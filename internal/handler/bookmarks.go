package handler

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/YingXiaoMo/nav/internal/db/queries"
	"github.com/YingXiaoMo/nav/internal/model"
)

type reorderRequest struct {
	Items []queries.ReorderItem `json:"items"`
}

func (h *Handler) ListBookmarks() http.HandlerFunc {
	return h.handleList("书签", func(ctx context.Context, db *sql.DB) (any, error) {
		return queries.GetAllBookmarks(ctx, db, "")
	})
}

func (h *Handler) GetBookmark() http.HandlerFunc {
	return h.handleGet("书签",
		func(ctx context.Context, db *sql.DB, id string) (any, error) { return queries.GetBookmark(ctx, db, id) })
}

func (h *Handler) CreateBookmark() http.HandlerFunc {
	return h.handleCreate("书签", func(r *http.Request, ctx context.Context, db *sql.DB) (any, string, bool) {
		var input model.BookmarkInput
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			return nil, "请求体格式错误", false
		}
		if input.CategoryID == "" {
			return nil, "缺少分类 ID", false
		}
		if input.Title == "" {
			return nil, "标题不能为空", false
		}
		if input.URL == "" && !input.IsFolder {
			return nil, "链接不能为空", false
		}
		if input.URL != "" && !strings.HasPrefix(input.URL, "http://") && !strings.HasPrefix(input.URL, "https://") {
			return nil, "链接格式无效，仅允许 http/https 链接", false
		}
		exists, err := queries.CategoryExists(ctx, db, input.CategoryID)
		if err != nil {
			return nil, "服务器内部错误", false
		}
		if !exists {
			return nil, "所属分类不存在", false
		}
		bm, err := queries.CreateBookmark(ctx, db, input)
		if err != nil {
			return nil, "服务器内部错误", false
		}
		return bm, "", true
	})
}

func (h *Handler) UpdateBookmark() http.HandlerFunc {
	return h.handleUpdate("书签", func(r *http.Request, ctx context.Context, db *sql.DB, id string) (any, string, bool) {
		var input model.BookmarkInput
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			return nil, "请求体格式错误", false
		}

		existing, err := queries.GetBookmark(ctx, db, id)
		if err != nil {
			return nil, "服务器内部错误", false
		}
		if existing == nil {
			return nil, "not_found", false
		}

		// 验证并更新分类
		if input.CategoryID != "" && input.CategoryID != existing.CategoryID {
			exists, err := queries.CategoryExists(ctx, db, input.CategoryID)
			if err != nil {
				return nil, "服务器内部错误", false
			}
			if !exists {
				return nil, "目标分类不存在", false
			}
			existing.CategoryID = input.CategoryID
		}
		// 直接使用输入值更新（允许清空字段）
		title := input.Title
		url := input.URL
		if url != "" && !strings.HasPrefix(url, "http://") && !strings.HasPrefix(url, "https://") {
			return nil, "链接格式无效，仅允许 http/https 链接", false
		}

		if _, err := queries.UpdateBookmark(ctx, db, id, model.BookmarkInput{
			CategoryID: existing.CategoryID, Title: title, URL: url,
			Icon: input.Icon, Description: input.Description, Order: existing.Order,
		}); err != nil {
			return nil, "服务器内部错误", false
		}

		updated, err := queries.GetBookmark(ctx, db, id)
		if err != nil {
			return nil, "服务器内部错误", false
		}
		return updated, "", true
	})
}

func (h *Handler) DeleteBookmark() http.HandlerFunc {
	return h.handleDelete("书签",
		func(ctx context.Context, db *sql.DB, id string) (any, error) { return queries.GetBookmark(ctx, db, id) },
		queries.DeleteBookmark)
}

// ReorderBookmarks 处理 PATCH /api/v1/bookmarks/reorder — 特殊非 CRUD 端点，保持原样
func (h *Handler) ReorderBookmarks() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req reorderRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			model.RespondError(w, http.StatusBadRequest, "请求体格式错误")
			return
		}
		if len(req.Items) > 500 {
			model.RespondError(w, http.StatusBadRequest, "单次排序数量不能超过 500")
			return
		}
		if len(req.Items) == 0 {
			model.RespondJSON(w, http.StatusOK, map[string]any{"success": true})
			return
		}
		if err := queries.ReorderBookmarks(r.Context(), h.DB, req.Items); err != nil {
			model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
			return
		}
		model.RespondJSON(w, http.StatusOK, map[string]any{"success": true})
	}
}
