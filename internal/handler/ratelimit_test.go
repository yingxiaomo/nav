package handler

import (
	"testing"
	"time"
)

// 回归锁定：登录限流必须真正生效。
// 历史 bug：checkRateLimit 的"过期清理"分支会把尚未封禁的条目
// （until 初始化为创建时间，恒 <= now）整个删除，失败计数每次被
// 重置为 1——限流从未生效过，连续错误登录永远返回 401 而非 429。
func TestLoginRateLimit(t *testing.T) {
	key := "1.2.3.4|ratelimit-test"

	// 前 4 次失败：允许
	for i := 1; i <= 4; i++ {
		if !checkRateLimit(key) {
			t.Fatalf("第 %d 次不应被拦截", i)
		}
		recordLoginAttempt(key, false)
	}

	// 第 5 次失败：仍允许（本次失败后触发封锁）
	if !checkRateLimit(key) {
		t.Fatal("第 5 次不应被拦截（封锁在本次失败后生效）")
	}
	recordLoginAttempt(key, false)

	// 之后必须拦截
	if checkRateLimit(key) {
		t.Fatal("5 次失败后必须被限流（回归：此前计数被重置，永远 401）")
	}
	if checkRateLimit(key) {
		t.Fatal("封禁期内应持续拦截")
	}

	// 成功登录清零
	recordLoginAttempt(key, true)
	if !checkRateLimit(key) {
		t.Fatal("成功登录后应解除限流")
	}

	// 封禁到期后恢复（模拟时间流逝）
	recordLoginAttempt(key, false)
	recordLoginAttempt(key, false)
	recordLoginAttempt(key, false)
	recordLoginAttempt(key, false)
	recordLoginAttempt(key, false)
	if checkRateLimit(key) {
		t.Fatal("再次 5 连败应封锁")
	}
	loginAttemptsMu.Lock()
	loginAttempts[key].until = time.Now().UnixMilli() - 1 // 时光飞逝
	loginAttemptsMu.Unlock()
	if !checkRateLimit(key) {
		t.Fatal("封禁到期后应放行")
	}
}
