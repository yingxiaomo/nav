package handler

import (
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
		ID: b.ID, Title: b.Title, URL: b.URL, Icon: b.Icon,
		Description: b.Description, UpdatedAt: b.CreatedAt, Order: b.Order,
	}
}

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
	v, ok := m[key]
	if !ok || v == "" {
		return def
	}
	if len(v) >= 2 && v[0] == '"' {
		var s string
		if json.Unmarshal([]byte(v), &s) == nil {
			return s
		}
	}
	return v
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
func (h *Handler) GetData() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		db := h.DB

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
				ID: cat.ID, Title: cat.Title, Icon: cat.Icon,
				Order: cat.Order, UpdatedAt: cat.CreatedAt, Links: linkItems,
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

		model.RespondJSON(w, http.StatusOK, dataExport{
			Settings:    siteSettings,
			Categories:  exportCats,
			Todos:       todos,
			Notes:       notes,
			PinnedLinks: pinnedLinks,
		})
	}
}

// PutData handles PUT /api/v1/data — full data replacement.
func (h *Handler) PutData() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		db := h.DB

		var body dataImport
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			model.RespondError(w, http.StatusBadRequest, "请求体格式错误")
			return
		}

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

		tables := []string{"bookmarks", "categories", "todos", "notes", "settings"}
		for _, t := range tables {
			if _, err := tx.ExecContext(r.Context(), "DELETE FROM "+t); err != nil {
				slog.Error("清空表失败", "error", err, "table", t)
				model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
				return
			}
		}

		now := model.Now()

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

		for _, todo := range body.Todos {
			todoID := todo.ID
			if todoID == "" {
				todoID = model.NewID()
			}
			createdAt := todo.CreatedAt
			if createdAt == 0 {
				createdAt = now
			}
			completed := 0
			if todo.Completed {
				completed = 1
			}

			if _, err := tx.ExecContext(r.Context(),
				"INSERT INTO todos (id, text, completed, created_at) VALUES (?, ?, ?, ?)",
				todoID, todo.Text, completed, createdAt); err != nil {
				slog.Error("插入待办失败", "error", err)
				model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
				return
			}
		}

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
				"INSERT INTO notes (id, title, content, updated_at) VALUES (?, ?, ?, ?)",
				noteID, note.Title, note.Content, updatedAt); err != nil {
				slog.Error("插入笔记失败", "error", err)
				model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
				return
			}
		}

		if len(body.Settings) > 0 {
			var settingsMap map[string]any
			if err := json.Unmarshal(body.Settings, &settingsMap); err == nil {
				for key, value := range settingsMap {
					if value == nil {
						continue
					}
					// Strings stored directly; other types JSON-encoded for the flat key-value table
					var valStr string
					switch v := value.(type) {
					case string:
						valStr = v
					default:
						valBytes, _ := json.Marshal(v)
						valStr = string(valBytes)
					}

					if _, err := tx.ExecContext(r.Context(),
						"INSERT INTO settings (key, value) VALUES (?, ?)",
						key, valStr); err != nil {
						slog.Error("插入设置失败", "error", err, "key", key)
						model.RespondError(w, http.StatusInternalServerError, "写入设置失败")
						return
					}
				}
			}
		}

		if len(body.PinnedLinks) > 0 {
			valBytes, _ := json.Marshal(body.PinnedLinks)
			if _, err := tx.ExecContext(r.Context(),
				"INSERT INTO settings (key, value) VALUES (?, ?)",
				"pinnedLinks", string(valBytes)); err != nil {
				slog.Error("插入 pinnedLinks 失败", "error", err)
				model.RespondError(w, http.StatusInternalServerError, "写入固定链接失败")
				return
			}
		}

		for key, value := range preserved {
			if _, err := tx.ExecContext(r.Context(),
				"INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?",
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
