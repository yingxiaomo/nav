package service

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"
)

// SuggestionResult holds search suggestions from a provider.
type SuggestionResult struct {
	Source      string   `json:"source"`
	Suggestions []string `json:"suggestions"`
}

// suggestionProvider defines how to fetch and parse suggestions from a search engine.
type suggestionProvider struct {
	Name      string
	BuildURL  func(query string) string
	ParseBody func(body []byte) ([]string, error)
}

var suggestionProviders = map[string]suggestionProvider{
	"duckduckgo": {
		Name: "duckduckgo",
		BuildURL: func(q string) string {
			return "https://duckduckgo.com/ac/?q=" + url.QueryEscape(q)
		},
		ParseBody: func(body []byte) ([]string, error) {
			var data []map[string]any
			if err := json.Unmarshal(body, &data); err != nil {
				return nil, fmt.Errorf("解析 DuckDuckGo 响应失败: %w", err)
			}
			var suggestions []string
			for _, item := range data {
				if phrase, ok := item["phrase"].(string); ok && strings.TrimSpace(phrase) != "" {
					suggestions = append(suggestions, phrase)
				}
			}
			return suggestions, nil
		},
	},
	"baidu": {
		Name: "baidu",
		BuildURL: func(q string) string {
			return "https://sp0.baidu.com/5a1Fazu8AA54nxGko9WTAnF6hhy/su?wd=" + url.QueryEscape(q)
		},
		ParseBody: func(body []byte) ([]string, error) {
			// Baidu returns JSONP: window.baidu.sug({...})
			text := string(body)
			re := regexp.MustCompile(`window\.baidu\.sug\(([\s\S]+)\)`)
			match := re.FindStringSubmatch(text)
			if len(match) < 2 {
				return nil, fmt.Errorf("无法解析百度 JSONP 响应")
			}
			var data struct {
				S []string `json:"s"`
			}
			if err := json.Unmarshal([]byte(match[1]), &data); err != nil {
				return nil, fmt.Errorf("解析百度 JSONP 数据失败: %w", err)
			}
			var suggestions []string
			for _, s := range data.S {
				if strings.TrimSpace(s) != "" {
					suggestions = append(suggestions, s)
				}
			}
			return suggestions, nil
		},
	},
	"google": {
		Name: "google",
		BuildURL: func(q string) string {
			return "https://suggestqueries.google.com/complete/search?client=chrome&q=" + url.QueryEscape(q)
		},
		ParseBody: func(body []byte) ([]string, error) {
			var data []json.RawMessage
			if err := json.Unmarshal(body, &data); err != nil {
				return nil, fmt.Errorf("解析 Google 响应失败: %w", err)
			}
			if len(data) < 2 {
				return nil, nil
			}
			var list []string
			if err := json.Unmarshal(data[1], &list); err != nil {
				return nil, fmt.Errorf("解析 Google 建议列表失败: %w", err)
			}
			var suggestions []string
			for _, s := range list {
				if strings.TrimSpace(s) != "" {
					suggestions = append(suggestions, s)
				}
			}
			return suggestions, nil
		},
	},
}

var supportedSources = func() []string {
	keys := make([]string, 0, len(suggestionProviders))
	for k := range suggestionProviders {
		keys = append(keys, k)
	}
	return keys
}()

// GetSuggestions fetches search suggestions for the given query from the specified source.
// Valid sources: "duckduckgo", "baidu", "google". Default source is "duckduckgo".
func GetSuggestions(query, source string) (*SuggestionResult, error) {
	if source == "" {
		source = "duckduckgo"
	}

	provider, ok := suggestionProviders[source]
	if !ok {
		return nil, fmt.Errorf("不支持的搜索来源: %s，可选: %s", source, strings.Join(supportedSources, ", "))
	}

	reqURL := provider.BuildURL(query)

	client := &http.Client{
		Timeout: 3 * time.Second,
	}

	req, err := http.NewRequest("GET", reqURL, nil)
	if err != nil {
		return nil, fmt.Errorf("创建搜索请求失败: %w", err)
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (compatible; NavServer/1.0)")
	req.Header.Set("Accept", "text/javascript, application/json")

	resp, err := client.Do(req)
	if err != nil {
		if strings.Contains(err.Error(), "timeout") || strings.Contains(err.Error(), "Timeout") {
			return nil, fmt.Errorf("搜索服务请求超时")
		}
		return nil, fmt.Errorf("搜索服务请求失败: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<18)) // 256KB limit
	if err != nil {
		return nil, fmt.Errorf("读取搜索响应失败")
	}

	suggestions, err := provider.ParseBody(body)
	if err != nil {
		return nil, err
	}

	if suggestions == nil {
		suggestions = []string{}
	}

	return &SuggestionResult{
		Source:      provider.Name,
		Suggestions: suggestions,
	}, nil
}
