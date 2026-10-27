package session

import (
	"context"
	"sync"
)

// SecretProvider 缓存 session_secret，避免每个请求都查一次库
// （SQLite 单连接配置下，所有认证请求会在该查询上串行排队）。
// 调用方在轮换密钥（登出/改密/初始化）后必须调用 Invalidate。
type SecretProvider struct {
	mu     sync.RWMutex
	secret string
	load   func(ctx context.Context) (string, error)
}

// NewSecretProvider 创建缓存；load 为密钥加载函数（通常查 settings 表）。
func NewSecretProvider(load func(ctx context.Context) (string, error)) *SecretProvider {
	return &SecretProvider{load: load}
}

// Get 返回缓存的密钥；缓存为空时加载一次。
// 加载失败或密钥为空返回 ""（不缓存失败结果，下次重试）。
func (p *SecretProvider) Get(ctx context.Context) string {
	p.mu.RLock()
	s := p.secret
	p.mu.RUnlock()
	if s != "" {
		return s
	}
	loaded, err := p.load(ctx)
	if err != nil || loaded == "" {
		return ""
	}
	p.mu.Lock()
	p.secret = loaded
	p.mu.Unlock()
	return loaded
}

// Invalidate 丢弃缓存（密钥轮换后调用）。nil 接收者安全（可选依赖）。
func (p *SecretProvider) Invalidate() {
	if p == nil {
		return
	}
	p.mu.Lock()
	p.secret = ""
	p.mu.Unlock()
}
