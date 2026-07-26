package service

import (
	"context"
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"

	"github.com/YingXiaoMo/nav/internal/model"
)

// mockNotifier 记录各类通知的调用次数，ShouldNotify 恒真便于观察 Send。
type mockNotifier struct {
	mu         sync.Mutex
	sends      int
	recoveries int
}

func (m *mockNotifier) ShouldNotify(string) bool { return true }
func (m *mockNotifier) MarkNotified(string)      {}
func (m *mockNotifier) ClearNotified(string)     {}
func (m *mockNotifier) Send(_, _, _ string)      { m.mu.Lock(); m.sends++; m.mu.Unlock() }
func (m *mockNotifier) SendRecovery(_, _ string) { m.mu.Lock(); m.recoveries++; m.mu.Unlock() }

// TestRecoveryNotification 验证宕机→恢复的翻转会触发一次恢复通知（而非普通告警）。
func TestRecoveryNotification(t *testing.T) {
	database := setupTestDB(t)
	defer database.Close()

	var up atomic.Bool
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		if up.Load() {
			w.WriteHeader(http.StatusOK)
		} else {
			w.WriteHeader(http.StatusInternalServerError)
		}
	}))
	defer srv.Close()

	mock := &mockNotifier{}
	hc := NewHealthChecker(database, mock)
	if _, err := hc.AddTarget(model.MonitorTargetInput{Name: "svc", URL: srv.URL}); err != nil {
		t.Fatalf("AddTarget: %v", err)
	}

	ctx := context.Background()
	up.Store(false)
	hc.runAllChecks(ctx) // 宕机轮次 → 触发告警
	up.Store(true)
	hc.runAllChecks(ctx) // 恢复轮次 → 触发恢复通知

	mock.mu.Lock()
	defer mock.mu.Unlock()
	if mock.recoveries != 1 {
		t.Errorf("期望 1 次恢复通知，实际 %d", mock.recoveries)
	}
	if mock.sends < 1 {
		t.Errorf("期望至少 1 次宕机告警，实际 %d", mock.sends)
	}
}
