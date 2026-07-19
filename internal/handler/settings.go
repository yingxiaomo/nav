package handler

import (
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/YingXiaoMo/nav/internal/db/queries"
	"github.com/YingXiaoMo/nav/internal/model"
	"github.com/YingXiaoMo/nav/internal/tgbot"
)

var protectedSettings = map[string]bool{
	"admin_password_hash": true,
	"session_secret":      true,
}

func (h *Handler) ListSettings() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		settings, err := queries.GetAllSettings(r.Context(), h.DB)
		if err != nil {
			slog.Error("获取设置列表失败", "error", err)
			model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
			return
		}
		model.RespondJSON(w, http.StatusOK, settings)
	}
}

func (h *Handler) GetSetting() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		db := h.DB
		key := r.PathValue("key")

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
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
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

		// 如果更新了 Bot 配置，热重载
		if botCfg, hasBot := body["bot_config"]; hasBot && h.TGBot != nil {
			h.TGBot.Stop()
			var bc tgbot.BotConfig
			if json.Unmarshal([]byte(botCfg), &bc) == nil && bc.Token != "" {
				newBot := tgbot.NewBot(bc)
				cmdHandler := &tgbot.CmdHandler{
					Devices: h.DeviceMgr,
					DB:      h.DB,
				}
				// 读取 AI 配置
				var aiCfg tgbot.LLMConfig
				if aiRaw, ok := body["ai_config"]; ok && aiRaw != "" {
					json.Unmarshal([]byte(aiRaw), &aiCfg)
					cmdHandler.LLM = aiCfg
				}
				newBot.Start(cmdHandler)
				h.TGBot = newBot
				slog.Info("TG Bot 已热重载")
			}
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
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
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
