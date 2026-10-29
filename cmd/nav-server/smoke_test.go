package main

// 全功能冒烟测试：调用真实的 run() 启动完整服务（真实中间件、路由注册、
// SQLite、静态文件、安全响应头），用 HTTP 请求走查核心功能面。
// CI 的 go test ./... 自动执行本文件；任何回归直接红。
//
// 覆盖：健康检查、认证（setup/登录/限流/登出）、匿名门控 401、安全响应头、
// 分类与书签 CRUD+排序、聚合数据（匿名剥离笔记/待办）、搜索与 LIKE 转义、
// 设置保护键、上传生命周期、监控 CRUD+首轮检查、备份导出/导入往返、
// AI/SSH 错误路径、静态页、优雅关闭。
//
// 不覆盖（环境受限）：Docker socket 端点（CI/本地无 socket 或平台不同，
// 已在真实 NAS 部署上人工验证）、WebSocket 终端交互。

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net"
	"net/http"
	"net/http/cookiejar"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

const smokePass = "SmokePass123"

func TestSmoke(t *testing.T) {
	base := startTestServer(t)
	c := newSmokeClient()

	// ── 1. 匿名状态 ──
	st, body := doJSON(t, c, http.MethodGet, base+"/api/v1/auth/status", nil)
	expect(t, "匿名 auth/status 200", st == http.StatusOK, st)
	expect(t, "提示需要初始化", strings.Contains(body, `"setupRequired":true`), body)

	// ── 2. 匿名门控：敏感端点一律 401（登录门控回归） ──
	for _, p := range []string{"/api/v1/notes", "/api/v1/todos", "/api/v1/admin/monitor/all", "/api/v1/settings"} {
		st, _ = doJSON(t, c, http.MethodGet, base+p, nil)
		expect(t, "匿名 "+p+" 应 401", st == http.StatusUnauthorized, st)
	}

	// ── 3. 安全响应头 ──
	resp := httpGet(t, c, base+"/api/v1/health")
	h := resp.Header
	expect(t, "CSP 存在", h.Get("Content-Security-Policy") != "", "")
	expect(t, "nosniff", h.Get("X-Content-Type-Options") == "nosniff", h.Get("X-Content-Type-Options"))
	expect(t, "X-Frame-Options DENY", h.Get("X-Frame-Options") == "DENY", h.Get("X-Frame-Options"))
	expect(t, "HSTS 存在", h.Get("Strict-Transport-Security") != "", "")
	expect(t, "API no-store", h.Get("Cache-Control") == "no-store", h.Get("Cache-Control"))

	// ── 4. setup 初始化（自动签发会话） ──
	st, body = doJSON(t, c, http.MethodPost, base+"/api/v1/auth/setup",
		map[string]string{"username": "smoke-admin", "password": smokePass})
	expect(t, "setup 201", st == http.StatusCreated, fmt.Sprintf("%d %s", st, body))
	st, body = doJSON(t, c, http.MethodGet, base+"/api/v1/auth/status", nil)
	expect(t, "登录态生效", strings.Contains(body, `"loggedIn":true`), body)

	// ── 5. 分类 + 书签 CRUD + 排序 ──
	st, body = doJSON(t, c, http.MethodPost, base+"/api/v1/categories", map[string]string{"title": "SmokeCat", "icon": "Folder"})
	expect(t, "创建分类", st == http.StatusOK || st == http.StatusCreated, st)
	catID := extractID(t, body)
	st, body = doJSON(t, c, http.MethodPost, base+"/api/v1/bookmarks",
		map[string]any{"title": "Smoke Bookmark", "url": "https://example.com", "categoryId": catID})
	expect(t, "创建书签", st == http.StatusOK || st == http.StatusCreated, fmt.Sprintf("%d %s", st, body))
	bmID := extractID(t, body)
	st, body = doJSON(t, c, http.MethodPost, base+"/api/v1/bookmarks",
		map[string]any{"title": "SmokeFolder", "isFolder": true, "categoryId": catID})
	expect(t, "创建子文件夹", (st == http.StatusOK || st == http.StatusCreated) && extractID(t, body) != "",
		fmt.Sprintf("%d %s", st, body))
	folderID := extractID(t, body)
	st, _ = doJSON(t, c, http.MethodPut, base+"/api/v1/bookmarks/"+bmID,
		map[string]any{"title": "Smoke Renamed", "url": "https://example.com", "categoryId": catID})
	expect(t, "更新书签", st == http.StatusOK, st)
	st, _ = doJSON(t, c, http.MethodPatch, base+"/api/v1/bookmarks/reorder",
		map[string]any{"items": []map[string]any{{"id": bmID, "order": 0}, {"id": folderID, "order": 1}}})
	expect(t, "书签排序", st == http.StatusOK, st)
	_, body = doJSON(t, c, http.MethodGet, base+"/api/v1/bookmarks", nil)
	expect(t, "书签列表含改名", strings.Contains(body, "Smoke Renamed"), body)

	// ── 6. 聚合数据：登录态完整、匿名剥离笔记/待办 ──
	st, _ = doJSON(t, c, http.MethodPut, base+"/api/v1/data", map[string]any{
		"notes": []map[string]any{{"id": "n1", "title": "SmokeNote", "content": "secret-content", "updatedAt": 123}},
		"todos": []map[string]any{{"id": "t1", "text": "smoke-task", "completed": false, "createdAt": 123}},
	})
	expect(t, "PUT /data", st == http.StatusOK, st)
	_, body = doJSON(t, c, http.MethodGet, base+"/api/v1/data", nil)
	expect(t, "登录态含笔记", strings.Contains(body, "SmokeNote"), "")
	expect(t, "登录态含待办", strings.Contains(body, "smoke-task"), "")
	expect(t, "子文件夹以 folder 类型呈现", strings.Contains(body, `"type":"folder"`), body)
	anon := newSmokeClient()
	_, body = doJSON(t, anon, http.MethodGet, base+"/api/v1/data", nil)
	expect(t, "匿名剥离笔记（回归）", !strings.Contains(body, "SmokeNote"), body)
	expect(t, "匿名剥离待办", !strings.Contains(body, "smoke-task"), body)

	// ── 7. 搜索与 LIKE 转义 ──
	_, body = doJSON(t, anon, http.MethodGet, base+"/api/v1/search?q=Smoke", nil)
	expect(t, "匿名搜索到书签", strings.Contains(body, `"type":"bookmark"`), body)
	st, body = doJSON(t, anon, http.MethodGet, base+"/api/v1/search?q=%25", nil)
	expect(t, "LIKE 转义（%不放大）", st == http.StatusOK && !strings.Contains(body, `"type"`),
		fmt.Sprintf("%d %s", st, body))
	st, _ = doJSON(t, anon, http.MethodGet, base+"/api/v1/suggest?q=Smo", nil)
	expect(t, "suggest 200", st == http.StatusOK, st)

	// ── 8. 设置：改标题 + 保护键脱敏 ──
	st, _ = doJSON(t, c, http.MethodPut, base+"/api/v1/settings", map[string]string{"title": "SMOKE-TITLE-1"})
	expect(t, "PUT settings", st == http.StatusOK, st)
	_, body = doJSON(t, c, http.MethodGet, base+"/api/v1/data", nil)
	expect(t, "标题生效", strings.Contains(body, "SMOKE-TITLE-1"), "")
	_, body = doJSON(t, c, http.MethodGet, base+"/api/v1/settings/session_secret", nil)
	expect(t, "session_secret 读脱敏", strings.Contains(body, `"value":""`), body)

	// ── 9. 上传生命周期 ──
	png := mustDecodeBase64(t, "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==")
	st, body = doUpload(t, c, base+"/api/v1/upload", png)
	expect(t, "上传", st == http.StatusOK || st == http.StatusCreated, fmt.Sprintf("%d %s", st, body))
	fileURL := extractString(t, body, "url")
	fileName := extractString(t, body, "filename")
	expect(t, "上传返回URL", fileURL != "", body)
	st, _ = doJSON(t, anon, http.MethodGet, base+fileURL, nil)
	expect(t, "上传公网可读", st == http.StatusOK, st)
	st, body = doJSON(t, c, http.MethodGet, base+"/api/v1/admin/uploads", nil)
	expect(t, "上传列表可见", strings.Contains(body, fileName), body)
	st, _ = doJSON(t, c, http.MethodDelete, base+"/api/v1/admin/uploads/"+fileName, nil)
	expect(t, "删除上传", st == http.StatusOK, st)
	st, _ = doJSON(t, anon, http.MethodGet, base+fileURL, nil)
	expect(t, "删除后 404", st == http.StatusNotFound, st)

	// ── 10. 监控：创建 → 首轮检查 ok → 删除 ──
	selfURL := fmt.Sprintf("%s/api/v1/health", base)
	st, body = doJSON(t, c, http.MethodPost, base+"/api/v1/admin/monitor/checks",
		map[string]any{"name": "smoke-self", "url": selfURL, "checkType": "http", "timeout": 5})
	expect(t, "创建监控目标", st == http.StatusOK || st == http.StatusCreated, fmt.Sprintf("%d %s", st, body))
	var checkID string
	deadline := time.Now().Add(10 * time.Second)
	for time.Now().Before(deadline) {
		_, body = doJSON(t, c, http.MethodGet, base+"/api/v1/admin/monitor/checks", nil)
		checkID = findIDByName(t, body, "smoke-self")
		if checkID != "" {
			break
		}
		time.Sleep(300 * time.Millisecond)
	}
	expect(t, "监控列表可见", checkID != "", "")
	healthOK := false
	deadline = time.Now().Add(15 * time.Second)
	for time.Now().Before(deadline) {
		_, body = doJSON(t, c, http.MethodGet, base+"/api/v1/admin/monitor/all", nil)
		if strings.Contains(body, `"status":"ok"`) {
			healthOK = true
			break
		}
		time.Sleep(500 * time.Millisecond)
	}
	expect(t, "首轮检查 ok", healthOK, "")
	st, _ = doJSON(t, c, http.MethodDelete, base+"/api/v1/admin/monitor/checks/"+checkID, nil)
	expect(t, "删除监控", st == http.StatusOK, st)

	// ── 11. 备份导出/导入往返（含 session_secret 保护回归） ──
	st, backupBody := doJSON(t, c, http.MethodGet, base+"/api/v1/admin/backup", nil)
	expect(t, "导出备份", st == http.StatusOK, st)
	expect(t, "备份不含 session_secret", !strings.Contains(backupBody, "session_secret"), "")
	st, _ = doJSON(t, c, http.MethodPut, base+"/api/v1/settings", map[string]string{"title": "SMOKE-TITLE-2"})
	expect(t, "导入前改标题", st == http.StatusOK, st)
	var backup map[string]any
	if err := json.Unmarshal([]byte(backupBody), &backup); err != nil {
		t.Fatalf("备份 JSON 解析失败: %v", err)
	}
	st, _ = doJSON(t, c, http.MethodPost, base+"/api/v1/admin/backup", backup)
	expect(t, "导入备份", st == http.StatusOK, st)
	_, body = doJSON(t, c, http.MethodGet, base+"/api/v1/data", nil)
	expect(t, "标题被还原", strings.Contains(body, "SMOKE-TITLE-1"), "")
	st, body = doJSON(t, c, http.MethodGet, base+"/api/v1/auth/status", nil)
	expect(t, "导入后 cookie 仍有效（保护键回归）", st == http.StatusOK && strings.Contains(body, `"loggedIn":true`), body)

	// ── 12. 登录限流（5 连败封锁，回归） ──
	// 用户名带随机后缀：限流计数是进程级状态，-count=2 重跑时不能被上一轮污染
	probeUser := fmt.Sprintf("smoke-limit-%d", time.Now().UnixNano())
	var lastStatus int
	for i := 0; i < 5; i++ {
		lastStatus, _ = doJSON(t, anon, http.MethodPost, base+"/api/v1/auth/login",
			map[string]string{"username": probeUser, "password": "wrong"})
		expect(t, fmt.Sprintf("限流第 %d 次 401", i+1), lastStatus == http.StatusUnauthorized, lastStatus)
	}
	lastStatus, _ = doJSON(t, anon, http.MethodPost, base+"/api/v1/auth/login",
		map[string]string{"username": probeUser, "password": "wrong"})
	expect(t, "第 6 次 429（回归：限流曾从未生效）", lastStatus == http.StatusTooManyRequests, lastStatus)

	// ── 13. AI 未配置错误路径（处理器把错误包成 200 + reply 文案） ──
	st, body = doJSON(t, c, http.MethodPost, base+"/api/v1/ai/chat", map[string]string{"message": "hi"})
	expect(t, "AI 未配置提示", strings.Contains(body, "AI 未配置"), fmt.Sprintf("%d %s", st, body))

	// ── 14. SSH exec 错误路径（连接拒绝，快速失败不挂起） ──
	st, body = doJSON(t, c, http.MethodPost, base+"/api/v1/ssh/exec",
		map[string]any{"host": "127.0.0.1", "port": 1, "user": "u", "pass": "p", "command": "ls"})
	expect(t, "SSH exec 错误路径", st >= 400 && strings.Contains(body, "error"), fmt.Sprintf("%d %s", st, body))

	// ── 15. 静态页 ──
	st, body = doJSON(t, anon, http.MethodGet, base+"/", nil)
	expect(t, "首页静态 200", st == http.StatusOK && strings.Contains(body, "SMOKE-INDEX-MARKER"), st)
	st, body = doJSON(t, anon, http.MethodGet, base+"/admin", nil)
	expect(t, "admin 页静态 200", st == http.StatusOK && strings.Contains(body, "SMOKE-ADMIN-MARKER"), st)

	// ── 16. 登出：会话轮换 + 旧 cookie 失效 ──
	st, _ = doJSON(t, c, http.MethodPost, base+"/api/v1/auth/logout", nil)
	expect(t, "登出", st == http.StatusOK, st)
	st, body = doJSON(t, c, http.MethodGet, base+"/api/v1/auth/status", nil)
	expect(t, "登出后 loggedIn=false", strings.Contains(body, `"loggedIn":false`), body)
	st, _ = doJSON(t, c, http.MethodGet, base+"/api/v1/notes", nil)
	expect(t, "登出后旧 cookie 401", st == http.StatusUnauthorized, st)

	t.Logf("冒烟测试全部通过")
}

// startTestServer 以测试配置启动真实服务并等待就绪；t.Cleanup 中优雅关闭。
func startTestServer(t *testing.T) string {
	t.Helper()

	l, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("分配端口失败: %v", err)
	}
	port := l.Addr().(*net.TCPAddr).Port
	l.Close()

	tmp := t.TempDir()
	staticDir := filepath.Join(tmp, "static")
	if err := os.MkdirAll(staticDir, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(staticDir, "index.html"), []byte("SMOKE-INDEX-MARKER"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(staticDir, "admin.html"), []byte("SMOKE-ADMIN-MARKER"), 0o644); err != nil {
		t.Fatal(err)
	}

	cfg := Config{
		Port:      port,
		DBPath:    filepath.Join(tmp, "smoke.db"),
		UploadDir: filepath.Join(tmp, "uploads"),
		DataDir:   filepath.Join(tmp, "data"),
		StaticDir: staticDir,
	}
	ctx, cancel := context.WithCancel(context.Background())
	errCh := make(chan error, 1)
	go func() { errCh <- run(ctx, cfg) }()
	t.Cleanup(func() {
		cancel()
		select {
		case err := <-errCh:
			if err != nil {
				t.Errorf("服务未优雅退出: %v", err)
			}
		case <-time.After(20 * time.Second):
			t.Error("服务 20s 内未优雅退出")
		}
	})

	base := fmt.Sprintf("http://127.0.0.1:%d", port)
	deadline := time.Now().Add(15 * time.Second)
	for time.Now().Before(deadline) {
		resp, err := http.Get(base + "/api/v1/health")
		if err == nil {
			_, _ = io.Copy(io.Discard, resp.Body)
			resp.Body.Close()
			if resp.StatusCode == http.StatusOK {
				return base
			}
		}
		time.Sleep(150 * time.Millisecond)
	}
	t.Fatal("服务 15s 内未就绪")
	return base
}

// ── 测试辅助 ──

func newSmokeClient() *http.Client {
	jar, err := cookiejar.New(nil)
	if err != nil {
		panic(err)
	}
	return &http.Client{Jar: jar, Timeout: 15 * time.Second}
}

func doJSON(t *testing.T, c *http.Client, method, url string, body any) (int, string) {
	t.Helper()
	var rd io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			t.Fatalf("marshal: %v", err)
		}
		rd = bytes.NewReader(b)
	}
	req, err := http.NewRequest(method, url, rd)
	if err != nil {
		t.Fatalf("new request: %v", err)
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := c.Do(req)
	if err != nil {
		t.Fatalf("%s %s: %v", method, url, err)
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	return resp.StatusCode, string(b)
}

func httpGet(t *testing.T, c *http.Client, url string) *http.Response {
	t.Helper()
	resp, err := c.Get(url)
	if err != nil {
		t.Fatalf("GET %s: %v", url, err)
	}
	t.Cleanup(func() { resp.Body.Close() })
	_, _ = io.Copy(io.Discard, resp.Body)
	return resp
}

func doUpload(t *testing.T, c *http.Client, url string, png []byte) (int, string) {
	t.Helper()
	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)
	part, err := w.CreateFormFile("file", "smoke.png")
	if err != nil {
		t.Fatalf("multipart: %v", err)
	}
	if _, err := part.Write(png); err != nil {
		t.Fatalf("multipart write: %v", err)
	}
	if err := w.Close(); err != nil {
		t.Fatalf("multipart close: %v", err)
	}
	req, err := http.NewRequest(http.MethodPost, url, &buf)
	if err != nil {
		t.Fatalf("new upload: %v", err)
	}
	req.Header.Set("Content-Type", w.FormDataContentType())
	resp, err := c.Do(req)
	if err != nil {
		t.Fatalf("upload: %v", err)
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	return resp.StatusCode, string(b)
}

func expect(t *testing.T, name string, cond bool, ctx any) {
	t.Helper()
	if !cond {
		t.Errorf("FAIL %s（上下文: %v）", name, ctx)
	} else {
		t.Logf("PASS %s", name)
	}
}

func extractID(t *testing.T, body string) string {
	t.Helper()
	var m map[string]any
	if err := json.Unmarshal([]byte(body), &m); err != nil {
		t.Fatalf("解析响应失败: %v (%s)", err, body)
	}
	if id, ok := m["id"].(string); ok {
		return id
	}
	t.Fatalf("响应中无 id: %s", body)
	return ""
}

func extractString(t *testing.T, body, key string) string {
	t.Helper()
	var m map[string]any
	if err := json.Unmarshal([]byte(body), &m); err != nil {
		return ""
	}
	s, _ := m[key].(string)
	return s
}

func findIDByName(t *testing.T, body, name string) string {
	t.Helper()
	// ListChecks 响应为 {"targets":[...],"results":[...]}，兼容裸数组
	var wrapped struct {
		Targets []map[string]any `json:"targets"`
		Checks  []map[string]any `json:"checks"`
	}
	var items []map[string]any
	if err := json.Unmarshal([]byte(body), &wrapped); err == nil {
		items = append(wrapped.Targets, wrapped.Checks...)
	} else if err := json.Unmarshal([]byte(body), &items); err != nil {
		return ""
	}
	for _, it := range items {
		if it["name"] == name {
			if id, ok := it["id"].(string); ok {
				return id
			}
		}
	}
	return ""
}

func mustDecodeBase64(t *testing.T, s string) []byte {
	t.Helper()
	b, err := base64.StdEncoding.DecodeString(s)
	if err != nil {
		t.Fatalf("base64 解码失败: %v", err)
	}
	return b
}
