package handler

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"

	"github.com/YingXiaoMo/nav/internal/db/queries"
	"github.com/YingXiaoMo/nav/internal/model"
	"github.com/YingXiaoMo/nav/internal/tgbot"
)

// AIChat handles POST /api/v1/ai/chat — 快速问答，无上下文
func (h *Handler) AIChat() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Message string `json:"message"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Message == "" {
			model.RespondError(w, http.StatusBadRequest, "请输入消息内容")
			return
		}
		if len(body.Message) > 4000 {
			model.RespondError(w, http.StatusBadRequest, "消息过长，最多 4000 字符")
			return
		}

		cfg, err := loadLLMConfig(r.Context(), h.DB)
		if err != nil {
			slog.Error("加载 AI 配置失败", "error", err)
			model.RespondError(w, http.StatusInternalServerError, "AI 未配置")
			return
		}
		if cfg.APIKey == "" {
			model.RespondError(w, http.StatusBadRequest, "AI 未配置，请在设置中填写 API Key")
			return
		}

		reply, err := tgbot.CallLLM(cfg, body.Message)
		if err != nil {
			slog.Error("AI 调用失败", "error", err)
			model.RespondError(w, http.StatusInternalServerError, "AI 调用失败: "+err.Error())
			return
		}

		model.RespondJSON(w, http.StatusOK, map[string]any{"reply": reply})
	}
}

// AIConversation handles POST /api/v1/ai/conversation — 深度对话，带上下文
func (h *Handler) AIConversation() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Message string `json:"message"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Message == "" {
			model.RespondError(w, http.StatusBadRequest, "请输入消息内容")
			return
		}
		if len(body.Message) > 4000 {
			model.RespondError(w, http.StatusBadRequest, "消息过长，最多 4000 字符")
			return
		}

		cfg, err := loadLLMConfig(r.Context(), h.DB)
		if err != nil {
			slog.Error("加载 AI 配置失败", "error", err)
			model.RespondError(w, http.StatusInternalServerError, "AI 未配置")
			return
		}
		if cfg.APIKey == "" {
			model.RespondError(w, http.StatusBadRequest, "AI 未配置，请在设置中填写 API Key")
			return
		}

		// 用 IP 作为用户标识（简化版，不需要 cookie 登录）
		userID := r.RemoteAddr
		reply := tgbot.CallLLMWithContext(cfg, userID, body.Message)

		model.RespondJSON(w, http.StatusOK, map[string]any{"reply": reply})
	}
}

// loadLLMConfig 从 settings 表加载 AI 配置
func loadLLMConfig(ctx context.Context, db *sql.DB) (tgbot.LLMConfig, error) {
	raw, err := queries.GetSetting(ctx, db, "ai_config")
	if err != nil || raw == "" {
		return tgbot.LLMConfig{}, fmt.Errorf("AI 未配置")
	}
	var cfg tgbot.LLMConfig
	if err := json.Unmarshal([]byte(raw), &cfg); err != nil {
		return tgbot.LLMConfig{}, err
	}
	if cfg.BaseURL == "" {
		cfg.BaseURL = "https://api.openai.com/v1"
	}
	if cfg.Model == "" {
		cfg.Model = "gpt-4o-mini"
	}
	return cfg, nil
}
