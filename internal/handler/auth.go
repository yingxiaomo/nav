package handler

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"log/slog"
	"net"
	"net/http"
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

func ipFromRemote(addr string) string {
	if host, _, err := net.SplitHostPort(addr); err == nil {
		return host
	}
	return addr
}

// StartLoginAttemptsCleanup 定期清理过期的登录尝试记录
func StartLoginAttemptsCleanup(ctx context.Context) {
	go func() {
		ticker := time.NewTicker(30 * time.Minute)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				loginAttemptsMu.Lock()
				now := time.Now().UnixMilli()
				for ip, entry := range loginAttempts {
					if entry.until > 0 && entry.until < now {
						delete(loginAttempts, ip)
					}
				}
				loginAttemptsMu.Unlock()
			case <-ctx.Done():
				return
			}
		}
	}()
}

func isSecureRequest(r *http.Request) bool {
	if r.Header.Get("X-Forwarded-Proto") == "https" {
		return true
	}
	return r.TLS != nil
}

func checkSession(r *http.Request, db *sql.DB) (string, bool) {
	cookie, err := r.Cookie(session.CookieName)
	if err != nil {
		return "", false
	}
	sessionSecret, _ := queries.GetSetting(r.Context(), db, "session_secret")
	if sessionSecret == "" {
		return "", false
	}
	uid := session.Verify(cookie.Value, sessionSecret)
	return uid, uid != ""
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
			Username string `json:"username"`
			Password string `json:"password"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			model.RespondError(w, http.StatusBadRequest, "请求体格式错误")
			return
		}
		if body.Username == "" || body.Password == "" {
			model.RespondError(w, http.StatusBadRequest, "请输入用户名和密码")
			return
		}

		ip := ipFromRemote(r.RemoteAddr)

		if !checkRateLimit(ip) {
			slog.Warn("登录限流", "ip", ip)
			model.RespondError(w, http.StatusTooManyRequests, "登录尝试过于频繁，请 15 分钟后再试")
			return
		}

		user, err := queries.GetUserByUsername(r.Context(), db, body.Username)
		if err != nil {
			slog.Error("查询用户失败", "error", err)
			model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
			return
		}
		if user == nil {
			recordLoginAttempt(ip, false)
			slog.Warn("登录失败 - 用户不存在", "ip", ip, "username", body.Username)
			model.RespondError(w, http.StatusUnauthorized, "用户名或密码错误")
			return
		}

		if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(body.Password)); err != nil {
			recordLoginAttempt(ip, false)
			slog.Warn("登录失败 - 密码错误", "ip", ip, "username", body.Username)
			model.RespondError(w, http.StatusUnauthorized, "用户名或密码错误")
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

		cookieValue := session.Sign(user.ID, secret)
		setSessionCookie(w, cookieValue, isSecureRequest(r))

		slog.Info("登录成功", "ip", ip, "username", body.Username)
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

// Setup handles POST /api/v1/auth/setup — initial admin account creation
func (h *Handler) Setup() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		db := h.DB

		count, err := queries.GetUserCount(r.Context(), db)
		if err != nil {
			slog.Error("查询用户数失败", "error", err)
			model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
			return
		}
		if count > 0 {
			model.RespondError(w, http.StatusBadRequest, "管理员账号已配置，不能重复初始化")
			return
		}

		var body struct {
			Username string `json:"username"`
			Password string `json:"password"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			model.RespondError(w, http.StatusBadRequest, "请求体格式错误")
			return
		}
		if body.Username == "" {
			model.RespondError(w, http.StatusBadRequest, "请输入用户名")
			return
		}
		if len(body.Username) < 2 {
			model.RespondError(w, http.StatusBadRequest, "用户名至少 2 个字符")
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
		if err := queries.CreateUser(r.Context(), db, model.NewID(), body.Username, string(hashed), model.Now()); err != nil {
			slog.Error("创建用户失败", "error", err)
			model.RespondError(w, http.StatusInternalServerError, "创建用户失败，用户名可能已存在")
			return
		}

		slog.Info("管理员初始化完成", "username", body.Username)
		model.RespondJSON(w, http.StatusCreated, map[string]any{"success": true})
	}
}

// AuthStatus handles GET /api/v1/auth/status
func (h *Handler) AuthStatus() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		count, _ := queries.GetUserCount(r.Context(), h.DB)
		_, loggedIn := checkSession(r, h.DB)

		model.RespondJSON(w, http.StatusOK, map[string]any{
			"setupRequired": count == 0,
			"loggedIn":      loggedIn,
		})
	}
}

// ChangePassword handles POST /api/v1/auth/change-password
func (h *Handler) ChangePassword() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		db := h.DB

		if !checkRateLimit(r.RemoteAddr) {
			slog.Warn("修改密码限流", "ip", r.RemoteAddr)
			model.RespondError(w, http.StatusTooManyRequests, "操作过于频繁，请 15 分钟后再试")
			return
		}

		uid, loggedIn := checkSession(r, db)
		if !loggedIn || uid == "" {
			model.RespondError(w, http.StatusUnauthorized, "请先登录")
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

		// 直接用 uid 查用户
		var pwHash string
		err := db.QueryRowContext(r.Context(), `SELECT password_hash FROM users WHERE id = ?`, uid).Scan(&pwHash)
		if err != nil {
			slog.Error("查询用户密码失败", "error", err)
			model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
			return
		}

		if err := bcrypt.CompareHashAndPassword([]byte(pwHash), []byte(body.CurrentPassword)); err != nil {
			recordLoginAttempt(r.RemoteAddr, false)
			slog.Warn("修改密码 - 当前密码错误", "ip", r.RemoteAddr)
			model.RespondError(w, http.StatusForbidden, "当前密码错误")
			return
		}

		recordLoginAttempt(r.RemoteAddr, true)

		newHash, err := bcrypt.GenerateFromPassword([]byte(body.NewPassword), bcrypt.DefaultCost)
		if err != nil {
			slog.Error("密码哈希失败", "error", err)
			model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
			return
		}
		if err := queries.UpdateUserPassword(r.Context(), db, uid, string(newHash)); err != nil {
			slog.Error("更新密码失败", "error", err)
			model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
			return
		}

		secret := generateSessionSecret()
		if err := queries.SetSetting(r.Context(), db, "session_secret", secret); err != nil {
			slog.Error("轮换会话密钥失败", "error", err)
			model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
			return
		}

		slog.Info("密码修改成功", "uid", uid)
		model.RespondJSON(w, http.StatusOK, map[string]any{
			"success": true,
			"message": "密码已修改，请重新登录",
		})
	}
}
