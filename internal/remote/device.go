package remote

import (
	"encoding/json"
	"fmt"
	"strings"
	"sync"
)

// Device 内网设备
type Device struct {
	Name     string `json:"name"`
	Type     string `json:"type"`
	Host     string `json:"host,omitempty"`
	Username string `json:"username,omitempty"`
	Password string `json:"password,omitempty"`
	Label    string `json:"label,omitempty"`
}

// Config 设备配置列表
type Config struct {
	Devices []Device `json:"devices"`
}

// Manager 设备管理器
type Manager struct {
	mu   sync.RWMutex
	cfg  Config
	exec Executor
}

// Executor 执行器接口
type Executor interface {
	ExecSSH(host, username, password string, cmd string) (string, error)
}

// NewManager 创建设备管理器
func NewManager(exec Executor) *Manager {
	return &Manager{exec: exec}
}

// Load 从 JSON 字符串加载配置
func (m *Manager) Load(data string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if data == "" {
		m.cfg = Config{Devices: []Device{}}
		return nil
	}
	return json.Unmarshal([]byte(data), &m.cfg)
}

// Save 序列化配置
func (m *Manager) Save() string {
	m.mu.RLock()
	defer m.mu.RUnlock()
	data, _ := json.Marshal(m.cfg)
	return string(data)
}

// List 列出所有设备
func (m *Manager) List() []Device {
	m.mu.RLock()
	defer m.mu.RUnlock()
	out := make([]Device, len(m.cfg.Devices))
	copy(out, m.cfg.Devices)
	return out
}

// Add 添加设备
func (m *Manager) Add(d Device) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	for i := range m.cfg.Devices {
		if m.cfg.Devices[i].Name == d.Name {
			m.cfg.Devices[i] = d
			return nil
		}
	}
	m.cfg.Devices = append(m.cfg.Devices, d)
	return nil
}

// Remove 删除设备
func (m *Manager) Remove(name string) bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	for i := range m.cfg.Devices {
		if m.cfg.Devices[i].Name == name {
			m.cfg.Devices = append(m.cfg.Devices[:i], m.cfg.Devices[i+1:]...)
			return true
		}
	}
	return false
}

// Find 查找设备
func (m *Manager) Find(keyword string) *Device {
	m.mu.RLock()
	defer m.mu.RUnlock()
	for i := range m.cfg.Devices {
		if m.cfg.Devices[i].Name == keyword || strings.Contains(m.cfg.Devices[i].Name, keyword) {
			return &m.cfg.Devices[i]
		}
	}
	return nil
}

// Exec 在设备上执行命令
func (m *Manager) Exec(name, cmd string) (string, error) {
	d := m.Find(name)
	if d == nil {
		return "", fmt.Errorf("未找到设备: %s", name)
	}
	return m.exec.ExecSSH(d.Host, d.Username, d.Password, cmd)
}

// FormatList 格式化设备列表（用于 TG 显示）
func (m *Manager) FormatList() string {
	devices := m.List()
	if len(devices) == 0 {
		return "未配置远程设备"
	}
	var b strings.Builder
	b.WriteString("远程设备")
	for _, d := range devices {
		label := d.Label
		if label == "" {
			label = d.Name
		}
		b.WriteString("\n " + label + " (" + d.Host + ")")
		b.WriteString("\n  /device exec " + d.Name + " <命令>")
	}
	return b.String()
}
