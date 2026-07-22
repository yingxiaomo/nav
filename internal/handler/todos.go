package handler

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"

	"github.com/YingXiaoMo/nav/internal/db/queries"
	"github.com/YingXiaoMo/nav/internal/model"
)

func (h *Handler) ListTodos() http.HandlerFunc {
	return h.handleList("待办", func(ctx context.Context, db *sql.DB) (any, error) {
		return queries.GetAllTodos(ctx, db)
	})
}

func (h *Handler) CreateTodo() http.HandlerFunc {
	return h.handleCreate("待办", func(r *http.Request, ctx context.Context, db *sql.DB) (any, string, bool) {
		var input model.TodoInput
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			return nil, "请求体格式错误", false
		}
		if input.Text == "" {
			return nil, "内容不能为空", false
		}
		todo, err := queries.CreateTodo(ctx, db, input.Text)
		if err != nil {
			return nil, "服务器内部错误", false
		}
		return todo, "", true
	})
}

func (h *Handler) UpdateTodo() http.HandlerFunc {
	return h.handleUpdate("待办", func(r *http.Request, ctx context.Context, db *sql.DB, id string) (any, string, bool) {
		var input model.TodoInput
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			return nil, "请求体格式错误", false
		}

		existing, err := queries.GetTodo(ctx, db, id)
		if err != nil {
			return nil, "服务器内部错误", false
		}
		if existing == nil {
			return nil, "not_found", false
		}

		// 直接使用输入值更新（允许清空字段）
		if _, err := queries.UpdateTodo(ctx, db, id, input.Text, input.Completed); err != nil {
			return nil, "服务器内部错误", false
		}

		updated, err := queries.GetTodo(ctx, db, id)
		if err != nil {
			return nil, "服务器内部错误", false
		}
		return updated, "", true
	})
}

func (h *Handler) DeleteTodo() http.HandlerFunc {
	return h.handleDelete("待办",
		func(ctx context.Context, db *sql.DB, id string) (any, error) { return queries.GetTodo(ctx, db, id) },
		queries.DeleteTodo)
}
