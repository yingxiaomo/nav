package handler

import (
	"database/sql"
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/YingXiaoMo/nav/internal/db/queries"
	"github.com/YingXiaoMo/nav/internal/model"
)

func ListCategories(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		cats, err := queries.GetAllCategories(r.Context(), db)
		if err != nil {
			slog.Error("获取分类列表失败", "error", err)
			model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
			return
		}

		for i := range cats {
			links, err := queries.GetBookmarksByCategory(r.Context(), db, cats[i].ID)
			if err != nil {
				slog.Error("获取分类书签失败", "error", err, "category_id", cats[i].ID)
				model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
				return
			}
			cats[i].Links = links
		}

		model.RespondJSON(w, http.StatusOK, cats)
	}
}

func GetCategory(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")

		cat, err := queries.GetCategory(r.Context(), db, id)
		if err != nil {
			slog.Error("获取分类失败", "error", err, "id", id)
			model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
			return
		}
		if cat == nil {
			model.RespondError(w, http.StatusNotFound, "分类不存在")
			return
		}

		links, err := queries.GetBookmarksByCategory(r.Context(), db, id)
		if err != nil {
			slog.Error("获取分类书签失败", "error", err, "category_id", id)
			model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
			return
		}
		cat.Links = links

		model.RespondJSON(w, http.StatusOK, cat)
	}
}

func CreateCategory(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var input model.CategoryInput
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			model.RespondError(w, http.StatusBadRequest, "请求体格式错误")
			return
		}
		if input.Title == "" {
			model.RespondError(w, http.StatusBadRequest, "分类名称不能为空")
			return
		}

		cat, err := queries.CreateCategory(r.Context(), db, input)
		if err != nil {
			slog.Error("创建分类失败", "error", err)
			model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
			return
		}

		model.RespondJSON(w, http.StatusCreated, cat)
	}
}

func UpdateCategory(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")

		var input model.CategoryInput
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			model.RespondError(w, http.StatusBadRequest, "请求体格式错误")
			return
		}

		existing, err := queries.GetCategory(r.Context(), db, id)
		if err != nil {
			slog.Error("获取分类失败", "error", err, "id", id)
			model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
			return
		}
		if existing == nil {
			model.RespondError(w, http.StatusNotFound, "分类不存在")
			return
		}

		// Apply partial updates — non-empty fields override existing values
		if input.Title != "" {
			existing.Title = input.Title
		}
		if input.Icon != "" {
			existing.Icon = input.Icon
		}

		_, err = queries.UpdateCategory(r.Context(), db, id, model.CategoryInput{
			Title: existing.Title,
			Icon:  existing.Icon,
			Order: existing.Order,
		})
		if err != nil {
			slog.Error("更新分类失败", "error", err, "id", id)
			model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
			return
		}

		updated, err := queries.GetCategory(r.Context(), db, id)
		if err != nil {
			slog.Error("获取更新后分类失败", "error", err, "id", id)
			model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
			return
		}

		model.RespondJSON(w, http.StatusOK, updated)
	}
}

func DeleteCategory(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")

		existing, err := queries.GetCategory(r.Context(), db, id)
		if err != nil {
			slog.Error("获取分类失败", "error", err, "id", id)
			model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
			return
		}
		if existing == nil {
			model.RespondError(w, http.StatusNotFound, "分类不存在")
			return
		}

		if err := queries.DeleteCategory(r.Context(), db, id); err != nil {
			slog.Error("删除分类失败", "error", err, "id", id)
			model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
			return
		}

		model.RespondJSON(w, http.StatusOK, map[string]any{"success": true})
	}
}
