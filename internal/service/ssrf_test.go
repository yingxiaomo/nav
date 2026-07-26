package service

import (
	"net"
	"testing"
)

// TestIsPrivateIP locks the H-1/M-3 SSRF fix: classification runs on the
// resolved IP, so decimal/hex-encoded and DNS-rebinding tricks that fool a
// hostname-string check are still blocked once resolved to a concrete IP.
func TestIsPrivateIP(t *testing.T) {
	private := []string{
		"127.0.0.1",       // loopback
		"10.0.0.5",        // private A
		"172.16.3.4",      // private B
		"192.168.1.1",     // private C
		"169.254.169.254", // link-local (cloud metadata)
		"0.0.0.0",         // unspecified
		"100.64.0.1",      // CGNAT
		"::1",             // IPv6 loopback
		"fe80::1",         // IPv6 link-local
		"fc00::1",         // IPv6 ULA
		"::ffff:127.0.0.1", // IPv4-mapped loopback
		"::ffff:10.0.0.1",  // IPv4-mapped private
	}
	for _, s := range private {
		if !isPrivateIP(net.ParseIP(s)) {
			t.Errorf("expected %s to be classified private/blocked", s)
		}
	}

	public := []string{
		"8.8.8.8",
		"1.1.1.1",
		"93.184.216.34", // example.com
		"2606:4700:4700::1111",
	}
	for _, s := range public {
		if isPrivateIP(net.ParseIP(s)) {
			t.Errorf("expected %s to be classified public", s)
		}
	}

	// nil (unparseable/failed resolution) is treated as unsafe.
	if !isPrivateIP(nil) {
		t.Error("expected nil IP to be treated as private/blocked")
	}
}

// TestSafeDialControl confirms the dialer refuses a resolved private address and
// permits a public one.
func TestSafeDialControl(t *testing.T) {
	if err := safeDialControl("tcp", "169.254.169.254:80", nil); err == nil {
		t.Error("expected dial to cloud-metadata IP to be blocked")
	}
	if err := safeDialControl("tcp", "8.8.8.8:443", nil); err != nil {
		t.Errorf("expected dial to public IP to be allowed, got %v", err)
	}
}
