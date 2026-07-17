package handler

import (
	"context"
	"database/sql"
	"log/slog"
	"net/http"

	"github.com/YingXiaoMo/nav/internal/model"
)

// ===== CRUD handler 骨架 — 消除模板代码重复 =====
// 每个函数封装 "decode → validate → query → error → respond" 模式。
// 实体特有的验证/合并逻辑放在 doXxx 闭包中完成。

// handleList wraps: query → error check → RespondJSON
func (h *Handler) handleList(entityName string, listFn func(context.Context, *sql.DB) (any, error)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		items, err := listFn(r.Context(), h.DB)
		if err != nil {
			slog.Error("获取"+entityName+"列表失败", "error", err)
			model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
			return
		}
		model.RespondJSON(w, http.StatusOK, items)
	}
}

// handleGet wraps: id → query → 404 → RespondJSON
func (h *Handler) handleGet(entityName string, getFn func(context.Context, *sql.DB, string) (any, error)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		item, err := getFn(r.Context(), h.DB, id)
		if err != nil {
			slog.Error("获取"+entityName+"失败", "error", err, "id", id)
			model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
			return
		}
		if item == nil {
			model.RespondError(w, http.StatusNotFound, entityName+"不存在")
			return
		}
		model.RespondJSON(w, http.StatusOK, item)
	}
}

// handleCreate wraps: doCreate(解码+验证+创建) → 201 Created
// doCreate 闭包捕获请求体解码和验证逻辑，返回 (result, errorMsg, ok)
func (h *Handler) handleCreate(entityName string,
	doCreate func(*http.Request, context.Context, *sql.DB) (any, string, bool)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		item, errMsg, ok := doCreate(r, r.Context(), h.DB)
		if !ok {
			model.RespondError(w, http.StatusBadRequest, errMsg)
			return
		}
		model.RespondJSON(w, http.StatusCreated, item)
	}
}

// handleUpdate wraps: id → doUpdate(解码+合并+更新) → 刷新 → RespondJSON
// doUpdate 闭包负责解码请求体、合并字段、执行更新，返回 (result, errorMsg, ok)
// 返回 errMsg=="not_found" 时自动返回 404
func (h *Handler) handleUpdate(entityName string,
	doUpdate func(*http.Request, context.Context, *sql.DB, string) (any, string, bool)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		item, errMsg, ok := doUpdate(r, r.Context(), h.DB, id)
		if !ok {
			if errMsg == "not_found" {
				model.RespondError(w, http.StatusNotFound, entityName+"不存在")
			} else {
				model.RespondError(w, http.StatusBadRequest, errMsg)
			}
			return
		}
		model.RespondJSON(w, http.StatusOK, item)
	}
}

// handleDelete wraps: id → 检查存在 → 删除 → RespondJSON
func (h *Handler) handleDelete(entityName string,
	getFn func(context.Context, *sql.DB, string) (any, error),
	deleteFn func(context.Context, *sql.DB, string) error) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")

		existing, err := getFn(r.Context(), h.DB, id)
		if err != nil {
			slog.Error("获取"+entityName+"失败", "error", err, "id", id)
			model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
			return
		}
		if existing == nil {
			model.RespondError(w, http.StatusNotFound, entityName+"不存在")
			return
		}

		if err := deleteFn(r.Context(), h.DB, id); err != nil {
			slog.Error("删除"+entityName+"失败", "error", err, "id", id)
			model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
			return
		}

		model.RespondJSON(w, http.StatusOK, map[string]any{"success": true})
	}
}
