package handler

import "testing"

func TestParseSSHHost(t *testing.T) {
	cases := map[string]string{
		"192.168.1.10":          "192.168.1.10",
		"192.168.1.10:2222":     "192.168.1.10:2222",
		"http://host:8080/path": "host:8080",
		"https://example.com/x": "example.com",
		"https://example.com":   "example.com",
		"ssh://box:22#frag":     "box:22",
		"box":                   "box",
	}
	for in, want := range cases {
		got, err := parseSSHHost(in)
		if err != nil {
			t.Errorf("parseSSHHost(%q) 返回错误: %v", in, err)
			continue
		}
		if got != want {
			t.Errorf("parseSSHHost(%q) = %q, 期望 %q", in, got, want)
		}
	}
}
