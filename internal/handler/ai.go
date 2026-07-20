package handler

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/YingXiaoMo/nav/internal/db/queries"
	"github.com/YingXiaoMo/nav/internal/model"
	"github.com/YingXiaoMo/nav/internal/service"
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
			model.RespondJSON(w, http.StatusOK, map[string]any{"reply": "AI 未配置，请在设置中填写 API Key"})
			return
		}

		// 自动附加监控数据上下文
		message := body.Message
		if ctx := h.collectMonitorContext(); ctx != "" && shouldIncludeMonitorData(message) {
			message = fmt.Sprintf("以下是当前监控数据：\n%s\n\n用户问题：%s", ctx, message)
		}

		reply, err := tgbot.CallLLM(cfg, message)
		if err != nil {
			model.RespondJSON(w, http.StatusOK, map[string]any{"reply": "AI 调用失败: " + err.Error()})
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
			model.RespondJSON(w, http.StatusOK, map[string]any{"reply": "AI 未配置，请在设置中填写 API Key"})
			return
		}

		message := body.Message
		if ctx := h.collectMonitorContext(); ctx != "" && shouldIncludeMonitorData(message) {
			message = fmt.Sprintf("以下是当前监控数据：\n%s\n\n用户问题：%s", ctx, message)
		}

		userID := r.RemoteAddr
		reply := tgbot.CallLLMWithContext(cfg, userID, message)
		model.RespondJSON(w, http.StatusOK, map[string]any{"reply": reply})
	}
}

// shouldIncludeMonitorData 判断是否需要注入监控数据作为 AI 上下文
func shouldIncludeMonitorData(msg string) bool {
	keywords := []string{"监控", "系统", "服务", "在线", "离线", "延迟", "容器", "docker",
		"内存", "cpu", "磁盘", "负载", "状态", "检查", "运行", "健康",
		"多少", "几个", "哪些", "什么", "分析", "查看", "显示", "情况"}
	lower := strings.ToLower(msg)
	for _, k := range keywords {
		if strings.Contains(lower, strings.ToLower(k)) {
			return true
		}
	}
	return false
}

// collectMonitorContext 收集当前监控数据供 AI 参考
func (h *Handler) collectMonitorContext() string {
	var parts []string

	sys := service.GetSystemInfo()
	if sys.CPU.Cores > 0 {
		parts = append(parts, fmt.Sprintf("CPU: %.0f%% (%d核), 内存: %.0f%% (%dG/%dG), 磁盘: %.0f%%, 运行: %.1f天",
			sys.CPU.Usage, sys.CPU.Cores,
			sys.Memory.UsedPercent, sys.Memory.Used/1073741824, sys.Memory.Total/1073741824,
			sys.Disk.UsedPercent,
			float64(sys.Uptime)/86400))
	}

	if h.HealthChecker != nil {
		targets := h.HealthChecker.GetTargets()
		results := h.HealthChecker.GetResults()
		rMap := make(map[string]int64)
		for _, r := range results {
			if r.Latency != nil {
				rMap[r.ID] = *r.Latency
			}
		}
		if len(targets) > 0 {
			var lines []string
			online, total := 0, len(targets)
			for _, t := range targets {
				lat := rMap[t.ID]
				s := "❌"
				if lat > 0 {
					s = "✅"
					online++
				}
				lines = append(lines, fmt.Sprintf("  %s %s — %dms", s, t.Name, lat))
			}
			parts = append(parts, fmt.Sprintf("巡检: %d/%d 在线", online, total))
			parts = append(parts, strings.Join(lines, "\n"))
		}
	}

	return strings.Join(parts, "\n")
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
