package service

import (
	"context"
	"crypto/tls"
	"database/sql"
	"fmt"
	"log/slog"
	"net/http"
	"os/exec"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/YingXiaoMo/nav/internal/model"
)

// HealthChecker periodically performs HTTP health checks on monitor targets
// and holds the most recent results in memory.
type HealthChecker struct {
	db      *sql.DB
	results map[string]model.CheckResult
	mu      sync.RWMutex
	running bool
	muRun   sync.Mutex
	ticker  *time.Ticker
	cancel  context.CancelFunc
	sem     chan struct{} // concurrency limiter
	notify  Notifier
}

// Notifier 健康检查状态变更通知接口
type Notifier interface {
	ShouldNotify(targetID string) bool
	MarkNotified(targetID string)
	Send(name, url, status string)
}

const maxConcurrentHealthChecks = 10

// NewHealthChecker creates a new HealthChecker.
func NewHealthChecker(db *sql.DB, notifier ...Notifier) *HealthChecker {
	hc := &HealthChecker{
		db:      db,
		results: make(map[string]model.CheckResult),
		sem:     make(chan struct{}, maxConcurrentHealthChecks),
	}
	if len(notifier) > 0 {
		hc.notify = notifier[0]
	}
	return hc
}

// Start begins periodic health checks every 60 seconds.
func (h *HealthChecker) Start(ctx context.Context) {
	ctx, cancel := context.WithCancel(ctx)
	h.cancel = cancel
	h.ticker = time.NewTicker(60 * time.Second)

	// Run first check immediately
	h.runAllChecks(ctx)

	go func() {
		for {
			select {
			case <-h.ticker.C:
				h.runAllChecks(ctx)
			case <-ctx.Done():
				return
			}
		}
	}()
}

// Stop stops the health checker.
func (h *HealthChecker) Stop() {
	if h.ticker != nil {
		h.ticker.Stop()
	}
	if h.cancel != nil {
		h.cancel()
	}
}

// GetResults returns all latest check results for all targets.
func (h *HealthChecker) GetResults() []model.CheckResult {
	targets := h.getTargets()
	h.mu.RLock()
	defer h.mu.RUnlock()

	results := make([]model.CheckResult, 0, len(targets))
	for _, t := range targets {
		r, ok := h.results[t.ID]
		if !ok {
			r = model.CheckResult{
				ID:        t.ID,
				Name:      t.Name,
				URL:       t.URL,
				Status:    "error",
				Latency:   nil,
				LastCheck: nil,
			}
		}
		results = append(results, r)
	}
	return results
}

// runAllChecks performs HTTP checks against all targets in the database.
// Uses a semaphore to limit concurrent HTTP requests.
func (h *HealthChecker) runAllChecks(ctx context.Context) {
	h.muRun.Lock()
	if h.running {
		h.muRun.Unlock()
		slog.Debug("Health check already in progress, skipping this round")
		return
	}
	h.running = true
	h.muRun.Unlock()

	defer func() {
		h.muRun.Lock()
		h.running = false
		h.muRun.Unlock()
	}()

	targets := h.getTargets()
	if len(targets) == 0 {
		return
	}

	var wg sync.WaitGroup
	for i := range targets {
		wg.Add(1)
		h.sem <- struct{}{} // acquire — blocks if already at max concurrency
		go func(t model.MonitorTarget) {
			defer wg.Done()
			defer func() { <-h.sem }() // release
			result := h.checkTarget(ctx, t)
			h.mu.Lock()
			h.results[result.ID] = result
			h.mu.Unlock()
		}(targets[i])
	}
	wg.Wait()
}

// checkTarget performs a check against a target.
// For HTTP targets: tries HEAD first, falls back to GET.
// For Ping targets: uses system ping command.
func (h *HealthChecker) checkTarget(ctx context.Context, target model.MonitorTarget) model.CheckResult {
	if target.CheckType == "ping" {
		return h.pingTarget(target)
	}

	timeout := target.Timeout
	if timeout <= 0 {
		timeout = 5000
	}

	client := &http.Client{
		Timeout: time.Duration(timeout) * time.Millisecond,
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
		},
	}

	return h.doCheck(client, ctx, target)
}

func (h *HealthChecker) doCheck(client *http.Client, ctx context.Context, target model.MonitorTarget) model.CheckResult {
	// Try HEAD first (faster, lighter)
	start := time.Now()
	req, err := http.NewRequestWithContext(ctx, "HEAD", target.URL, nil)
	if err != nil {
		now := model.Now()
		return model.CheckResult{
			ID:        target.ID,
			Name:      target.Name,
			URL:       target.URL,
			Status:    "error",
			Latency:   nil,
			LastCheck: &now,
		}
	}

	resp, err := client.Do(req)
	latency := time.Since(start).Milliseconds()
	now := model.Now()

	if err != nil {
		// HEAD failed (timeout/TLS/network) — fall back to GET
		slog.Debug("HEAD 请求失败，回退到 GET", "url", target.URL, "error", err)
		return h.doGetCheck(client, ctx, target)
	}
	resp.Body.Close()

	if resp.StatusCode >= 200 && resp.StatusCode < 400 {
		return model.CheckResult{
			ID:        target.ID,
			Name:      target.Name,
			URL:       target.URL,
			Status:    "ok",
			Latency:   &latency,
			LastCheck: &now,
		}
	}

	// HEAD returned 4xx/5xx — fall back to GET for a definitive status
	return h.doGetCheck(client, ctx, target)
}

// pingTarget 通过 ICMP Ping 检查目标可达性
func (h *HealthChecker) pingTarget(target model.MonitorTarget) model.CheckResult {
	host := target.URL
	// 去掉协议前缀
	host = strings.TrimPrefix(host, "http://")
	host = strings.TrimPrefix(host, "https://")
	// 去掉路径
	if idx := strings.Index(host, "/"); idx > 0 {
		host = host[:idx]
	}

	count := "1"
	timeout := target.Timeout
	if timeout <= 0 {
		timeout = 5000
	}

	now := model.Now()
	var cmd *exec.Cmd
	if runtime.GOOS == "windows" {
		cmd = exec.Command("ping", "-n", count, "-w", strconv.Itoa(timeout), host)
	} else {
		cmd = exec.Command("ping", "-c", count, "-W", strconv.Itoa(timeout/1000), host)
	}

	start := time.Now()
	err := cmd.Run()
	latency := time.Since(start).Milliseconds()

	if err != nil {
		return model.CheckResult{
			ID: target.ID, Name: target.Name, URL: target.URL,
			Status: "timeout", Latency: nil, LastCheck: &now,
		}
	}

	return model.CheckResult{
		ID: target.ID, Name: target.Name, URL: target.URL,
		Status: "ok", Latency: &latency, LastCheck: &now,
	}
}

func (h *HealthChecker) doGetCheck(client *http.Client, ctx context.Context, target model.MonitorTarget) model.CheckResult {
	start := time.Now()
	req, err := http.NewRequestWithContext(ctx, "GET", target.URL, nil)
	if err != nil {
		now := model.Now()
		return model.CheckResult{
			ID:        target.ID,
			Name:      target.Name,
			URL:       target.URL,
			Status:    "error",
			Latency:   nil,
			LastCheck: &now,
		}
	}

	resp, err := client.Do(req)
	latency := time.Since(start).Milliseconds()
	now := model.Now()

	if err != nil {
		return model.CheckResult{
			ID:        target.ID,
			Name:      target.Name,
			URL:       target.URL,
			Status:    "timeout",
			Latency:   nil,
			LastCheck: &now,
		}
	}
	resp.Body.Close()

	if resp.StatusCode >= 200 && resp.StatusCode < 400 {
		return model.CheckResult{
			ID:        target.ID,
			Name:      target.Name,
			URL:       target.URL,
			Status:    "ok",
			Latency:   &latency,
			LastCheck: &now,
		}
	}

	return model.CheckResult{
		ID:        target.ID,
		Name:      target.Name,
		URL:       target.URL,
		Status:    "error",
		Latency:   &latency,
		LastCheck: &now,
	}
}

// -------- CRUD for monitor targets ----------

// GetTargets retrieves all monitor targets from the database.
func (h *HealthChecker) GetTargets() []model.MonitorTarget {
	return h.getTargets()
}

// getTargets retrieves all monitor targets from the database.
func (h *HealthChecker) getTargets() []model.MonitorTarget {
	rows, err := h.db.Query(
		"SELECT id, name, url, COALESCE(icon,''), COALESCE(mac,''), timeout, created_at FROM monitor_targets ORDER BY created_at",
	)
	if err != nil {
		slog.Warn("查询监控目标失败", "error", err)
		return nil
	}
	defer rows.Close()

	var targets []model.MonitorTarget
	for rows.Next() {
		var t model.MonitorTarget
		if err := rows.Scan(&t.ID, &t.Name, &t.URL, &t.Icon, &t.MAC, &t.Timeout, &t.CreatedAt, &t.SSHUser, &t.SSHPass); err != nil {
			slog.Warn("扫描监控目标失败", "error", err)
			continue
		}
		targets = append(targets, t)
	}
	return targets
}


// cleanOldHistory 清理 7 天前的历史记录
func (h *HealthChecker) cleanOldHistory() error {
	sevenDaysAgo := time.Now().AddDate(0, 0, -7).UnixMilli()
	_, err := h.db.Exec("DELETE FROM check_history WHERE checked_at < ?", sevenDaysAgo)
	return err
}

// GetUptime 返回指定目标最近 24 小时内的在线率（0-100）
func (h *HealthChecker) GetUptime(targetID string) float64 {
	dayAgo := time.Now().Add(-24 * time.Hour).UnixMilli()
	var total, ok int
	h.db.QueryRow("SELECT COUNT(*), COALESCE(SUM(CASE WHEN status='ok' THEN 1 ELSE 0 END),0) FROM check_history WHERE target_id=? AND checked_at > ?", targetID, dayAgo).Scan(&total, &ok)
	if total == 0 { return 0 }
	return float64(ok) / float64(total) * 100
}

// GetUptimeAll 返回所有目标的在线率
func (h *HealthChecker) GetUptimeAll() map[string]float64 {
	targets := h.getTargets()
	result := make(map[string]float64, len(targets))
	for _, t := range targets {
		result[t.ID] = h.GetUptime(t.ID)
	}
	return result
}
// AddTarget creates a new monitor target and triggers an immediate check.
// Returns the created target and any error.
func (h *HealthChecker) AddTarget(input model.MonitorTargetInput) (*model.MonitorTarget, error) {
	timeout := input.Timeout
	if timeout <= 0 {
		timeout = 5000
	}

	target := model.MonitorTarget{
		ID:        model.NewID(),
		Name:      input.Name,
		URL:       input.URL,
		Icon:      input.Icon,
		MAC:       input.MAC,
		Timeout:   timeout,
		CreatedAt: model.Now(),
	}

	_, err := h.db.Exec(
		"INSERT INTO monitor_targets (id, name, url, icon, mac, timeout, created_at, ssh_user, ssh_pass) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
		target.ID, target.Name, target.URL, target.Icon, target.MAC, target.Timeout, target.CreatedAt, target.SSHUser, target.SSHPass,
	)
	if err != nil {
		return nil, fmt.Errorf("添加监控目标失败: %w", err)
	}

	// Trigger immediate check
	result := h.checkTarget(context.Background(), target)
	h.mu.Lock()
	h.results[result.ID] = result
	h.mu.Unlock()

	return &target, nil
}

// UpdateTarget updates an existing monitor target.
func (h *HealthChecker) UpdateTarget(id string, input model.MonitorTargetInput) error {
	result, err := h.db.Exec(
		"UPDATE monitor_targets SET name=?, url=?, icon=?, mac=?, timeout=?, ssh_user=?, ssh_pass=?, api_key=?, check_type=? WHERE id=?",
		input.Name, input.URL, input.Icon, input.MAC, input.Timeout, input.SSHUser, input.SSHPass, id,
	)
	if err != nil {
		return fmt.Errorf("更新监控目标失败: %w", err)
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("监控目标不存在: %s", id)
	}

	// 清除内存中的旧结果，下次检查将使用新配置
	h.mu.Lock()
	delete(h.results, id)
	h.mu.Unlock()

	return nil
}


// CheckNow 对指定 ID 的目标立即执行一次健康检查，并更新内存结果。
// 返回目标信息；如果目标不存在返回 nil。
func (h *HealthChecker) CheckNow(id string) *model.MonitorTarget {
	targets := h.getTargets()
	for _, t := range targets {
		if t.ID == id {
			result := h.checkTarget(context.Background(), t)
			h.mu.Lock()
			h.results[result.ID] = result
			h.mu.Unlock()
			return &t
		}
	}
	return nil
}

// DeleteTarget removes a monitor target and its cached results.
func (h *HealthChecker) DeleteTarget(id string) error {
	result, err := h.db.Exec("DELETE FROM monitor_targets WHERE id=?", id)
	if err != nil {
		return fmt.Errorf("删除监控目标失败: %w", err)
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("监控目标不存在: %s", id)
	}

	h.mu.Lock()
	delete(h.results, id)
	h.mu.Unlock()

	return nil
}
