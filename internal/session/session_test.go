package session

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"strconv"
	"strings"
	"testing"
	"time"
)

func TestSign_ProducesValidCookieFormat(t *testing.T) {
	secret := "test-secret-32-bytes-long-for-hmac!!"
	cookie := Sign("admin", secret)

	// Format: base64(userID:expiresAtUnixMs).hmac_hex
	parts := strings.Split(cookie, ".")
	if len(parts) != 2 {
		t.Fatalf("Sign() produced %d parts (expect 2): %q", len(parts), cookie)
	}
	if parts[0] == "" || parts[1] == "" {
		t.Fatal("Sign() produced empty payload or signature")
	}
}

func TestVerify_ValidCookie(t *testing.T) {
	secret := "my-secret-key-here-1234567890"
	cookie := Sign("admin", secret)

	if !Verify(cookie, secret) {
		t.Fatal("Verify() should accept a validly signed cookie")
	}
}

func TestVerify_WrongSecret(t *testing.T) {
	cookie := Sign("admin", "real-secret-that-should-be-used")
	if Verify(cookie, "wrong-secret") {
		t.Fatal("Verify() should reject cookie signed with a different secret")
	}
}

func TestVerify_TamperedPayload(t *testing.T) {
	secret := "keep-it-secret-keep-it-safe!!"
	cookie := Sign("admin", secret)

	// Tamper with the payload
	parts := strings.Split(cookie, ".")
	tampered := "AAAA" + parts[0][4:] + "." + parts[1]
	if Verify(tampered, secret) {
		t.Fatal("Verify() should reject a tampered payload")
	}
}

func TestVerify_MalformedCookie(t *testing.T) {
	tests := []struct {
		name   string
		cookie string
	}{
		{"empty", ""},
		{"no dot", "justonepart"},
		{"bad base64", "!!!.abc123"},
		{"no colon in payload", "AAAA" + base64.StdEncoding.EncodeToString([]byte("nocolon")) + ".sig"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if Verify(tc.cookie, "secret") {
				t.Errorf("Verify(%q) should return false", tc.cookie)
			}
		})
	}
}

func TestSign_RespectsDuration(t *testing.T) {
	secret := "test-duration-secret-key-1234"
	cookie := Sign("admin", secret)

	// Extract the payload and check it's within a reasonable range
	parts := strings.Split(cookie, ".")
	payloadBytes, _ := base64.StdEncoding.DecodeString(parts[0])
	payload := string(payloadBytes)
	colonIdx := strings.LastIndex(payload, ":")
	expiresStr := payload[colonIdx+1:]
	expires, _ := strconv.ParseInt(expiresStr, 10, 64)

	now := time.Now().UnixMilli()
	if expires < now-1000 || expires > now+Duration.Milliseconds()+1000 {
		t.Errorf("expires %d out of range [%d, %d]",
			expires, now-1000, now+Duration.Milliseconds()+1000)
	}
}

func TestVerify_RejectsExpiredCookie(t *testing.T) {
	secret := "expired-cookie-test-secret!!"
	// Manually create a cookie with an expired timestamp
	payload := "admin:" + strconv.FormatInt(time.Now().Add(-1*time.Hour).UnixMilli(), 10)
	payloadBase64 := base64.StdEncoding.EncodeToString([]byte(payload))
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(payload))
	sig := hex.EncodeToString(mac.Sum(nil))
	cookie := payloadBase64 + "." + sig

	if Verify(cookie, secret) {
		t.Fatal("Verify() should reject an expired cookie")
	}
}
