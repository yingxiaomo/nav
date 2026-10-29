package service

import (
	"bufio"
	"context"
	"encoding/binary"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/YingXiaoMo/nav/internal/model"
)

// DockerService 封装了轻量 Docker HTTP 客户端，用于容器管理。
type DockerService struct {
	cli       *http.Client
	streamCli *http.Client
}

// NewDockerService 创建 Docker 客户端。
// 如果 Docker socket 不可用则返回错误（调用方应优雅处理）。
func NewDockerService() (*DockerService, error) {
	cli, err := newDockerClient()
	if err != nil {
		return nil, fmt.Errorf("创建 Docker 客户端失败: %w", err)
	}
	streamCli, err := newDockerStreamClient()
	if err != nil {
		return nil, fmt.Errorf("创建 Docker 流客户端失败: %w", err)
	}
	return &DockerService{cli: cli, streamCli: streamCli}, nil
}

// Close 释放空闲连接。
func (s *DockerService) Close() error {
	for _, c := range []*http.Client{s.cli, s.streamCli} {
		if tr, ok := c.Transport.(*http.Transport); ok {
			tr.CloseIdleConnections()
		}
	}
	return nil
}

// shortID 安全截取容器 ID 前 12 位——Docker 返回异常数据（空 ID）时
// 直接切片会 panic，而后台快照 goroutine 的 panic 会杀死整个进程。
func shortID(id string) string {
	if len(id) > 12 {
		return id[:12]
	}
	return id
}

// containerRefRe 合法的容器名/短 ID 格式（Docker 命名规则）。
// 服务端统一校验后再拼进 API 路径，防止 ?/#/../% 等字符改变请求目标。
var containerRefRe = regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$`)

// validateContainerRef 校验容器名/ID
func validateContainerRef(ref string) error {
	if !containerRefRe.MatchString(ref) {
		return fmt.Errorf("非法的容器名或 ID: %q", ref)
	}
	return nil
}

// ListContainers 返回所有容器（运行中 + 已停止）的基本信息。
func (s *DockerService) ListContainers(ctx context.Context) ([]model.DockerContainer, error) {
	containers, err := dockerGet[[]dockerContainerJSON](ctx, s.cli, "/containers/json?all=true")
	if err != nil {
		return nil, err
	}

	result := make([]model.DockerContainer, 0, len(*containers))
	for _, c := range *containers {
		name := ""
		if len(c.Names) > 0 {
			name = strings.TrimPrefix(c.Names[0], "/")
		}
		result = append(result, model.DockerContainer{
			ID:      shortID(c.ID),
			Name:    name,
			Image:   c.Image,
			State:   c.State,
			Status:  c.Status,
			Ports:   formatPorts(c.Ports),
			Created: time.Unix(c.Created, 0).Format(time.RFC3339),
		})
	}
	return result, nil
}

// formatPorts 将 Docker 端口映射转换为可读字符串。
func formatPorts(ports []dockerPortJSON) string {
	var parts []string
	for _, p := range ports {
		if p.PublicPort > 0 {
			parts = append(parts, fmt.Sprintf("%d:%d", p.PublicPort, p.PrivatePort))
		} else {
			parts = append(parts, fmt.Sprintf("%d", p.PrivatePort))
		}
	}
	return strings.Join(parts, ", ")
}

// dockerInspectTTY 仅取容器 inspect 的 TTY 标志（决定日志流格式）
type dockerInspectTTY struct {
	Config struct {
		Tty bool `json:"Tty"`
	} `json:"Config"`
}

// containerTTY 查询容器是否以 TTY 模式运行
func (s *DockerService) containerTTY(ctx context.Context, id string) (bool, error) {
	insp, err := dockerGet[dockerInspectTTY](ctx, s.cli, "/containers/"+id+"/json")
	if err != nil {
		return false, err
	}
	return insp.Config.Tty, nil
}

// ContainerStats 返回所有运行中容器的实时 CPU 和内存统计。
func (s *DockerService) ContainerStats(ctx context.Context) ([]model.DockerStat, error) {
	containers, err := dockerGet[[]dockerContainerJSON](ctx, s.cli, "/containers/json?all=false")
	if err != nil {
		return nil, err
	}

	var stats []model.DockerStat
	for _, c := range *containers {
		name := ""
		if len(c.Names) > 0 {
			name = strings.TrimPrefix(c.Names[0], "/")
		}

		statsCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
		sData, err := dockerGet[dockerStatsJSON](statsCtx, s.cli, "/containers/"+c.ID+"/stats?stream=false")
		cancel()
		if err != nil {
			slog.Warn("获取容器统计失败", "container", shortID(c.ID), "error", err)
			continue
		}

		cpuPercent := calcCPUPercent(sData)
		memPercent := 0.0
		if sData.MemoryStats.MemoryLimit > 0 {
			memPercent = float64(sData.MemoryStats.MemoryUsage) / float64(sData.MemoryStats.MemoryLimit) * 100.0
		}

		stats = append(stats, model.DockerStat{
			Name:       name,
			CPUPercent: cpuPercent,
			MemUsage:   float64(sData.MemoryStats.MemoryUsage),
			MemLimit:   float64(sData.MemoryStats.MemoryLimit),
			MemPercent: memPercent,
		})
	}

	return stats, nil
}

// calcCPUPercent 从 Docker 统计信息计算 CPU 使用率百分比。
func calcCPUPercent(s *dockerStatsJSON) float64 {
	if s.CPUStats.SystemUsage == 0 || s.PreCPUStats.SystemUsage == 0 {
		return 0.0
	}

	cpuDelta := s.CPUStats.CPUUsage.TotalUsage - s.PreCPUStats.CPUUsage.TotalUsage
	systemDelta := s.CPUStats.SystemUsage - s.PreCPUStats.SystemUsage
	if systemDelta == 0 {
		return 0.0
	}

	onlineCPUs := s.CPUStats.OnlineCPUs
	if onlineCPUs == 0 {
		onlineCPUs = 1
	}

	return (float64(cpuDelta) / float64(systemDelta)) * float64(onlineCPUs) * 100.0
}

// StartContainer 启动已停止的容器。
func (s *DockerService) StartContainer(ctx context.Context, id string) error {
	if err := validateContainerRef(id); err != nil {
		return err
	}
	return dockerPost(ctx, s.cli, "/containers/"+id+"/start", 204)
}

// StopContainer 停止运行中的容器。
func (s *DockerService) StopContainer(ctx context.Context, id string) error {
	if err := validateContainerRef(id); err != nil {
		return err
	}
	return dockerPost(ctx, s.cli, "/containers/"+id+"/stop", 204)
}

// RestartContainer 重启容器。
func (s *DockerService) RestartContainer(ctx context.Context, id string) error {
	if err := validateContainerRef(id); err != nil {
		return err
	}
	return dockerPost(ctx, s.cli, "/containers/"+id+"/restart", 204)
}

// StreamLogs 将容器日志流式传输到指定 channel。
// 当 context 被取消或日志流结束时，channel 会被关闭。
func (s *DockerService) StreamLogs(ctx context.Context, containerID string, lines chan<- string) error {
	if err := validateContainerRef(containerID); err != nil {
		return err
	}
	// TTY 容器的日志是 raw 文本流（无 8 字节复用头）——按头解析会出现
	// 乱码/"帧过大"。先查容器 TTY 标志再选择解析方式
	tty, err := s.containerTTY(ctx, containerID)
	if err != nil {
		// 不能默认非 TTY：TTY 容器的 raw 流会被误当复用头解析
		// （乱码/"帧过大"）。查询失败直接报错，由前端重试
		return fmt.Errorf("查询容器信息失败: %w", err)
	}
	// 用不带 Timeout 的流客户端：30s Timeout 会掐断 follow 长连接
	reader, err := dockerGetRaw(ctx, s.streamCli,
		"/containers/"+containerID+"/logs?stdout=true&stderr=true&follow=true&tail=100")
	if err != nil {
		return fmt.Errorf("获取容器日志失败: %w", err)
	}
	defer reader.Close()

	// TTY 容器：raw 文本流，按行读取（无复用头）
	if tty {
		scanner := bufio.NewScanner(reader)
		scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)
		for scanner.Scan() {
			select {
			case lines <- scanner.Text():
			case <-ctx.Done():
				return ctx.Err()
			}
		}
		return scanner.Err()
	}

	// 读取复用流：8 字节头 + 负载
	hdr := make([]byte, 8)
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		_, err := io.ReadFull(reader, hdr)
		if err != nil {
			if err == io.EOF || err == io.ErrUnexpectedEOF {
				return nil
			}
			return fmt.Errorf("读取日志头失败: %w", err)
		}

		// hdr[0] = 流类型（1=stdout, 2=stderr）
		// hdr[4:8] = 帧大小（大端 uint32）
		size := binary.BigEndian.Uint32(hdr[4:8])
		if size == 0 {
			continue
		}
		// 防御异常帧头导致的超大分配（Docker 实际帧 ≤16KB）
		if size > 1<<20 {
			return fmt.Errorf("日志帧过大: %d bytes", size)
		}

		buf := make([]byte, size)
		_, err = io.ReadFull(reader, buf)
		if err != nil {
			return fmt.Errorf("读取日志内容失败: %w", err)
		}

		select {
		case lines <- string(buf):
		case <-ctx.Done():
			return ctx.Err()
		}
	}
}

// DockerSnapshotter 后台轮询 Docker stats，提供内存快照
type DockerSnapshotter struct {
	svc     *DockerService
	mu      sync.RWMutex
	stats   []model.DockerStat
	updated time.Time
	ready   bool
	cancel  context.CancelFunc
}

// NewDockerSnapshotter 创建快照器
func NewDockerSnapshotter(svc *DockerService) *DockerSnapshotter {
	return &DockerSnapshotter{svc: svc}
}

// Start 启动后台轮询（每 10s 更新一次快照）
func (s *DockerSnapshotter) Start(ctx context.Context) {
	ctx, cancel := context.WithCancel(ctx)
	s.cancel = cancel
	go func() {
		// 首次运行立即执行
		s.refresh(ctx)
		ticker := time.NewTicker(10 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				s.refresh(ctx)
			}
		}
	}()
}

// Stop 停止轮询
func (s *DockerSnapshotter) Stop() {
	if s.cancel != nil {
		s.cancel()
	}
}

// Snapshot 返回当前快照（读锁，不阻塞其余前端请求）
func (s *DockerSnapshotter) Snapshot() ([]model.DockerStat, bool, time.Time) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.stats, s.ready, s.updated
}

func (s *DockerSnapshotter) refresh(ctx context.Context) {
	// 后台 goroutine 不受 HTTP recovery 中间件保护，任何 panic 都会杀死整个进程
	defer func() {
		if r := recover(); r != nil {
			slog.Error("Docker 快照刷新 panic（已恢复）", "panic", r)
		}
	}()
	stats, err := s.svc.ContainerStats(ctx)
	if err != nil {
		slog.Warn("Docker stats 快照刷新失败", "error", err)
		return
	}
	s.mu.Lock()
	s.stats = stats
	s.updated = time.Now()
	s.ready = true
	s.mu.Unlock()
}
