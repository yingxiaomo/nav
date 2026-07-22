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
	AppriseURL      string `json:"apprise_url,omitempty"`      // Apprise API 地址，如 http://apprise:8000/notify
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

// ShouldNotify 检查是否应该发送通知（cooldown + enabled）
func (s *Sender) ShouldNotify(targetID string) bool {
	if !s.Config.Enabled || s.Config.AppriseURL == "" {
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

// Send 发送通知到 Apprise
func (s *Sender) Send(name, url, status string) {
	s.sendApprise(name, url, status)
}

type apprisePayload struct {
	Title string `json:"title"`
	Body  string `json:"body"`
	Type  string `json:"type"`
}

func (s *Sender) sendApprise(name, url, status string) {
	label := status
	if status == "timeout" {
		label = "超时"
	} else if status == "error" {
		label = "错误"
	}
	payload := apprisePayload{
		Title: fmt.Sprintf("⚠️ 监控告警: %s", name),
		Body:  fmt.Sprintf("服务: %s\n地址: %s\n状态: %s\n时间: %s", name, url, label, time.Now().Format("2006-01-02 15:04:05")),
		Type:  "failure",
	}
	body, _ := json.Marshal(payload)
	resp, err := s.client.Post(s.Config.AppriseURL, "application/json", bytes.NewReader(body))
	if err != nil {
		slog.Warn("Apprise 通知失败", "error", err)
		return
	}
	resp.Body.Close()
	if resp.StatusCode >= 400 {
		slog.Warn("Apprise 返回错误", "status", resp.StatusCode)
	}
}
