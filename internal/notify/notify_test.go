package notify

import (
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
)

func TestSendTest_EmptyURL(t *testing.T) {
	if err := SendTest(Config{}); err == nil {
		t.Error("空 Apprise 地址应返回错误")
	}
}

func TestSendTest_Posts(t *testing.T) {
	var hits atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		hits.Add(1)
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	if err := SendTest(Config{AppriseURL: srv.URL}); err != nil {
		t.Fatalf("SendTest: %v", err)
	}
	if hits.Load() != 1 {
		t.Errorf("期望 1 次 POST，实际 %d", hits.Load())
	}
}

func TestSendTest_ServerError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer srv.Close()

	if err := SendTest(Config{AppriseURL: srv.URL}); err == nil {
		t.Error("服务端 500 应返回错误")
	}
}

func TestClearNotified(t *testing.T) {
	s := NewSender(Config{Enabled: true, AppriseURL: "http://example", CooldownMinutes: 30})
	s.MarkNotified("t1")
	if s.ShouldNotify("t1") {
		t.Error("冷却期内不应再次通知")
	}
	s.ClearNotified("t1")
	if !s.ShouldNotify("t1") {
		t.Error("清除冷却后应可再次通知")
	}
}
