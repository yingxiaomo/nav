package handler

import (
	"database/sql"
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/YingXiaoMo/nav/internal/db/queries"
	"github.com/YingXiaoMo/nav/internal/model"
)

// ===== Export types (match TypeScript export format exactly) =====

type categoryExport struct {
	ID        string           `json:"id"`
	Title     string           `json:"title"`
	Icon      string           `json:"icon,omitempty"`
	Order     int              `json:"order"`
	UpdatedAt int64            `json:"updatedAt"`
	Links     []model.LinkItem `json:"links"`
}

type dataExport struct {
	Settings    model.SiteSettings `json:"settings"`
	Categories  []categoryExport   `json:"categories"`
	Todos       []model.Todo       `json:"todos,omitempty"`
	Notes       []model.Note       `json:"notes,omitempty"`
	PinnedLinks []model.LinkItem   `json:"pinnedLinks,omitempty"`
}

// ===== Import types (match TypeScript import format) =====

type categoryImport struct {
	ID        string           `json:"id"`
	Title     string           `json:"title"`
	Icon      string           `json:"icon,omitempty"`
	Order     int              `json:"order,omitempty"`
	UpdatedAt int64            `json:"updatedAt,omitempty"`
	Links     []model.LinkItem `json:"links"`
}

type dataImport struct {
	Settings    json.RawMessage  `json:"settings"`
	Categories  []categoryImport `json:"categories"`
	Todos       []model.Todo     `json:"todos,omitempty"`
	Notes       []model.Note     `json:"notes,omitempty"`
	PinnedLinks []model.LinkItem `json:"pinnedLinks,omitempty"`
}

// ===== Helper functions =====

func bookmarkToLinkItem(b model.Bookmark) model.LinkItem {
	return model.LinkItem{
		ID:          b.ID,
		Title:       b.Title,
		URL:         b.URL,
		Icon:        b.Icon,
		Description: b.Description,
		UpdatedAt:   b.CreatedAt,
		Order:       b.Order,
	}
}

// settingsMapToSiteSettings builds a SiteSettings from the flat key-value settings map.
// Values that are JSON-encoded (e.g. wallpaperList) are unmarshalled;
// plain string values are used as-is.
func settingsMapToSiteSettings(m map[string]string) model.SiteSettings {
	return model.SiteSettings{
		Title:         strVal(m, "title", "Clean Nav"),
		Wallpaper:     strVal(m, "wallpaper", ""),
		WallpaperType: strVal(m, "wallpaperType", "local"),
		WallpaperList: strsVal(m, "wallpaperList"),
		BlurLevel:     strVal(m, "blurLevel", "medium"),
		ShowFeatures:  boolPtrVal(m, "showFeatures"),
		HomeLayout:    strVal(m, "homeLayout", ""),
		Theme:         strVal(m, "theme", ""),
	}
}

func strVal(m map[string]string, key, def string) string {
	if v, ok := m[key]; ok && v != "" {
		return v
	}
	return def
}

func strsVal(m map[string]string, key string) []string {
	v, ok := m[key]
	if !ok || v == "" {
		return []string{}
	}
	var r []string
	if json.Unmarshal([]byte(v), &r) == nil {
		return r
	}
	return []string{}
}

func boolPtrVal(m map[string]string, key string) *bool {
	v, ok := m[key]
	if !ok || v == "" {
		return nil
	}
	var r bool
	if json.Unmarshal([]byte(v), &r) == nil {
		return &r
	}
	return nil
}

func extractPinnedLinks(m map[string]string) []model.LinkItem {
	val, ok := m["pinnedLinks"]
	if !ok || val == "" {
		return nil
	}
	var links []model.LinkItem
	if json.Unmarshal([]byte(val), &links) == nil {
		return links
	}
	return nil
}

// ===== Handlers =====

// GetData handles GET /api/v1/data — full data export.
func GetData(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		settingsMap, err := queries.GetAllSettings(r.Context(), db)
		if err != nil {
			slog.Error("获取设置失败", "error", err)
			model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
			return
		}

		siteSettings := settingsMapToSiteSettings(settingsMap)
		pinnedLinks := extractPinnedLinks(settingsMap)

		cats, err := queries.GetAllCategories(r.Context(), db)
		if err != nil {
			slog.Error("获取分类列表失败", "error", err)
			model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
			return
		}

		exportCats := make([]categoryExport, 0, len(cats))
		for _, cat := range cats {
			links, err := queries.GetBookmarksByCategory(r.Context(), db, cat.ID)
			if err != nil {
				slog.Error("获取分类书签失败", "error", err, "category_id", cat.ID)
				model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
				return
			}
			linkItems := make([]model.LinkItem, 0, len(links))
			for _, b := range links {
				linkItems = append(linkItems, bookmarkToLinkItem(b))
			}
			exportCats = append(exportCats, categoryExport{
				ID:        cat.ID,
				Title:     cat.Title,
				Icon:      cat.Icon,
				Order:     cat.Order,
				UpdatedAt: cat.CreatedAt,
				Links:     linkItems,
			})
		}

		todos, err := queries.GetAllTodos(r.Context(), db)
		if err != nil {
			slog.Error("获取待办列表失败", "error", err)
			model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
			return
		}

		notes, err := queries.GetAllNotes(r.Context(), db)
		if err != nil {
			slog.Error("获取笔记列表失败", "error", err)
			model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
			return
		}

		result := dataExport{
			Settings:    siteSettings,
			Categories:  exportCats,
			Todos:       todos,
			Notes:       notes,
			PinnedLinks: pinnedLinks,
		}
		model.RespondJSON(w, http.StatusOK, result)
	}
}

// PutData handles PUT /api/v1/data — full data replacement.
func PutData(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var body dataImport
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			model.RespondError(w, http.StatusBadRequest, "请求体格式错误")
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
			slog.Error("开启事务失败", "error", err)
			model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
			return
		}
		defer tx.Rollback()

		// Delete existing data (bookmarks first because of FK constraint)
		if _, err := tx.ExecContext(r.Context(), "DELETE FROM bookmarks"); err != nil {
			slog.Error("清空书签失败", "error", err)
			model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
			return
		}
		if _, err := tx.ExecContext(r.Context(), "DELETE FROM categories"); err != nil {
			slog.Error("清空分类失败", "error", err)
			model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
			return
		}
		if _, err := tx.ExecContext(r.Context(), "DELETE FROM todos"); err != nil {
			slog.Error("清空待办失败", "error", err)
			model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
			return
		}
		if _, err := tx.ExecContext(r.Context(), "DELETE FROM notes"); err != nil {
			slog.Error("清空笔记失败", "error", err)
			model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
			return
		}
		if _, err := tx.ExecContext(r.Context(), "DELETE FROM settings"); err != nil {
			slog.Error("清空设置失败", "error", err)
			model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
			return
		}

		now := model.Now()

		// Insert categories + bookmarks
		for _, cat := range body.Categories {
			catID := cat.ID
			if catID == "" {
				catID = model.NewID()
			}
			createdAt := cat.UpdatedAt
			if createdAt == 0 {
				createdAt = now
			}

			if _, err := tx.ExecContext(r.Context(),
				`INSERT INTO categories (id, title, icon, "order", created_at) VALUES (?, ?, ?, ?, ?)`,
				catID, cat.Title, cat.Icon, cat.Order, createdAt); err != nil {
				slog.Error("插入分类失败", "error", err)
				model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
				return
			}

			for li, link := range cat.Links {
				linkID := link.ID
				if linkID == "" {
					linkID = model.NewID()
				}
				linkCreatedAt := link.UpdatedAt
				if linkCreatedAt == 0 {
					linkCreatedAt = now
				}
				linkOrder := link.Order
				if linkOrder == 0 {
					linkOrder = li
				}

				if _, err := tx.ExecContext(r.Context(),
					`INSERT INTO bookmarks (id, category_id, title, url, icon, description, "order", created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
					linkID, catID, link.Title, link.URL, link.Icon, link.Description, linkOrder, linkCreatedAt); err != nil {
					slog.Error("插入书签失败", "error", err)
					model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
					return
				}
			}
		}

		// Insert todos
		for _, todo := range body.Todos {
			todoID := todo.ID
			if todoID == "" {
				todoID = model.NewID()
			}
			createdAt := todo.CreatedAt
			if createdAt == 0 {
				createdAt = now
			}

			if _, err := tx.ExecContext(r.Context(),
				`INSERT INTO todos (id, text, completed, created_at) VALUES (?, ?, ?, ?)`,
				todoID, todo.Text, todo.Completed, createdAt); err != nil {
				slog.Error("插入待办失败", "error", err)
				model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
				return
			}
		}

		// Insert notes
		for _, note := range body.Notes {
			noteID := note.ID
			if noteID == "" {
				noteID = model.NewID()
			}
			updatedAt := note.UpdatedAt
			if updatedAt == 0 {
				updatedAt = now
			}

			if _, err := tx.ExecContext(r.Context(),
				`INSERT INTO notes (id, title, content, updated_at) VALUES (?, ?, ?, ?)`,
				noteID, note.Title, note.Content, updatedAt); err != nil {
				slog.Error("插入笔记失败", "error", err)
				model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
				return
			}
		}

		// Save settings from the import JSON (each key→value as a JSON-encoded string)
		if len(body.Settings) > 0 {
			var settingsMap map[string]any
			if err := json.Unmarshal(body.Settings, &settingsMap); err == nil {
				for key, value := range settingsMap {
					if value == nil {
						continue
					}
					valBytes, _ := json.Marshal(value)
					if _, err := tx.ExecContext(r.Context(),
						`INSERT INTO settings (key, value) VALUES (?, ?)`,
						key, string(valBytes)); err != nil {
						slog.Error("插入设置失败", "error", err, "key", key)
						model.RespondError(w, http.StatusInternalServerError, "写入设置失败")
						return
					}
				}
			}
		}

		// Save pinnedLinks
		if len(body.PinnedLinks) > 0 {
			valBytes, _ := json.Marshal(body.PinnedLinks)
			if _, err := tx.ExecContext(r.Context(),
				`INSERT INTO settings (key, value) VALUES (?, ?)`,
				"pinnedLinks", string(valBytes)); err != nil {
				slog.Error("插入 pinnedLinks 失败", "error", err)
				model.RespondError(w, http.StatusInternalServerError, "写入固定链接失败")
				return
			}
		}

		// Restore preserved auth keys
		for key, value := range preserved {
			if _, err := tx.ExecContext(r.Context(),
				`INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?`,
				key, value, value); err != nil {
				slog.Error("恢复密钥失败", "error", err, "key", key)
				model.RespondError(w, http.StatusInternalServerError, "恢复密钥失败")
				return
			}
		}

		if err := tx.Commit(); err != nil {
			slog.Error("提交事务失败", "error", err)
			model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
			return
		}

		model.RespondJSON(w, http.StatusOK, map[string]any{"success": true})
	}
}
