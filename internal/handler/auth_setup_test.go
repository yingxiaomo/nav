package handler

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/YingXiaoMo/nav/internal/session"
)

// TestSetup_AutoLogin 验证首次初始化管理员后自动登录：响应应带 session cookie，
// 无需前端再单独调用一次 /auth/login。
func TestSetup_AutoLogin(t *testing.T) {
	h := setupHandler(t)

	req := httptest.NewRequest("POST", "/api/v1/auth/setup",
		strings.NewReader(`{"username":"admin","password":"secret123"}`))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	h.Setup()(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", rec.Code, rec.Body.String())
	}
	var found bool
	for _, c := range rec.Result().Cookies() {
		if c.Name == session.CookieName && c.Value != "" {
			found = true
		}
	}
	if !found {
		t.Error("setup 后应自动签发 session cookie，未找到")
	}
}

// TestPutData_PreservesUnsentSettings 锁定"保存增量"语义：前端整包保存时只
// upsert 提交的设置键，绝不能覆盖/清除后台单独配置、且未随包提交的键
// （bot_config / device_config / session_secret 等）。历史上曾是全量覆盖导致丢配置。
func TestPutData_PreservesUnsentSettings(t *testing.T) {
	h := setupHandler(t)

	// 预置一个仅后台会配置、前端保存体不会携带的设置
	if _, err := h.DB.Exec(`INSERT INTO settings (key, value) VALUES (?, ?)`,
		"bot_config", `{"token":"keep-me"}`); err != nil {
		t.Fatalf("seed bot_config: %v", err)
	}

	// 前端保存：只带 settings.title
	req := httptest.NewRequest("PUT", "/api/v1/data",
		strings.NewReader(`{"settings":{"title":"新标题"}}`))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	h.PutData()(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("PUT expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var v string
	if err := h.DB.QueryRow(`SELECT value FROM settings WHERE key='bot_config'`).Scan(&v); err != nil {
		t.Fatalf("bot_config 查询失败（疑似被删）: %v", err)
	}
	if v != `{"token":"keep-me"}` {
		t.Errorf("bot_config 被覆盖：%q —— 保存应为增量，不动未提交的设置", v)
	}
}
