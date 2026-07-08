package handler

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"strings"

	"github.com/YingXiaoMo/nav/internal/db/queries"
	"github.com/YingXiaoMo/nav/internal/model"
)

type reorderRequest struct {
	Items []queries.ReorderItem `json:"items"`
}

func (h *Handler) ListBookmarks() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		categoryID := r.URL.Query().Get("categoryId")
		bms, err := queries.GetAllBookmarks(r.Context(), h.DB, categoryID)
		if err != nil {
			slog.Error("获取书签列表失败", "error", err)
			model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
			return
		}
		model.RespondJSON(w, http.StatusOK, bms)
	}
}

func (h *Handler) GetBookmark() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		bm, err := queries.GetBookmark(r.Context(), h.DB, id)
		if err != nil {
			slog.Error("获取书签失败", "error", err, "id", id)
			model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
			return
		}
		if bm == nil {
			model.RespondError(w, http.StatusNotFound, "书签不存在")
			return
		}
		model.RespondJSON(w, http.StatusOK, bm)
	}
}

func (h *Handler) CreateBookmark() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		db := h.DB

		var input model.BookmarkInput
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			model.RespondError(w, http.StatusBadRequest, "请求体格式错误")
			return
		}
		if input.CategoryID == "" {
			model.RespondError(w, http.StatusBadRequest, "缺少分类 ID")
			return
		}
		if input.Title == "" {
			model.RespondError(w, http.StatusBadRequest, "标题不能为空")
			return
		}
		if input.URL == "" || (!strings.HasPrefix(input.URL, "http://") && !strings.HasPrefix(input.URL, "https://")) {
			model.RespondError(w, http.StatusBadRequest, "链接格式无效，仅允许 http/https 链接")
			return
		}

		exists, err := queries.CategoryExists(r.Context(), db, input.CategoryID)
		if err != nil {
			slog.Error("验证分类失败", "error", err)
			model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
			return
		}
		if !exists {
			model.RespondError(w, http.StatusNotFound, "所属分类不存在")
			return
		}

		bm, err := queries.CreateBookmark(r.Context(), db, input)
		if err != nil {
			slog.Error("创建书签失败", "error", err)
			model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
			return
		}
		model.RespondJSON(w, http.StatusCreated, bm)
	}
}

func (h *Handler) UpdateBookmark() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		db := h.DB
		id := r.PathValue("id")

		var input model.BookmarkInput
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			model.RespondError(w, http.StatusBadRequest, "请求体格式错误")
			return
		}

		existing, err := queries.GetBookmark(r.Context(), db, id)
		if err != nil {
			slog.Error("获取书签失败", "error", err, "id", id)
			model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
			return
		}
		if existing == nil {
			model.RespondError(w, http.StatusNotFound, "书签不存在")
			return
		}

		if input.CategoryID != "" {
			if input.CategoryID != existing.CategoryID {
				exists, err := queries.CategoryExists(r.Context(), db, input.CategoryID)
				if err != nil {
					slog.Error("验证目标分类失败", "error", err)
					model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
					return
				}
				if !exists {
					model.RespondError(w, http.StatusBadRequest, "目标分类不存在")
					return
				}
				existing.CategoryID = input.CategoryID
			}
		}
		if input.Title != "" {
			existing.Title = input.Title
		}
		if input.URL != "" {
			if !strings.HasPrefix(input.URL, "http://") && !strings.HasPrefix(input.URL, "https://") {
				model.RespondError(w, http.StatusBadRequest, "链接格式无效，仅允许 http/https 链接")
				return
			}
			existing.URL = input.URL
		}
		if input.Icon != "" {
			existing.Icon = input.Icon
		}
		if input.Description != "" {
			existing.Description = input.Description
		}

		_, err = queries.UpdateBookmark(r.Context(), db, id, model.BookmarkInput{
			CategoryID:  existing.CategoryID,
			Title:       existing.Title,
			URL:         existing.URL,
			Icon:        existing.Icon,
			Description: existing.Description,
			Order:       existing.Order,
		})
		if err != nil {
			slog.Error("更新书签失败", "error", err, "id", id)
			model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
			return
		}

		updated, err := queries.GetBookmark(r.Context(), db, id)
		if err != nil {
			slog.Error("获取更新后书签失败", "error", err, "id", id)
			model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
			return
		}
		model.RespondJSON(w, http.StatusOK, updated)
	}
}

func (h *Handler) DeleteBookmark() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		db := h.DB
		id := r.PathValue("id")

		existing, err := queries.GetBookmark(r.Context(), db, id)
		if err != nil {
			slog.Error("获取书签失败", "error", err, "id", id)
			model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
			return
		}
		if existing == nil {
			model.RespondError(w, http.StatusNotFound, "书签不存在")
			return
		}

		if err := queries.DeleteBookmark(r.Context(), db, id); err != nil {
			slog.Error("删除书签失败", "error", err, "id", id)
			model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
			return
		}
		model.RespondJSON(w, http.StatusOK, map[string]any{"success": true})
	}
}

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
			slog.Error("排序书签失败", "error", err)
			model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
			return
		}
		model.RespondJSON(w, http.StatusOK, map[string]any{"success": true})
	}
}
