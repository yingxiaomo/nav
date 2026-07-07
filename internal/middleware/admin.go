package middleware

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/YingXiaoMo/nav/internal/model"
)

const (
	sessionCookieName = "admin_web_session"
	sessionDuration   = 7 * 24 * time.Hour // 7 days, used when signing sessions
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
			cookie, err := r.Cookie(sessionCookieName)
			if err != nil {
				model.RespondError(w, http.StatusUnauthorized, "未登录，请先登录管理后台")
				return
			}

			// Read session_secret from database
			sessionSecret := getSetting(r.Context(), database, "session_secret")
			if sessionSecret != "" && verifySessionCookie(cookie.Value, sessionSecret) {
				next.ServeHTTP(w, r)
				return
			}

			// Legacy compatibility: verify cookie with API token as HMAC secret
			apiToken := getSetting(r.Context(), database, "api_token")
			if apiToken != "" && verifySessionCookie(cookie.Value, apiToken) {
				next.ServeHTTP(w, r)
				return
			}

			model.RespondError(w, http.StatusUnauthorized, "会话已过期，请重新登录")
		})
	}
}

// verifySessionCookie checks the session cookie format and HMAC signature.
// Format: base64("userID:expiresAtUnixMs") + "." + hmac_hex
func verifySessionCookie(cookieValue, secret string) bool {
	// Split on the last dot to separate the payload base64 from the HMAC hex
	dotIdx := strings.LastIndex(cookieValue, ".")
	if dotIdx < 0 {
		return false
	}
	payloadBase64 := cookieValue[:dotIdx]
	sigHex := cookieValue[dotIdx+1:]

	payloadBytes, err := base64.StdEncoding.DecodeString(payloadBase64)
	if err != nil {
		return false
	}
	payload := string(payloadBytes)

	// Split payload on ":" to get userID and expiresAt
	colonIdx := strings.LastIndex(payload, ":")
	if colonIdx < 0 {
		return false
	}
	expiresStr := payload[colonIdx+1:]

	expires, err := strconv.ParseInt(expiresStr, 10, 64)
	if err != nil || time.Now().UnixMilli() > expires {
		return false
	}

	// Verify HMAC: HMAC-SHA256(secret, payload)
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(payload))
	expectedHex := hex.EncodeToString(mac.Sum(nil))

	if subtle.ConstantTimeCompare([]byte(sigHex), []byte(expectedHex)) != 1 {
		return false
	}

	return true
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
