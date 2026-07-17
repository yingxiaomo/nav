package tgbot

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"
)

var chatHistory struct {
	sync.Mutex
	data map[string][]chatMessage
}

var chatHistoryInit sync.Once

func initHistory() {
	chatHistoryInit.Do(func() { chatHistory.data = make(map[string][]chatMessage) })
}

type chatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type chatRequest struct {
	Model     string        `json:"model"`
	Messages  []chatMessage `json:"messages"`
	MaxTokens int           `json:"max_tokens"`
}

type chatResponse struct {
	Choices []struct {
		Message chatMessage `json:"message"`
	} `json:"choices"`
}


// CallLLM 单次 AI 调用（无上下文，供 handleOrganize 使用）
func CallLLM(cfg LLMConfig, prompt string) (string, error) {
	if cfg.APIKey == "" { return "", fmt.Errorf("AI 未配置") }
	if cfg.Model == "" { cfg.Model = defaultLLMConfig.Model }
	baseURL := strings.TrimRight(cfg.BaseURL, "/")
	msgs := []chatMessage{
		{Role: "system", Content: "你是一个智能助手，理解并返回 JSON 格式数据。"},
		{Role: "user", Content: prompt},
	}
	body := chatRequest{Model: cfg.Model, Messages: msgs, MaxTokens: 1000}
	payload, _ := json.Marshal(body)
	req, err := http.NewRequest("POST", baseURL+"/chat/completions", bytes.NewReader(payload))
	if err != nil { return "", err }
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+cfg.APIKey)
	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil { return "", fmt.Errorf("请求失败: %w", err) }
	defer resp.Body.Close()
	if resp.StatusCode != 200 { return "", fmt.Errorf("返回 %d", resp.StatusCode) }
	var result chatResponse
	json.NewDecoder(resp.Body).Decode(&result)
	if len(result.Choices) == 0 { return "", fmt.Errorf("AI 返回为空") }
	return strings.TrimSpace(result.Choices[0].Message.Content), nil
}

func callLLM(cfg LLMConfig, uid, text string) string {
	if cfg.APIKey == "" {
		return "AI 未配置"
	}
	if cfg.Model == "" {
		cfg.Model = defaultLLMConfig.Model
	}
	baseURL := strings.TrimRight(cfg.BaseURL, "/")

	initHistory()
	chatHistory.Lock()
	history := chatHistory.data[uid]
	chatHistory.Unlock()

	sysPrompt := "你是一个智能家居助手，可以用中文聊天。如需执行命令，在回复中另起一行以 / 开头写命令。可用命令：/status /wake /docker /device /organize"

	msgs := []chatMessage{{Role: "system", Content: sysPrompt}}
	msgs = append(msgs, history...)
	msgs = append(msgs, chatMessage{Role: "user", Content: text})

	if len(msgs) > 14 {
		msgs = append([]chatMessage{msgs[0]}, msgs[len(msgs)-12:]...)
	}

	body := chatRequest{Model: cfg.Model, Messages: msgs, MaxTokens: 600}
	payload, _ := json.Marshal(body)
	req, err := http.NewRequest("POST", baseURL+"/chat/completions", bytes.NewReader(payload))
	if err != nil {
		return "请求失败: " + err.Error()
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+cfg.APIKey)

	client := &http.Client{Timeout: 20 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "AI 请求失败: " + err.Error()
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		io.ReadAll(io.LimitReader(resp.Body, 200))
		return fmt.Sprintf("AI 返回 %d", resp.StatusCode)
	}

	var result chatResponse
	json.NewDecoder(resp.Body).Decode(&result)
	if len(result.Choices) == 0 {
		return "AI 返回为空"
	}

	reply := strings.TrimSpace(result.Choices[0].Message.Content)

	chatHistory.Lock()
	chatHistory.data[uid] = append(chatHistory.data[uid],
		chatMessage{Role: "user", Content: text},
		chatMessage{Role: "assistant", Content: reply})
	if len(chatHistory.data[uid]) > 40 {
		chatHistory.data[uid] = chatHistory.data[uid][len(chatHistory.data[uid])-40:]
	}
	chatHistory.Unlock()

	return reply
}

// LLMConfig AI 配置
type LLMConfig struct {
	APIKey  string `json:"api_key"`
	BaseURL string `json:"base_url"`
	Model   string `json:"model"`
}

var defaultLLMConfig = LLMConfig{
	BaseURL: "https://api.openai.com/v1",
	Model:   "gpt-4o-mini",
}

// CallLLMWithContext 带上下文的 AI 对话（导出包装 callLLM）
func CallLLMWithContext(cfg LLMConfig, uid, text string) string {
	return callLLM(cfg, uid, text)
}
