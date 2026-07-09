package middleware

import (
	"crypto/subtle"
	"database/sql"
	"log/slog"
	"net/http"
	"strings"

	"github.com/YingXiaoMo/nav/internal/model"
)

// Auth returns middleware that verifies Bearer API tokens on non-same-origin
// requests to API routes. The middleware skips verification for:
//   - /api/v1/health
//   - OPTIONS requests
//   - /api/v1/auth/* and /api/v1/admin/* (handled by admin middleware)
//   - Same-origin requests (Host header matches Origin or Referer)
func Auth(database *sql.DB) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			path := r.URL.Path

			// Health check and CORS preflight — always allowed
			if path == "/api/v1/health" || r.Method == http.MethodOptions {
				next.ServeHTTP(w, r)
				return
			}

			// Auth and admin routes are protected by the admin middleware
			if strings.HasPrefix(path, "/api/v1/auth/") || strings.HasPrefix(path, "/api/v1/admin/") {
				next.ServeHTTP(w, r)
				return
			}

			// Same-origin check: if the request comes from the same server,
			// it is from the frontend UI and does not need a token.
			host := r.Host
			origin := r.Header.Get("Origin")
			referer := r.Header.Get("Referer")

			isSameOrigin := (origin != "" && (strings.Contains(origin, "://"+host) || strings.Contains(origin, "://localhost"))) ||
				(referer != "" && (strings.Contains(referer, "://"+host) || strings.Contains(referer, "://localhost")))
			if isSameOrigin {
				next.ServeHTTP(w, r)
				return
			}

			// All other requests must present a Bearer token
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
				model.RespondError(w, http.StatusUnauthorized, "缺少 Authorization 头，格式: Bearer <api-token>")
				return
			}
			token := strings.TrimPrefix(authHeader, "Bearer ")

			// Look up the API token from the database
			var apiToken string
			err := database.QueryRowContext(r.Context(), "SELECT value FROM settings WHERE key = 'api_token'").Scan(&apiToken)
			if err != nil {
				slog.Warn("API token not configured in database", "error", err)
				model.RespondError(w, http.StatusServiceUnavailable, "服务未初始化，请先配置 API 令牌")
				return
			}

			if subtle.ConstantTimeCompare([]byte(token), []byte(apiToken)) != 1 {
				model.RespondError(w, http.StatusUnauthorized, "API 令牌无效")
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
