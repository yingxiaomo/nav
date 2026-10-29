package handler

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/YingXiaoMo/nav/internal/model"
	"github.com/YingXiaoMo/nav/internal/service"
)

// knownDockerDomains maps well-known Docker image names to their official domains.
var knownDockerDomains = map[string]string{
	"nginx":         "nginx.org",
	"redis":         "redis.io",
	"postgres":      "postgresql.org",
	"mysql":         "mysql.com",
	"mariadb":       "mariadb.org",
	"mongo":         "mongodb.com",
	"node":          "nodejs.org",
	"python":        "python.org",
	"alpine":        "alpinelinux.org",
	"ubuntu":        "ubuntu.com",
	"debian":        "debian.org",
	"centos":        "centos.org",
	"grafana":       "grafana.com",
	"prometheus":    "prometheus.io",
	"traefik":       "traefik.io",
	"portainer":     "portainer.io",
	"jenkins":       "jenkins.io",
	"gitlab":        "gitlab.com",
	"nextcloud":     "nextcloud.com",
	"homeassistant": "home-assistant.io",
	"openwrt":       "openwrt.org",
	"pihole":        "pi-hole.net",
	"adguard":       "adguard.com",
	"jellyfin":      "jellyfin.org",
	"emby":          "emby.media",
	"plex":          "plex.tv",
	"transmission":  "transmissionbt.com",
	"qbittorrent":   "qbittorrent.org",
	"sonarr":        "sonarr.tv",
	"radarr":        "radarr.video",
	"jackett":       "jackett.io",
	"navidrome":     "navidrome.org",
	"firefly":       "firefly-iii.org",
	"outline":       "getoutline.com",
	"frp":           "gofrp.org",
	"ddns":          "ddns.org",
}

// ===== Handlers =====

// DockerContainers handles GET /api/v1/admin/docker/containers.
func (h *Handler) DockerContainers() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		svc := h.DockerSvc
		if svc == nil {
			model.RespondError(w, http.StatusServiceUnavailable, "Docker 不可用，需要挂载 Docker socket")
			return
		}
		containers, err := svc.ListContainers(r.Context())
		if err != nil {
			slog.Warn("获取 Docker 容器列表失败", "error", err)
			model.RespondError(w, http.StatusBadGateway, err.Error())
			return
		}
		model.RespondJSON(w, http.StatusOK, map[string]any{"containers": containers})
	}
}

// DockerStats handles GET /api/v1/admin/docker/stats.
func (h *Handler) DockerStats() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		svc := h.DockerSvc
		if svc == nil {
			model.RespondError(w, http.StatusServiceUnavailable, "Docker 不可用，需要挂载 Docker socket")
			return
		}
		// 优先读后台快照（每 10s 刷新，毫秒级返回）：实时拉取是逐容器串行
		// 且每个最长 5s，真实环境（如 fnOS 十余个系统容器）会把本端点挂起数十秒
		if h.DockerSnap != nil {
			stats, _, _ := h.DockerSnap.Snapshot()
			model.RespondJSON(w, http.StatusOK, map[string]any{"stats": stats})
			return
		}
		stats, err := svc.ContainerStats(r.Context())
		if err != nil {
			slog.Warn("获取 Docker 容器统计失败", "error", err)
			model.RespondError(w, http.StatusBadGateway, err.Error())
			return
		}
		model.RespondJSON(w, http.StatusOK, map[string]any{"stats": stats})
	}
}

// dockerLogStreams 全局并发日志流上限：每条流占用一条 Docker follow
// 长连接 + goroutine，无上限时可被无限开流耗尽资源
var dockerLogStreams = make(chan struct{}, 5)

// DockerLogs handles GET /api/v1/admin/docker/logs/{name}.
// It streams container logs via Server-Sent Events.
func (h *Handler) DockerLogs() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		svc := h.DockerSvc
		name := r.PathValue("name")

		select {
		case dockerLogStreams <- struct{}{}:
			defer func() { <-dockerLogStreams }()
		default:
			model.RespondError(w, http.StatusTooManyRequests, "日志流数量已达上限，请稍后再试")
			return
		}

		flusher, ok := w.(http.Flusher)
		if !ok {
			model.RespondError(w, http.StatusInternalServerError, "SSE not supported")
			return
		}

		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")

		// 写超时逐次滚动设置（每次写 30s），而非永久清除——永久裸写时
		// 慢客户端停止读取会无限阻塞 handler，占死日志流名额（历史 bug）
		rc := http.NewResponseController(w)
		writeEvent := func(payload string) error {
			if err := rc.SetWriteDeadline(time.Now().Add(30 * time.Second)); err != nil {
				slog.Debug("设置写超时失败", "error", err)
			}
			_, err := fmt.Fprint(w, payload)
			return err
		}

		if svc == nil {
			fmt.Fprintf(w, "event: error\ndata: Docker 不可用\n\n")
			flusher.Flush()
			return
		}

		lines := make(chan string)
		// 会话复核：登出/改密轮换密钥后 30s 内断开日志流——
		// SSE 连接本身不感知会话轮换，需要主动撤销
		streamCtx, cancelStream := context.WithCancel(r.Context())
		defer cancelStream()
		go func() {
			ticker := time.NewTicker(30 * time.Second)
			defer ticker.Stop()
			for {
				select {
				case <-streamCtx.Done():
					return
				case <-ticker.C:
					if _, ok := checkSession(r, h.Secrets); !ok {
						slog.Info("会话已失效，断开容器日志流", "container", name)
						cancelStream()
						return
					}
				}
			}
		}()
		go func() {
			defer close(lines)
			if err := svc.StreamLogs(streamCtx, name, lines); err != nil && err != context.Canceled {
				slog.Warn("Docker 日志流结束", "container", name, "error", err)
			}
		}()

		for line := range lines {
			// 去除行尾换行符，避免在 SSE 中作为可见字符显示
			cleaned := strings.TrimRight(line, "\n\r")
			if err := writeEvent("data: " + cleaned + "\n\n"); err != nil {
				slog.Info("日志流写入失败，断开慢客户端", "container", name, "error", err)
				return
			}
			flusher.Flush()
		}

		// 发送 end 事件，前端监听 end 事件后关闭 EventSource
		_ = writeEvent("event: end\ndata: \n\n")
		flusher.Flush()
	}
}

// DockerContainerAction handles POST /api/v1/admin/docker/{name}/{action}.
// It dispatches to start/stop/restart based on the action path parameter.
func (h *Handler) DockerContainerAction() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		name := r.PathValue("name")
		action := r.PathValue("action")

		switch action {
		case "start":
			h.dockerStartContainer(name, w, r)
		case "stop":
			h.dockerStopContainer(name, w, r)
		case "restart":
			h.dockerRestartContainer(name, w, r)
		default:
			model.RespondError(w, http.StatusBadRequest, "不支持的操作，仅支持 start/stop/restart")
		}
	}
}

// dockerStartContainer starts a Docker container by name.
func (h *Handler) dockerStartContainer(name string, w http.ResponseWriter, r *http.Request) {
	svc := h.DockerSvc
	if svc == nil {
		model.RespondError(w, http.StatusServiceUnavailable, "Docker 不可用，需要挂载 Docker socket")
		return
	}
	if err := svc.StartContainer(r.Context(), name); err != nil {
		slog.Warn("启动容器失败", "container", name, "error", err)
		model.RespondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	model.RespondJSON(w, http.StatusOK, map[string]any{"success": true})
}

// dockerStopContainer stops a Docker container by name.
func (h *Handler) dockerStopContainer(name string, w http.ResponseWriter, r *http.Request) {
	svc := h.DockerSvc
	if svc == nil {
		model.RespondError(w, http.StatusServiceUnavailable, "Docker 不可用，需要挂载 Docker socket")
		return
	}
	if err := svc.StopContainer(r.Context(), name); err != nil {
		slog.Warn("停止容器失败", "container", name, "error", err)
		model.RespondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	model.RespondJSON(w, http.StatusOK, map[string]any{"success": true})
}

// dockerRestartContainer restarts a Docker container by name.
func (h *Handler) dockerRestartContainer(name string, w http.ResponseWriter, r *http.Request) {
	svc := h.DockerSvc
	if svc == nil {
		model.RespondError(w, http.StatusServiceUnavailable, "Docker 不可用，需要挂载 Docker socket")
		return
	}
	if err := svc.RestartContainer(r.Context(), name); err != nil {
		slog.Warn("重启容器失败", "container", name, "error", err)
		model.RespondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	model.RespondJSON(w, http.StatusOK, map[string]any{"success": true})
}

// FetchDockerIcon handles POST /api/v1/admin/docker/fetch-icon.
// 探测逻辑在 service.FetchDockerIcon（含 SSRF 防护），此处只做参数解析。
func FetchDockerIcon() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		type request struct {
			Image string `json:"image"`
		}
		var req request
		if !model.DecodeJSON(r, &req) || req.Image == "" {
			model.RespondJSON(w, http.StatusOK, map[string]any{"icon": nil})
			return
		}

		icon := service.FetchDockerIcon(req.Image)
		model.RespondJSON(w, http.StatusOK, map[string]any{"icon": icon})
	}
}

// GetDockerMetadata handles GET /api/v1/admin/docker/metadata.
func (h *Handler) GetDockerMetadata() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		model.RespondJSON(w, http.StatusOK, h.DockerMeta.GetAll())
	}
}

// SetDockerMetadata handles PUT /api/v1/admin/docker/metadata/{name}.
func (h *Handler) SetDockerMetadata() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		name := r.PathValue("name")

		type request struct {
			Icon  string `json:"icon,omitempty"`
			Label string `json:"label,omitempty"`
			URL   string `json:"url,omitempty"`
		}
		var req request
		if !model.DecodeJSON(r, &req) {
			model.RespondError(w, http.StatusBadRequest, "请求体格式错误")
			return
		}

		if err := h.DockerMeta.Set(name, model.DockerMetadata{Name: name, Icon: req.Icon, Label: req.Label, URL: req.URL}); err != nil {
			slog.Error("保存 Docker 元数据失败", "error", err)
			model.RespondError(w, http.StatusInternalServerError, "保存失败")
			return
		}

		model.RespondJSON(w, http.StatusOK, map[string]any{"success": true})
	}
}

// ReorderContainers handles PUT /api/v1/admin/docker/reorder.
// Accepts {"order": ["containerName1", "containerName2", ...]} to set display order.
func (h *Handler) ReorderContainers() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Order []string `json:"order"`
		}
		if !model.DecodeJSON(r, &req) {
			model.RespondError(w, http.StatusBadRequest, "请求体格式错误")
			return
		}

		for i, name := range req.Order {
			if meta, err := h.DockerMeta.Get(name); err == nil {
				meta.Order = i
				if err := h.DockerMeta.Set(name, meta); err != nil {
					slog.Error("保存容器排序失败", "container", name, "error", err)
				}
			}
		}

		model.RespondJSON(w, http.StatusOK, map[string]any{"success": true})
	}
}
