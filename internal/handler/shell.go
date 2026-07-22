package handler

import (
	"encoding/json"
	"log/slog"
	"net"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"golang.org/x/crypto/ssh"

	"github.com/YingXiaoMo/nav/internal/model"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  4096,
	WriteBufferSize: 4096,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

// SSHWebSocket handles GET /api/v1/ws/ssh — WebSocket SSH 代理
func (h *Handler) SSHWebSocket() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		host := r.URL.Query().Get("host")
		user := r.URL.Query().Get("user")
		pass := r.URL.Query().Get("pass")
		portStr := r.URL.Query().Get("port")
		if host == "" || user == "" {
			model.RespondError(w, http.StatusBadRequest, "缺少 SSH 连接参数")
			return
		}
		port := 22
		if portStr != "" {
			if p, err := strconv.Atoi(portStr); err == nil {
				port = p
			}
		}

		// 兼容 host 已带端口、或是完整 URL
		addr := host
		if u, err := parseSSHHost(host); err == nil {
			addr = u
		}
		if _, _, err := net.SplitHostPort(addr); err != nil {
			addr = net.JoinHostPort(addr, strconv.Itoa(port))
		}

		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			slog.Error("WebSocket upgrade 失败", "error", err)
			return
		}
		defer conn.Close()

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
			HostKeyCallback: ssh.InsecureIgnoreHostKey(),
			Timeout:         10 * time.Second,
		}

		client, err := ssh.Dial("tcp", addr, sshConfig)
		if err != nil {
			_ = conn.WriteMessage(websocket.TextMessage, []byte("\r\nSSH 连接失败: "+err.Error()+"\r\n"))
			return
		}
		defer client.Close()

		session, err := client.NewSession()
		if err != nil {
			_ = conn.WriteMessage(websocket.TextMessage, []byte("\r\nSSH 会话创建失败: "+err.Error()+"\r\n"))
			return
		}
		defer session.Close()

		modes := ssh.TerminalModes{
			ssh.ECHO:          1,
			ssh.TTY_OP_ISPEED: 14400,
			ssh.TTY_OP_OSPEED: 14400,
		}
		if err := session.RequestPty("xterm-256color", 24, 80, modes); err != nil {
			_ = conn.WriteMessage(websocket.TextMessage, []byte("\r\nPTY 分配失败: "+err.Error()+"\r\n"))
			return
		}

		stdout, err := session.StdoutPipe()
		if err != nil {
			_ = conn.WriteMessage(websocket.TextMessage, []byte("\r\nSSH 管道初始化失败: "+err.Error()+"\r\n"))
			return
		}
		stderr, err := session.StderrPipe()
		if err != nil {
			_ = conn.WriteMessage(websocket.TextMessage, []byte("\r\nSSH 管道初始化失败: "+err.Error()+"\r\n"))
			return
		}
		stdin, err := session.StdinPipe()
		if err != nil {
			_ = conn.WriteMessage(websocket.TextMessage, []byte("\r\nSSH 管道初始化失败: "+err.Error()+"\r\n"))
			return
		}

		if err := session.Shell(); err != nil {
			_ = conn.WriteMessage(websocket.TextMessage, []byte("\r\nShell 启动失败: "+err.Error()+"\r\n"))
			return
		}

		_ = conn.WriteMessage(websocket.TextMessage, []byte("\x1b[32mSSH 已连接 "+user+"@"+addr+"\x1b[0m\r\n"))

		var wg sync.WaitGroup
		wg.Add(2)

		// stdout → WebSocket
		go func() {
			defer wg.Done()
			buf := make([]byte, 4096)
			for {
				n, err := stdout.Read(buf)
				if n > 0 {
					_ = conn.WriteMessage(websocket.BinaryMessage, buf[:n])
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
					_ = conn.WriteMessage(websocket.BinaryMessage, buf[:n])
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
	if !containsScheme(raw) {
		return raw, nil
	}
	// http(s)://host:port/path
	// 简单解析，避免依赖 net/url 对不带 scheme 的处理差异
	rest := raw
	if i := indexOf(raw, "://"); i >= 0 {
		rest = raw[i+3:]
	}
	if i := indexOf(rest, "/"); i >= 0 {
		rest = rest[:i]
	}
	if i := indexOf(rest, "#"); i >= 0 {
		rest = rest[:i]
	}
	return rest, nil
}

func containsScheme(s string) bool {
	return indexOf(s, "://") >= 0
}

func indexOf(s, sub string) int {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return i
		}
	}
	return -1
}
