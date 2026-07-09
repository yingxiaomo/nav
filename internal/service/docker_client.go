package service

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// dockerSocketPaths 当 DOCKER_HOST 未设置时按顺序尝试的 socket 路径。
var dockerSocketPaths = []string{
	"/var/run/docker.sock",
	filepath.Join(os.Getenv("HOME"), ".docker", "run", "docker.sock"),
}

// DockerAPI 类型 — 仅包含我们从 Docker SDK 中用到的最小字段子集。

type dockerContainerJSON struct {
	ID      string           `json:"Id"`
	Names   []string         `json:"Names"`
	Image   string           `json:"Image"`
	State   string           `json:"State"`
	Status  string           `json:"Status"`
	Created int64            `json:"Created"`
	Ports   []dockerPortJSON `json:"Ports"`
}

type dockerPortJSON struct {
	PrivatePort uint16 `json:"PrivatePort"`
	PublicPort  uint16 `json:"PublicPort"`
	Type        string `json:"Type"`
}

type dockerStatsJSON struct {
	CPUStats    dockerCPUStats    `json:"cpu_stats"`
	PreCPUStats dockerCPUStats    `json:"precpu_stats"`
	MemoryStats dockerMemoryStats `json:"memory_stats"`
}

type dockerCPUStats struct {
	CPUUsage    dockerCPUUsage `json:"cpu_usage"`
	SystemUsage uint64         `json:"system_cpu_usage"`
	OnlineCPUs  uint32         `json:"online_cpus"`
}

type dockerCPUUsage struct {
	TotalUsage uint64 `json:"total_usage"`
}

type dockerMemoryStats struct {
	MemoryUsage uint64 `json:"usage"`
	MemoryLimit uint64 `json:"limit"`
}

// newDockerClient 创建连接到 Docker 守护进程的 http.Client。
// 优先读取 DOCKER_HOST 环境变量，否则默认连接 Unix socket。
func newDockerClient() (*http.Client, error) {
	dockerHost := os.Getenv("DOCKER_HOST")
	if dockerHost == "" {
		// 尝试默认 socket 路径
		sockPath := ""
		for _, p := range dockerSocketPaths {
			if _, err := os.Stat(p); err == nil {
				sockPath = p
				break
			}
		}
		if sockPath == "" {
			// 兜底：尝试 Docker Desktop 默认路径（macOS/Linux）
			sockPath = "/var/run/docker.sock"
		}
		dockerHost = "unix://" + sockPath
	}

	parsed, err := url.Parse(dockerHost)
	if err != nil {
		return nil, fmt.Errorf("解析 DOCKER_HOST 失败: %w", err)
	}

	var dialFn func(ctx context.Context, network, addr string) (net.Conn, error)

	switch parsed.Scheme {
	case "unix":
		sockPath := parsed.Path
		dialFn = func(_ context.Context, _, _ string) (net.Conn, error) {
			return net.DialTimeout("unix", sockPath, 5*time.Second)
		}
	case "tcp":
		host := parsed.Host
		if parsed.Port() == "" {
			host = host + ":2375"
		}
		dialFn = func(_ context.Context, _, _ string) (net.Conn, error) {
			return net.DialTimeout("tcp", host, 5*time.Second)
		}
	default:
		return nil, fmt.Errorf("不支持的 Docker host 协议: %s", parsed.Scheme)
	}

	return &http.Client{
		Transport: &http.Transport{
			DialContext: dialFn,
		},
		Timeout: 30 * time.Second,
	}, nil
}

// dockerGet 向 Docker API 发送 GET 请求并将 JSON 响应解码为目标类型。
func dockerGet[T any](ctx context.Context, cli *http.Client, path string) (*T, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "http://docker"+path, nil)
	if err != nil {
		return nil, fmt.Errorf("创建请求失败: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := cli.Do(req)
	if err != nil {
		return nil, fmt.Errorf("请求失败: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		return nil, fmt.Errorf("Docker API 返回 %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}

	var result T
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("解析响应失败: %w", err)
	}
	return &result, nil
}

// dockerPost 向 Docker API 发送 POST 请求。
// expectStatus 为 0 时接受任意 2xx 状态码。
func dockerPost(ctx context.Context, cli *http.Client, path string, expectStatus int) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "http://docker"+path, http.NoBody)
	if err != nil {
		return fmt.Errorf("创建请求失败: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := cli.Do(req)
	if err != nil {
		return fmt.Errorf("请求失败: %w", err)
	}
	defer resp.Body.Close()

	if expectStatus > 0 && resp.StatusCode != expectStatus {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		return fmt.Errorf("Docker API 返回 %d（期望 %d）: %s",
			resp.StatusCode, expectStatus, strings.TrimSpace(string(body)))
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		return fmt.Errorf("Docker API 返回 %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}
	return nil
}

// dockerGetRaw 发送 GET 请求并返回原始响应体读取器。
// 调用方必须关闭返回的 body。
func dockerGetRaw(ctx context.Context, cli *http.Client, path string) (io.ReadCloser, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "http://docker"+path, nil)
	if err != nil {
		return nil, fmt.Errorf("创建请求失败: %w", err)
	}

	resp, err := cli.Do(req)
	if err != nil {
		return nil, fmt.Errorf("请求失败: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		resp.Body.Close()
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		return nil, fmt.Errorf("Docker API 返回 %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}
	return resp.Body, nil
}
