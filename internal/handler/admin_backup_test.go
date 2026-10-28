package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

// 回归锁定：备份导入不得丢失 session_secret。
// 历史 bug：导入先 DELETE 全部 settings，body.Settings 跳过保护键后，
// "保留现有设置"循环又因备份文件（Go 导出含 session_secret）里存在该键
// 而跳过恢复 → 导入完成即全员会话失效。
func TestImportBackup_PreservesSessionSecret(t *testing.T) {
	h := setupHandler(t)

	seed := `INSERT INTO settings (key, value) VALUES ('session_secret', 'orig-secret'), ('bot_config', '{"token":"keep"}')`
	if _, err := h.DB.Exec(seed); err != nil {
		t.Fatalf("seed settings: %v", err)
	}

	body := map[string]any{
		"version":  1,
		"settings": map[string]string{"session_secret": "evil-override", "title": "Imported Title"},
	}
	payload, _ := json.Marshal(body)
	req := httptest.NewRequest("POST", "/api/v1/admin/backup", bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	h.ImportBackup()(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var secret string
	if err := h.DB.QueryRow(`SELECT value FROM settings WHERE key='session_secret'`).Scan(&secret); err != nil {
		t.Fatalf("session_secret 查询失败（疑似被删）: %v", err)
	}
	if secret != "orig-secret" {
		t.Errorf("session_secret 被覆盖为 %q —— 导入必须以导入前的现值保留保护键", secret)
	}

	var title string
	if err := h.DB.QueryRow(`SELECT value FROM settings WHERE key='title'`).Scan(&title); err != nil {
		t.Fatalf("title 查询失败: %v", err)
	}
	if title != "Imported Title" {
		t.Errorf("备份提供的普通键应正常导入, got %q", title)
	}

	var botCfg string
	if err := h.DB.QueryRow(`SELECT value FROM settings WHERE key='bot_config'`).Scan(&botCfg); err != nil {
		t.Fatalf("bot_config 查询失败: %v", err)
	}
	if botCfg != `{"token":"keep"}` {
		t.Errorf("未随备份提供的现有键应保留, got %q", botCfg)
	}
}
