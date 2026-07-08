package middleware

import (
	"context"
	"crypto/subtle"
	"database/sql"
	"net/http"
	"strings"

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

// Admin returns middleware that protects admin and auth API routes.
// It checks for a valid session cookie or falls back to Bearer token auth.
//
// Session cookie format: base64("userID:expiresAtUnixMs") + "." + hmac_hex
// The HMAC is computed over "userID:expiresAtUnixMs" using the session_secret
// from the database settings table.
func Admin(database *sql.DB) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			path := r.URL.Path

			// Unauthenticated public endpoints
			if isPublicPath(path) {
				next.ServeHTTP(w, r)
				return
			}

			// Read-only monitor and Docker container endpoints are public
			if r.Method == http.MethodGet {
				if strings.HasPrefix(path, "/api/v1/admin/monitor/") ||
					path == "/api/v1/admin/docker/containers" ||
					path == "/api/v1/admin/docker/stats" {
					next.ServeHTTP(w, r)
					return
				}
			}

			// POST /fetch-icon, /start, /stop, /restart (used by monitoring panel) are public
			if r.Method == http.MethodPost &&
				(strings.HasSuffix(path, "/fetch-icon") ||
					strings.HasSuffix(path, "/start") ||
					strings.HasSuffix(path, "/stop") ||
					strings.HasSuffix(path, "/restart")) {
				next.ServeHTTP(w, r)
				return
			}

			// Docker metadata read/write is public (non-sensitive preferences)
			if strings.HasPrefix(path, "/api/v1/admin/docker/metadata") {
				next.ServeHTTP(w, r)
				return
			}

			// --- Authenticated paths below ---

			// Try Bearer token first (used by widgets and non-browser clients)
			authHeader := r.Header.Get("Authorization")
			if authHeader != "" && strings.HasPrefix(authHeader, "Bearer ") {
				token := strings.TrimPrefix(authHeader, "Bearer ")
				if verifyAPIToken(r, database, token) {
					next.ServeHTTP(w, r)
					return
				}
				// Invalid token — do not fall through to cookie check; fail immediately.
				model.RespondError(w, http.StatusUnauthorized, "API 令牌无效")
				return
			}

			// Try session cookie
			cookie, err := r.Cookie(session.CookieName)
			if err != nil {
				model.RespondError(w, http.StatusUnauthorized, "未登录，请先登录管理后台")
				return
			}

			// Read session_secret from database
			sessionSecret := getSetting(r.Context(), database, "session_secret")
			if sessionSecret != "" && session.Verify(cookie.Value, sessionSecret) {
				next.ServeHTTP(w, r)
				return
			}

			// Legacy compatibility: verify cookie with API token as HMAC secret
			apiToken := getSetting(r.Context(), database, "api_token")
			if apiToken != "" && session.Verify(cookie.Value, apiToken) {
				next.ServeHTTP(w, r)
				return
			}

			model.RespondError(w, http.StatusUnauthorized, "会话已过期，请重新登录")
		})
	}
}


// verifyAPIToken checks the Authorization Bearer token against the stored api_token.
func verifyAPIToken(r *http.Request, database *sql.DB, token string) bool {
	var apiToken string
	err := database.QueryRowContext(r.Context(), "SELECT value FROM settings WHERE key = 'api_token'").Scan(&apiToken)
	if err != nil || apiToken == "" {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(token), []byte(apiToken)) == 1
}

// getSetting reads a string value from the settings table by key.
func getSetting(ctx context.Context, database *sql.DB, key string) string {
	var value string
	err := database.QueryRowContext(ctx, "SELECT value FROM settings WHERE key = ?", key).Scan(&value)
	if err != nil {
		return ""
	}
	return value
}
