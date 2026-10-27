package handler

import (
	"encoding/json"
	"log/slog"
	"net"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"golang.org/x/crypto/ssh"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  4096,
	WriteBufferSize: 4096,
	// 仅允许同源发起的 WebSocket 握手，防止用户浏览的恶意网页驱动本端点
	// （跨站 WebSocket 劫持 / 用服务器做内网 SSH 跳板）。无 Origin 头的
	// 非浏览器客户端放行。
	CheckOrigin: func(r *http.Request) bool {
		origin := r.Header.Get("Origin")
		if origin == "" {
			return true
		}
		u, err := url.Parse(origin)
		if err != nil {
			return false
		}
		return u.Host == r.Host
	},
}

// wsWriter 对 WebSocket 写操作加互斥：gorilla/websocket 要求同一时刻
// 只有一个 goroutine 调用写方法，并发写会导致 panic 或帧损坏
type wsWriter struct {
	mu   sync.Mutex
	conn *websocket.Conn
}

func (ww *wsWriter) writeMessage(msgType int, data []byte) error {
	ww.mu.Lock()
	defer ww.mu.Unlock()
	return ww.conn.WriteMessage(msgType, data)
}

// hostKeyCallback 返回 TOFU 主机密钥校验回调；未注入 HostKeys 时退回不校验。
func (h *Handler) hostKeyCallback() ssh.HostKeyCallback {
	if h.HostKeys != nil {
		return h.HostKeys.Callback()
	}
	return ssh.InsecureIgnoreHostKey()
}

// SSHWebSocket handles GET /api/v1/ws/ssh — WebSocket SSH 代理
//
// SSH 凭据通过 WS 建立后的首条 JSON 消息（type=auth）传递，
// 不走 URL 查询串——查询串会落入反向代理访问日志。
func (h *Handler) SSHWebSocket() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			slog.Error("WebSocket upgrade 失败", "error", err)
			return
		}
		defer conn.Close()

		ww := &wsWriter{conn: conn}

		// 等待首条认证消息，10s 内未收到则断开
		_ = conn.SetReadDeadline(time.Now().Add(10 * time.Second))
		_, msg, err := conn.ReadMessage()
		if err != nil {
			_ = ww.writeMessage(websocket.TextMessage, []byte("\r\n未收到 SSH 认证消息: "+err.Error()+"\r\n"))
			return
		}
		_ = conn.SetReadDeadline(time.Time{})

		var auth struct {
			Type string `json:"type"`
			Host string `json:"host"`
			User string `json:"user"`
			Pass string `json:"pass"`
			Port int    `json:"port"`
		}
		if err := json.Unmarshal(msg, &auth); err != nil || auth.Type != "auth" || auth.Host == "" || auth.User == "" {
			_ = ww.writeMessage(websocket.TextMessage, []byte("\r\nSSH 认证消息无效\r\n"))
			return
		}
		host, user, pass := auth.Host, auth.User, auth.Pass
		port := auth.Port
		if port == 0 {
			port = 22
		}

		// 兼容 host 已带端口、或是完整 URL
		addr := host
		if u, err := parseSSHHost(host); err == nil {
			addr = u
		}
		if _, _, err := net.SplitHostPort(addr); err != nil {
			addr = net.JoinHostPort(addr, strconv.Itoa(port))
		}

		sshConfig := &ssh.ClientConfig{
			User: user,
			Auth: []ssh.AuthMethod{
				ssh.Password(pass),
				ssh.KeyboardInteractive(func(user, instruction string, questions []string, echos []bool) ([]string, error) {
					answers := make([]string, len(questions))
					for i := range questions {
						answers[i] = pass
					}
					return answers, nil
				}),
			},
			HostKeyCallback: h.hostKeyCallback(),
			Timeout:         10 * time.Second,
		}

		client, err := ssh.Dial("tcp", addr, sshConfig)
		if err != nil {
			_ = ww.writeMessage(websocket.TextMessage, []byte("\r\nSSH 连接失败: "+err.Error()+"\r\n"))
			return
		}
		defer client.Close()

		session, err := client.NewSession()
		if err != nil {
			_ = ww.writeMessage(websocket.TextMessage, []byte("\r\nSSH 会话创建失败: "+err.Error()+"\r\n"))
			return
		}
		defer session.Close()

		modes := ssh.TerminalModes{
			ssh.ECHO:          1,
			ssh.TTY_OP_ISPEED: 14400,
			ssh.TTY_OP_OSPEED: 14400,
		}
		if err := session.RequestPty("xterm-256color", 24, 80, modes); err != nil {
			_ = ww.writeMessage(websocket.TextMessage, []byte("\r\nPTY 分配失败: "+err.Error()+"\r\n"))
			return
		}

		stdout, err := session.StdoutPipe()
		if err != nil {
			_ = ww.writeMessage(websocket.TextMessage, []byte("\r\nSSH 管道初始化失败: "+err.Error()+"\r\n"))
			return
		}
		stderr, err := session.StderrPipe()
		if err != nil {
			_ = ww.writeMessage(websocket.TextMessage, []byte("\r\nSSH 管道初始化失败: "+err.Error()+"\r\n"))
			return
		}
		stdin, err := session.StdinPipe()
		if err != nil {
			_ = ww.writeMessage(websocket.TextMessage, []byte("\r\nSSH 管道初始化失败: "+err.Error()+"\r\n"))
			return
		}

		if err := session.Shell(); err != nil {
			_ = ww.writeMessage(websocket.TextMessage, []byte("\r\nShell 启动失败: "+err.Error()+"\r\n"))
			return
		}

		_ = ww.writeMessage(websocket.TextMessage, []byte("\x1b[32mSSH 已连接 "+user+"@"+addr+"\x1b[0m\r\n"))

		var wg sync.WaitGroup
		wg.Add(2)

		// stdout → WebSocket
		go func() {
			defer wg.Done()
			buf := make([]byte, 4096)
			for {
				n, err := stdout.Read(buf)
				if n > 0 {
					_ = ww.writeMessage(websocket.BinaryMessage, buf[:n])
				}
				if err != nil {
					return
				}
			}
		}()

		// stderr → WebSocket
		go func() {
			defer wg.Done()
			buf := make([]byte, 4096)
			for {
				n, err := stderr.Read(buf)
				if n > 0 {
					_ = ww.writeMessage(websocket.BinaryMessage, buf[:n])
				}
				if err != nil {
					return
				}
			}
		}()

		// WebSocket → stdin
		go func() {
			for {
				_, msg, err := conn.ReadMessage()
				if err != nil {
					_ = session.Close()
					return
				}
				var resize struct {
					Type   string `json:"type"`
					Cols   int    `json:"cols"`
					Rows   int    `json:"rows"`
					Width  int    `json:"width"`
					Height int    `json:"height"`
				}
				if json.Unmarshal(msg, &resize) == nil && resize.Type == "resize" {
					cols, rows := resize.Cols, resize.Rows
					if cols == 0 {
						cols = resize.Width
					}
					if rows == 0 {
						rows = resize.Height
					}
					if cols > 0 && rows > 0 {
						_ = session.WindowChange(rows, cols)
					}
					continue
				}
				_, _ = stdin.Write(msg)
			}
		}()

		_ = session.Wait()
		wg.Wait()
	}
}

// parseSSHHost 从可能的 URL 或 host:port 中提取主机名
func parseSSHHost(raw string) (string, error) {
	// 已经是 host 或 host:port
	i := strings.Index(raw, "://")
	if i < 0 {
		return raw, nil
	}
	// http(s)://host:port/path → 取 host:port 部分
	rest := raw[i+3:]
	if j := strings.IndexAny(rest, "/#"); j >= 0 {
		rest = rest[:j]
	}
	return rest, nil
}
