package middleware

import (
	"database/sql"
	"net/http"

	"github.com/YingXiaoMo/nav/internal/db/queries"
	"github.com/YingXiaoMo/nav/internal/model"
	"github.com/YingXiaoMo/nav/internal/session"
)

// publicPaths are endpoints that do not require any authentication.
var publicPaths = []string{
	"/api/v1/auth/login",
	"/api/v1/auth/setup",
	"/api/v1/auth/status",
	"/api/v1/health",
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

// SessionAuth returns middleware that protects admin and API routes with session cookie auth.
//
// Session cookie format: base64("userID:expiresAtUnixMs") + "." + hmac_hex
// The HMAC is computed over "userID:expiresAtUnixMs" using the session_secret
// from the database settings table.
//
// Strategy:
// - GET requests are always allowed (read-only)
// - Public paths (login/setup/health) are always allowed
// - All other requests require a valid session cookie
func SessionAuth(database *sql.DB) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			path := r.URL.Path

			// Public endpoints and health check — always allowed
			if isPublicPath(path) || r.Method == http.MethodOptions {
				next.ServeHTTP(w, r)
				return
			}

			// GET requests are read-only — always allowed
			if r.Method == http.MethodGet {
				next.ServeHTTP(w, r)
				return
			}

			// Everything else (POST/PUT/DELETE/PATCH) requires authentication
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
