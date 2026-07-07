package model

import (
	"crypto/rand"
	"time"
)

// ===== Input / DTO types (match TypeScript interfaces) =====

type CategoryInput struct {
	ID    string `json:"id,omitempty"`
	Title string `json:"title"`
	Icon  string `json:"icon,omitempty"`
	Order int    `json:"order,omitempty"`
}

type BookmarkInput struct {
	ID          string `json:"id,omitempty"`
	CategoryID  string `json:"categoryId"`
	Title       string `json:"title"`
	URL         string `json:"url"`
	Icon        string `json:"icon,omitempty"`
	Description string `json:"description,omitempty"`
	Order       int    `json:"order,omitempty"`
}

type TodoInput struct {
	Text      string `json:"text"`
	Completed bool   `json:"completed"`
}

type NoteInput struct {
	Title   string `json:"title"`
	Content string `json:"content"`
}

type MonitorTargetInput struct {
	Name    string `json:"name"`
	URL     string `json:"url"`
	Icon    string `json:"icon,omitempty"`
	MAC     string `json:"mac,omitempty"`
	Timeout int    `json:"timeout,omitempty"`
}

// ===== DB model types =====

type Category struct {
	ID        string     `json:"id"`
	Title     string     `json:"title"`
	Icon      string     `json:"icon,omitempty"`
	Order     int        `json:"order"`
	CreatedAt int64      `json:"created_at"`
	Links     []Bookmark `json:"links,omitempty"`
}

type Bookmark struct {
	ID          string `json:"id"`
	CategoryID  string `json:"categoryId"`
	Title       string `json:"title"`
	URL         string `json:"url"`
	Icon        string `json:"icon,omitempty"`
	Description string `json:"description,omitempty"`
	Order       int    `json:"order"`
	CreatedAt   int64  `json:"created_at"`
}

// ===== API response types (match TypeScript interfaces exactly) =====

type LinkItem struct {
	ID          string      `json:"id"`
	Title       string      `json:"title"`
	URL         string      `json:"url"`
	Icon        string      `json:"icon,omitempty"`
	Description string      `json:"description,omitempty"`
	Type        string      `json:"type,omitempty"`
	Children    []LinkItem  `json:"children,omitempty"`
	UpdatedAt   int64       `json:"updatedAt,omitempty"`
	Order       int         `json:"order,omitempty"`
}

type Todo struct {
	ID        string `json:"id"`
	Text      string `json:"text"`
	Completed bool   `json:"completed"`
	CreatedAt int64  `json:"createdAt"`
}

type Note struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	Content   string `json:"content"`
	UpdatedAt int64  `json:"updatedAt"`
}

type Setting struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

type SiteSettings struct {
	Title         string   `json:"title"`
	Wallpaper     string   `json:"wallpaper"`
	WallpaperType string   `json:"wallpaperType"`
	WallpaperList []string `json:"wallpaperList"`
	BlurLevel     string   `json:"blurLevel"`
	ShowFeatures  *bool    `json:"showFeatures,omitempty"`
	HomeLayout    string   `json:"homeLayout,omitempty"`
	Theme         string   `json:"theme,omitempty"`
}

type DataSchema struct {
	Settings    SiteSettings `json:"settings"`
	Categories  []Category   `json:"categories"`
	Todos       []Todo       `json:"todos,omitempty"`
	Notes       []Note       `json:"notes,omitempty"`
	PinnedLinks []LinkItem   `json:"pinnedLinks,omitempty"`
}

// ===== Monitor types =====

type MonitorTarget struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	URL       string `json:"url"`
	Icon      string `json:"icon,omitempty"`
	MAC       string `json:"mac,omitempty"`
	Timeout   int    `json:"timeout"`
	CreatedAt int64  `json:"createdAt"`
}

type CheckResult struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	URL       string `json:"url"`
	Status    string `json:"status"`
	Latency   *int64 `json:"latency"`
	LastCheck *int64 `json:"lastCheck"`
}

// ===== Docker types =====

type DockerContainer struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Image   string `json:"image"`
	State   string `json:"state"`
	Status  string `json:"status"`
	Ports   string `json:"ports"`
	Created string `json:"created"`
}

type DockerStat struct {
	Name       string  `json:"name"`
	CPUPercent float64 `json:"cpuPercent"`
	MemUsage   float64 `json:"memUsage"`
	MemLimit   float64 `json:"memLimit"`
	MemPercent float64 `json:"memPercent"`
}

type DockerMetadata struct {
	Name string `json:"name"`
	Icon string `json:"icon,omitempty"`
}

// ===== System info types =====

type CPUInfo struct {
	Usage float64 `json:"usage"`
	Cores int     `json:"cores"`
}

type MemoryInfo struct {
	Total       int64 `json:"total"`
	Used        int64 `json:"used"`
	UsedPercent int   `json:"usedPercent"`
}

type DiskInfo struct {
	Total       int64 `json:"total"`
	Used        int64 `json:"used"`
	UsedPercent int   `json:"usedPercent"`
}

type SystemInfo struct {
	CPU    CPUInfo    `json:"cpu"`
	Memory MemoryInfo `json:"memory"`
	Disk   DiskInfo   `json:"disk"`
	Uptime int64      `json:"uptime"`
}

// ===== Helpers =====

func NewID() string {
	const alphabet = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_-"
	b := make([]byte, 21)
	randBytes := make([]byte, 21)
	_, err := rand.Read(randBytes)
	if err != nil {
		panic(err)
	}
	for i, r := range randBytes {
		b[i] = alphabet[int(r)%len(alphabet)]
	}
	return string(b)
}

func Now() int64 { return time.Now().UnixMilli() }
