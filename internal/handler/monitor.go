package handler

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"sort"
	"strings"

	"github.com/YingXiaoMo/nav/internal/model"
	"github.com/YingXiaoMo/nav/internal/service"
)

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

		// 编辑后立即触发一次健康检查，刷新内存结果
		if target := h.HealthChecker.CheckNow(id); target != nil {
			slog.Debug("更新后触发检查", "id", id, "url", target.URL)
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
		iconURL, _ := service.FetchFavicon(req.URL)
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

// MonitorAllResponse 包含监控面板全部数据
type MonitorAllResponse struct {
	System     model.SystemInfo                `json:"system"`
	Targets    []model.MonitorTarget           `json:"targets"`
	Results    []model.CheckResult             `json:"results"`
	Containers []model.DockerContainer         `json:"containers"`
	Stats      []model.DockerStat              `json:"stats"`
	Metadata   map[string]model.DockerMetadata `json:"metadata"`
	Uptime     map[string]float64               `json:"uptime,omitempty"`
	Initializing bool                          `json:"initializing,omitempty"`
}

// MonitorAll handles GET /api/v1/admin/monitor/all.
func (h *Handler) MonitorAll() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		resp := MonitorAllResponse{
			System:   service.GetSystemInfo(),
			Targets:  h.HealthChecker.GetTargets(),
			Results:  h.HealthChecker.GetResults(),
			Metadata: h.DockerMeta.GetAll(),
			Uptime:   h.HealthChecker.GetUptimeAll(),
		}

		if svc := h.DockerSvc; svc != nil {
			// 容器列表轻量快速，直接请求
			if containers, err := svc.ListContainers(r.Context()); err == nil {
				// 按 metadata.order 排序，支持前端拖拽后顺序固定
				sort.SliceStable(containers, func(i, j int) bool {
					oi := h.DockerMeta.GetOrder(containers[i].Name)
					oj := h.DockerMeta.GetOrder(containers[j].Name)
					return oi < oj
				})
				resp.Containers = containers
			}
			// Docker stats 从内存快照读取（<1ms），后台每 10s 刷新一次
			if h.DockerSnap != nil {
				stats, ready, _ := h.DockerSnap.Snapshot()
				resp.Stats = stats
				if !ready {
					resp.Initializing = true
				}
			}
		}

		model.RespondJSON(w, http.StatusOK, resp)
	}
}

