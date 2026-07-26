package middleware

import (
	"database/sql"
	"net/http"
	"strings"

	"github.com/YingXiaoMo/nav/internal/db/queries"
	"github.com/YingXiaoMo/nav/internal/model"
	"github.com/YingXiaoMo/nav/internal/session"
)

// publicPaths are endpoints that require no authentication for any method.
var publicPaths = []string{
	"/api/v1/auth/login",
	"/api/v1/auth/setup",
	"/api/v1/auth/status",
	"/api/v1/health",
}

// publicReadExact are endpoints served publicly on GET only — the data the
// navigation homepage renders for anonymous visitors. Everything not listed
// here (or in publicReadPrefixes) requires a valid session, regardless of
// HTTP method — i.e. the policy is default-deny.
var publicReadExact = map[string]bool{
	"/api/v1/data":              true, // 首页聚合数据（仅展示字段，无密钥）
	"/api/v1/suggest":           true, // 搜索建议
	"/api/v1/search":            true, // 聚合搜索
	"/api/v1/categories":        true,
	"/api/v1/bookmarks":         true,
	"/api/v1/todos":             true,
	"/api/v1/notes":             true,
	"/api/v1/admin/monitor/all": true, // 状态浮层（公开状态页；SSH 凭证已在处理器剥离）
}

// publicReadPrefixes covers the per-resource GET endpoints (…/{id}).
var publicReadPrefixes = []string{
	"/api/v1/categories/",
	"/api/v1/bookmarks/",
	"/api/v1/notes/",
}

// isPublicPath checks whether the given path is always public.
func isPublicPath(path string) bool {
	for _, p := range publicPaths {
		if path == p {
			return true
		}
	}
	return false
}

// isPublicRead checks whether the given path is public for GET requests.
func isPublicRead(path string) bool {
	if publicReadExact[path] {
		return true
	}
	for _, p := range publicReadPrefixes {
		if strings.HasPrefix(path, p) {
			return true
		}
	}
	return false
}

// SessionAuth returns middleware that protects the API with session cookie auth.
//
// Session cookie format: base64("userID:expiresAtUnixMs") + "." + hmac_hex
// The HMAC is computed over "userID:expiresAtUnixMs" using the session_secret
// from the database settings table.
//
// Strategy (default-deny):
//   - Public paths (login/setup/status/health) — always allowed
//   - Homepage read endpoints — allowed on GET only
//   - Everything else — requires a valid session cookie, regardless of method
//
// This closes the previous "all GET requests are public" hole, which exposed
// secret settings (session_secret, bot/ai/device configs) and the unauthenticated
// SSH WebSocket / SSRF endpoints to anyone who could reach the server.
func SessionAuth(database *sql.DB) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			path := r.URL.Path

			// Always-public endpoints and preflight
			if isPublicPath(path) || r.Method == http.MethodOptions {
				next.ServeHTTP(w, r)
				return
			}

			// Static frontend assets (anything not under /api/) are public on GET —
			// they carry no secrets; auth is enforced on the /api/ endpoints they call.
			// Without this the default-deny policy would lock anonymous visitors out of
			// the homepage itself (the public start page couldn't even load its HTML/JS).
			if r.Method == http.MethodGet && !strings.HasPrefix(path, "/api/") {
				next.ServeHTTP(w, r)
				return
			}

			// Public read endpoints — GET only
			if r.Method == http.MethodGet && isPublicRead(path) {
				next.ServeHTTP(w, r)
				return
			}

			// Everything else requires a valid session
			cookie, err := r.Cookie(session.CookieName)
			if err != nil {
				model.RespondError(w, http.StatusUnauthorized, "未登录，请先登录管理后台")
				return
			}

			sessionSecret, _ := queries.GetSetting(r.Context(), database, "session_secret")
			if sessionSecret == "" || session.Verify(cookie.Value, sessionSecret) == "" {
				model.RespondError(w, http.StatusUnauthorized, "会话已过期，请重新登录")
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
