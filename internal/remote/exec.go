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

	stdout := newLimitedBuffer()
	stderr := newLimitedBuffer()
	session.Stdout = stdout
	session.Stderr = stderr

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
	if stdout.overflow || stderr.overflow {
		out += "\n…（输出超限已截断）"
	}
	if out == "" {
		out = "✅ 命令执行完成（无输出）"
	}
	return truncate(out, 2000), nil
}

// maxSSHOutput 限制单命令输出缓冲：journalctl/ls -R 级输出若不设上限，
// 30 秒内可吃掉数百 MB 内存（截断发生在读完之后就来不及了）。
const maxSSHOutput = 64 * 1024

// limitedBuffer 超限后丢弃后续写入（保留开头），Write 恒报告成功——
// SSH 会话不因缓冲上限而中断。
type limitedBuffer struct {
	buf      bytes.Buffer
	max      int
	overflow bool
}

func newLimitedBuffer() *limitedBuffer {
	return &limitedBuffer{max: maxSSHOutput}
}

func (l *limitedBuffer) Write(p []byte) (int, error) {
	if remain := l.max - l.buf.Len(); remain > 0 {
		if len(p) > remain {
			l.buf.Write(p[:remain])
			l.overflow = true
		} else {
			l.buf.Write(p)
		}
	}
	return len(p), nil
}

func (l *limitedBuffer) String() string { return l.buf.String() }

func truncate(s string, n int) string {
	runes := []rune(s)
	if len(runes) > n {
		return string(runes[:n]) + "..."
	}
	return s
}
