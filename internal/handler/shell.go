package handler

import (
	"encoding/json"
	"log/slog"
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
		if host == "" || user == "" || pass == "" {
			model.RespondError(w, http.StatusBadRequest, "缺少 SSH 连接参数")
			return
		}
		port := 22
		if portStr != "" {
			if p, err := strconv.Atoi(portStr); err == nil {
				port = p
			}
		}

		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			slog.Error("WebSocket upgrade 失败", "error", err)
			return
		}
		defer conn.Close()

		sshConfig := &ssh.ClientConfig{
			User:            user,
			Auth:            []ssh.AuthMethod{ssh.Password(pass)},
			HostKeyCallback: ssh.InsecureIgnoreHostKey(),
			Timeout:         10 * time.Second,
		}

		client, err := ssh.Dial("tcp", host+":"+strconv.Itoa(port), sshConfig)
		if err != nil {
			conn.WriteMessage(websocket.TextMessage, []byte("SSH 连接失败: "+err.Error()+"\r\n"))
			return
		}
		defer client.Close()

		session, err := client.NewSession()
		if err != nil {
			conn.WriteMessage(websocket.TextMessage, []byte("SSH 会话创建失败: "+err.Error()+"\r\n"))
			return
		}
		defer session.Close()

		// PTY
		modes := ssh.TerminalModes{
			ssh.ECHO:          1,
			ssh.TTY_OP_ISPEED: 14400,
			ssh.TTY_OP_OSPEED: 14400,
		}
		if err := session.RequestPty("xterm-256color", 24, 80, modes); err != nil {
			conn.WriteMessage(websocket.TextMessage, []byte("PTY 分配失败: "+err.Error()+"\r\n"))
			return
		}

		stdout, _ := session.StdoutPipe()
		stderr, _ := session.StderrPipe()
		stdin, _ := session.StdinPipe()

		if err := session.Shell(); err != nil {
			conn.WriteMessage(websocket.TextMessage, []byte("Shell 启动失败: "+err.Error()+"\r\n"))
			return
		}

		var wg sync.WaitGroup
		wg.Add(2)

		// stdout → WebSocket
		go func() {
			defer wg.Done()
			buf := make([]byte, 4096)
			for {
				n, err := stdout.Read(buf)
				if n > 0 {
					conn.WriteMessage(websocket.BinaryMessage, buf[:n])
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
					conn.WriteMessage(websocket.BinaryMessage, buf[:n])
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
					session.Close()
					return
				}
				var resize struct {
					Type   string `json:"type"`
					Width  int    `json:"width"`
					Height int    `json:"height"`
				}
				if json.Unmarshal(msg, &resize) == nil && resize.Type == "resize" {
					session.WindowChange(resize.Height, resize.Width)
					continue
				}
				stdin.Write(msg)
			}
		}()

		session.Wait()
		wg.Wait()
	}
}
