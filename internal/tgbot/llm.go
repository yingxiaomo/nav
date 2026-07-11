package tgbot

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// LLMConfig AI 配置
type LLMConfig struct {
	APIKey  string `json:"api_key"`
	BaseURL string `json:"base_url"` // OpenAI-compatible API
	Model   string `json:"model"`
}

var defaultLLMConfig = LLMConfig{
	BaseURL: "https://api.openai.com/v1",
	Model:   "gpt-4o-mini",
}

type chatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type chatRequest struct {
	Model       string        `json:"model"`
	Messages    []chatMessage `json:"messages"`
	MaxTokens   int           `json:"max_tokens"`
}

type chatResponse struct {
	Choices []struct {
		Message chatMessage `json:"message"`
	} `json:"choices"`
}

// CallLLM 调用大模型，将自然语言转为具体指令
func CallLLM(cfg LLMConfig, prompt string) (string, error) {
	if cfg.APIKey == "" || cfg.BaseURL == "" {
		return "", fmt.Errorf("AI 未配置")
	}
	if cfg.Model == "" {
		cfg.Model = defaultLLMConfig.Model
	}

	baseURL := strings.TrimRight(cfg.BaseURL, "/")

	systemPrompt := `你是一个智能家居助手，可以控制内网设备。可用命令：
- /status [name] - 查看服务状态
- /wake [name] - 唤醒设备
- /docker ps - 容器列表
- /docker start [name] / stop [name] / restart [name]
- /device exec [name] [command] - 在设备上执行 SSH 命令

请把用户的自然语言转换成对应的斜杠命令，只回复命令本身，不要解释。`

	body := chatRequest{
		Model: cfg.Model,
		Messages: []chatMessage{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: prompt},
		},
		MaxTokens: 200,
	}

	payload, _ := json.Marshal(body)
	req, err := http.NewRequest("POST", baseURL+"/chat/completions", bytes.NewReader(payload))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+cfg.APIKey)

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("AI 请求失败: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 500))
		return "", fmt.Errorf("AI 返回 %d: %s", resp.StatusCode, string(body))
	}

	var result chatResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("AI 响应解析失败: %w", err)
	}

	if len(result.Choices) == 0 {
		return "", fmt.Errorf("AI 返回为空")
	}

	return strings.TrimSpace(result.Choices[0].Message.Content), nil
}
