package notify

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"sync"
	"time"
)

// Config 通知配置
type Config struct {
	Enabled         bool   `json:"enabled"`
	AppriseURL      string `json:"apprise_url,omitempty"` // Apprise API 地址，如 http://apprise:8000/notify
	CooldownMinutes int    `json:"cooldown_minutes"`
}

// Sender 通知发送器
type Sender struct {
	Config   Config
	mu       sync.Mutex
	cooldown map[string]time.Time // targetID → 上次通知时间
	client   *http.Client
}

// NewSender 创建通知发送器
func NewSender(cfg Config) *Sender {
	if cfg.CooldownMinutes <= 0 {
		cfg.CooldownMinutes = 30
	}
	return &Sender{
		Config:   cfg,
		cooldown: make(map[string]time.Time),
		client:   &http.Client{Timeout: 5 * time.Second},
	}
}

func (s *Sender) enabled() bool {
	return s.Config.Enabled && s.Config.AppriseURL != ""
}

// ShouldNotify 检查是否应该发送宕机告警（cooldown + enabled）
func (s *Sender) ShouldNotify(targetID string) bool {
	if !s.enabled() {
		return false
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if last, ok := s.cooldown[targetID]; ok {
		if time.Since(last) < time.Duration(s.Config.CooldownMinutes)*time.Minute {
			return false
		}
	}
	return true
}

// MarkNotified 记录通知时间
func (s *Sender) MarkNotified(targetID string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.cooldown[targetID] = time.Now()
}

// ClearNotified 清除某目标的冷却记录，使其恢复后再次宕机能立即告警
func (s *Sender) ClearNotified(targetID string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.cooldown, targetID)
}

// Send 发送宕机告警
func (s *Sender) Send(name, url, status string) {
	if !s.enabled() {
		return
	}
	_ = post(s.client, s.Config.AppriseURL, apprisePayload{
		Title: fmt.Sprintf("⚠️ 监控告警: %s", name),
		Body:  fmt.Sprintf("服务: %s\n地址: %s\n状态: %s\n时间: %s", name, url, statusLabel(status), nowStr()),
		Type:  "failure",
	})
}

// SendRecovery 发送服务恢复通知（宕机→恢复的一次性提示）
func (s *Sender) SendRecovery(name, url string) {
	if !s.enabled() {
		return
	}
	_ = post(s.client, s.Config.AppriseURL, apprisePayload{
		Title: fmt.Sprintf("✅ 服务恢复: %s", name),
		Body:  fmt.Sprintf("服务: %s\n地址: %s\n状态: 已恢复\n时间: %s", name, url, nowStr()),
		Type:  "success",
	})
}

// SendTest 用给定配置发送一条测试通知，返回错误以便前端反馈配置是否可用。
// 独立于 Sender：调用方传入当前 settings 里的配置，即可验证刚填写的地址。
func SendTest(cfg Config) error {
	if cfg.AppriseURL == "" {
		return fmt.Errorf("尚未配置 Apprise 地址")
	}
	client := &http.Client{Timeout: 5 * time.Second}
	return post(client, cfg.AppriseURL, apprisePayload{
		Title: "🔔 Clean Nav 测试通知",
		Body:  fmt.Sprintf("这是一条测试通知，说明你的通知配置可用。\n时间: %s", nowStr()),
		Type:  "info",
	})
}

type apprisePayload struct {
	Title string `json:"title"`
	Body  string `json:"body"`
	Type  string `json:"type"`
}

// post 向 Apprise 提交一条通知，返回错误（网络失败或 4xx/5xx）。
func post(client *http.Client, url string, p apprisePayload) error {
	body, _ := json.Marshal(p)
	resp, err := client.Post(url, "application/json", bytes.NewReader(body))
	if err != nil {
		slog.Warn("Apprise 通知失败", "error", err)
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		slog.Warn("Apprise 返回错误", "status", resp.StatusCode)
		return fmt.Errorf("Apprise 返回状态 %d", resp.StatusCode)
	}
	return nil
}

func statusLabel(status string) string {
	switch status {
	case "timeout":
		return "超时"
	case "error":
		return "错误"
	default:
		return status
	}
}

func nowStr() string {
	return time.Now().Format("2006-01-02 15:04:05")
}
