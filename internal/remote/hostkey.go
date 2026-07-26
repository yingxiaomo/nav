package remote

import (
	"encoding/json"
	"fmt"
	"net"
	"os"
	"sync"

	"golang.org/x/crypto/ssh"
)

// HostKeyManager 以 TOFU（trust on first use，首次使用即信任）策略校验 SSH
// 主机密钥。已知密钥持久化到 JSON 文件（"host:port" → SHA256 指纹）。
//
// 首次连接某主机时记录其指纹并放行；此后若指纹变化则拒绝连接（提示可能的
// 中间人攻击）。相比原先的 InsecureIgnoreHostKey，可在不打断正常使用的前提下
// 抵御 SSH MITM。若确需更换目标主机密钥，删除 known_hosts 文件对应条目即可。
type HostKeyManager struct {
	path string
	mu   sync.Mutex
}

// NewHostKeyManager 创建一个以 path 为持久化文件的管理器。
func NewHostKeyManager(path string) *HostKeyManager {
	return &HostKeyManager{path: path}
}

func (m *HostKeyManager) load() (map[string]string, error) {
	data, err := os.ReadFile(m.path)
	if err != nil {
		if os.IsNotExist(err) {
			return map[string]string{}, nil
		}
		return nil, err
	}
	known := map[string]string{}
	if len(data) > 0 {
		if err := json.Unmarshal(data, &known); err != nil {
			return nil, err
		}
	}
	return known, nil
}

func (m *HostKeyManager) save(known map[string]string) error {
	data, err := json.MarshalIndent(known, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(m.path, data, 0o600)
}

// Callback 返回用于 ssh.ClientConfig.HostKeyCallback 的校验回调。
func (m *HostKeyManager) Callback() ssh.HostKeyCallback {
	return func(hostname string, _ net.Addr, key ssh.PublicKey) error {
		fp := ssh.FingerprintSHA256(key)

		m.mu.Lock()
		defer m.mu.Unlock()

		known, err := m.load()
		if err != nil {
			return fmt.Errorf("读取 known_hosts 失败: %w", err)
		}
		if prev, ok := known[hostname]; ok {
			if prev != fp {
				return fmt.Errorf("SSH 主机密钥不匹配（可能存在中间人攻击）：%s 期望 %s 实际 %s", hostname, prev, fp)
			}
			return nil
		}

		// TOFU：首次连接，记录并信任
		known[hostname] = fp
		if err := m.save(known); err != nil {
			return fmt.Errorf("保存 known_hosts 失败: %w", err)
		}
		return nil
	}
}
