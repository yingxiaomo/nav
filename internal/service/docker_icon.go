package service

import (
	"net/http"
	"strings"
	"time"
)

// knownDockerDomains maps well-known Docker image names to their official domains.
var knownDockerDomains = map[string]string{
	"nginx":         "nginx.org",
	"redis":         "redis.io",
	"postgres":      "postgresql.org",
	"mysql":         "mysql.com",
	"mariadb":       "mariadb.org",
	"mongo":         "mongodb.com",
	"node":          "nodejs.org",
	"python":        "python.org",
	"alpine":        "alpinelinux.org",
	"ubuntu":        "ubuntu.com",
	"debian":        "debian.org",
	"centos":        "centos.org",
	"grafana":       "grafana.com",
	"prometheus":    "prometheus.io",
	"traefik":       "traefik.io",
	"portainer":     "portainer.io",
	"jenkins":       "jenkins.io",
	"gitlab":        "gitlab.com",
	"nextcloud":     "nextcloud.com",
	"homeassistant": "home-assistant.io",
	"openwrt":       "openwrt.org",
	"pihole":        "pi-hole.net",
	"adguard":       "adguard.com",
	"jellyfin":      "jellyfin.org",
	"emby":          "emby.media",
	"plex":          "plex.tv",
	"transmission":  "transmissionbt.com",
	"qbittorrent":   "qbittorrent.org",
	"sonarr":        "sonarr.tv",
	"radarr":        "radarr.video",
	"jackett":       "jackett.io",
	"navidrome":     "navidrome.org",
	"firefly":       "firefly-iii.org",
	"outline":       "getoutline.com",
	"frp":           "gofrp.org",
	"ddns":          "ddns.org",
}

// FetchDockerIcon guesses an icon URL from a Docker image name.
// 下沉到 service 包：与 FetchFavicon 共用同一套 SSRF 防护 Transport，
// 避免 handler 层各自实现探测逻辑。
func FetchDockerIcon(image string) string {
	parts := strings.Split(image, ":")
	name := parts[0]
	parts = strings.Split(name, "/")
	name = parts[len(parts)-1]
	if name == "" {
		return ""
	}

	domain, ok := knownDockerDomains[name]
	if !ok {
		domain = name + ".org"
	}

	client := NewSafeClient(3 * time.Second)

	ddgURL := "https://icons.duckduckgo.com/ip3/" + domain + ".ico"
	if ok := headOK(client, ddgURL); ok {
		return ddgURL
	}

	favURL := "https://" + domain + "/favicon.ico"
	if headOK(client, favURL) {
		return favURL
	}

	return ""
}

// headOK 对 url 发起 HEAD 请求，返回是否 200。
func headOK(client *http.Client, url string) bool {
	resp, err := client.Head(url)
	if err != nil {
		return false
	}
	resp.Body.Close()
	return resp.StatusCode == http.StatusOK
}
