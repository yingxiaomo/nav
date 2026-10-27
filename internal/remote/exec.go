package remote

import (
	"bytes"
	"fmt"
	"net"
	"strings"
	"time"

	"golang.org/x/crypto/ssh"
)

// SSHExec 实现 Executor 接口的 SSH 执行器
type SSHExec struct {
	hostKeys *HostKeyManager
}

// NewSSHExec 创建执行器。hostKeys 用于 TOFU 主机密钥校验；为 nil 时退回到
// 不校验主机密钥（仅用于测试）。
func NewSSHExec(hostKeys *HostKeyManager) *SSHExec {
	return &SSHExec{hostKeys: hostKeys}
}

func (e *SSHExec) hostKeyCallback() ssh.HostKeyCallback {
	if e.hostKeys != nil {
		return e.hostKeys.Callback()
	}
	return ssh.InsecureIgnoreHostKey()
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
		HostKeyCallback: e.hostKeyCallback(),
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

	// 命令级超时：一条 sleep 999999 之类的命令不应把 HTTP 请求或 TG pollLoop 永久挂住。
	// Close 会使 Run 立即失败，goroutine 经带缓冲 channel 退出，不会泄漏。
	done := make(chan error, 1)
	go func() { done <- session.Run(cmd) }()
	select {
	case err := <-done:
		if err != nil {
			errMsg := strings.TrimSpace(stderr.String())
			if errMsg != "" {
				return "", fmt.Errorf("命令执行失败: %s", errMsg)
			}
			return "", fmt.Errorf("命令执行失败: %w", err)
		}
	case <-time.After(30 * time.Second):
		_ = session.Close()
		return "", fmt.Errorf("命令执行超时（30 秒），已中断")
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
