package remote

import (
	"bytes"
	"fmt"
	"net"
	"net/http"
	"strings"
	"time"

	"golang.org/x/crypto/ssh"
)

// SSHExec 实现 Executor 接口的 SSH/HTTP 执行器
type SSHExec struct {
	client *http.Client
}

// NewSSHExec 创建执行器
func NewSSHExec() *SSHExec {
	return &SSHExec{
		client: &http.Client{Timeout: 30 * time.Second},
	}
}

func (e *SSHExec) ExecSSH(host, username, password, cmd string) (string, error) {
	// host 可能是 "192.168.0.10" 或 "192.168.0.10:22"
	addr := host
	if _, _, err := net.SplitHostPort(host); err != nil {
		addr = net.JoinHostPort(host, "22")
	}

	config := &ssh.ClientConfig{
		User: username,
		Auth: []ssh.AuthMethod{
			ssh.Password(password),
			// OpenWrt / 部分发行版只接受 keyboard-interactive
			ssh.KeyboardInteractive(func(user, instruction string, questions []string, echos []bool) ([]string, error) {
				answers := make([]string, len(questions))
				for i := range questions {
					answers[i] = password
				}
				return answers, nil
			}),
		},
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		Timeout:         10 * time.Second,
	}

	conn, err := ssh.Dial("tcp", addr, config)
	if err != nil {
		return "", fmt.Errorf("SSH 连接失败: %w", err)
	}
	defer conn.Close()

	session, err := conn.NewSession()
	if err != nil {
		return "", fmt.Errorf("SSH 会话创建失败: %w", err)
	}
	defer session.Close()

	var stdout, stderr bytes.Buffer
	session.Stdout = &stdout
	session.Stderr = &stderr

	if err := session.Run(cmd); err != nil {
		errMsg := strings.TrimSpace(stderr.String())
		if errMsg != "" {
			return "", fmt.Errorf("命令执行失败: %s", errMsg)
		}
		return "", fmt.Errorf("命令执行失败: %w", err)
	}

	out := strings.TrimSpace(stdout.String())
	if out == "" {
		out = "✅ 命令执行完成（无输出）"
	}
	return truncate(out, 2000), nil
}

func truncate(s string, n int) string {
	runes := []rune(s)
	if len(runes) > n {
		return string(runes[:n]) + "..."
	}
	return s
}
