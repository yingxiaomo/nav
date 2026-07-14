package tgbot

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/YingXiaoMo/nav/internal/model"
	"github.com/YingXiaoMo/nav/internal/remote"
	"github.com/YingXiaoMo/nav/internal/service"
)

type DeviceManager = remote.Manager

type CmdHandler struct {
	Health  *service.HealthChecker
	Docker  *service.DockerService
	Devices *DeviceManager
	LLM     LLMConfig
	DB      *sql.DB
}

func (h *CmdHandler) HandleTG(fromID, cmd string, args []string) string {
	if !strings.HasPrefix(cmd, "/") && h.LLM.APIKey != "" {
		return h.handleAI(fromID, cmd, args)
	}
	switch cmd {
	case "/start", "/help":
		return "<b>Nav Bot</b>\n\n/status - 监控状态\n/wake - WOL 唤醒\n/docker ps|start|stop|restart - Docker\n/device ssh [name] [cmd] - SSH\n/organize - AI 整理\n/uptime - 运行时间\n/help - 帮助"
	case "/status": return h.handleStatus(args)
	case "/wake": return h.handleWake(args)
	case "/docker": return h.handleDocker(args)
	case "/organize": return h.handleOrganize()
	case "/device": return h.handleDevice(args)
	case "/uptime": return fmt.Sprintf("运行 %d 秒", service.GetSystemInfo().Uptime)
	default: return "未知命令，发送 /help 查看"
	}
}

func (h *CmdHandler) handleAI(fromID, cmd string, args []string) string {
	fullText := cmd
	if len(args) > 0 { fullText += " " + strings.Join(args, " ") }
	resp := callLLM(h.LLM, fromID, fullText)
	return resp
}

func (h *CmdHandler) handleStatus(args []string) string {
	if h.Health == nil { return "健康检查未启动" }
	targets := h.Health.GetTargets()
	if len(targets) == 0 { return "暂无监控目标" }
	if len(args) > 0 {
		name := strings.Join(args, " ")
		for _, t := range targets {
			if strings.Contains(t.Name, name) || strings.Contains(t.URL, name) {
				results := h.Health.GetResults()
				for _, r := range results {
					if r.ID == t.ID {
						icon := map[string]string{"ok": "✅", "error": "⚠️", "timeout": "❌"}[r.Status]
						lat := ""; if r.Latency != nil { lat = fmt.Sprintf("%dms", *r.Latency) }
						return fmt.Sprintf("%s %s - %s 延迟:%s", icon, t.Name, r.Status, lat)
					}
				}
			}
		}
		return "未找到匹配的目标"
	}
	var b strings.Builder
	b.WriteString("监控状态\n")
	for _, t := range targets {
		results := h.Health.GetResults()
		for _, r := range results {
			if r.ID == t.ID {
				icon := map[string]string{"ok": "✅", "error": "⚠️", "timeout": "❌"}[r.Status]
				lat := "-"; if r.Latency != nil { lat = fmt.Sprintf("%dms", *r.Latency) }
				b.WriteString(fmt.Sprintf("\n%s %s (%s)", icon, t.Name, lat))
				break
			}
		}
	}
	return b.String()
}

func (h *CmdHandler) handleWake(args []string) string {
	if len(args) == 0 { return "用法: /wake [名称]" }
	name := strings.Join(args, " ")
	for _, t := range h.Health.GetTargets() {
		if strings.Contains(t.Name, name) || strings.Contains(t.URL, name) {
			if t.MAC == "" { return fmt.Sprintf("%s 未配置 MAC", t.Name) }
			if err := service.WakeOnLAN(t.MAC); err != nil { return fmt.Sprintf("唤醒失败: %v", err) }
			return fmt.Sprintf("已发送 WOL 到 %s", t.Name)
		}
	}
	return "未找到匹配目标"
}

func (h *CmdHandler) handleDocker(args []string) string {
	if h.Docker == nil { return "Docker 不可用" }
	if len(args) == 0 { return "用法: /docker ps|start|stop|restart [name]" }
	switch args[0] {
	case "ps":
		containers, err := h.Docker.ListContainers(context.Background())
		if err != nil { return fmt.Sprintf("获取失败: %v", err) }
		if len(containers) == 0 { return "无容器" }
		var b strings.Builder; b.WriteString("容器\n")
		for _, c := range containers {
			icon := map[string]string{"running": "🟢", "exited": "🔴", "paused": "🟡"}[c.State]
			b.WriteString(fmt.Sprintf("\n%s %s - %s", icon, c.Name, c.State))
		}
		return b.String()
	case "start", "stop", "restart":
		if len(args) < 2 { return fmt.Sprintf("用法: /docker %s [名称]", args[0]) }
		name, ctx := args[1], context.Background()
		var err error
		switch args[0] {
		case "start": err = h.Docker.StartContainer(ctx, name)
		case "stop": err = h.Docker.StopContainer(ctx, name)
		case "restart": err = h.Docker.RestartContainer(ctx, name)
		}
		if err != nil { return fmt.Sprintf("失败: %v", err) }
		return fmt.Sprintf("%s %s 成功", args[0], name)
	default: return "未知 docker 命令"
	}
}

func (h *CmdHandler) handleOrganize() string {
	if h.DB == nil || h.LLM.APIKey == "" { return "需要 AI Key" }
	rows, err := h.DB.Query("SELECT id, title, url, COALESCE(icon,'') FROM bookmarks")
	if err != nil { return "读取书签失败" }
	type bk struct{ id, title, url, icon string }
	var bks []bk
	for rows.Next() {
		var b bk
		if err := rows.Scan(&b.id, &b.title, &b.url, &b.icon); err == nil { bks = append(bks, b) }
	}
	rows.Close()
	if len(bks) == 0 { return "暂无书签" }
	var sb strings.Builder
	sb.WriteString("将以下书签归类到合适的分类中，返回JSON数组，每个元素包含category和bookmarks字段。只返回JSON：")
	for _, b := range bks { sb.WriteString(fmt.Sprintf("\n%s - %s", b.title, b.url)) }
	resp, err := CallLLM(h.LLM, sb.String())
	if err != nil { return "AI 失败: " + err.Error() }
	var cats []struct {
		Category  string `json:"category"`
		Bookmarks []struct { Title, URL string } `json:"bookmarks"`
	}
	if err := json.Unmarshal([]byte(resp), &cats); err != nil { return "AI 格式有误:\n" + resp }
	var result strings.Builder; result.WriteString("整理完成：")
	for _, cat := range cats {
		if cat.Category == "" || len(cat.Bookmarks) == 0 { continue }
		catID := model.NewID(); now := model.Now()
		var existing string
		if err := h.DB.QueryRow("SELECT id FROM categories WHERE title=?", cat.Category).Scan(&existing); err == nil { catID = existing
		} else { h.DB.Exec("INSERT INTO categories (id,title,icon,\"order\",created_at) VALUES (?,?,?,?,?)", catID, cat.Category, "Folder", 0, now) }
		matched := 0
		for _, bm := range cat.Bookmarks {
			for _, b := range bks {
				if b.url == bm.URL { h.DB.Exec("UPDATE bookmarks SET category_id=? WHERE id=?", catID, b.id); matched++; break }
			}
		}
		result.WriteString(fmt.Sprintf("\n %s (%d个)", cat.Category, matched))
	}
	return result.String()
}

func (h *CmdHandler) handleDevice(args []string) string {
	if h.Devices == nil { return "设备管理未启用" }
	if len(args) == 0 { return h.Devices.FormatList() }
	switch args[0] {
	case "ssh":
		if len(args) < 3 { return "用法: /device ssh [名] [命令]" }
		out, err := h.Devices.Exec(args[1], strings.Join(args[2:], " "))
		if err != nil { return fmt.Sprintf("失败: %v", err) }
		return fmt.Sprintf("$ %s\n%s", strings.Join(args[2:], " "), out)
	case "ping":
		if len(args) < 2 { return "用法: /device ping [名]" }
		out, err := h.Devices.Exec(args[1], "echo pong")
		if err != nil { return fmt.Sprintf("不可达: %v", err) }
		return fmt.Sprintf("可达: %s", out)
	default:
		return h.Devices.FormatList()
	}
}
