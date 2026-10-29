package session

import (
	"context"
	"sync"
)

// SecretProvider 缓存 session_secret，避免每个请求都查一次库
// （SQLite 单连接配置下，所有认证请求会在该查询上串行排队）。
// 调用方在轮换密钥（登出/改密/初始化）后必须调用 Invalidate。
//
// 并发正确性：Get 在锁外加载数据库，期间可能发生 Invalidate——
// 用 generation 计数防护：加载前捕获代数，写回前比对；代数变化说明
// 读到的密钥已过期，丢弃不缓存（fail-closed，下次 Get 重新加载）。
// 仅靠"写回前复查缓存是否为空"防不住该时序：缓存本就为空时
// Invalidate 是无效操作，读到的旧密钥会被写回，登出后旧会话复活。
type SecretProvider struct {
	mu     sync.RWMutex
	secret string
	gen    uint64
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
	s, gen := p.secret, p.gen
	p.mu.RUnlock()
	if s != "" {
		return s
	}
	loaded, err := p.load(ctx)
	if err != nil || loaded == "" {
		return ""
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.gen != gen {
		// 加载期间发生过轮换：本次读到的密钥已不可信，丢弃不缓存
		return p.secret
	}
	p.secret = loaded
	return loaded
}

// Invalidate 丢弃缓存（密钥轮换后调用）。nil 接收者安全（可选依赖）。
func (p *SecretProvider) Invalidate() {
	if p == nil {
		return
	}
	p.mu.Lock()
	p.gen++
	p.secret = ""
	p.mu.Unlock()
}
