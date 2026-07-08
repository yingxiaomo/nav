package service

import (
	"context"
	"encoding/binary"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/YingXiaoMo/nav/internal/model"
)

// DockerService 封装了轻量 Docker HTTP 客户端，用于容器管理。
type DockerService struct {
	cli *http.Client
}

// NewDockerService 创建 Docker 客户端。
// 如果 Docker socket 不可用则返回错误（调用方应优雅处理）。
func NewDockerService() (*DockerService, error) {
	cli, err := newDockerClient()
	if err != nil {
		return nil, fmt.Errorf("创建 Docker 客户端失败: %w", err)
	}
	return &DockerService{cli: cli}, nil
}

// Close 释放空闲连接。
func (s *DockerService) Close() error {
	if tr, ok := s.cli.Transport.(*http.Transport); ok {
		tr.CloseIdleConnections()
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
			ID:      c.ID[:12],
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
			slog.Warn("获取容器统计失败", "container", c.ID[:12], "error", err)
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
	return dockerPost(ctx, s.cli, "/containers/"+id+"/start", 204)
}

// StopContainer 停止运行中的容器。
func (s *DockerService) StopContainer(ctx context.Context, id string) error {
	return dockerPost(ctx, s.cli, "/containers/"+id+"/stop", 204)
}

// RestartContainer 重启容器。
func (s *DockerService) RestartContainer(ctx context.Context, id string) error {
	return dockerPost(ctx, s.cli, "/containers/"+id+"/restart", 204)
}

// StreamLogs 将容器日志流式传输到指定 channel。
// 当 context 被取消或日志流结束时，channel 会被关闭。
func (s *DockerService) StreamLogs(ctx context.Context, containerID string, lines chan<- string) error {
	reader, err := dockerGetRaw(ctx, s.cli,
		"/containers/"+containerID+"/logs?stdout=true&stderr=true&follow=true&tail=100")
	if err != nil {
		return fmt.Errorf("获取容器日志失败: %w", err)
	}
	defer reader.Close()

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
