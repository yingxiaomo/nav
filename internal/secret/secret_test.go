package secret

import (
	"strings"
	"testing"
)

func TestRoundTripWithKey(t *testing.T) {
	t.Setenv(EnvKey, "my-master-key")

	plain := "hunter2-密码"
	enc := Encrypt(plain)
	if enc == plain {
		t.Fatalf("配置密钥后应产生密文，得到明文")
	}
	if !IsEncrypted(enc) {
		t.Fatalf("密文应带前缀: %q", enc)
	}
	got, err := Decrypt(enc)
	if err != nil {
		t.Fatalf("Decrypt 失败: %v", err)
	}
	if got != plain {
		t.Fatalf("往返不一致: got %q want %q", got, plain)
	}
}

func TestPassthroughWithoutKey(t *testing.T) {
	t.Setenv(EnvKey, "")
	if Enabled() {
		t.Fatalf("未配置密钥时不应 Enabled")
	}
	plain := "plaintext"
	if enc := Encrypt(plain); enc != plain {
		t.Fatalf("无密钥应透传，得到 %q", enc)
	}
	// 无前缀值始终按明文返回
	got, err := Decrypt(plain)
	if err != nil || got != plain {
		t.Fatalf("明文应原样返回: got %q err %v", got, err)
	}
}

func TestEmptyAndIdempotent(t *testing.T) {
	t.Setenv(EnvKey, "k")
	if Encrypt("") != "" {
		t.Fatalf("空串应原样返回")
	}
	enc := Encrypt("x")
	if Encrypt(enc) != enc {
		t.Fatalf("对已加密值应幂等")
	}
}

func TestDecryptWithoutKeyErrors(t *testing.T) {
	t.Setenv(EnvKey, "k1")
	enc := Encrypt("secret")
	t.Setenv(EnvKey, "")
	if _, err := Decrypt(enc); err == nil {
		t.Fatalf("密文但无密钥应报错")
	}
}

func TestWrongKeyFails(t *testing.T) {
	t.Setenv(EnvKey, "right")
	enc := Encrypt("secret")
	t.Setenv(EnvKey, "wrong")
	if _, err := Decrypt(enc); err == nil || !strings.Contains(err.Error(), "") {
		t.Fatalf("错误密钥应解密失败")
	}
}
