package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestOriginCheck(t *testing.T) {
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	handler := OriginCheck(next)

	post := func(origin, host string) int {
		req := httptest.NewRequest(http.MethodPost, "http://"+host+"/api/v1/settings", nil)
		if origin != "" {
			req.Header.Set("Origin", origin)
		}
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
		return rec.Code
	}

	// 同源：放行（浏览器同源 POST 也带 Origin）
	if code := post("http://192.168.0.100:8642", "192.168.0.100:8642"); code != http.StatusOK {
		t.Errorf("同源 POST 应放行, got %d", code)
	}
	// 非浏览器客户端：无 Origin，放行
	if code := post("", "192.168.0.100:8642"); code != http.StatusOK {
		t.Errorf("无 Origin 的 POST（脚本场景）应放行, got %d", code)
	}
	// 同站不同源：同 IP 不同端口的其他服务 → 拒绝（CSRF 面）
	if code := post("http://192.168.0.100:9999", "192.168.0.100:8642"); code != http.StatusForbidden {
		t.Errorf("同站跨源 POST 应拒绝, got %d", code)
	}
	// 同主域不同子域 → 拒绝
	if code := post("http://evil.ovoxo.cc", "nav.ovoxo.cc"); code != http.StatusForbidden {
		t.Errorf("跨子域 POST 应拒绝, got %d", code)
	}
	// 完全异源 → 拒绝
	if code := post("https://evil.example.com", "nav.ovoxo.cc"); code != http.StatusForbidden {
		t.Errorf("异源 POST 应拒绝, got %d", code)
	}
	// GET 不受影响（公开导航页读取）
	req := httptest.NewRequest(http.MethodGet, "http://192.168.0.100:8642/", nil)
	req.Header.Set("Origin", "http://evil.example.com")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Errorf("GET 不应校验 Origin, got %d", rec.Code)
	}
	// 非法 Origin 解析失败 → 拒绝
	if code := post("::::", "192.168.0.100:8642"); code != http.StatusForbidden {
		t.Errorf("非法 Origin 应拒绝, got %d", code)
	}
}
