package middleware

import (
	"net/http"
	"net/url"
)

// OriginCheck 对状态变更请求（非 GET/HEAD/OPTIONS）校验 Origin 头：
// 浏览器发起的跨源请求必带 Origin，与请求 Host 不一致即拒绝。
//
// 为什么需要：会话 Cookie 是 SameSite=Lax，只能挡跨**站**请求；
// 同站不同源（例如同一台 NAS 上其他端口的服务、同一主域的其他子域）
// 仍会随请求携带 Cookie，构成 CSRF 面——被入侵的同机服务可以
// 借用户的已登录会话调用 /api/v1/admin/* 状态变更接口。
//
// 非浏览器客户端（curl / 脚本）通常不带 Origin 头，按原样放行，
// 不影响 API 直连使用场景。GET/HEAD/OPTIONS 不做校验（首页公开读 + 预检）。
func OriginCheck(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead && r.Method != http.MethodOptions {
			if origin := r.Header.Get("Origin"); origin != "" {
				u, err := url.Parse(origin)
				if err != nil || u.Host != r.Host {
					http.Error(w, "cross-origin request rejected", http.StatusForbidden)
					return
				}
			}
		}
		next.ServeHTTP(w, r)
	})
}
