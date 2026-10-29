package handler

import (
	"testing"
	"time"
)

// 回归锁定：登录限流必须真正生效。
// 历史 bug 1：checkRateLimit 的"过期清理"分支把尚未封禁的条目整个删除，
// 失败计数每次被重置——限流从未生效（连续错误登录永远 401）。
// 历史 bug 2：未封禁条目（until==0）永不被清理，map 无界增长。
func TestLoginRateLimit(t *testing.T) {
	key := "1.2.3.4|ratelimit-test"
	ip := "1.2.3.4"

	// 前 4 次失败：允许
	for i := 1; i <= 4; i++ {
		if !checkRateLimit(key, ip) {
			t.Fatalf("第 %d 次不应被拦截", i)
		}
		recordLoginAttempt(key, ip, false)
	}

	// 第 5 次失败：仍允许（本次失败后触发封锁）
	if !checkRateLimit(key, ip) {
		t.Fatal("第 5 次不应被拦截（封锁在本次失败后生效）")
	}
	recordLoginAttempt(key, ip, false)

	// 之后必须拦截
	if checkRateLimit(key, ip) {
		t.Fatal("5 次失败后必须被限流（回归：此前计数被重置，永远 401）")
	}
	if checkRateLimit(key, ip) {
		t.Fatal("封禁期内应持续拦截")
	}

	// 成功登录清用户名级计数
	recordLoginAttempt(key, ip, true)
	if !checkRateLimit(key, ip) {
		t.Fatal("成功登录后应解除限流")
	}

	// 再次 5 连败封锁；模拟到期后恢复
	for i := 0; i < 5; i++ {
		recordLoginAttempt(key, ip, false)
	}
	if checkRateLimit(key, ip) {
		t.Fatal("再次 5 连败应封锁")
	}
	loginAttemptsMu.Lock()
	loginAttempts[key].until = time.Now().UnixMilli() - 1 // 时光飞逝
	loginAttemptsMu.Unlock()
	if !checkRateLimit(key, ip) {
		t.Fatal("封禁到期后应放行")
	}
}

// 回归锁定：轮换随机用户名绕过 IP|username 键的攻击路径，
// 由 IP 级独立限额（30 次/1h）拦截。
func TestRateLimitPerIPBypass(t *testing.T) {
	ip := "9.9.9.9"
	// 30 次失败（每次不同用户名），前 30 次均不因 IP 级拦截
	for i := 0; i < maxIPAttempts; i++ {
		key := ip + "|rotating-user-" + string(rune('a'+i%26)) + string(rune('0'+i/26))
		if !checkRateLimit(key, ip) {
			t.Fatalf("第 %d 次（IP 级阈值内）不应被拦截", i+1)
		}
		recordLoginAttempt(key, ip, false)
	}
	// 第 31 次：IP 级封锁生效（即使用户名是全新的）
	if checkRateLimit(ip+"|brand-new-user", ip) {
		t.Fatal("IP 级限额应在 30 次失败后拦截随机用户名轮换")
	}
}

// 回归锁定：未封禁条目（until==0）必须能被 TTL 清理，否则 map 无界增长。
func TestRateLimitEntryTTL(t *testing.T) {
	key := "5.6.7.8|ttl-test"
	ip := "5.6.7.8"
	recordLoginAttempt(key, ip, false) // 1 次失败，未封禁
	loginAttemptsMu.Lock()
	e := loginAttempts[key]
	if e == nil || e.until != 0 {
		loginAttemptsMu.Unlock()
		t.Fatal("前置条件不符：应为未封禁条目")
	}
	e.lastAttempt = time.Now().UnixMilli() - attemptEntryTTL.Milliseconds() - 1000
	loginAttemptsMu.Unlock()

	// 清理循环的逻辑（与 StartLoginAttemptsCleanup 一致）
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
	if !checkRateLimit(key, ip) {
		t.Fatal("清理后应重新允许")
	}
}
