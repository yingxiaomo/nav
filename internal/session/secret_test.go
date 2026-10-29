package session

import (
	"context"
	"testing"
)

// 回归锁定：Get 在锁外加载 DB 期间若发生 Invalidate（登出/改密轮换），
// 读到的旧密钥必须被丢弃——否则登出后旧会话复活、新会话反而失效。
// 历史 bug：仅靠"写回前复查缓存是否为空"防不住该时序（缓存本就为空时
// Invalidate 是无效操作）。当前实现以 generation 计数防护。
func TestSecretProviderRotationDuringLoad(t *testing.T) {
	loadStarted := make(chan struct{})
	releaseLoad := make(chan struct{})
	var calls int
	p := NewSecretProvider(func(ctx context.Context) (string, error) {
		calls++
		if calls == 1 {
			close(loadStarted)
			<-releaseLoad
			return "old-secret", nil // 模拟读到了轮换前的旧密钥
		}
		return "new-secret", nil
	})

	gotCh := make(chan string, 1)
	go func() { gotCh <- p.Get(context.Background()) }()
	<-loadStarted

	p.Invalidate() // 轮换恰好发生在加载期间
	close(releaseLoad)

	if got := <-gotCh; got != "" {
		t.Fatalf("轮换期间加载的旧密钥必须被丢弃（fail-closed），got %q", got)
	}
	if p.secret != "" {
		t.Fatalf("缓存不得被旧密钥污染, got %q", p.secret)
	}

	// 之后的一次 Get 正常加载新密钥
	if got := p.Get(context.Background()); got != "new-secret" {
		t.Fatalf("轮换后应加载新密钥, got %q", got)
	}
}

// 正常路径：缓存命中、加载失败不缓存、Invalidate 后重新加载。
func TestSecretProviderBasics(t *testing.T) {
	secret := "s1"
	p := NewSecretProvider(func(ctx context.Context) (string, error) {
		return secret, nil
	})
	if got := p.Get(context.Background()); got != "s1" {
		t.Fatalf("got %q", got)
	}
	secret = "s2"
	if got := p.Get(context.Background()); got != "s1" {
		t.Fatalf("缓存未生效: %q", got)
	}
	p.Invalidate()
	if got := p.Get(context.Background()); got != "s2" {
		t.Fatalf("Invalidate 后应重新加载: %q", got)
	}
	// 加载失败：返回空且不缓存
	p2 := NewSecretProvider(func(ctx context.Context) (string, error) {
		return "", context.DeadlineExceeded
	})
	if got := p2.Get(context.Background()); got != "" {
		t.Fatalf("加载失败应返回空: %q", got)
	}
	// nil 接收者安全
	var nilp *SecretProvider
	nilp.Invalidate()
}
