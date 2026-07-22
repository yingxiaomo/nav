package handler

import (
	"context"
	"database/sql"
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/YingXiaoMo/nav/internal/db/queries"
	"github.com/YingXiaoMo/nav/internal/model"
)

// ===== 导出类型（精确匹配 TypeScript 导出格式）=====

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

// ===== 导入类型（匹配 TypeScript 导入格式）=====

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

// ===== 辅助函数 =====

func bookmarkToLinkItem(b model.Bookmark) model.LinkItem {
	li := model.LinkItem{
		ID: b.ID, Title: b.Title, URL: b.URL, Icon: b.Icon,
		Description: b.Description, UpdatedAt: b.CreatedAt, Order: b.Order,
	}
	if b.IsFolder == 1 {
		li.Type = "folder"
		li.Children = []model.LinkItem{}
	}
	if b.URL == "" && li.Type == "" {
		li.URL = ""
	}
	return li
}

// bookmarksToTree 将扁平书签列表按 parent_id 重建成树形结构
// 根节点（parent_id=""）之间保持原始 order 排序
func bookmarksToTree(bms []model.Bookmark) []model.LinkItem {
	byParent := map[string][]model.Bookmark{}
	var roots []model.Bookmark

	for _, bm := range bms {
		if bm.ParentID == "" {
			roots = append(roots, bm)
		} else {
			byParent[bm.ParentID] = append(byParent[bm.ParentID], bm)
		}
	}

	var build func(bm model.Bookmark) model.LinkItem
	build = func(bm model.Bookmark) model.LinkItem {
		li := bookmarkToLinkItem(bm)
		if children, ok := byParent[bm.ID]; ok {
			li.Type = "folder"
			li.Children = make([]model.LinkItem, 0, len(children))
			for _, child := range children {
				li.Children = append(li.Children, build(child))
			}
		}
		return li
	}

	items := make([]model.LinkItem, 0, len(roots))
	for _, root := range roots {
		items = append(items, build(root))
	}
	return items
}

// saveLinksTree 递归保存书签/文件夹树（直接使用 *sql.Tx 执行）
func saveLinksTree(ctx context.Context, tx *sql.Tx, categoryID, parentID string, links []model.LinkItem, now int64) error {
	for i, link := range links {
		linkID := link.ID
		if linkID == "" {
			linkID = model.NewID()
		}
		createdAt := link.UpdatedAt
		if createdAt == 0 {
			createdAt = now
		}
		order := link.Order
		if order == 0 {
			order = i
		}

		isFolder := 0
		var effectiveParent any
		if parentID != "" {
			effectiveParent = parentID
		}
		if link.Type == "folder" {
			isFolder = 1
		}

		if _, err := tx.ExecContext(ctx,
			`INSERT INTO bookmarks (id, category_id, parent_id, title, url, icon, description, "order", created_at, is_folder) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			linkID, categoryID, effectiveParent, link.Title, link.URL, link.Icon, link.Description, order, createdAt, isFolder); err != nil {
			return err
		}

		if len(link.Children) > 0 {
			if err := saveLinksTree(ctx, tx, categoryID, linkID, link.Children, now); err != nil {
				return err
			}
		}
	}
	return nil
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

// ===== 处理器 =====

// GetData 处理 GET /api/v1/data — 导出完整数据并重建文件夹树。
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
			bms, err := queries.GetBookmarksByCategory(r.Context(), db, cat.ID)
			if err != nil {
				slog.Error("获取分类书签失败", "error", err, "category_id", cat.ID)
				model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
				return
			}
			linkItems := bookmarksToTree(bms)

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

// PutData 处理 PUT /api/v1/data — 增量保存，只 upsert 导入体提供的数据。
func (h *Handler) PutData() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		db := h.DB

		var body dataImport
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			model.RespondError(w, http.StatusBadRequest, "请求体格式错误")
			return
		}

		tx, err := db.BeginTx(r.Context(), nil)
		if err != nil {
			slog.Error("开启事务失败", "error", err)
			model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
			return
		}
		defer tx.Rollback()

		now := model.Now()

		// 分类 + 书签（增量）：只处理 body 提供的分类，未提供的分类不受影响
		if body.Categories != nil {
			if len(body.Categories) == 0 {
				if _, err := tx.ExecContext(r.Context(), `DELETE FROM bookmarks`); err != nil {
					slog.Error("清空书签失败", "error", err)
					model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
					return
				}
				if _, err := tx.ExecContext(r.Context(), `DELETE FROM categories`); err != nil {
					slog.Error("清空分类失败", "error", err)
					model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
					return
				}
			} else {
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
						`INSERT INTO categories (id, title, icon, "order", created_at) VALUES (?, ?, ?, ?, ?)
						 ON CONFLICT(id) DO UPDATE SET title = ?, icon = ?, "order" = ?`,
						catID, cat.Title, cat.Icon, cat.Order, createdAt,
						cat.Title, cat.Icon, cat.Order); err != nil {
						slog.Error("插入分类失败", "error", err)
						model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
						return
					}

					if _, err := tx.ExecContext(r.Context(), `DELETE FROM bookmarks WHERE category_id = ?`, catID); err != nil {
						slog.Error("清空分类书签失败", "error", err)
						model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
						return
					}

					if len(cat.Links) > 0 {
						if err := saveLinksTree(r.Context(), tx, catID, "", cat.Links, now); err != nil {
							slog.Error("保存书签树失败", "error", err)
							model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
							return
						}
					}
				}
			}
		}

		// 待办（增量）：只处理 body 提供的待办
		if body.Todos != nil {
			if len(body.Todos) == 0 {
				if _, err := tx.ExecContext(r.Context(), `DELETE FROM todos`); err != nil {
					slog.Error("清空待办失败", "error", err)
					model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
					return
				}
			} else {
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
						`INSERT INTO todos (id, text, completed, created_at) VALUES (?, ?, ?, ?)
						 ON CONFLICT(id) DO UPDATE SET text = ?, completed = ?`,
						todoID, todo.Text, completed, createdAt, todo.Text, completed); err != nil {
						slog.Error("插入待办失败", "error", err)
						model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
						return
					}
				}
			}
		}

		// 笔记（增量）：只处理 body 提供的笔记
		if body.Notes != nil {
			if len(body.Notes) == 0 {
				if _, err := tx.ExecContext(r.Context(), `DELETE FROM notes`); err != nil {
					slog.Error("清空笔记失败", "error", err)
					model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
					return
				}
			} else {
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
						`INSERT INTO notes (id, title, content, updated_at) VALUES (?, ?, ?, ?)
						 ON CONFLICT(id) DO UPDATE SET title = ?, content = ?, updated_at = ?`,
						noteID, note.Title, note.Content, updatedAt, note.Title, note.Content, updatedAt); err != nil {
						slog.Error("插入笔记失败", "error", err)
						model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
						return
					}
				}
			}
		}

		// 设置（增量）：只 upsert 导入体提供的键，不删除已有设置
		if len(body.Settings) > 0 {
			var settingsMap map[string]any
			if err := json.Unmarshal(body.Settings, &settingsMap); err == nil {
				for key, value := range settingsMap {
					if value == nil {
						continue
					}
					var valStr string
					switch v := value.(type) {
					case string:
						valStr = v
					default:
						valBytes, _ := json.Marshal(v)
						valStr = string(valBytes)
					}

					if _, err := tx.ExecContext(r.Context(),
						"INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?",
						key, valStr, valStr); err != nil {
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
				"INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?",
				"pinnedLinks", string(valBytes), string(valBytes)); err != nil {
				slog.Error("插入 pinnedLinks 失败", "error", err)
				model.RespondError(w, http.StatusInternalServerError, "写入固定链接失败")
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
