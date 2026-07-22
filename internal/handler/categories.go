package handler

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"

	"github.com/YingXiaoMo/nav/internal/db/queries"
	"github.com/YingXiaoMo/nav/internal/model"
)

func (h *Handler) ListCategories() http.HandlerFunc {
	return h.handleList("分类", func(ctx context.Context, db *sql.DB) (any, error) {
		cats, err := queries.GetAllCategories(ctx, db)
		if err != nil {
			return nil, err
		}
		// 获取所有书签并按分类分组，使前端能显示书签数
		allBms, err := queries.GetAllBookmarks(ctx, db, "")
		if err != nil {
			return cats, nil // 书签获取失败时只返回分类基本信息
		}
		byCat := make(map[string][]model.Bookmark)
		for _, bm := range allBms {
			byCat[bm.CategoryID] = append(byCat[bm.CategoryID], bm)
		}
		for i, cat := range cats {
			if links, ok := byCat[cat.ID]; ok {
				cats[i].Links = links
			} else {
				cats[i].Links = []model.Bookmark{}
			}
		}
		return cats, nil
	})
}

func (h *Handler) GetCategory() http.HandlerFunc {
	return h.handleGet("分类",
		func(ctx context.Context, db *sql.DB, id string) (any, error) {
			cat, err := queries.GetCategory(ctx, db, id)
			if err != nil || cat == nil {
				return cat, err
			}
			// 附带书签列表
			links, err := queries.GetBookmarksByCategory(ctx, db, id)
			if err != nil {
				return cat, nil // 书签获取失败不影响分类本身
			}
			cat.Links = links
			return cat, nil
		})
}

func (h *Handler) CreateCategory() http.HandlerFunc {
	return h.handleCreate("分类", func(r *http.Request, ctx context.Context, db *sql.DB) (any, string, bool) {
		var input model.CategoryInput
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			return nil, "请求体格式错误", false
		}
		if input.Title == "" {
			return nil, "分类名称不能为空", false
		}
		cat, err := queries.CreateCategory(ctx, db, input)
		if err != nil {
			return nil, "服务器内部错误", false
		}
		return cat, "", true
	})
}

func (h *Handler) UpdateCategory() http.HandlerFunc {
	return h.handleUpdate("分类", func(r *http.Request, ctx context.Context, db *sql.DB, id string) (any, string, bool) {
		var input model.CategoryInput
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			return nil, "请求体格式错误", false
		}

		existing, err := queries.GetCategory(ctx, db, id)
		if err != nil {
			return nil, "服务器内部错误", false
		}
		if existing == nil {
			return nil, "not_found", false
		}

		if input.Title != "" {
			existing.Title = input.Title
		}
		if input.Icon != "" {
			existing.Icon = input.Icon
		}

		if _, err := queries.UpdateCategory(ctx, db, id, model.CategoryInput{
			Title: existing.Title, Icon: existing.Icon, Order: existing.Order,
		}); err != nil {
			return nil, "服务器内部错误", false
		}

		updated, err := queries.GetCategory(ctx, db, id)
		if err != nil {
			return nil, "服务器内部错误", false
		}
		return updated, "", true
	})
}

func (h *Handler) DeleteCategory() http.HandlerFunc {
	return h.handleDelete("分类",
		func(ctx context.Context, db *sql.DB, id string) (any, error) { return queries.GetCategory(ctx, db, id) },
		queries.DeleteCategory)
}
