//go:build windows

package service

import (
	"github.com/YingXiaoMo/nav/internal/model"
)

// GetSystemInfo returns system information.
// On Windows, returns a stub since /proc is not available.
func GetSystemInfo() model.SystemInfo {
	return model.SystemInfo{
		CPU: model.CPUInfo{
			Usage: 0,
			Cores: 0,
		},
		Memory: model.MemoryInfo{
			Total:       0,
			Used:        0,
			UsedPercent: 0,
		},
		Disk: model.DiskInfo{
			Total:       0,
			Used:        0,
			UsedPercent: 0,
		},
		Uptime: 0,
	}
}

// Stub functions needed by compilation on Windows.

type cpuSample struct {
	idle  uint64
	total uint64
}

func readCPUSample() (cpuSample, error) {
	return cpuSample{}, nil
}

func calcCPUUsage() float64 { return 0 }

func readMemoryInfo() (total int64, avail int64) { return 0, 0 }

func parseMemInfoValue(line string) int64 { return 0 }

func readDiskInfo(path string) (total int64, free int64) { return 0, 0 }

func readUptime() int64 { return 0 }

func countCPUCores() int { return 0 }
