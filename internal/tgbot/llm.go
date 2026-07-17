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

// LLMConfig AI 配置
type LLMConfig struct {
	BaseURL string `json:"base_url"`
	APIKey  string `json:"api_key"`
	Model   string `json:"model"`
}

type chatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type chatRequest struct {
	Model    string        `json:"model"`
	Messages []chatMessage `json:"messages"`
}

type chatResponse struct {
	Choices []struct {
		Message chatMessage `json:"message"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

// 内存会话存储
var (
	convMu       sync.RWMutex
	conversations = make(map[string][]chatMessage)
	convMaxLen   = 20 // 最多保留 20 轮
)

// CallLLM 简单问答，无上下文
func CallLLM(cfg LLMConfig, text string) (string, error) {
	return callLLM(cfg, "", text)
}

// callLLM 内部调用 LLM，支持会话上下文
func callLLM(cfg LLMConfig, uid, text string) (string, error) {
	messages := buildMessages(cfg, uid, text)

	baseURL := strings.TrimRight(cfg.BaseURL, "/")
	body := chatRequest{
		Model:    cfg.Model,
		Messages: messages,
	}

	reqBody, err := json.Marshal(body)
	if err != nil {
		return "", fmt.Errorf("序列化请求失败: %w", err)
	}

	req, err := http.NewRequest("POST", baseURL+"/chat/completions", bytes.NewReader(reqBody))
	if err != nil {
		return "", fmt.Errorf("创建请求失败: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+cfg.APIKey)

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("请求失败: %w", err)
	}
	defer resp.Body.Close()

	respData, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("读取响应失败: %w", err)
	}

	var chatResp chatResponse
	if err := json.Unmarshal(respData, &chatResp); err != nil {
		return "", fmt.Errorf("解析响应失败: %w", err)
	}

	if chatResp.Error != nil && chatResp.Error.Message != "" {
		return "", fmt.Errorf("API 错误: %s", chatResp.Error.Message)
	}

	if len(chatResp.Choices) == 0 {
		return "", fmt.Errorf("API 返回空结果")
	}

	reply := chatResp.Choices[0].Message.Content

	// 有用户 ID 时保存上下文
	if uid != "" {
		saveConversation(uid, text, reply)
	}

	return reply, nil
}

// CallLLMWithContext 带上下文的 AI 对话（导出包装 callLLM）
func CallLLMWithContext(cfg LLMConfig, uid, text string) string {
	reply, err := callLLM(cfg, uid, text)
	if err != nil {
		return "AI 调用失败: " + err.Error()
	}
	return reply
}

// buildMessages 构造消息列表，有上下文时从会话存储中加载历史
func buildMessages(cfg LLMConfig, uid, text string) []chatMessage {
	msgs := []chatMessage{
		{Role: "system", Content: "你是一个有用的导航页助手，回答简洁准确。可以使用 Markdown 格式。"},
	}

	if uid != "" {
		convMu.RLock()
		history := conversations[uid]
		convMu.RUnlock()

		// 只取最近 convMaxLen-1 轮（留位置给当前消息）
		if len(history) > convMaxLen-1 {
			history = history[len(history)-(convMaxLen-1):]
		}
		for _, m := range history {
			msgs = append(msgs, m)
		}
	}

	msgs = append(msgs, chatMessage{Role: "user", Content: text})
	return msgs
}

// saveConversation 保存用户对话到内存
func saveConversation(uid, text, reply string) {
	convMu.Lock()
	defer convMu.Unlock()

	conversations[uid] = append(conversations[uid],
		chatMessage{Role: "user", Content: text},
		chatMessage{Role: "assistant", Content: reply},
	)

	// 超限截断，保留最近 convMaxLen 轮
	if len(conversations[uid]) > convMaxLen*2 {
		conversations[uid] = conversations[uid][len(conversations[uid])-convMaxLen*2:]
	}
}
