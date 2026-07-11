package tgbot

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"sync"
	"time"
)

// BotConfig TG 机器人配置
type BotConfig struct {
	Token  string `json:"token"`
	ChatID string `json:"chat_id,omitempty"`
}

// Bot TG 机器人实例
type Bot struct {
	cfg    BotConfig
	client *http.Client
	cmd    CommandHandler
	offset int
	mu     sync.Mutex
	stopCh chan struct{}
}

// CommandHandler 处理 /command
type CommandHandler interface {
	HandleTG(fromID string, cmd string, args []string) string
}

// NewBot 创建机器人
func NewBot(cfg BotConfig) *Bot {
	return &Bot{
		cfg:    cfg,
		client: &http.Client{Timeout: 10 * time.Second},
		stopCh: make(chan struct{}),
	}
}

func (b *Bot) apiURL(method string) string {
	return fmt.Sprintf("https://api.telegram.org/bot%s/%s", b.cfg.Token, method)
}

// SendMessage 发送消息
func (b *Bot) SendMessage(chatID, text string) {
	payload, _ := json.Marshal(map[string]string{"chat_id": chatID, "text": text, "parse_mode": "HTML"})
	resp, err := b.client.Post(b.apiURL("sendMessage"), "application/json", bytes.NewReader(payload))
	if err != nil {
		slog.Warn("TG 发送失败", "error", err)
		return
	}
	io.Copy(io.Discard, resp.Body)
	resp.Body.Close()
}

// Broadcast 向已配置的 chat_id 发送消息
func (b *Bot) Broadcast(text string) {
	if b.cfg.ChatID != "" {
		b.SendMessage(b.cfg.ChatID, text)
	}
}

// Start 开始长轮询消息
func (b *Bot) Start(handler CommandHandler) {
	b.cmd = handler
	slog.Info("TG 机器人已启动")
	go b.pollLoop()
}

func (b *Bot) Stop() {
	close(b.stopCh)
}

func (b *Bot) pollLoop() {
	for {
		select {
		case <-b.stopCh:
			return
		default:
		}

		updates, err := b.getUpdates()
		if err != nil {
			slog.Debug("TG poll error", "error", err)
			time.Sleep(3 * time.Second)
			continue
		}

		for _, u := range updates {
			if u.Message == nil || u.Message.Text == "" {
				continue
			}
			b.mu.Lock()
			b.offset = u.ID + 1
			b.mu.Unlock()

			fromID := fmt.Sprintf("%d", u.Message.From.ID)
			if u.Message.Chat != nil {
				fromID = fmt.Sprintf("%d", u.Message.Chat.ID)
			}

			text := strings.TrimSpace(u.Message.Text)
			if !strings.HasPrefix(text, "/") {
				continue
			}

			parts := strings.Fields(text)
			cmd := parts[0]
			args := parts[1:]

			slog.Info("TG 命令", "from", fromID, "cmd", cmd)
			resp := b.cmd.HandleTG(fromID, cmd, args)
			b.SendMessage(fromID, resp)
		}

		time.Sleep(1 * time.Second)
	}
}

type tgUpdate struct {
	ID      int `json:"update_id"`
	Message *struct {
		Text string `json:"text"`
		From struct {
			ID int `json:"id"`
		} `json:"from"`
		Chat *struct {
			ID int `json:"id"`
		} `json:"chat"`
	} `json:"message"`
}

func (b *Bot) getUpdates() ([]tgUpdate, error) {
	b.mu.Lock()
	off := b.offset
	b.mu.Unlock()

	url := fmt.Sprintf("%s?offset=%d&timeout=10", b.apiURL("getUpdates"), off)
	resp, err := b.client.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result struct {
		OK      bool       `json:"ok"`
		Updates []tgUpdate `json:"result"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	if !result.OK {
		return nil, fmt.Errorf("telegram API error")
	}
	return result.Updates, nil
}
