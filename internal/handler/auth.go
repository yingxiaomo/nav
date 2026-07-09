package handler

import (
	"crypto/rand"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"log/slog"
	"net/http"
	"strings"
	"sync"
	"time"

	"golang.org/x/crypto/bcrypt"

	"github.com/YingXiaoMo/nav/internal/db/queries"
	"github.com/YingXiaoMo/nav/internal/model"
	"github.com/YingXiaoMo/nav/internal/session"
)

// ===== Session helpers =====

func generateSessionSecret() string {
	b := make([]byte, 32)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func setSessionCookie(w http.ResponseWriter, value string, secure bool) {
	http.SetCookie(w, &http.Cookie{
		Name:     session.CookieName,
		Value:    value,
		Path:     "/",
		HttpOnly: true,
		Secure:   secure,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   86400 * 7,
	})
}

func clearSessionCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     session.CookieName,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		MaxAge:   -1,
	})
}

func isSecureRequest(r *http.Request) bool {
	if r.Header.Get("X-Forwarded-Proto") == "https" {
		return true
	}
	return r.TLS != nil
}

func checkSession(r *http.Request, db *sql.DB) bool {
	cookie, err := r.Cookie(session.CookieName)
	if err != nil {
		return false
	}
	sessionSecret, _ := queries.GetSetting(r.Context(), db, "session_secret")
	if sessionSecret != "" && session.Verify(cookie.Value, sessionSecret) {
		return true
	}
	apiToken, _ := queries.GetSetting(r.Context(), db, "api_token")
	if apiToken != "" && session.Verify(cookie.Value, apiToken) {
		return true
	}
	return false
}

func generateAPIToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return "sk-" + base64.RawURLEncoding.EncodeToString(b), nil
}

// ===== Rate limiting for login =====

type loginAttempt struct {
	count int
	until int64
}

var (
	loginAttemptsMu sync.Mutex
	loginAttempts   = map[string]*loginAttempt{}
)

const maxAttempts = 5
const blockDuration = 15 * time.Minute

func checkRateLimit(ip string) bool {
	loginAttemptsMu.Lock()
	defer loginAttemptsMu.Unlock()
	now := time.Now().UnixMilli()
	entry, exists := loginAttempts[ip]
	if exists && entry.until > now {
		return false
	}
	if exists && entry.until <= now {
		delete(loginAttempts, ip)
	}
	return true
}

func recordLoginAttempt(ip string, success bool) {
	loginAttemptsMu.Lock()
	defer loginAttemptsMu.Unlock()
	now := time.Now().UnixMilli()
	if success {
		delete(loginAttempts, ip)
		return
	}
	entry, exists := loginAttempts[ip]
	if !exists {
		entry = &loginAttempt{until: now}
		loginAttempts[ip] = entry
	}
	entry.count++
	if entry.count >= maxAttempts {
		entry.until = now + blockDuration.Milliseconds()
		entry.count = 0
	}
}

// ===== Handlers =====

// Login handles POST /api/v1/auth/login
func (h *Handler) Login() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		db := h.DB

		var body struct {
			Password string `json:"password"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			model.RespondError(w, http.StatusBadRequest, "请求体格式错误")
			return
		}
		if body.Password == "" {
			model.RespondError(w, http.StatusBadRequest, "请输入管理员密码")
			return
		}

		ip := r.RemoteAddr
		if fwd := r.Header.Get("X-Forwarded-For"); fwd != "" {
			if idx := strings.Index(fwd, ","); idx != -1 {
				ip = strings.TrimSpace(fwd[:idx])
			} else {
				ip = strings.TrimSpace(fwd)
			}
		}

		pwHash, err := queries.GetSetting(r.Context(), db, "admin_password_hash")
		if err != nil {
			slog.Error("读取密码设置失败", "error", err)
			model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
			return
		}
		if pwHash == "" {
			model.RespondJSON(w, http.StatusBadRequest, map[string]any{
				"error":         "管理员密码未配置，请先完成初始化",
				"setupRequired": true,
			})
			return
		}

		if !checkRateLimit(ip) {
			slog.Warn("登录限流", "ip", ip)
			model.RespondError(w, http.StatusTooManyRequests, "登录尝试过于频繁，请 15 分钟后再试")
			return
		}

		if err := bcrypt.CompareHashAndPassword([]byte(pwHash), []byte(body.Password)); err != nil {
			recordLoginAttempt(ip, false)
			slog.Warn("登录失败 - 密码错误", "ip", ip)
			model.RespondError(w, http.StatusUnauthorized, "密码错误")
			return
		}

		recordLoginAttempt(ip, true)

		secret, _ := queries.GetSetting(r.Context(), db, "session_secret")
		if secret == "" {
			secret = generateSessionSecret()
			if err := queries.SetSetting(r.Context(), db, "session_secret", secret); err != nil {
				slog.Error("保存会话密钥失败", "error", err)
				model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
				return
			}
		}

		cookieValue := session.Sign("admin", secret)
		setSessionCookie(w, cookieValue, isSecureRequest(r))

		slog.Info("登录成功", "ip", ip)
		model.RespondJSON(w, http.StatusOK, map[string]any{"success": true})
	}
}

// Logout handles POST /api/v1/auth/logout
func (h *Handler) Logout() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		secret := generateSessionSecret()
		if err := queries.SetSetting(r.Context(), h.DB, "session_secret", secret); err != nil {
			slog.Error("轮换会话密钥失败", "error", err)
			model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
			return
		}
		clearSessionCookie(w)
		model.RespondJSON(w, http.StatusOK, map[string]any{"success": true})
	}
}

// Setup handles POST /api/v1/auth/setup — initial password and API token creation
func (h *Handler) Setup() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		db := h.DB

		pwHash, err := queries.GetSetting(r.Context(), db, "admin_password_hash")
		if err != nil {
			slog.Error("读取密码设置失败", "error", err)
			model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
			return
		}
		if pwHash != "" {
			model.RespondError(w, http.StatusBadRequest, "管理员密码已配置，不能重复初始化")
			return
		}

		var body struct {
			Password string `json:"password"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			model.RespondError(w, http.StatusBadRequest, "请求体格式错误")
			return
		}
		if len(body.Password) < 6 {
			model.RespondError(w, http.StatusBadRequest, "密码至少 6 位")
			return
		}

		hashed, err := bcrypt.GenerateFromPassword([]byte(body.Password), bcrypt.DefaultCost)
		if err != nil {
			slog.Error("密码哈希失败", "error", err)
			model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
			return
		}
		if err := queries.SetSetting(r.Context(), db, "admin_password_hash", string(hashed)); err != nil {
			slog.Error("保存密码失败", "error", err)
			model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
			return
		}

		token, err := generateAPIToken()
		if err != nil {
			slog.Error("生成 API token 失败", "error", err)
			model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
			return
		}
		if err := queries.SetSetting(r.Context(), db, "api_token", token); err != nil {
			slog.Error("保存 API token 失败", "error", err)
			model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
			return
		}

		slog.Info("管理员初始化完成")
		model.RespondJSON(w, http.StatusCreated, map[string]any{"success": true})
	}
}

// AuthStatus handles GET /api/v1/auth/status
func (h *Handler) AuthStatus() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		pwHash, _ := queries.GetSetting(r.Context(), h.DB, "admin_password_hash")
		apiToken, _ := queries.GetSetting(r.Context(), h.DB, "api_token")

		model.RespondJSON(w, http.StatusOK, map[string]any{
			"setupRequired":   pwHash == "",
			"tokenConfigured": apiToken != "",
			"loggedIn":        checkSession(r, h.DB),
		})
	}
}

// GetAPIToken handles GET /api/v1/auth/api-token
func (h *Handler) GetAPIToken() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		token, err := queries.GetSetting(r.Context(), h.DB, "api_token")
		if err != nil {
			slog.Error("读取 API token 失败", "error", err)
			model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
			return
		}
		model.RespondJSON(w, http.StatusOK, map[string]any{"token": token})
	}
}

// RegenerateAPIToken handles POST /api/v1/auth/api-token
func (h *Handler) RegenerateAPIToken() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		token, err := generateAPIToken()
		if err != nil {
			slog.Error("生成 API token 失败", "error", err)
			model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
			return
		}
		if err := queries.SetSetting(r.Context(), h.DB, "api_token", token); err != nil {
			slog.Error("保存 API token 失败", "error", err)
			model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
			return
		}

		slog.Info("API token 已重新生成")
		model.RespondJSON(w, http.StatusOK, map[string]any{
			"success": true,
			"token":   token,
			"message": "API 令牌已重新生成，前端需要使用新令牌连接",
		})
	}
}

// ChangePassword handles POST /api/v1/auth/change-password
func (h *Handler) ChangePassword() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		db := h.DB
		ip := r.RemoteAddr
		if fwd := r.Header.Get("X-Forwarded-For"); fwd != "" {
			if idx := strings.Index(fwd, ","); idx != -1 {
				ip = strings.TrimSpace(fwd[:idx])
			} else {
				ip = strings.TrimSpace(fwd)
			}
		}

		if !checkRateLimit(ip) {
			slog.Warn("修改密码限流", "ip", ip)
			model.RespondError(w, http.StatusTooManyRequests, "操作过于频繁，请 15 分钟后再试")
			return
		}

		var body struct {
			CurrentPassword string `json:"currentPassword"`
			NewPassword     string `json:"newPassword"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			model.RespondError(w, http.StatusBadRequest, "请求体格式错误")
			return
		}
		if body.CurrentPassword == "" {
			model.RespondError(w, http.StatusBadRequest, "请输入当前密码")
			return
		}
		if len(body.NewPassword) < 6 {
			model.RespondError(w, http.StatusBadRequest, "新密码至少 6 位")
			return
		}

		pwHash, err := queries.GetSetting(r.Context(), db, "admin_password_hash")
		if err != nil {
			slog.Error("读取密码失败", "error", err)
			model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
			return
		}
		if err := bcrypt.CompareHashAndPassword([]byte(pwHash), []byte(body.CurrentPassword)); err != nil {
			recordLoginAttempt(ip, false)
			slog.Warn("修改密码 - 当前密码错误", "ip", ip)
			model.RespondError(w, http.StatusForbidden, "当前密码错误")
			return
		}

		recordLoginAttempt(ip, true)

		newHash, err := bcrypt.GenerateFromPassword([]byte(body.NewPassword), bcrypt.DefaultCost)
		if err != nil {
			slog.Error("密码哈希失败", "error", err)
			model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
			return
		}
		if err := queries.SetSetting(r.Context(), db, "admin_password_hash", string(newHash)); err != nil {
			slog.Error("保存密码失败", "error", err)
			model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
			return
		}

		secret := generateSessionSecret()
		if err := queries.SetSetting(r.Context(), db, "session_secret", secret); err != nil {
			slog.Error("轮换会话密钥失败", "error", err)
			model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
			return
		}

		slog.Info("密码修改成功")
		model.RespondJSON(w, http.StatusOK, map[string]any{
			"success": true,
			"message": "密码已修改，请重新登录",
		})
	}
}
