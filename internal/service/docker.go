package service

import (
	"context"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"strings"
	"time"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/client"

	"github.com/YingXiaoMo/nav/internal/model"
)

// DockerService wraps the Docker SDK client for container management.
type DockerService struct {
	cli *client.Client
}

// NewDockerService creates a new Docker client from environment variables.
// Returns nil, nil if Docker is not available (caller should handle gracefully).
func NewDockerService() (*DockerService, error) {
	cli, err := client.NewClientWithOpts(
		client.FromEnv,
		client.WithAPIVersionNegotiation(),
	)
	if err != nil {
		return nil, fmt.Errorf("创建 Docker 客户端失败: %w", err)
	}
	return &DockerService{cli: cli}, nil
}

// Close releases the Docker client resources.
func (s *DockerService) Close() error {
	return s.cli.Close()
}

// ListContainers returns all containers (running + stopped) with basic info.
func (s *DockerService) ListContainers(ctx context.Context) ([]model.DockerContainer, error) {
	containers, err := s.cli.ContainerList(ctx, container.ListOptions{All: true})
	if err != nil {
		return nil, err
	}

	result := make([]model.DockerContainer, 0, len(containers))
	for _, c := range containers {
		name := ""
		if len(c.Names) > 0 {
			name = strings.TrimPrefix(c.Names[0], "/")
		}
		result = append(result, model.DockerContainer{
			ID:      c.ID[:12],
			Name:    name,
			Image:   c.Image,
			State:   string(c.State),
			Status:  c.Status,
			Ports:   formatPorts(c.Ports),
			Created: time.Unix(c.Created, 0).Format(time.RFC3339),
		})
	}
	return result, nil
}

// formatPorts converts Docker port mappings to a human-readable string.
func formatPorts(ports []container.Port) string {
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

// ContainerStats returns live CPU and memory stats for all running containers.
func (s *DockerService) ContainerStats(ctx context.Context) ([]model.DockerStat, error) {
	containers, err := s.cli.ContainerList(ctx, container.ListOptions{All: false})
	if err != nil {
		return nil, err
	}

	var stats []model.DockerStat
	for _, c := range containers {
		name := ""
		if len(c.Names) > 0 {
			name = strings.TrimPrefix(c.Names[0], "/")
		}

		resp, err := s.cli.ContainerStats(ctx, c.ID, false)
		if err != nil {
			slog.Warn("获取容器统计失败", "container", c.ID[:12], "error", err)
			continue
		}

		var sData container.StatsResponse
		if err := json.NewDecoder(resp.Body).Decode(&sData); err != nil {
			resp.Body.Close()
			slog.Warn("解析容器统计 JSON 失败", "container", c.ID[:12], "error", err)
			continue
		}
		resp.Body.Close()

		// Calculate CPU percent
		cpuPercent := calcCPUPercent(&sData)

		// Calculate memory percent
		memPercent := 0.0
		if sData.MemoryStats.Limit > 0 {
			memPercent = float64(sData.MemoryStats.Usage) / float64(sData.MemoryStats.Limit) * 100.0
		}

		stats = append(stats, model.DockerStat{
			Name:       name,
			CPUPercent: cpuPercent,
			MemUsage:   float64(sData.MemoryStats.Usage),
			MemLimit:   float64(sData.MemoryStats.Limit),
			MemPercent: memPercent,
		})
	}

	return stats, nil
}

// calcCPUPercent computes CPU usage percentage from Docker stats.
func calcCPUPercent(s *container.StatsResponse) float64 {
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

// StreamLogs streams container logs to the given channel.
// The channel is closed when the context is cancelled or the log stream ends.
func (s *DockerService) StreamLogs(ctx context.Context, containerID string, lines chan<- string) error {
	logOpts := container.LogsOptions{
		ShowStdout: true,
		ShowStderr: true,
		Follow:     true,
		Tail:       "100",
	}

	reader, err := s.cli.ContainerLogs(ctx, containerID, logOpts)
	if err != nil {
		return fmt.Errorf("获取容器日志失败: %w", err)
	}
	defer reader.Close()

	// Read the multiplexed stream: 8-byte header + payload
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

		// hdr[0] = stream type (1=stdout, 2=stderr)
		// hdr[4:8] = frame size (big-endian uint32)
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
