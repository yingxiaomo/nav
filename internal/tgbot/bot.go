package tgbot

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

// BotConfig TG 机器人配置
type BotConfig struct {
	Token    string `json:"token"`
	ChatID   string `json:"chat_id,omitempty"`
	ProxyURL string `json:"proxy_url,omitempty"` // 代理地址，如 http://192.168.0.1:7890
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

// KeyboardResponder 可选接口：回复需要携带 inline keyboard（/ask 确认按钮）。
// ok=false 时 Bot 回退到普通 HandleTG 路径。
type KeyboardResponder interface {
	HandleTGKeyboard(fromID, cmd string, args []string) (text string, buttons []InlineButton, ok bool)
}

// CallbackHandler 可选接口：处理 inline keyboard 回调
// （Bot 负责校验 chat 白名单，实现方负责校验动作本身）。
type CallbackHandler interface {
	HandleCallback(chatID string, msgID int, data string) string
}

// InlineButton inline keyboard 按钮
type InlineButton struct {
	Text string `json:"text"`
	Data string `json:"callback_data"`
}

// NewBot 创建机器人
func NewBot(cfg BotConfig) *Bot {
	transport := &http.Transport{}
	if cfg.ProxyURL != "" {
		if proxyURL, err := url.Parse(cfg.ProxyURL); err == nil {
			transport.Proxy = http.ProxyURL(proxyURL)
		}
	}
	return &Bot{
		cfg: cfg,
		// 长轮询服务器侧超时为 10s，client 超时必须留出余量，
		// 否则无更新时每次都恰好撞上 client 超时 + 3s 退避
		client: &http.Client{Timeout: 20 * time.Second, Transport: transport},
		stopCh: make(chan struct{}),
	}
}

func (b *Bot) apiURL(method string) string {
	return fmt.Sprintf("https://api.telegram.org/bot%s/%s", b.cfg.Token, method)
}

// SendMessage 发送消息。
// 不使用 parse_mode=HTML：回复内容含用户数据/AI 输出/容器名等，
// 用 HTML 模式既是注入面（恶意命名的容器可伪造排版）也容易因未转义字符发送失败。
func (b *Bot) SendMessage(chatID, text string) {
	payload, _ := json.Marshal(map[string]string{"chat_id": chatID, "text": text})
	b.postAPI("sendMessage", payload)
}

// SendMessageWithKeyboard 发送带 inline keyboard 的消息。
// buttons 为空时退化为普通消息。
func (b *Bot) SendMessageWithKeyboard(chatID, text string, buttons []InlineButton) {
	if len(buttons) == 0 {
		b.SendMessage(chatID, text)
		return
	}
	payload, _ := json.Marshal(map[string]any{
		"chat_id":      chatID,
		"text":         text,
		"reply_markup": map[string]any{"inline_keyboard": [][]InlineButton{buttons}},
	})
	b.postAPI("sendMessage", payload)
}

// AnswerCallback 应答 callback query（消除客户端转圈，并可弹提示）
func (b *Bot) AnswerCallback(callbackID, text string) {
	payload, _ := json.Marshal(map[string]string{"callback_query_id": callbackID, "text": text})
	b.postAPI("answerCallbackQuery", payload)
}

// ClearKeyboard 移除消息上的 inline keyboard（确认后防重复点击）
func (b *Bot) ClearKeyboard(chatID string, messageID int) {
	payload, _ := json.Marshal(map[string]any{
		"chat_id": chatID, "message_id": messageID,
		"reply_markup": map[string]any{"inline_keyboard": [][]InlineButton{}},
	})
	b.postAPI("editMessageReplyMarkup", payload)
}

func (b *Bot) postAPI(method string, payload []byte) {
	resp, err := b.client.Post(b.apiURL(method), "application/json", bytes.NewReader(payload))
	if err != nil {
		slog.Warn("TG 发送失败", "method", method, "error", err)
		return
	}
	io.Copy(io.Discard, resp.Body)
	resp.Body.Close()
}

// Start 开始长轮询消息
func (b *Bot) Start(handler CommandHandler) {
	b.cmd = handler
	slog.Info("TG 机器人已启动")
	b.registerCommands()
	go b.pollLoop()
}

func (b *Bot) registerCommands() {
	cmds := []map[string]string{
		{"command": "ai", "description": "AI 对话"},
		{"command": "ask", "description": "AI 诊断内网，可提议命令（需确认）"},
		{"command": "status", "description": "查看监控状态"},
		{"command": "wake", "description": "WOL 唤醒"},
		{"command": "docker", "description": "Docker 管理"},
		{"command": "device", "description": "远程设备"},
		{"command": "organize", "description": "AI 整理书签"},
		{"command": "uptime", "description": "运行时间"},
		{"command": "cancel", "description": "取消待确认的操作"},
		{"command": "help", "description": "帮助"},
	}
	payload, _ := json.Marshal(map[string]any{"commands": cmds})
	resp, err := b.client.Post(b.apiURL("setMyCommands"), "application/json", bytes.NewReader(payload))
	if err == nil {
		resp.Body.Close()
	}
}

func (b *Bot) Stop() {
	close(b.stopCh)
}

// isAuthorized 校验消息来源 chat_id 是否在配置的白名单内。
// cfg.ChatID 支持逗号分隔的多个 ID；未配置时拒绝所有命令（安全默认）。
func (b *Bot) isAuthorized(chatID string) bool {
	allow := strings.TrimSpace(b.cfg.ChatID)
	if allow == "" {
		return false
	}
	for _, id := range strings.Split(allow, ",") {
		if strings.TrimSpace(id) == chatID {
			return true
		}
	}
	return false
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
			b.mu.Lock()
			b.offset = u.ID + 1
			b.mu.Unlock()

			// inline keyboard 回调（/ask 确认执行）
			if u.CallbackQuery != nil {
				b.handleCallbackQuery(u.CallbackQuery)
				continue
			}

			if u.Message == nil || u.Message.Text == "" {
				continue
			}

			fromID := fmt.Sprintf("%d", u.Message.From.ID)
			if u.Message.Chat != nil {
				fromID = fmt.Sprintf("%d", u.Message.Chat.ID)
			}

			// 仅处理授权 chat_id 的命令：机器人可对内网设备执行 SSH / Docker
			// 操作，未授权来源必须拒绝（否则任何 Telegram 用户都能远程控制）。
			if !b.isAuthorized(fromID) {
				slog.Warn("TG 未授权来源，已忽略", "from", fromID)
				continue
			}

			text := strings.TrimSpace(u.Message.Text)
			if !strings.HasPrefix(text, "/") {
				continue
			}

			parts := strings.Fields(text)
			cmd := parts[0]
			args := parts[1:]

			slog.Info("TG 命令", "from", fromID, "cmd", cmd)

			// /ask 等需要携带确认按钮的命令走 keyboard 路径
			if kr, ok := b.cmd.(KeyboardResponder); ok {
				if resp, buttons, has := kr.HandleTGKeyboard(fromID, cmd, args); has {
					b.SendMessageWithKeyboard(fromID, resp, buttons)
					continue
				}
			}

			resp := b.cmd.HandleTG(fromID, cmd, args)
			b.SendMessage(fromID, resp)
		}

		time.Sleep(1 * time.Second)
	}
}

// handleCallbackQuery 处理 /ask 的确认/取消按钮：
// 与命令相同，先过 chat 白名单，再交给 handler 校验并执行
func (b *Bot) handleCallbackQuery(cb *tgCallbackQuery) {
	if cb.Message == nil || cb.Message.Chat == nil {
		b.AnswerCallback(cb.ID, "无效的确认")
		return
	}
	chatID := fmt.Sprintf("%d", cb.Message.Chat.ID)
	if !b.isAuthorized(chatID) {
		slog.Warn("TG 未授权回调，已忽略", "from", chatID)
		b.AnswerCallback(cb.ID, "未授权")
		return
	}
	ch, ok := b.cmd.(CallbackHandler)
	if !ok {
		b.AnswerCallback(cb.ID, "不支持")
		return
	}

	resp := ch.HandleCallback(chatID, cb.Message.ID, cb.Data)
	if resp != "" {
		b.SendMessage(chatID, resp)
	}
	b.AnswerCallback(cb.ID, "")
	b.ClearKeyboard(chatID, cb.Message.ID)
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
	CallbackQuery *tgCallbackQuery `json:"callback_query"`
}

type tgCallbackQuery struct {
	ID      string `json:"id"`
	Data    string `json:"data"`
	Message *struct {
		ID   int `json:"message_id"`
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
