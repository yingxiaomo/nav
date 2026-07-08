package handler

import (
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/YingXiaoMo/nav/internal/model"
	"github.com/YingXiaoMo/nav/internal/service"
)

// ===== Favicon extraction patterns =====

var faviconPatterns = []*regexp.Regexp{
	regexp.MustCompile(`(?i)<link[^>]+rel=["'](?:apple-touch-icon|apple-touch-icon-precomposed)["'][^>]+href=["']([^"']*)["']`),
	regexp.MustCompile(`(?i)<link[^>]+rel=["']icon["'][^>]+href=["']([^"']*)["']`),
	regexp.MustCompile(`(?i)<link[^>]+rel=["']shortcut\s+icon["'][^>]+href=["']([^"']*)["']`),
	regexp.MustCompile(`(?i)<link[^>]+href=["']([^"']*)["'][^>]+rel=["']icon["']`),
	regexp.MustCompile(`(?i)<link[^>]+href=["']([^"']*)["'][^>]+rel=["']shortcut\s+icon["']`),
}

// ===== Handlers =====

// SystemInfo handles GET /api/v1/admin/monitor/system.
func SystemInfo() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		model.RespondJSON(w, http.StatusOK, service.GetSystemInfo())
	}
}

// ListChecks handles GET /api/v1/admin/monitor/checks.
func (h *Handler) ListChecks() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		hc := h.HealthChecker
		model.RespondJSON(w, http.StatusOK, map[string]any{
			"targets": hc.GetTargets(),
			"results": hc.GetResults(),
		})
	}
}

// CreateCheck handles POST /api/v1/admin/monitor/checks.
func (h *Handler) CreateCheck() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var input model.MonitorTargetInput
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			model.RespondError(w, http.StatusBadRequest, "请求体格式错误")
			return
		}
		if input.Name == "" || input.URL == "" {
			model.RespondError(w, http.StatusBadRequest, "名称和 URL 不能为空")
			return
		}
		if !strings.HasPrefix(input.URL, "http://") && !strings.HasPrefix(input.URL, "https://") {
			input.URL = "http://" + input.URL
		}

		if _, err := h.HealthChecker.AddTarget(input); err != nil {
			slog.Error("添加监控目标失败", "error", err)
			model.RespondError(w, http.StatusInternalServerError, "添加失败")
			return
		}
		model.RespondJSON(w, http.StatusCreated, map[string]any{"success": true})
	}
}

// UpdateCheck handles PUT /api/v1/admin/monitor/checks/{id}.
func (h *Handler) UpdateCheck() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")

		var input model.MonitorTargetInput
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			model.RespondError(w, http.StatusBadRequest, "请求体格式错误")
			return
		}

		if err := h.HealthChecker.UpdateTarget(id, input); err != nil {
			if strings.Contains(err.Error(), "不存在") {
				model.RespondError(w, http.StatusNotFound, "目标不存在")
				return
			}
			slog.Error("更新监控目标失败", "error", err)
			model.RespondError(w, http.StatusInternalServerError, "更新失败")
			return
		}
		model.RespondJSON(w, http.StatusOK, map[string]any{"success": true})
	}
}

// DeleteCheck handles DELETE /api/v1/admin/monitor/checks/{id}.
func (h *Handler) DeleteCheck() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")

		if err := h.HealthChecker.DeleteTarget(id); err != nil {
			if strings.Contains(err.Error(), "不存在") {
				model.RespondError(w, http.StatusNotFound, "目标不存在")
				return
			}
			slog.Error("删除监控目标失败", "error", err)
			model.RespondError(w, http.StatusInternalServerError, "删除失败")
			return
		}
		model.RespondJSON(w, http.StatusOK, map[string]any{"success": true})
	}
}

// FetchMonitorIcon handles POST /api/v1/admin/monitor/fetch-icon.
func FetchMonitorIcon() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		type request struct{ URL string `json:"url"` }
		var req request
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.URL == "" {
			model.RespondError(w, http.StatusBadRequest, "请输入有效 URL")
			return
		}
		iconURL := fetchFavicon(req.URL)
		model.RespondJSON(w, http.StatusOK, map[string]any{"icon": iconURL})
	}
}

// WOLById handles POST /api/v1/admin/monitor/wol/{id}.
func (h *Handler) WOLById() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")

		var mac string
		err := h.DB.QueryRowContext(r.Context(),
			"SELECT mac FROM monitor_targets WHERE id = ?", id).Scan(&mac)
		if err != nil {
			model.RespondError(w, http.StatusNotFound, "目标不存在")
			return
		}
		if mac == "" {
			model.RespondError(w, http.StatusBadRequest, "未配置 MAC 地址")
			return
		}

		if err := service.WakeOnLAN(mac); err != nil {
			slog.Warn("WOL 唤醒失败", "error", err)
			model.RespondError(w, http.StatusInternalServerError, "唤醒失败，请检查 MAC 地址")
			return
		}

		model.RespondJSON(w, http.StatusOK, map[string]any{"success": true, "mac": mac})
	}
}

// WOLDirect handles POST /api/v1/admin/monitor/wol.
func WOLDirect() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		type request struct{ MAC string `json:"mac"` }
		var req request
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.MAC == "" {
			model.RespondError(w, http.StatusBadRequest, "请输入 MAC 地址")
			return
		}

		if err := service.WakeOnLAN(req.MAC); err != nil {
			slog.Warn("WOL 唤醒失败", "error", err)
			model.RespondError(w, http.StatusInternalServerError, "唤醒失败，请检查 MAC 地址")
			return
		}
		model.RespondJSON(w, http.StatusOK, map[string]any{"success": true})
	}
}

// ===== Aggregate endpoint =====

type MonitorAllResponse struct {
	System     model.SystemInfo                `json:"system"`
	Targets    []model.MonitorTarget           `json:"targets"`
	Results    []model.CheckResult             `json:"results"`
	Containers []model.DockerContainer         `json:"containers"`
	Stats      []model.DockerStat              `json:"stats"`
	Metadata   map[string]model.DockerMetadata `json:"metadata"`
}

// MonitorAll handles GET /api/v1/admin/monitor/all.
func (h *Handler) MonitorAll() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		resp := MonitorAllResponse{
			System:   service.GetSystemInfo(),
			Targets:  h.HealthChecker.GetTargets(),
			Results:  h.HealthChecker.GetResults(),
			Metadata: h.DockerMeta.GetAll(),
		}

		if svc := h.DockerSvc; svc != nil {
			if containers, err := svc.ListContainers(r.Context()); err == nil {
				resp.Containers = containers
			}
			if stats, err := svc.ContainerStats(r.Context()); err == nil {
				resp.Stats = stats
			}
		}

		model.RespondJSON(w, http.StatusOK, resp)
	}
}

// ===== Favicon fetch helper =====

func fetchFavicon(targetURL string) *string {
	normalizedURL := targetURL
	if !strings.HasPrefix(normalizedURL, "http://") && !strings.HasPrefix(normalizedURL, "https://") {
		normalizedURL = "http://" + normalizedURL
	}

	client := &http.Client{
		Timeout: 5 * time.Second,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= 10 {
				return fmt.Errorf("重定向次数过多")
			}
			return nil
		},
	}

	origin := extractOrigin(targetURL)
	var fallbackIcon *string
	if origin != "" {
		f := origin + "/favicon.ico"
		fallbackIcon = &f
	}

	html := fetchHTML(client, targetURL)
	if html == "" {
		return fallbackIcon
	}

	iconURL := extractFaviconFromHTML(html, origin)
	if iconURL != "" {
		return &iconURL
	}

	return fallbackIcon
}

func fetchHTML(client *http.Client, url string) string {
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return ""
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (NavServer Monitor; +https://github.com/yingxiaomo/nav)")
	req.Header.Set("Accept", "text/html,application/xhtml+xml")

	resp, err := client.Do(req)
	if err != nil {
		return ""
	}
	defer resp.Body.Close()

	limited := io.LimitReader(resp.Body, 512*1024)
	data, err := io.ReadAll(limited)
	if err != nil {
		return ""
	}

	contentType := resp.Header.Get("Content-Type")
	charset := detectCharset(contentType)
	return decodeToString(data, charset)
}

func extractOrigin(rawURL string) string {
	if !strings.HasPrefix(rawURL, "http://") && !strings.HasPrefix(rawURL, "https://") {
		rawURL = "http://" + rawURL
	}

	afterProto := rawURL
	if strings.HasPrefix(rawURL, "https://") {
		afterProto = rawURL[8:]
	} else if strings.HasPrefix(rawURL, "http://") {
		afterProto = rawURL[7:]
	}

	slashIdx := strings.Index(afterProto, "/")
	if slashIdx == -1 {
		slashIdx = len(afterProto)
	}

	host := afterProto[:slashIdx]
	proto := "https"
	if strings.HasPrefix(rawURL, "http://") {
		proto = "http"
	}

	return proto + "://" + host
}

func detectCharset(contentType string) string {
	idx := strings.Index(strings.ToLower(contentType), "charset=")
	if idx == -1 {
		return "utf-8"
	}
	charset := contentType[idx+8:]
	if semi := strings.Index(charset, ";"); semi != -1 {
		charset = charset[:semi]
	}
	return strings.TrimSpace(charset)
}

func decodeToString(data []byte, charset string) string {
	switch strings.ToLower(charset) {
	case "utf-8", "utf8", "":
		return string(data)
	default:
		return string(data)
	}
}

func extractFaviconFromHTML(html string, baseURL string) string {
	for _, pattern := range faviconPatterns {
		matches := pattern.FindStringSubmatch(html)
		if len(matches) > 1 && matches[1] != "" {
			resolved := resolveURL(matches[1], baseURL)
			if resolved != "" {
				return resolved
			}
		}
	}
	return ""
}

func resolveURL(href, base string) string {
	if strings.HasPrefix(href, "http://") || strings.HasPrefix(href, "https://") || strings.HasPrefix(href, "data:") {
		return href
	}

	base = strings.TrimRight(base, "/")
	if strings.HasPrefix(href, "/") {
		return base + href
	}
	return base + "/" + href
}
