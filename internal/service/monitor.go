package service

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"net/http"
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
}

// NewHealthChecker creates a new HealthChecker.
func NewHealthChecker(db *sql.DB) *HealthChecker {
	return &HealthChecker{
		db:      db,
		results: make(map[string]model.CheckResult),
	}
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
		go func(t model.MonitorTarget) {
			defer wg.Done()
			result := h.checkTarget(ctx, t)
			h.mu.Lock()
			h.results[result.ID] = result
			h.mu.Unlock()
		}(targets[i])
	}
	wg.Wait()
}

// checkTarget performs a single HTTP check against a target.
func (h *HealthChecker) checkTarget(ctx context.Context, target model.MonitorTarget) model.CheckResult {
	timeout := target.Timeout
	if timeout <= 0 {
		timeout = 5000
	}

	client := &http.Client{
		Timeout: time.Duration(timeout) * time.Millisecond,
	}

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
		Status:    "timeout",
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
		if err := rows.Scan(&t.ID, &t.Name, &t.URL, &t.Icon, &t.MAC, &t.Timeout, &t.CreatedAt); err != nil {
			slog.Warn("扫描监控目标失败", "error", err)
			continue
		}
		targets = append(targets, t)
	}
	return targets
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
		"INSERT INTO monitor_targets (id, name, url, icon, mac, timeout, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
		target.ID, target.Name, target.URL, target.Icon, target.MAC, target.Timeout, target.CreatedAt,
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
		"UPDATE monitor_targets SET name=?, url=?, icon=?, mac=?, timeout=? WHERE id=?",
		input.Name, input.URL, input.Icon, input.MAC, input.Timeout, id,
	)
	if err != nil {
		return fmt.Errorf("更新监控目标失败: %w", err)
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("监控目标不存在: %s", id)
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
