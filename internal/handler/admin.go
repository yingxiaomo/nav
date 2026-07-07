package handler

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/YingXiaoMo/nav/internal/db/queries"
	"github.com/YingXiaoMo/nav/internal/model"
	"github.com/YingXiaoMo/nav/internal/service"
)

// ===== Backup export types (match TypeScript FullBackup structure) =====

type backupCategory struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	Icon      string `json:"icon,omitempty"`
	Order     int    `json:"order"`
	CreatedAt int64  `json:"createdAt"`
}

type backupBookmark struct {
	ID          string `json:"id"`
	CategoryID  string `json:"categoryId"`
	Title       string `json:"title"`
	URL         string `json:"url"`
	Icon        string `json:"icon,omitempty"`
	Description string `json:"description,omitempty"`
	Order       int    `json:"order"`
	CreatedAt   int64  `json:"createdAt"`
}

type backupMonitorTarget struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	URL       string `json:"url"`
	Icon      string `json:"icon,omitempty"`
	MAC       string `json:"mac,omitempty"`
	Timeout   int    `json:"timeout"`
	CreatedAt int64  `json:"createdAt"`
}

type adminBackupExport struct {
	Version       int                  `json:"version"`
	ExportedAt    int64                `json:"exportedAt"`
	Settings      map[string]string    `json:"settings"`
	Categories    []backupCategory      `json:"categories"`
	Bookmarks     []backupBookmark      `json:"bookmarks"`
	Todos         []model.Todo          `json:"todos"`
	Notes         []model.Note          `json:"notes"`
	MonitorTargets []backupMonitorTarget `json:"monitorTargets"`
}

type adminBackupImport struct {
	Version       int                       `json:"version"`
	Settings      map[string]string         `json:"settings"`
	Categories    []backupCategory           `json:"categories"`
	Bookmarks     []backupBookmark           `json:"bookmarks"`
	Todos         []model.Todo               `json:"todos"`
	Notes         []model.Note               `json:"notes"`
	MonitorTargets []backupMonitorTarget      `json:"monitorTargets"`
}

// ===== Upload listing type =====

type uploadFile struct {
	Name  string `json:"name"`
	Size  int64  `json:"size"`
	MTime int64  `json:"mtime"`
}

// ===== Known domain mapping for Docker icon fetch =====

var knownDockerDomains = map[string]string{
	"nginx":        "nginx.org",
	"redis":        "redis.io",
	"postgres":     "postgresql.org",
	"mysql":        "mysql.com",
	"mariadb":      "mariadb.org",
	"mongo":        "mongodb.com",
	"node":         "nodejs.org",
	"python":       "python.org",
	"alpine":       "alpinelinux.org",
	"ubuntu":       "ubuntu.com",
	"debian":       "debian.org",
	"centos":       "centos.org",
	"grafana":      "grafana.com",
	"prometheus":   "prometheus.io",
	"traefik":      "traefik.io",
	"portainer":    "portainer.io",
	"jenkins":      "jenkins.io",
	"gitlab":       "gitlab.com",
	"nextcloud":    "nextcloud.com",
	"homeassistant": "home-assistant.io",
	"openwrt":      "openwrt.org",
	"pihole":       "pi-hole.net",
	"adguard":      "adguard.com",
	"jellyfin":     "jellyfin.org",
	"emby":         "emby.media",
	"plex":         "plex.tv",
	"transmission": "transmissionbt.com",
	"qbittorrent":  "qbittorrent.org",
	"sonarr":       "sonarr.tv",
	"radarr":       "radarr.video",
	"jackett":      "jackett.io",
	"navidrome":    "navidrome.org",
	"firefly":      "firefly-iii.org",
	"outline":      "getoutline.com",
	"frp":          "gofrp.org",
	"ddns":         "ddns.org",
}

// ===== Handlers =====

// Logs handles GET /api/v1/admin/logs.
// It reads the last N lines from nav-server.log in the data directory.
func Logs(dataDir string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		logPath := filepath.Join(dataDir, "nav-server.log")

		lines := 100
		if l := r.URL.Query().Get("lines"); l != "" {
			if n, err := strconv.Atoi(l); err == nil && n > 0 {
				lines = n
			}
		}

		data, err := os.ReadFile(logPath)
		if err != nil {
			// File likely doesn't exist (log written by separate process)
			model.RespondJSON(w, http.StatusOK, map[string]any{"lines": []string{}})
			return
		}

		content := strings.TrimRight(string(data), "\n")
		allLines := strings.Split(content, "\n")
		if lines > len(allLines) {
			lines = len(allLines)
		}
		lastLines := allLines[len(allLines)-lines:]

		model.RespondJSON(w, http.StatusOK, map[string]any{"lines": lastLines})
	}
}

// ExportBackup handles GET /api/v1/admin/backup.
// It exports all tables including monitor_targets as a v1 backup.
func ExportBackup(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Settings
		settingsMap, err := queries.GetAllSettings(r.Context(), db)
		if err != nil {
			slog.Error("备份导出: 获取设置失败", "error", err)
			model.RespondError(w, http.StatusInternalServerError, "备份导出失败")
			return
		}
		if settingsMap == nil {
			settingsMap = make(map[string]string)
		}

		// Categories
		catRows, err := queries.GetAllCategories(r.Context(), db)
		if err != nil {
			slog.Error("备份导出: 获取分类失败", "error", err)
			model.RespondError(w, http.StatusInternalServerError, "备份导出失败")
			return
		}
		exportCats := make([]backupCategory, 0, len(catRows))
		for _, cat := range catRows {
			exportCats = append(exportCats, backupCategory{
				ID:        cat.ID,
				Title:     cat.Title,
				Icon:      cat.Icon,
				Order:     cat.Order,
				CreatedAt: cat.CreatedAt,
			})
		}

		// Bookmarks (all)
		bmRows, err := queries.GetAllBookmarks(r.Context(), db, "")
		if err != nil {
			slog.Error("备份导出: 获取书签失败", "error", err)
			model.RespondError(w, http.StatusInternalServerError, "备份导出失败")
			return
		}
		exportBMs := make([]backupBookmark, 0, len(bmRows))
		for _, bm := range bmRows {
			exportBMs = append(exportBMs, backupBookmark{
				ID:          bm.ID,
				CategoryID:  bm.CategoryID,
				Title:       bm.Title,
				URL:         bm.URL,
				Icon:        bm.Icon,
				Description: bm.Description,
				Order:       bm.Order,
				CreatedAt:   bm.CreatedAt,
			})
		}

		// Todos
		todoRows, err := queries.GetAllTodos(r.Context(), db)
		if err != nil {
			slog.Error("备份导出: 获取待办失败", "error", err)
			model.RespondError(w, http.StatusInternalServerError, "备份导出失败")
			return
		}

		// Notes
		noteRows, err := queries.GetAllNotes(r.Context(), db)
		if err != nil {
			slog.Error("备份导出: 获取笔记失败", "error", err)
			model.RespondError(w, http.StatusInternalServerError, "备份导出失败")
			return
		}

		// Monitor targets (direct query, no queries package wrapper)
		exportMTs := make([]backupMonitorTarget, 0)
		mtRows, err := db.QueryContext(r.Context(),
			`SELECT id, name, url, COALESCE(icon,''), COALESCE(mac,''), timeout, created_at FROM monitor_targets ORDER BY created_at`)
		if err == nil {
			defer mtRows.Close()
			for mtRows.Next() {
				var mt backupMonitorTarget
				if err := mtRows.Scan(&mt.ID, &mt.Name, &mt.URL, &mt.Icon, &mt.MAC, &mt.Timeout, &mt.CreatedAt); err == nil {
					exportMTs = append(exportMTs, mt)
				}
			}
		}

		backup := adminBackupExport{
			Version:       1,
			ExportedAt:    model.Now(),
			Settings:      settingsMap,
			Categories:    exportCats,
			Bookmarks:     exportBMs,
			Todos:         todoRows,
			Notes:         noteRows,
			MonitorTargets: exportMTs,
		}

		model.RespondJSON(w, http.StatusOK, backup)
	}
}

// ImportBackup handles POST /api/v1/admin/backup.
// It restores all data from a backup JSON, preserving auth keys.
func ImportBackup(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var body adminBackupImport
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			model.RespondError(w, http.StatusBadRequest, "请求体格式错误")
			return
		}

		if body.Version != 1 {
			model.RespondError(w, http.StatusBadRequest, "不兼容的备份版本")
			return
		}

		// Preserve auth-related settings so the import does not lock users out.
		authKeys := []string{"api_token", "admin_password_hash", "admin_salt", "session_secret", "admin_session_secret"}
		preserved := make(map[string]string)
		for _, key := range authKeys {
			if val, err := queries.GetSetting(r.Context(), db, key); err == nil && val != "" {
				preserved[key] = val
			}
		}

		tx, err := db.BeginTx(r.Context(), nil)
		if err != nil {
			slog.Error("备份导入: 开启事务失败", "error", err)
			model.RespondError(w, http.StatusInternalServerError, "恢复失败")
			return
		}
		defer tx.Rollback()

		// Clear all tables (bookmarks first because of FK constraint)
		if _, err := tx.ExecContext(r.Context(), "DELETE FROM bookmarks"); err != nil {
			slog.Error("备份导入: 清空书签失败", "error", err)
			model.RespondError(w, http.StatusInternalServerError, "恢复失败")
			return
		}
		if _, err := tx.ExecContext(r.Context(), "DELETE FROM categories"); err != nil {
			slog.Error("备份导入: 清空分类失败", "error", err)
			model.RespondError(w, http.StatusInternalServerError, "恢复失败")
			return
		}
		if _, err := tx.ExecContext(r.Context(), "DELETE FROM todos"); err != nil {
			slog.Error("备份导入: 清空待办失败", "error", err)
			model.RespondError(w, http.StatusInternalServerError, "恢复失败")
			return
		}
		if _, err := tx.ExecContext(r.Context(), "DELETE FROM notes"); err != nil {
			slog.Error("备份导入: 清空笔记失败", "error", err)
			model.RespondError(w, http.StatusInternalServerError, "恢复失败")
			return
		}
		if _, err := tx.ExecContext(r.Context(), "DELETE FROM settings"); err != nil {
			slog.Error("备份导入: 清空设置失败", "error", err)
			model.RespondError(w, http.StatusInternalServerError, "恢复失败")
			return
		}
		if _, err := tx.ExecContext(r.Context(), "DELETE FROM monitor_targets"); err != nil {
			slog.Error("备份导入: 清空监控目标失败", "error", err)
			model.RespondError(w, http.StatusInternalServerError, "恢复失败")
			return
		}

		// Restore settings
		for key, value := range body.Settings {
			if _, err := tx.ExecContext(r.Context(),
				"INSERT INTO settings (key, value) VALUES (?, ?)", key, value); err != nil {
				slog.Error("备份导入: 恢复设置失败", "error", err, "key", key)
				model.RespondError(w, http.StatusInternalServerError, "恢复失败")
				return
			}
		}

		// Restore categories
		for _, cat := range body.Categories {
			if _, err := tx.ExecContext(r.Context(),
				`INSERT INTO categories (id, title, icon, "order", created_at) VALUES (?, ?, ?, ?, ?)`,
				cat.ID, cat.Title, cat.Icon, cat.Order, cat.CreatedAt); err != nil {
				slog.Error("备份导入: 恢复分类失败", "error", err)
				model.RespondError(w, http.StatusInternalServerError, "恢复失败")
				return
			}
		}

		// Restore bookmarks
		for _, bm := range body.Bookmarks {
			if _, err := tx.ExecContext(r.Context(),
				`INSERT INTO bookmarks (id, category_id, title, url, icon, description, "order", created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
				bm.ID, bm.CategoryID, bm.Title, bm.URL, bm.Icon, bm.Description, bm.Order, bm.CreatedAt); err != nil {
				slog.Error("备份导入: 恢复书签失败", "error", err)
				model.RespondError(w, http.StatusInternalServerError, "恢复失败")
				return
			}
		}

		// Restore todos
		for _, todo := range body.Todos {
			completed := 0
			if todo.Completed {
				completed = 1
			}
			if _, err := tx.ExecContext(r.Context(),
				"INSERT INTO todos (id, text, completed, created_at) VALUES (?, ?, ?, ?)",
				todo.ID, todo.Text, completed, todo.CreatedAt); err != nil {
				slog.Error("备份导入: 恢复待办失败", "error", err)
				model.RespondError(w, http.StatusInternalServerError, "恢复失败")
				return
			}
		}

		// Restore notes
		for _, note := range body.Notes {
			if _, err := tx.ExecContext(r.Context(),
				"INSERT INTO notes (id, title, content, updated_at) VALUES (?, ?, ?, ?)",
				note.ID, note.Title, note.Content, note.UpdatedAt); err != nil {
				slog.Error("备份导入: 恢复笔记失败", "error", err)
				model.RespondError(w, http.StatusInternalServerError, "恢复失败")
				return
			}
		}

		// Restore monitor targets
		for _, mt := range body.MonitorTargets {
			if _, err := tx.ExecContext(r.Context(),
				"INSERT INTO monitor_targets (id, name, url, icon, mac, timeout, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
				mt.ID, mt.Name, mt.URL, mt.Icon, mt.MAC, mt.Timeout, mt.CreatedAt); err != nil {
				slog.Error("备份导入: 恢复监控目标失败", "error", err)
				model.RespondError(w, http.StatusInternalServerError, "恢复失败")
				return
			}
		}

		// Restore preserved auth keys (override backup values)
		for key, value := range preserved {
			if _, err := tx.ExecContext(r.Context(),
				"INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?",
				key, value, value); err != nil {
				slog.Error("备份导入: 恢复密钥失败", "error", err, "key", key)
				model.RespondError(w, http.StatusInternalServerError, "恢复密钥失败")
				return
			}
		}

		if err := tx.Commit(); err != nil {
			slog.Error("备份导入: 提交事务失败", "error", err)
			model.RespondError(w, http.StatusInternalServerError, "恢复失败")
			return
		}

		model.RespondJSON(w, http.StatusOK, map[string]any{"success": true})
	}
}

// DockerContainers handles GET /api/v1/admin/docker/containers.
func DockerContainers(svc *service.DockerService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if svc == nil {
			model.RespondJSON(w, http.StatusOK, map[string]any{"containers": []any{}, "error": "Docker 不可用"})
			return
		}

		containers, err := svc.ListContainers(r.Context())
		if err != nil {
			slog.Warn("获取 Docker 容器列表失败", "error", err)
			model.RespondJSON(w, http.StatusOK, map[string]any{"containers": []any{}, "error": err.Error()})
			return
		}

		model.RespondJSON(w, http.StatusOK, map[string]any{"containers": containers})
	}
}

// DockerStats handles GET /api/v1/admin/docker/stats.
func DockerStats(svc *service.DockerService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if svc == nil {
			model.RespondJSON(w, http.StatusOK, map[string]any{"stats": []any{}, "error": "Docker 不可用"})
			return
		}

		stats, err := svc.ContainerStats(r.Context())
		if err != nil {
			slog.Warn("获取 Docker 容器统计失败", "error", err)
			model.RespondJSON(w, http.StatusOK, map[string]any{"stats": []any{}, "error": err.Error()})
			return
		}

		model.RespondJSON(w, http.StatusOK, map[string]any{"stats": stats})
	}
}

// DockerLogs handles GET /api/v1/admin/docker/logs/{name}.
// It streams container logs via Server-Sent Events.
func DockerLogs(svc *service.DockerService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		name := r.PathValue("name")

		flusher, ok := w.(http.Flusher)
		if !ok {
			model.RespondError(w, http.StatusInternalServerError, "SSE not supported")
			return
		}

		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")

		if svc == nil {
			fmt.Fprintf(w, "event: error\ndata: Docker 不可用\n\n")
			flusher.Flush()
			return
		}

		lines := make(chan string)
		go func() {
			defer close(lines)
			if err := svc.StreamLogs(r.Context(), name, lines); err != nil && err != context.Canceled {
				slog.Warn("Docker 日志流结束", "container", name, "error", err)
			}
		}()

		for line := range lines {
			// SSE format: "data: <text>\n\n"
			escaped := strings.ReplaceAll(line, "\n", "\\n")
			escaped = strings.ReplaceAll(escaped, "\r", "")
			fmt.Fprintf(w, "data: %s\n\n", escaped)
			flusher.Flush()
		}
	}
}

// ListUploads handles GET /api/v1/admin/uploads.
// It lists all uploaded files sorted by mtime descending.
func ListUploads(uploadDir string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		dir := uploadDir
		entries, err := os.ReadDir(dir)
		if err != nil {
			model.RespondJSON(w, http.StatusOK, map[string]any{"files": []any{}})
			return
		}

		var files []uploadFile
		for _, entry := range entries {
			if entry.IsDir() {
				continue
			}
			// Only show image files
			name := strings.ToLower(entry.Name())
			if !strings.HasSuffix(name, ".png") && !strings.HasSuffix(name, ".jpg") &&
				!strings.HasSuffix(name, ".jpeg") && !strings.HasSuffix(name, ".gif") &&
				!strings.HasSuffix(name, ".svg") && !strings.HasSuffix(name, ".webp") &&
				!strings.HasSuffix(name, ".ico") {
				continue
			}

			info, err := entry.Info()
			if err != nil {
				continue
			}

			files = append(files, uploadFile{
				Name:  entry.Name(),
				Size:  info.Size(),
				MTime: info.ModTime().UnixMilli(),
			})
		}

		sort.Slice(files, func(i, j int) bool {
			return files[i].MTime > files[j].MTime
		})

		model.RespondJSON(w, http.StatusOK, map[string]any{"files": files})
	}
}

// DeleteUpload handles DELETE /api/v1/admin/uploads/{filename}.
// It prevents path traversal and deletes the file.
func DeleteUpload(uploadDir string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		filename := r.PathValue("filename")
		filename = cleanUploadFilename(filename)

		if filename == "" || strings.Contains(filename, "..") || strings.Contains(filename, "/") || strings.Contains(filename, "\\") {
			model.RespondError(w, http.StatusBadRequest, "无效的文件名")
			return
		}

		filepath := filepath.Join(uploadDir, filename)

		if _, err := os.Stat(filepath); os.IsNotExist(err) {
			model.RespondError(w, http.StatusNotFound, "文件不存在")
			return
		}

		if err := os.Remove(filepath); err != nil {
			slog.Error("删除上传文件失败", "error", err)
			model.RespondError(w, http.StatusInternalServerError, "删除失败")
			return
		}

		model.RespondJSON(w, http.StatusOK, map[string]any{"success": true})
	}
}

// cleanUploadFilename sanitizes a filename to prevent path traversal.
func cleanUploadFilename(filename string) string {
	filename = filepath.Base(filepath.Clean(filename))
	return filename
}

// iconFetchResponse is the JSON response for icon fetch endpoints.
type iconFetchResponse struct {
	Icon *string `json:"icon"`
}

// FetchDockerIcon handles POST /api/v1/admin/docker/fetch-icon.
// It guesses an icon URL from the Docker image name.
func FetchDockerIcon() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		type request struct {
			Image string `json:"image"`
		}
		var req request
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Image == "" {
			model.RespondJSON(w, http.StatusOK, map[string]any{"icon": nil})
			return
		}

		// Extract short name from image: "nginx:latest" -> "nginx", "library/nginx:latest" -> "nginx"
		parts := strings.Split(req.Image, ":")
		name := parts[0]
		parts = strings.Split(name, "/")
		name = parts[len(parts)-1]
		if name == "" {
			model.RespondJSON(w, http.StatusOK, map[string]any{"icon": nil})
			return
		}

		domain, ok := knownDockerDomains[name]
		if !ok {
			domain = name + ".org"
		}

		client := &http.Client{Timeout: 3 * time.Second}

		// Try DuckDuckGo icons service first
		ddgURL := "https://icons.duckduckgo.com/ip3/" + domain + ".ico"
		resp, err := client.Head(ddgURL)
		if err == nil {
			resp.Body.Close()
			if resp.StatusCode == http.StatusOK {
				model.RespondJSON(w, http.StatusOK, map[string]any{"icon": ddgURL})
				return
			}
		}

		// Fallback to /favicon.ico
		favURL := "https://" + domain + "/favicon.ico"
		resp, err = client.Head(favURL)
		if err == nil {
			resp.Body.Close()
			if resp.StatusCode == http.StatusOK {
				model.RespondJSON(w, http.StatusOK, map[string]any{"icon": favURL})
				return
			}
		}

		model.RespondJSON(w, http.StatusOK, map[string]any{"icon": nil})
	}
}

// GetDockerMetadata handles GET /api/v1/admin/docker/metadata.
func GetDockerMetadata(meta *service.DockerMetadataStore) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		allMeta := meta.GetAll()
		model.RespondJSON(w, http.StatusOK, allMeta)
	}
}

// SetDockerMetadata handles PUT /api/v1/admin/docker/metadata/{name}.
func SetDockerMetadata(meta *service.DockerMetadataStore) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		name := r.PathValue("name")

		type request struct {
			Icon string `json:"icon,omitempty"`
		}
		var req request
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			model.RespondError(w, http.StatusBadRequest, "请求体格式错误")
			return
		}

		if err := meta.Set(name, model.DockerMetadata{Name: name, Icon: req.Icon}); err != nil {
			slog.Error("保存 Docker 元数据失败", "error", err)
			model.RespondError(w, http.StatusInternalServerError, "保存失败")
			return
		}

		model.RespondJSON(w, http.StatusOK, map[string]any{"success": true})
	}
}
