package tgbot

// /ask：AI 只读问答 + 命令提议 + 人工确认执行
//
// 安全边界（三道闸，缺一不可）：
//  1. AI 只读：给 LLM 的状态快照不含任何凭据，AI 自身没有执行通道；
//  2. 白名单：AI 提议的命令必须通过 validateProposal——只允许 docker
//     start/stop/restart 与一组只读诊断命令，管道/重定向/命令替换字符一律拒绝；
//  3. 人在环上：提议以 inline keyboard 下发，执行需人工点确认，
//     确认时对命令做二次校验，且提议 2 分钟过期、每个 chat 同时最多一个。

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/YingXiaoMo/nav/internal/service"
)

const (
	// proposalPrefix AI 回复中命令提议行的前缀
	proposalPrefix = "[RUN] "
	// pendingTTL 提议有效期，超时后确认按钮失效
	pendingTTL = 2 * time.Minute
	// callback 按钮的 callback_data
	cbConfirm = "askrun"
	cbCancel  = "askcancel"

	askSystemPrompt = `你是 homelab 内网助手，基于给定的实时状态快照回答问题、分析故障。回答用中文、简短。
如果你需要执行一个操作来进一步诊断或处置，可以在回答的最后一行输出恰好一条提议，格式：
[RUN] docker restart 容器名
[RUN] ssh 设备别名 df -h
规则：
- docker 仅允许 start/stop/restart + 容器名
- ssh 仅允许快照中列出的设备别名 + 只读命令（uptime / df -h / free / ip a / ps aux / lsblk / systemctl status X / journalctl -u X / ping -c 次数 主机 等）
- 不允许任何修改性、删除性、下载类命令，越界提议会被系统直接拒绝
- 若无需执行命令，不要输出 [RUN] 行`
)

// pendingAction 待确认的执行动作（每个 chat 同时最多一个）
type pendingAction struct {
	token    string // 随机 token，随确认按钮下发；旧消息上的按钮因 token 不匹配而失效
	display  string // 展示给用户的原始提议（执行时二次校验的依据）
	kind     string // "docker" | "ssh"
	target   string // 容器名 / 设备别名
	exec     string // docker 子动作 / ssh 命令
	expireAt time.Time
}

// aiopsState /ask 的运行时状态
type aiopsState struct {
	mu      sync.Mutex
	pending map[string]*pendingAction // key: chatID
}

// setPending 注册待确认动作（替换同 chat 旧提议）
func (s *aiopsState) setPending(chatID string, pa *pendingAction) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.pending == nil {
		s.pending = make(map[string]*pendingAction)
	}
	s.pending[chatID] = pa
}

// takePending 取出并删除待确认动作（取消路径用）
func (s *aiopsState) takePending(chatID string) *pendingAction {
	s.mu.Lock()
	defer s.mu.Unlock()
	pa := s.pending[chatID]
	delete(s.pending, chatID)
	return pa
}

// takePendingIfToken 仅当 token 匹配时取出并删除待确认动作。
// 原子执行：旧提议的按钮不会误消费新提议，且并发双击只有一次能通过。
func (s *aiopsState) takePendingIfToken(chatID, token string) *pendingAction {
	s.mu.Lock()
	defer s.mu.Unlock()
	pa := s.pending[chatID]
	if pa == nil || pa.token != token {
		return nil
	}
	delete(s.pending, chatID)
	return pa
}

// newActionToken 生成确认 token（crypto/rand，不可猜测）
func newActionToken() string {
	b := make([]byte, 8)
	if _, err := rand.Read(b); err != nil {
		// rand 失败极罕见；退化为时间戳，仍保证同 chat 内提议互不相同
		return fmt.Sprintf("t%x", time.Now().UnixNano())
	}
	return hex.EncodeToString(b)
}

// ===== 提议校验 =====

var (
	proposedContainerRe = regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9_.-]*$`)
	simpleTokenRe       = regexp.MustCompile(`^[a-zA-Z0-9@._-]+$`) // systemd unit 名等
	pathTokenRe         = regexp.MustCompile(`^[a-zA-Z0-9/._-]+$`) // ls 路径参数
	digitsRe            = regexp.MustCompile(`^[0-9]+$`)           // ping 次数
	hostTokenRe         = regexp.MustCompile(`^[a-zA-Z0-9.-]+$`)   // ping 主机
)

func simpleTokenParam(rest string) error {
	if !simpleTokenRe.MatchString(rest) {
		return fmt.Errorf("参数不合法: %q", rest)
	}
	return nil
}

// 禁止出现的字符：阻断命令链接（; & |）、重定向（> <）、命令替换（` $）与引号注入
var forbiddenSubstrs = []string{";", "&", "|", "`", "$", ">", "<", "\n", "\r", "'", `"`}

// 精确匹配的只读命令白名单（不含参数化命令）
var sshExactCmds = map[string]bool{
	"uptime": true, "uname -a": true, "hostname": true, "date": true, "who": true,
	"df": true, "df -h": true, "df -m": true,
	"free": true, "free -m": true, "free -h": true,
	"ip a": true, "ip addr": true, "ps aux": true, "ps -ef": true,
	"ls": true, "lsblk": true, "sensors": true,
	"docker ps": true, "docker stats --no-stream": true,
	"cat /proc/loadavg": true, "cat /proc/uptime": true,
	"cat /proc/meminfo": true, "cat /etc/os-release": true,
}

// validateSSHCmd 校验 ssh 只读命令：精确白名单 + 参数化白名单
func validateSSHCmd(cmd string) error {
	if sshExactCmds[cmd] {
		return nil
	}
	if rest, ok := strings.CutPrefix(cmd, "systemctl status "); ok {
		return simpleTokenParam(rest)
	}
	if rest, ok := strings.CutPrefix(cmd, "systemctl is-active "); ok {
		return simpleTokenParam(rest)
	}
	if rest, ok := strings.CutPrefix(cmd, "journalctl -u "); ok {
		return simpleTokenParam(rest)
	}
	if rest, ok := strings.CutPrefix(cmd, "ls "); ok {
		if !pathTokenRe.MatchString(rest) {
			return fmt.Errorf("路径参数不合法: %q", rest)
		}
		return nil
	}
	if rest, ok := strings.CutPrefix(cmd, "ping -c "); ok {
		fields := strings.Fields(rest)
		if len(fields) != 2 || !digitsRe.MatchString(fields[0]) || fields[0] == "0" || len(fields[0]) > 2 || !hostTokenRe.MatchString(fields[1]) {
			return fmt.Errorf("ping 参数格式: -c 次数(1-99) 主机")
		}
		return nil
	}
	return fmt.Errorf("命令不在只读白名单内: %s", cmd)
}

// validateProposal 校验 AI 提议的命令。
// 返回 kind（docker/ssh）、target（容器名/设备别名）、exec（docker 子动作/ssh 命令）。
func (h *CmdHandler) validateProposal(cmd string) (kind, target, exec, display string, err error) {
	cmd = strings.TrimSpace(cmd)
	display = cmd
	if cmd == "" || len(cmd) > 200 {
		return "", "", "", "", fmt.Errorf("命令为空或过长")
	}
	for _, s := range forbiddenSubstrs {
		if strings.Contains(cmd, s) {
			return "", "", "", "", fmt.Errorf("包含不允许的字符 %q", s)
		}
	}

	fields := strings.Fields(cmd)
	switch {
	case fields[0] == "docker":
		if len(fields) != 3 {
			return "", "", "", "", fmt.Errorf("docker 提议格式: docker start|stop|restart 容器名")
		}
		action := fields[1]
		if action != "start" && action != "stop" && action != "restart" {
			return "", "", "", "", fmt.Errorf("docker 仅允许 start/stop/restart")
		}
		if !proposedContainerRe.MatchString(fields[2]) {
			return "", "", "", "", fmt.Errorf("容器名不合法: %q", fields[2])
		}
		return "docker", fields[2], action, display, nil

	case fields[0] == "ssh":
		if len(fields) < 3 {
			return "", "", "", "", fmt.Errorf("ssh 提议格式: ssh 设备别名 命令")
		}
		alias := fields[1]
		rest := strings.Join(fields[2:], " ")
		if h.Devices == nil {
			return "", "", "", "", fmt.Errorf("设备管理未启用")
		}
		if h.Devices.Find(alias) == nil {
			return "", "", "", "", fmt.Errorf("设备 %q 不在设备列表中", alias)
		}
		if err := validateSSHCmd(rest); err != nil {
			return "", "", "", "", err
		}
		return "ssh", alias, rest, display, nil

	default:
		return "", "", "", "", fmt.Errorf("仅允许 docker start|stop|restart 或 ssh <设备别名> <只读命令>")
	}
}

// ===== 状态快照（给 AI 的只读数据，绝不含凭据） =====

func (h *CmdHandler) statusSnapshot() string {
	var b strings.Builder

	b.WriteString("[系统] ")
	if si := service.GetSystemInfo(); si.Uptime > 0 {
		b.WriteString(fmt.Sprintf("运行 %d 秒, CPU %.0f%% (%d核), 内存 %d%%, 磁盘 %d%%",
			si.Uptime, si.CPU.Usage, si.CPU.Cores, si.Memory.UsedPercent, si.Disk.UsedPercent))
	} else {
		b.WriteString("不可用")
	}

	if h.Health != nil {
		results := h.Health.GetResults()
		if len(results) > 0 {
			b.WriteString("\n[监控]")
			for _, r := range results {
				lat := "-"
				if r.Latency != nil {
					lat = fmt.Sprintf("%dms", *r.Latency)
				}
				b.WriteString(fmt.Sprintf("\n%s %s (%s)", r.Name, r.Status, lat))
			}
		}
	}

	if h.Docker != nil {
		if containers, err := h.Docker.ListContainers(context.Background()); err == nil && len(containers) > 0 {
			b.WriteString("\n[容器]")
			for _, c := range containers {
				b.WriteString(fmt.Sprintf("\n%s %s", c.Name, c.State))
			}
		}
	}

	if h.Devices != nil {
		if devices := h.Devices.List(); len(devices) > 0 {
			b.WriteString("\n[设备]（仅以下别名可用于 ssh 提议）")
			for _, d := range devices {
				// 只暴露别名与主机名，用户名/密码绝不进入 AI 上下文
				b.WriteString(fmt.Sprintf("\n%s (%s)", d.Name, d.Host))
			}
		}
	}

	return b.String()
}

// ===== /ask 处理 =====

// handleAsk AI 诊断问答。
// 返回回复文本、确认 token（有合法提议时非空，随按钮 callback_data 下发）。
func (h *CmdHandler) handleAsk(fromID string, args []string) (text string, token string) {
	if h.LLM.APIKey == "" {
		return "AI 未配置，请在设置中填写 API Key", ""
	}
	question := strings.Join(args, " ")
	if question == "" {
		return "用法: /ask 你的问题，如「postgres 容器怎么挂了」「NAS 磁盘还剩多少」", ""
	}

	prompt := fmt.Sprintf("%s\n\n[实时状态快照]\n%s\n\n[问题]\n%s", askSystemPrompt, h.statusSnapshot(), question)
	reply, err := CallLLM(h.LLM, prompt)
	if err != nil {
		return "AI 调用失败: " + err.Error(), ""
	}

	// 解析提议行：取最后一个 [RUN] 前缀行
	text = reply
	proposal := ""
	if idx := strings.LastIndex(reply, proposalPrefix); idx >= 0 {
		line := reply[idx+len(proposalPrefix):]
		if nl := strings.IndexAny(line, "\r\n"); nl >= 0 {
			line = line[:nl]
		}
		proposal = strings.TrimSpace(line)
		text = strings.TrimSpace(reply[:idx])
	}
	if proposal == "" {
		return text, ""
	}

	kind, target, exec, display, err := h.validateProposal(proposal)
	if err != nil {
		return text + "\n\n（AI 提议了一条命令，但未通过白名单校验已忽略: " + err.Error() + "）", ""
	}

	token = newActionToken()
	h.aiops.setPending(fromID, &pendingAction{
		token:    token,
		display:  display,
		kind:     kind,
		target:   target,
		exec:     exec,
		expireAt: time.Now().Add(pendingTTL),
	})
	return text + "\n\n建议执行: " + display + "\n（2 分钟内点击下方按钮确认）", token
}

// HandleCallback 处理 inline keyboard 回调（Bot 校验 chat 白名单后调用）。
// data 形如 "askrun:<token>" / "askcancel:<token>"。
// 返回给用户的执行结果文本。
func (h *CmdHandler) HandleCallback(chatID string, data string) string {
	action, token, _ := strings.Cut(data, ":")
	switch action {
	case cbCancel:
		if h.aiops.takePending(chatID) == nil {
			return "当前没有待确认的操作"
		}
		return "已取消"

	case cbConfirm:
		// token 匹配才消费：旧消息上的按钮不会误伤新提议，并发双击只有一次通过
		pa := h.aiops.takePendingIfToken(chatID, token)
		if pa == nil {
			return "该确认已失效（过期或已被处理），请重新 /ask"
		}
		if time.Now().After(pa.expireAt) {
			return "该确认已过期，请重新 /ask"
		}
		// 二次校验：以提议原文重新走一遍白名单，防状态漂移
		kind, target, exec, display, err := h.validateProposal(pa.display)
		if err != nil {
			return "命令未通过校验，已拒绝: " + err.Error()
		}
		return h.executeAction(kind, target, exec, display)

	default:
		return ""
	}
}

// executeAction 执行已确认的动作（docker API 或 SSH）
func (h *CmdHandler) executeAction(kind, target, exec, display string) string {
	switch kind {
	case "docker":
		if h.Docker == nil {
			return "Docker 不可用"
		}
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		var err error
		switch exec {
		case "start":
			err = h.Docker.StartContainer(ctx, target)
		case "stop":
			err = h.Docker.StopContainer(ctx, target)
		case "restart":
			err = h.Docker.RestartContainer(ctx, target)
		}
		if err != nil {
			return "执行失败: " + err.Error()
		}
		return "✅ 已执行: " + display

	case "ssh":
		out, err := h.Devices.Exec(target, exec)
		if err != nil {
			return "执行失败: " + err.Error()
		}
		return "$ " + display + "\n" + truncateForTG(out, 1500)

	default:
		return "未知的动作类型"
	}
}

func truncateForTG(s string, n int) string {
	runes := []rune(strings.TrimSpace(s))
	if len(runes) > n {
		return string(runes[:n]) + "\n…（已截断）"
	}
	if len(runes) == 0 {
		return "（无输出）"
	}
	return string(runes)
}
