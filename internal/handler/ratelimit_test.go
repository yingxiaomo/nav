package handler

import (
	"fmt"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

// 测试间隔离：限流状态是包级全局（真实服务单进程共享），
// -count=N 重跑时上一轮的封锁状态会污染下一轮——每个用例先重置。
func resetRateLimitState(t *testing.T) {
	t.Helper()
	loginAttemptsMu.Lock()
	loginAttempts = map[string]*attemptCounter{}
	ipAttempts = map[string]*attemptCounter{}
	loginAttemptsMu.Unlock()
}

// 回归锁定：登录限流必须真正生效。
// 历史 bug 1：checkRateLimit 的"过期清理"分支把尚未封禁的条目整个删除，
// 失败计数每次被重置——限流从未生效（连续错误登录永远 401）。
// 历史 bug 2：未封禁条目（until==0）永不被清理，map 无界增长。
func TestLoginRateLimit(t *testing.T) {
	resetRateLimitState(t)
	key := "1.2.3.4|ratelimit-test"
	ip := "1.2.3.4"

	// 前 4 次尝试：允许；失败不归还名额
	for i := 1; i <= 4; i++ {
		if !beginLoginAttempt(key, ip) {
			t.Fatalf("第 %d 次不应被拦截", i)
		}
		finishLoginAttempt(key, ip, false)
	}

	// 第 5 次尝试：仍允许（本次触发封锁）
	if !beginLoginAttempt(key, ip) {
		t.Fatal("第 5 次不应被拦截（封锁在本次后生效）")
	}

	// 之后必须拦截
	if beginLoginAttempt(key, ip) {
		t.Fatal("5 次尝试后必须被限流（回归：此前计数被重置，永远 401）")
	}
	if beginLoginAttempt(key, ip) {
		t.Fatal("封禁期内应持续拦截")
	}

	// 模拟到期后恢复
	loginAttemptsMu.Lock()
	loginAttempts[key].until = time.Now().UnixMilli() - 1
	loginAttemptsMu.Unlock()
	if !beginLoginAttempt(key, ip) {
		t.Fatal("封禁到期后应放行")
	}
}

// 回归锁定（并发原子性）：check/record 分离的两段式存在并发窗口，
// 80 个并发随机用户名请求会全部穿透到 bcrypt。名额必须在检查时
// 原子登记——并发突发下放行数量必须精确等于限额。
func TestRateLimitConcurrentBurst(t *testing.T) {
	resetRateLimitState(t)
	ip := "7.7.7.7"
	const n = 80
	var allowed atomic.Int32
	var wg sync.WaitGroup
	for i := 0; i < n; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			if beginLoginAttempt(fmt.Sprintf("%s|burst-%d", ip, i), ip) {
				allowed.Add(1)
			}
		}(i)
	}
	wg.Wait()
	if got := allowed.Load(); got != maxIPAttempts {
		t.Fatalf("并发突发下必须精确放行 %d 个（原子性回归）, got %d", maxIPAttempts, got)
	}
}

// 回归锁定：轮换随机用户名绕过 IP|username 键的攻击路径，
// 由 IP 级独立限额（30 次/1h）拦截。成功登录归还名额。
func TestRateLimitPerIPBypass(t *testing.T) {
	resetRateLimitState(t)
	ip := "9.9.9.9"
	for i := 0; i < maxIPAttempts-1; i++ {
		key := fmt.Sprintf("%s|rotating-%d", ip, i)
		if !beginLoginAttempt(key, ip) {
			t.Fatalf("第 %d 次（IP 级阈值内）不应被拦截", i+1)
		}
	}
	// 成功归还一个名额后，第 30 次仍被允许
	finishLoginAttempt(ip+"|rotating-0", ip, true)
	if !beginLoginAttempt(ip+"|after-success", ip) {
		t.Fatal("归还名额后第 30 次应放行")
	}
	// 第 31 次：IP 级封锁生效（即使全新用户名）
	if beginLoginAttempt(ip+"|brand-new-user", ip) {
		t.Fatal("IP 级限额应在 30 次尝试后拦截随机用户名轮换")
	}
}

// 回归锁定：未封禁条目（until==0）必须能被 TTL 清理，否则 map 无界增长。
func TestRateLimitEntryTTL(t *testing.T) {
	resetRateLimitState(t)
	key := "5.6.7.8|ttl-test"
	ip := "5.6.7.8"
	beginLoginAttempt(key, ip) // 1 次尝试，未封禁
	finishLoginAttempt(key, ip, false)
	loginAttemptsMu.Lock()
	e := loginAttempts[key]
	if e == nil || e.until != 0 {
		loginAttemptsMu.Unlock()
		t.Fatal("前置条件不符：应为未封禁条目")
	}
	e.lastAttempt = time.Now().UnixMilli() - attemptEntryTTL.Milliseconds() - 1000
	loginAttemptsMu.Unlock()

	// 与 StartLoginAttemptsCleanup 相同的清理判定
	now := time.Now().UnixMilli()
	loginAttemptsMu.Lock()
	expired := e.until > 0 && e.until < now
	stale := e.lastAttempt > 0 && now-e.lastAttempt > attemptEntryTTL.Milliseconds()
	if expired || stale {
		delete(loginAttempts, key)
	}
	loginAttemptsMu.Unlock()

	if _, ok := loginAttempts[key]; ok {
		t.Fatal("陈旧未封禁条目应被 TTL 清理（回归：原实现永不删除）")
	}
	if !beginLoginAttempt(key, ip) {
		t.Fatal("清理后应重新允许")
	}
}
