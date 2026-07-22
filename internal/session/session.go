package session

import (
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"strconv"
	"strings"
	"time"
)

const (
	CookieName = "admin_web_session"
	Duration   = 7 * 24 * time.Hour // 7 days
)

// Sign creates a signed session cookie value.
// Format: base64("<userID>:<expiresAtUnixMs>") + "." + hmac_hex
// The HMAC is computed over the decoded payload using the provided secret.
func Sign(userID, secret string) string {
	expires := time.Now().Add(Duration).UnixMilli()
	payload := userID + ":" + strconv.FormatInt(expires, 10)
	payloadBase64 := base64.URLEncoding.EncodeToString([]byte(payload))

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(payload))
	sig := hex.EncodeToString(mac.Sum(nil))

	return payloadBase64 + "." + sig
}

// Verify checks the session cookie format, expiration, and HMAC signature.
// Format expected: base64("<userID>:<expiresAtUnixMs>") + "." + hmac_hex
func Verify(cookieValue, secret string) bool {
	dotIdx := strings.LastIndex(cookieValue, ".")
	if dotIdx < 0 {
		return false
	}
	payloadBase64 := cookieValue[:dotIdx]
	sigHex := cookieValue[dotIdx+1:]

	payloadBytes, err := base64.URLEncoding.DecodeString(payloadBase64)
	if err != nil {
		return false
	}
	payload := string(payloadBytes)

	colonIdx := strings.LastIndex(payload, ":")
	if colonIdx < 0 {
		return false
	}
	expiresStr := payload[colonIdx+1:]

	expires, err := strconv.ParseInt(expiresStr, 10, 64)
	if err != nil || time.Now().UnixMilli() > expires {
		return false
	}

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(payload))
	expectedHex := hex.EncodeToString(mac.Sum(nil))

	return subtle.ConstantTimeCompare([]byte(sigHex), []byte(expectedHex)) == 1
}
