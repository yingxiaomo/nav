// Package secret 提供敏感字段的可选静态加密（AES-256-GCM）。
//
// 主密钥来自环境变量 NAV_SECRET_KEY（任意长度，内部 SHA-256 派生 32 字节）。
// 未设置该变量时，Encrypt/Decrypt 均为透传——即"不配置就明文，向后兼容既有部署"。
// 加密值带 "enc:v1:" 前缀，Decrypt 据此区分密文与历史明文。
//
// 威胁模型：仅防"数据库文件单独泄露"（如误提交备份）。若攻击者同时拿到同机的
// NAV_SECRET_KEY，则无防护意义——这是单机 homelab 的固有限制，已在文档说明。
package secret

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"io"
	"os"
	"strings"
)

// EnvKey 是主密钥的环境变量名。
const EnvKey = "NAV_SECRET_KEY"

const prefix = "enc:v1:"

// key 返回派生的 32 字节 AES 密钥；未配置 NAV_SECRET_KEY 时返回 nil。
func key() []byte {
	v := os.Getenv(EnvKey)
	if v == "" {
		return nil
	}
	h := sha256.Sum256([]byte(v))
	return h[:]
}

// Enabled 报告是否启用了静态加密（即配置了 NAV_SECRET_KEY）。
func Enabled() bool { return key() != nil }

// IsEncrypted 报告值是否为本包产生的密文。
func IsEncrypted(s string) bool { return strings.HasPrefix(s, prefix) }

// Encrypt 加密 plain 并返回带前缀的密文。
// 未配置密钥、plain 为空、或已是密文时原样返回（幂等、非破坏）。
func Encrypt(plain string) string {
	if plain == "" || IsEncrypted(plain) {
		return plain
	}
	k := key()
	if k == nil {
		return plain
	}
	gcm, err := newGCM(k)
	if err != nil {
		return plain
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return plain
	}
	ct := gcm.Seal(nonce, nonce, []byte(plain), nil)
	return prefix + base64.StdEncoding.EncodeToString(ct)
}

// Decrypt 还原 Encrypt 的结果。
// 无前缀的值视为历史明文，原样返回（向后兼容）。
// 有前缀但未配置密钥或解密失败时返回错误。
func Decrypt(stored string) (string, error) {
	if !IsEncrypted(stored) {
		return stored, nil
	}
	k := key()
	if k == nil {
		return "", errors.New("数据已加密但未配置 " + EnvKey)
	}
	gcm, err := newGCM(k)
	if err != nil {
		return "", err
	}
	raw, err := base64.StdEncoding.DecodeString(stored[len(prefix):])
	if err != nil {
		return "", err
	}
	if len(raw) < gcm.NonceSize() {
		return "", errors.New("密文长度不足")
	}
	nonce, ct := raw[:gcm.NonceSize()], raw[gcm.NonceSize():]
	pt, err := gcm.Open(nil, nonce, ct, nil)
	if err != nil {
		return "", err
	}
	return string(pt), nil
}

func newGCM(k []byte) (cipher.AEAD, error) {
	block, err := aes.NewCipher(k)
	if err != nil {
		return nil, err
	}
	return cipher.NewGCM(block)
}
