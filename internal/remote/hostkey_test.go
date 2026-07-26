package remote

import (
	"crypto/ed25519"
	"crypto/rand"
	"path/filepath"
	"testing"

	"golang.org/x/crypto/ssh"
)

func genPubKey(t *testing.T) ssh.PublicKey {
	t.Helper()
	pub, _, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatalf("生成密钥失败: %v", err)
	}
	sk, err := ssh.NewPublicKey(pub)
	if err != nil {
		t.Fatalf("包装公钥失败: %v", err)
	}
	return sk
}

func TestHostKeyTOFU(t *testing.T) {
	m := NewHostKeyManager(filepath.Join(t.TempDir(), "known_hosts.json"))
	cb := m.Callback()
	k1 := genPubKey(t)

	// 首次连接：记录并信任
	if err := cb("host:22", nil, k1); err != nil {
		t.Fatalf("首次连接应放行，得到: %v", err)
	}
	// 同主机同密钥：放行
	if err := cb("host:22", nil, k1); err != nil {
		t.Fatalf("相同指纹应放行，得到: %v", err)
	}
	// 同主机不同密钥：拒绝（疑似 MITM）
	if err := cb("host:22", nil, genPubKey(t)); err == nil {
		t.Fatal("指纹变化应被拒绝，却放行了")
	}
	// 新主机：独立 TOFU，放行
	if err := cb("other:22", nil, k1); err != nil {
		t.Fatalf("新主机应放行，得到: %v", err)
	}
}

func TestHostKeyPersists(t *testing.T) {
	path := filepath.Join(t.TempDir(), "known_hosts.json")
	k := genPubKey(t)

	// 第一个管理器记录指纹
	if err := NewHostKeyManager(path).Callback()("h:22", nil, k); err != nil {
		t.Fatalf("记录失败: %v", err)
	}
	// 新管理器（同文件）应从磁盘读到、对不同密钥拒绝
	if err := NewHostKeyManager(path).Callback()("h:22", nil, genPubKey(t)); err == nil {
		t.Fatal("持久化的指纹应在新实例中生效并拒绝不同密钥")
	}
}
