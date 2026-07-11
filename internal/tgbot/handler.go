package tgbot

import (
	"context"
	"fmt"
	"strings"

	"database/sql"
	"encoding/json"
	"github.com/YingXiaoMo/nav/internal/model"
	"github.com/YingXiaoMo/nav/internal/remote"
	"github.com/YingXiaoMo/nav/internal/service"
)

// DeviceManager 别名
type DeviceManager = remote.Manager

// CmdHandler 机器人命令处理
type CmdHandler struct {
	Health  *service.HealthChecker
	Docker  *service.DockerService
	Devices *DeviceManager
	LLM     LLMConfig
	DB      *sql.DB
}

// HandleTG 处理 TG 命令
func (h *CmdHandler) HandleTG(fromID, cmd string, args []string) string {
	// 非命令消息 → AI 转换
	if !strings.HasPrefix(cmd, "/") && h.LLM.APIKey != "" {
		fullText := cmd
		if len(args) > 0 {
			fullText += " " + strings.Join(args, " ")
		}
		llmResp, err := CallLLM(h.LLM, fullText)
		if err != nil {
			return fmt.Sprintf("🤖 AI 思考失败: %v", err)
		}
		parts := strings.Fields(llmResp)
		if len(parts) > 0 {
			return h.HandleTG("", parts[0], parts[1:])
		}
		return "🤖 AI 不理解你的意思"
	}

	switch cmd {
	case "/start", "/help":
		return `<b>🤖 Nav Bot</b>

/status - 所有监控目标状态
/status [name] - 指定目标详情
/wake [name] - WOL 唤醒目标
/docker ps - Docker 容器列表
/docker start [name] - 启动容器
/docker stop [name] - 停止容器
/docker restart [name] - 重启容器
/uptime - 服务器运行时间
/device - 远程设备列表
/device ssh [name] [command] - SSH 执行命令
/organize - AI 整理书签
/help - 这条帮助`

	case "/status":
		return h.handleStatus(args)
	case "/wake":
		return h.handleWake(args)
	case "/docker":
		return h.handleDocker(args)
	case "/organize":
		return h.handleOrganize()
	case "/device":
		return h.handleDevice(args)
	case "/uptime":
		return fmt.Sprintf("🖥️ 服务器已运行 %d 秒", service.GetSystemInfo().Uptime)
	default:
		return fmt.Sprintf("未知命令: %s\n发送 /help 查看可用命令", cmd)
	}
}

func (h *CmdHandler) handleStatus(args []string) string {
	if h.Health == nil {
		return "❌ 健康检查未启动"
	}
	targets := h.Health.GetTargets()
	if len(targets) == 0 {
		return "📭 暂无监控目标"
	}

	if len(args) > 0 {
		name := strings.Join(args, " ")
		for _, t := range targets {
			if strings.Contains(t.Name, name) || strings.Contains(t.URL, name) {
				results := h.Health.GetResults()
				for _, r := range results {
					if r.ID == t.ID {
						icon := map[string]string{"ok": "✅", "error": "⚠️", "timeout": "❌"}[r.Status]
						lat := ""
						if r.Latency != nil {
							lat = fmt.Sprintf("%dms", *r.Latency)
						}
						return fmt.Sprintf("%s <b>%s</b>\n  地址: %s\n  状态: %s\n  延迟: %s", icon, t.Name, t.URL, r.Status, lat)
					}
				}
			}
		}
		return "❌ 未找到匹配的目标"
	}

	var b strings.Builder
	b.WriteString("<b>📡 监控状态</b>\n")
	for _, t := range targets {
		results := h.Health.GetResults()
		for _, r := range results {
			if r.ID == t.ID {
				icon := map[string]string{"ok": "✅", "error": "⚠️", "timeout": "❌"}[r.Status]
				lat := "-"
				if r.Latency != nil {
					lat = fmt.Sprintf("%dms", *r.Latency)
				}
				b.WriteString(fmt.Sprintf("\n%s <b>%s</b> — %s (%s)", icon, t.Name, r.Status, lat))
				break
			}
		}
	}
	return b.String()
}

func (h *CmdHandler) handleWake(args []string) string {
	if len(args) == 0 {
		return "用法: /wake [目标名称]"
	}
	name := strings.Join(args, " ")
	targets := h.Health.GetTargets()
	for _, t := range targets {
		if strings.Contains(t.Name, name) || strings.Contains(t.URL, name) {
			if t.MAC == "" {
				return fmt.Sprintf("❌ %s 未配置 MAC 地址", t.Name)
			}
			if err := service.WakeOnLAN(t.MAC); err != nil {
				return fmt.Sprintf("❌ 唤醒失败: %v", err)
			}
			return fmt.Sprintf("✅ 已发送 WOL 魔法包到 %s (%s)", t.Name, t.MAC)
		}
	}
	return "❌ 未找到匹配的目标"
}

func (h *CmdHandler) handleDocker(args []string) string {
	if h.Docker == nil {
		return "❌ Docker 不可用"
	}
	if len(args) == 0 {
		return "用法: /docker ps | start [name] | stop [name] | restart [name]"
	}

	switch args[0] {
	case "ps":
		containers, err := h.Docker.ListContainers(context.Background())
		if err != nil {
			return fmt.Sprintf("❌ 获取容器列表失败: %v", err)
		}
		if len(containers) == 0 {
			return "📭 无容器"
		}
		var b strings.Builder
		b.WriteString("<b>🐳 Docker 容器</b>\n")
		for _, c := range containers {
			icon := map[string]string{"running": "🟢", "exited": "🔴", "paused": "🟡"}[c.State]
			b.WriteString(fmt.Sprintf("\n%s <b>%s</b> — %s", icon, c.Name, c.State))
		}
		return b.String()

	case "start", "stop", "restart":
		if len(args) < 2 {
			return fmt.Sprintf("用法: /docker %s [容器名]", args[0])
		}
		name := args[1]
		var err error
		ctx := context.Background()
		switch args[0] {
		case "start":
			err = h.Docker.StartContainer(ctx, name)
		case "stop":
			err = h.Docker.StopContainer(ctx, name)
		case "restart":
			err = h.Docker.RestartContainer(ctx, name)
		}
		if err != nil {
			return fmt.Sprintf("❌ %s %s 失败: %v", name, args[0], err)
		}
		return fmt.Sprintf("✅ %s %s 成功", name, args[0])

	default:
		return "未知 docker 子命令: " + args[0]
	}
}

func (h *CmdHandler) handleOrganize() string {
	if h.DB == nil || h.LLM.APIKey == "" {
		return "需要配置 AI API Key 才能使用此功能"
	}
	rows, err := h.DB.Query("SELECT id, title, url, COALESCE(icon,'') FROM bookmarks")
	if err != nil {
		return "读取书签失败: " + err.Error()
	}
	type bk struct{ id, title, url, icon string }
	var bks []bk
	for rows.Next() {
		var b bk
		if err := rows.Scan(&b.id, &b.title, &b.url, &b.icon); err == nil {
			bks = append(bks, b)
		}
	}
	rows.Close()
	if len(bks) == 0 {
		return "暂无书签需要整理"
	}

	// 构造提示词
	var sb strings.Builder
	sb.WriteString("将以下书签归类，返回JSON数组，每个元素包含category(分类名)和bookmarks(书签数组，每个有title和url字段)。只返回JSON：")
	for _, b := range bks {
		sb.WriteString(fmt.Sprintf("\n%s - %s", b.title, b.url))
	}

	resp, err := CallLLM(h.LLM, sb.String())
	if err != nil {
		return "AI 分析失败: " + err.Error()
	}

	// 解析 JSON
	var cats []struct {
		Category  string `json:"category"`
		Bookmarks []struct {
			Title string `json:"title"`
			URL   string `json:"url"`
		} `json:"bookmarks"`
	}
	if err := json.Unmarshal([]byte(resp), &cats); err != nil {
		return "AI 返回格式有误，请手动检查：\n\n" + resp
	}

	var result strings.Builder
	result.WriteString("书签整理完成：")
	for _, cat := range cats {
		if cat.Category == "" || len(cat.Bookmarks) == 0 {
			continue
		}
		// 创建或获取分类
		catID := model.NewID()
		now := model.Now()
		var existingID string
		err := h.DB.QueryRow("SELECT id FROM categories WHERE title = ?", cat.Category).Scan(&existingID)
		if err == nil {
			catID = existingID
		} else {
			h.DB.Exec("INSERT INTO categories (id, title, icon, `order`, created_at) VALUES (?, ?, ?, ?, ?)",
				catID, cat.Category, "Folder", 0, now)
		}

		// 更新书签分类
		matched := 0
		for _, bm := range cat.Bookmarks {
			for _, b := range bks {
				if b.url == bm.URL {
					h.DB.Exec("UPDATE bookmarks SET category_id = ? WHERE id = ?", catID, b.id)
					matched++
					break
				}
			}
		}
		result.WriteString(fmt.Sprintf("\n 📂 %s (%d 个书签)", cat.Category, matched))
	}
	return result.String()
}

func (h *CmdHandler) handleDevice(args []string) string {
	if h.Devices == nil {
		return "❌ 远程设备管理未启用"
	}
	if len(args) == 0 {
		return h.Devices.FormatList()
	}
	switch args[0] {
	case "ssh":
		if len(args) < 3 {
			return "用法: /device ssh [设备名] [命令]"
		}
		name := args[1]
		cmd := strings.Join(args[2:], " ")
		out, err := h.Devices.Exec(name, cmd)
		if err != nil {
			return fmt.Sprintf("❌ %s: %v", name, err)
		}
		return fmt.Sprintf("<b>$ %s</b>\n<code>%s</code>", cmd, out)
	case "ping":
		if len(args) < 2 {
			return "用法: /device ping [设备名]"
		}
		out, err := h.Devices.Exec(args[1], "echo pong")
		if err != nil {
			return fmt.Sprintf("❌ %s 不可达: %v", args[1], err)
		}
		return fmt.Sprintf("✅ %s 可达\n%s", args[1], out)
	default:
		return h.Devices.FormatList()
	}
}
