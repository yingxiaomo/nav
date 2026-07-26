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
