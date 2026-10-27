package handler

import (
	"log/slog"
	"net/http"

	"github.com/YingXiaoMo/nav/internal/db/queries"
	"github.com/YingXiaoMo/nav/internal/model"
	"github.com/YingXiaoMo/nav/internal/remote"
)

var protectedSettings = map[string]bool{
	"session_secret": true,
}

func (h *Handler) ListSettings() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		settings, err := queries.GetAllSettings(r.Context(), h.DB)
		if err != nil {
			slog.Error("获取设置列表失败", "error", err)
			model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
			return
		}
		// 保护键（session_secret 等）设为 write-only：拿到它就能离线伪造任意会话，
		// 不应随设置列表下发（前端无任何读取该键的场景）
		for key := range protectedSettings {
			delete(settings, key)
		}
		model.RespondJSON(w, http.StatusOK, settings)
	}
}

func (h *Handler) GetSetting() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		db := h.DB
		key := r.PathValue("key")

		// 保护键 write-only：只回显键存在、值为空
		if protectedSettings[key] {
			model.RespondJSON(w, http.StatusOK, map[string]string{"key": key, "value": ""})
			return
		}

		value, err := queries.GetSetting(r.Context(), db, key)
		if err != nil {
			slog.Error("获取设置失败", "error", err, "key", key)
			model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
			return
		}
		if value == "" {
			all, err := queries.GetAllSettings(r.Context(), db)
			if err != nil {
				slog.Error("获取所有设置失败", "error", err)
				model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
				return
			}
			if _, exists := all[key]; !exists {
				model.RespondJSON(w, http.StatusOK, map[string]string{"key": key, "value": ""})
				return
			}
		}

		model.RespondJSON(w, http.StatusOK, map[string]string{"key": key, "value": value})
	}
}

func (h *Handler) UpdateSettings() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		db := h.DB

		var body map[string]string
		if !model.DecodeJSON(r, &body) {
			model.RespondError(w, http.StatusBadRequest, "请求体格式错误")
			return
		}

		tx, err := db.BeginTx(r.Context(), nil)
		if err != nil {
			slog.Error("开启事务失败", "error", err)
			model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
			return
		}
		defer tx.Rollback()

		stmt, err := tx.PrepareContext(r.Context(),
			"INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?")
		if err != nil {
			slog.Error("准备语句失败", "error", err)
			model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
			return
		}
		defer stmt.Close()

		for key, value := range body {
			if protectedSettings[key] {
				slog.Warn("跳过保护键", "key", key)
				continue
			}
			// 设备配置含 SSH 明文密码：写入前对密码字段做静态加密（配置 NAV_SECRET_KEY 时生效）
			if key == "device_config" {
				value = remote.EncryptDeviceConfigJSON(value)
			}
			if _, err := stmt.ExecContext(r.Context(), key, value, value); err != nil {
				slog.Error("批量更新设置失败", "error", err, "key", key)
				model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
				return
			}
		}

		if err := tx.Commit(); err != nil {
			slog.Error("提交事务失败", "error", err)
			model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
			return
		}

		// Bot/AI 配置变更需重启进程生效（启动时读取；TG Bot 不做热重载，
		// 避免为一次性场景维护 goroutine 生命周期）
		if _, hasBot := body["bot_config"]; hasBot {
			slog.Info("TG Bot 配置已更新，重启后生效")
		}
		model.RespondJSON(w, http.StatusOK, map[string]any{"success": true})
	}
}

func (h *Handler) UpdateSetting() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		key := r.PathValue("key")

		if protectedSettings[key] {
			model.RespondError(w, http.StatusForbidden, "不允许修改系统内部配置")
			return
		}

		var body struct {
			Value string `json:"value"`
		}
		if !model.DecodeJSON(r, &body) {
			model.RespondError(w, http.StatusBadRequest, "请求体格式错误")
			return
		}

		if err := queries.SetSetting(r.Context(), h.DB, key, body.Value); err != nil {
			slog.Error("更新设置失败", "error", err, "key", key)
			model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
			return
		}

		model.RespondJSON(w, http.StatusOK, map[string]any{"success": true})
	}
}
