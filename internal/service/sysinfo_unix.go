//go:build !windows

package service

import (
	"fmt"
	"math"
	"os"
	"strconv"
	"strings"
	"sync"
	"syscall"

	"github.com/YingXiaoMo/nav/internal/model"
)

// cpuSample stores a snapshot of CPU times for delta calculation.
type cpuSample struct {
	idle  uint64
	total uint64
}

var (
	lastCPUSample cpuSample
	cpuSampleMu   sync.Mutex
)

// readCPUSample reads the current CPU times from /proc/stat.
func readCPUSample() (cpuSample, error) {
	data, err := os.ReadFile("/proc/stat")
	if err != nil {
		return cpuSample{}, err
	}

	for _, line := range strings.Split(string(data), "\n") {
		if !strings.HasPrefix(line, "cpu ") {
			continue
		}

		fields := strings.Fields(line)
		if len(fields) < 5 {
			continue
		}

		var values [8]uint64
		for i := 1; i < len(fields) && i <= 8; i++ {
			v, _ := strconv.ParseUint(fields[i], 10, 64)
			values[i-1] = v
		}

		// fields: user, nice, system, idle, iowait, irq, softirq, steal
		idle := values[3] + values[4] // idle + iowait
		total := values[0] + values[1] + values[2] + values[3] + values[4] + values[5] + values[6] + values[7]
		return cpuSample{idle: idle, total: total}, nil
	}

	return cpuSample{}, fmt.Errorf("/proc/stat 中未找到 cpu 行")
}

// calcCPUUsage calculates CPU usage percentage between last and current sample.
func calcCPUUsage() float64 {
	current, err := readCPUSample()
	if err != nil {
		return 0
	}

	cpuSampleMu.Lock()
	last := lastCPUSample
	lastCPUSample = current
	cpuSampleMu.Unlock()

	if last.total == 0 || last.idle == 0 {
		return 0
	}

	diffIdle := current.idle - last.idle
	diffTotal := current.total - last.total

	if diffTotal == 0 {
		return 0
	}

	usage := (1.0 - float64(diffIdle)/float64(diffTotal)) * 100.0
	return math.Round(usage)
}

// readMemoryInfo reads memory stats from /proc/meminfo.
func readMemoryInfo() (total int64, available int64) {
	data, err := os.ReadFile("/proc/meminfo")
	if err != nil {
		return 0, 0
	}

	var memTotal, memAvailable int64
	for _, line := range strings.Split(string(data), "\n") {
		if strings.HasPrefix(line, "MemTotal:") {
			memTotal = parseMemInfoValue(line)
		} else if strings.HasPrefix(line, "MemAvailable:") {
			memAvailable = parseMemInfoValue(line)
		}
	}

	return memTotal, memAvailable
}

// parseMemInfoValue extracts the numeric value (in kB) from a /proc/meminfo line.
func parseMemInfoValue(line string) int64 {
	parts := strings.Fields(line)
	if len(parts) < 2 {
		return 0
	}
	v, _ := strconv.ParseInt(parts[1], 10, 64)
	return v * 1024 // Convert kB to bytes
}

// readDiskInfo reads disk usage via syscall.Statfs.
func readDiskInfo(path string) (total int64, free int64) {
	var stat syscall.Statfs_t
	if err := syscall.Statfs(path, &stat); err != nil {
		return 0, 0
	}
	total = int64(stat.Blocks) * int64(stat.Bsize)
	free = int64(stat.Bfree) * int64(stat.Bsize)
	return total, free
}

// readUptime reads system uptime from /proc/uptime.
func readUptime() int64 {
	data, err := os.ReadFile("/proc/uptime")
	if err != nil {
		return 0
	}
	parts := strings.Fields(string(data))
	if len(parts) < 1 {
		return 0
	}
	up, err := strconv.ParseFloat(parts[0], 64)
	if err != nil {
		return 0
	}
	return int64(up)
}

// countCPUCores counts the number of CPU cores from /proc/stat.
func countCPUCores() int {
	data, err := os.ReadFile("/proc/stat")
	if err != nil {
		return 1
	}

	count := 0
	for _, line := range strings.Split(string(data), "\n") {
		if strings.HasPrefix(line, "cpu") && len(line) > 3 && line[3] >= '0' && line[3] <= '9' {
			count++
		}
	}
	if count == 0 {
		return 1
	}
	return count
}

// GetSystemInfo collects CPU, memory, disk, and uptime stats.
func GetSystemInfo() model.SystemInfo {
	cpuUsage := calcCPUUsage()

	memTotal, memAvailable := readMemoryInfo()
	memUsed := memTotal - memAvailable
	memPercent := 0
	if memTotal > 0 {
		memPercent = int(math.Round(float64(memUsed) / float64(memTotal) * 100))
	}

	// Try /app/data first, fall back to /
	diskTotal, diskFree := readDiskInfo("/app/data")
	if diskTotal == 0 {
		diskTotal, diskFree = readDiskInfo("/")
	}
	diskUsed := diskTotal - diskFree
	diskPercent := 0
	if diskTotal > 0 {
		diskPercent = int(math.Round(float64(diskUsed) / float64(diskTotal) * 100))
	}

	uptime := readUptime()
	cpuCores := countCPUCores()

	return model.SystemInfo{
		CPU: model.CPUInfo{
			Usage: cpuUsage,
			Cores: cpuCores,
		},
		Memory: model.MemoryInfo{
			Total:       memTotal,
			Used:        memUsed,
			UsedPercent: memPercent,
		},
		Disk: model.DiskInfo{
			Total:       diskTotal,
			Used:        diskUsed,
			UsedPercent: diskPercent,
		},
		Uptime: uptime,
	}
}
