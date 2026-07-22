package handler

import (
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/YingXiaoMo/nav/internal/db/queries"
	"github.com/YingXiaoMo/nav/internal/model"
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
	Categories    []backupCategory     `json:"categories"`
	Bookmarks     []backupBookmark     `json:"bookmarks"`
	Todos         []model.Todo         `json:"todos"`
	Notes         []model.Note         `json:"notes"`
	MonitorTargets []backupMonitorTarget `json:"monitorTargets"`
	DockerMetadata  map[string]model.DockerMetadata `json:"dockerMetadata,omitempty"`
}

type adminBackupImport struct {
	Version       int                  `json:"version"`
	Settings      map[string]string    `json:"settings"`
	Categories    []backupCategory     `json:"categories"`
	Bookmarks     []backupBookmark     `json:"bookmarks"`
	Todos         []model.Todo         `json:"todos"`
	Notes         []model.Note         `json:"notes"`
	MonitorTargets []backupMonitorTarget `json:"monitorTargets"`
	DockerMetadata  map[string]model.DockerMetadata `json:"dockerMetadata,omitempty"`
}

// ===== Handlers =====

// ExportBackup handles GET /api/v1/admin/backup.
func (h *Handler) ExportBackup() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		db := h.DB

		settingsMap, err := queries.GetAllSettings(r.Context(), db)
		if err != nil {
			slog.Error("备份导出: 获取设置失败", "error", err)
			model.RespondError(w, http.StatusInternalServerError, "备份导出失败")
			return
		}
		if settingsMap == nil {
			settingsMap = make(map[string]string)
		}

		catRows, err := queries.GetAllCategories(r.Context(), db)
		if err != nil {
			slog.Error("备份导出: 获取分类失败", "error", err)
			model.RespondError(w, http.StatusInternalServerError, "备份导出失败")
			return
		}
		exportCats := make([]backupCategory, 0, len(catRows))
		for _, cat := range catRows {
			exportCats = append(exportCats, backupCategory{
				ID: cat.ID, Title: cat.Title, Icon: cat.Icon,
				Order: cat.Order, CreatedAt: cat.CreatedAt,
			})
		}

		bmRows, err := queries.GetAllBookmarks(r.Context(), db, "")
		if err != nil {
			slog.Error("备份导出: 获取书签失败", "error", err)
			model.RespondError(w, http.StatusInternalServerError, "备份导出失败")
			return
		}
		exportBMs := make([]backupBookmark, 0, len(bmRows))
		for _, bm := range bmRows {
			exportBMs = append(exportBMs, backupBookmark{
				ID: bm.ID, CategoryID: bm.CategoryID, Title: bm.Title,
				URL: bm.URL, Icon: bm.Icon, Description: bm.Description,
				Order: bm.Order, CreatedAt: bm.CreatedAt,
			})
		}

		todoRows, err := queries.GetAllTodos(r.Context(), db)
		if err != nil {
			slog.Error("备份导出: 获取待办失败", "error", err)
			model.RespondError(w, http.StatusInternalServerError, "备份导出失败")
			return
		}

		noteRows, err := queries.GetAllNotes(r.Context(), db)
		if err != nil {
			slog.Error("备份导出: 获取笔记失败", "error", err)
			model.RespondError(w, http.StatusInternalServerError, "备份导出失败")
			return
		}

		exportMTs := make([]backupMonitorTarget, 0)
		mtRows, err := db.QueryContext(r.Context(),
			`SELECT id, name, url, COALESCE(icon,''), COALESCE(mac,''), timeout, created_at FROM monitor_targets ORDER BY created_at`)
		if err != nil {
			slog.Warn("备份导出: 获取监控目标失败", "error", err)
		} else {
			defer mtRows.Close()
			for mtRows.Next() {
				var mt backupMonitorTarget
				if err := mtRows.Scan(&mt.ID, &mt.Name, &mt.URL, &mt.Icon, &mt.MAC, &mt.Timeout, &mt.CreatedAt); err == nil {
					exportMTs = append(exportMTs, mt)
				}
			}
		}

		backup := adminBackupExport{
			Version: 1, ExportedAt: model.Now(),
			Settings: settingsMap, Categories: exportCats, Bookmarks: exportBMs,
			Todos: todoRows, Notes: noteRows, MonitorTargets: exportMTs,
		}
		model.RespondJSON(w, http.StatusOK, backup)
	}
}

// ImportBackup handles POST /api/v1/admin/backup.
func (h *Handler) ImportBackup() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		db := h.DB

		var body adminBackupImport
		r.Body = http.MaxBytesReader(w, r.Body, 10<<20) // 10MB limit
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			model.RespondError(w, http.StatusBadRequest, "请求体格式错误")
			return
		}
		if body.Version != 1 {
			model.RespondError(w, http.StatusBadRequest, "不兼容的备份版本")
			return
		}

		authKeys := []string{"admin_password_hash", "session_secret"}
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

		tables := []string{"bookmarks", "categories", "todos", "notes", "settings", "monitor_targets"}
		for _, t := range tables {
			if _, err := tx.ExecContext(r.Context(), "DELETE FROM "+t); err != nil {
				slog.Error("备份导入: 清空表失败", "error", err, "table", t)
				model.RespondError(w, http.StatusInternalServerError, "恢复失败")
				return
			}
		}

		for key, value := range body.Settings {
			if _, err := tx.ExecContext(r.Context(),
				"INSERT INTO settings (key, value) VALUES (?, ?)", key, value); err != nil {
				slog.Error("备份导入: 恢复设置失败", "error", err, "key", key)
				model.RespondError(w, http.StatusInternalServerError, "恢复失败")
				return
			}
		}

		for _, cat := range body.Categories {
			if _, err := tx.ExecContext(r.Context(),
				`INSERT INTO categories (id, title, icon, "order", created_at) VALUES (?, ?, ?, ?, ?)`,
				cat.ID, cat.Title, cat.Icon, cat.Order, cat.CreatedAt); err != nil {
				slog.Error("备份导入: 恢复分类失败", "error", err)
				model.RespondError(w, http.StatusInternalServerError, "恢复失败")
				return
			}
		}

		for _, bm := range body.Bookmarks {
			if _, err := tx.ExecContext(r.Context(),
				`INSERT INTO bookmarks (id, category_id, title, url, icon, description, "order", created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
				bm.ID, bm.CategoryID, bm.Title, bm.URL, bm.Icon, bm.Description, bm.Order, bm.CreatedAt); err != nil {
				slog.Error("备份导入: 恢复书签失败", "error", err)
				model.RespondError(w, http.StatusInternalServerError, "恢复失败")
				return
			}
		}

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

		for _, note := range body.Notes {
			if _, err := tx.ExecContext(r.Context(),
				"INSERT INTO notes (id, title, content, updated_at) VALUES (?, ?, ?, ?)",
				note.ID, note.Title, note.Content, note.UpdatedAt); err != nil {
				slog.Error("备份导入: 恢复笔记失败", "error", err)
				model.RespondError(w, http.StatusInternalServerError, "恢复失败")
				return
			}
		}

		// 恢复 Docker 元数据
		if body.DockerMetadata != nil {
			for name, meta := range body.DockerMetadata {
				meta.Name = name
				h.DockerMeta.Set(name, meta)
			}
		}

			for _, mt := range body.MonitorTargets {
			if _, err := tx.ExecContext(r.Context(),
				"INSERT INTO monitor_targets (id, name, url, icon, mac, timeout, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
				mt.ID, mt.Name, mt.URL, mt.Icon, mt.MAC, mt.Timeout, mt.CreatedAt); err != nil {
				slog.Error("备份导入: 恢复监控目标失败", "error", err)
				model.RespondError(w, http.StatusInternalServerError, "恢复失败")
				return
			}
		}

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
