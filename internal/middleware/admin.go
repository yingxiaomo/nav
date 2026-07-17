package middleware

import (
	"database/sql"
	"net/http"
	"strings"

	"github.com/YingXiaoMo/nav/internal/db/queries"
	"github.com/YingXiaoMo/nav/internal/model"
	"github.com/YingXiaoMo/nav/internal/session"
)

// publicPaths are endpoints that do not require any authentication.
var publicPaths = []string{
	"/api/v1/auth/login",
	"/api/v1/auth/setup",
	"/api/v1/auth/status",
}

// isPublicPath checks whether the given path is in the public whitelist.
func isPublicPath(path string) bool {
	for _, p := range publicPaths {
		if path == p {
			return true
		}
	}
	return false
}

// Admin returns middleware that protects admin and API routes with session cookie auth.
//
// Session cookie format: base64("userID:expiresAtUnixMs") + "." + hmac_hex
// The HMAC is computed over "userID:expiresAtUnixMs" using the session_secret
// from the database settings table.
func Admin(database *sql.DB) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			path := r.URL.Path

			// Public endpoints
			if isPublicPath(path) {
				next.ServeHTTP(w, r)
				return
			}

			// Health check and CORS preflight — always allowed
			if path == "/api/v1/health" || r.Method == http.MethodOptions {
				next.ServeHTTP(w, r)
				return
			}

			// Monitor and Docker read-only endpoints are public
			if r.Method == http.MethodGet {
				if strings.HasPrefix(path, "/api/v1/admin/monitor/") ||
					strings.HasPrefix(path, "/api/v1/admin/docker/") {
					next.ServeHTTP(w, r)
					return
				}
			}

			// Docker actions (used by monitoring panel) are public
			if r.Method == http.MethodPost &&
				(strings.HasSuffix(path, "/start") ||
					strings.HasSuffix(path, "/stop") ||
					strings.HasSuffix(path, "/restart")) {
				next.ServeHTTP(w, r)
				return
			}

			// Check session cookie
			cookie, err := r.Cookie(session.CookieName)
			if err != nil {
				model.RespondError(w, http.StatusUnauthorized, "未登录，请先登录管理后台")
				return
			}

			sessionSecret, _ := queries.GetSetting(r.Context(), database, "session_secret")
			if sessionSecret != "" && session.Verify(cookie.Value, sessionSecret) {
				next.ServeHTTP(w, r)
				return
			}

			model.RespondError(w, http.StatusUnauthorized, "会话已过期，请重新登录")
		})
	}
}
