package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/YingXiaoMo/nav/internal/model"
)

// knownDockerDomains maps well-known Docker image names to their official domains.
var knownDockerDomains = map[string]string{
	"nginx":        "nginx.org",
	"redis":        "redis.io",
	"postgres":     "postgresql.org",
	"mysql":        "mysql.com",
	"mariadb":      "mariadb.org",
	"mongo":        "mongodb.com",
	"node":         "nodejs.org",
	"python":       "python.org",
	"alpine":       "alpinelinux.org",
	"ubuntu":       "ubuntu.com",
	"debian":       "debian.org",
	"centos":       "centos.org",
	"grafana":      "grafana.com",
	"prometheus":   "prometheus.io",
	"traefik":      "traefik.io",
	"portainer":    "portainer.io",
	"jenkins":      "jenkins.io",
	"gitlab":       "gitlab.com",
	"nextcloud":    "nextcloud.com",
	"homeassistant": "home-assistant.io",
	"openwrt":      "openwrt.org",
	"pihole":       "pi-hole.net",
	"adguard":      "adguard.com",
	"jellyfin":     "jellyfin.org",
	"emby":         "emby.media",
	"plex":         "plex.tv",
	"transmission": "transmissionbt.com",
	"qbittorrent":  "qbittorrent.org",
	"sonarr":       "sonarr.tv",
	"radarr":       "radarr.video",
	"jackett":      "jackett.io",
	"navidrome":    "navidrome.org",
	"firefly":      "firefly-iii.org",
	"outline":      "getoutline.com",
	"frp":          "gofrp.org",
	"ddns":         "ddns.org",
}

// ===== Handlers =====

// DockerContainers handles GET /api/v1/admin/docker/containers.
func (h *Handler) DockerContainers() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		svc := h.DockerSvc
		if svc == nil {
			model.RespondJSON(w, http.StatusOK, map[string]any{"containers": []any{}, "error": "Docker 不可用"})
			return
		}
		containers, err := svc.ListContainers(r.Context())
		if err != nil {
			slog.Warn("获取 Docker 容器列表失败", "error", err)
			model.RespondJSON(w, http.StatusOK, map[string]any{"containers": []any{}, "error": err.Error()})
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
			model.RespondJSON(w, http.StatusOK, map[string]any{"stats": []any{}, "error": "Docker 不可用"})
			return
		}
		stats, err := svc.ContainerStats(r.Context())
		if err != nil {
			slog.Warn("获取 Docker 容器统计失败", "error", err)
			model.RespondJSON(w, http.StatusOK, map[string]any{"stats": []any{}, "error": err.Error()})
			return
		}
		model.RespondJSON(w, http.StatusOK, map[string]any{"stats": stats})
	}
}

// DockerLogs handles GET /api/v1/admin/docker/logs/{name}.
// It streams container logs via Server-Sent Events.
func (h *Handler) DockerLogs() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		svc := h.DockerSvc
		name := r.PathValue("name")

		flusher, ok := w.(http.Flusher)
		if !ok {
			model.RespondError(w, http.StatusInternalServerError, "SSE not supported")
			return
		}

		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")

		if svc == nil {
			fmt.Fprintf(w, "event: error\ndata: Docker 不可用\n\n")
			flusher.Flush()
			return
		}

		lines := make(chan string)
		go func() {
			defer close(lines)
			if err := svc.StreamLogs(r.Context(), name, lines); err != nil && err != context.Canceled {
				slog.Warn("Docker 日志流结束", "container", name, "error", err)
			}
		}()

		for line := range lines {
			escaped := strings.ReplaceAll(line, "\n", "\\n")
			escaped = strings.ReplaceAll(escaped, "\r", "")
			fmt.Fprintf(w, "data: %s\n\n", escaped)
			flusher.Flush()
		}
	}
}

// DockerStartContainer handles POST /api/v1/admin/docker/{name}/start.
func (h *Handler) DockerStartContainer() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		svc := h.DockerSvc
		if svc == nil {
			model.RespondJSON(w, http.StatusOK, map[string]any{"success": false, "error": "Docker 不可用"})
			return
		}
		name := r.PathValue("name")
		if err := svc.StartContainer(r.Context(), name); err != nil {
			model.RespondJSON(w, http.StatusOK, map[string]any{"success": false, "error": err.Error()})
			return
		}
		model.RespondJSON(w, http.StatusOK, map[string]any{"success": true})
	}
}

// DockerStopContainer handles POST /api/v1/admin/docker/{name}/stop.
func (h *Handler) DockerStopContainer() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		svc := h.DockerSvc
		if svc == nil {
			model.RespondJSON(w, http.StatusOK, map[string]any{"success": false, "error": "Docker 不可用"})
			return
		}
		name := r.PathValue("name")
		if err := svc.StopContainer(r.Context(), name); err != nil {
			model.RespondJSON(w, http.StatusOK, map[string]any{"success": false, "error": err.Error()})
			return
		}
		model.RespondJSON(w, http.StatusOK, map[string]any{"success": true})
	}
}

// DockerRestartContainer handles POST /api/v1/admin/docker/{name}/restart.
func (h *Handler) DockerRestartContainer() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		svc := h.DockerSvc
		if svc == nil {
			model.RespondJSON(w, http.StatusOK, map[string]any{"success": false, "error": "Docker 不可用"})
			return
		}
		name := r.PathValue("name")
		if err := svc.RestartContainer(r.Context(), name); err != nil {
			model.RespondJSON(w, http.StatusOK, map[string]any{"success": false, "error": err.Error()})
			return
		}
		model.RespondJSON(w, http.StatusOK, map[string]any{"success": true})
	}
}

// FetchDockerIcon handles POST /api/v1/admin/docker/fetch-icon.
// It guesses an icon URL from the Docker image name.
func FetchDockerIcon() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		type request struct{ Image string `json:"image"` }
		var req request
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Image == "" {
			model.RespondJSON(w, http.StatusOK, map[string]any{"icon": nil})
			return
		}

		parts := strings.Split(req.Image, ":")
		name := parts[0]
		parts = strings.Split(name, "/")
		name = parts[len(parts)-1]
		if name == "" {
			model.RespondJSON(w, http.StatusOK, map[string]any{"icon": nil})
			return
		}

		domain, ok := knownDockerDomains[name]
		if !ok {
			domain = name + ".org"
		}

		client := &http.Client{Timeout: 3 * time.Second}

		ddgURL := "https://icons.duckduckgo.com/ip3/" + domain + ".ico"
		resp, err := client.Head(ddgURL)
		if err == nil {
			resp.Body.Close()
			if resp.StatusCode == http.StatusOK {
				model.RespondJSON(w, http.StatusOK, map[string]any{"icon": ddgURL})
				return
			}
		}

		favURL := "https://" + domain + "/favicon.ico"
		resp, err = client.Head(favURL)
		if err == nil {
			resp.Body.Close()
			if resp.StatusCode == http.StatusOK {
				model.RespondJSON(w, http.StatusOK, map[string]any{"icon": favURL})
				return
			}
		}

		model.RespondJSON(w, http.StatusOK, map[string]any{"icon": nil})
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

		type request struct{ Icon string `json:"icon,omitempty"` }
		var req request
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			model.RespondError(w, http.StatusBadRequest, "请求体格式错误")
			return
		}

		if err := h.DockerMeta.Set(name, model.DockerMetadata{Name: name, Icon: req.Icon}); err != nil {
			slog.Error("保存 Docker 元数据失败", "error", err)
			model.RespondError(w, http.StatusInternalServerError, "保存失败")
			return
		}

		model.RespondJSON(w, http.StatusOK, map[string]any{"success": true})
	}
}
