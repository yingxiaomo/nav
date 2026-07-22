package handler

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"

	"github.com/YingXiaoMo/nav/internal/db/queries"
	"github.com/YingXiaoMo/nav/internal/model"
)

func (h *Handler) ListNotes() http.HandlerFunc {
	return h.handleList("笔记", func(ctx context.Context, db *sql.DB) (any, error) {
		return queries.GetAllNotes(ctx, db)
	})
}

func (h *Handler) GetNote() http.HandlerFunc {
	return h.handleGet("笔记",
		func(ctx context.Context, db *sql.DB, id string) (any, error) { return queries.GetNote(ctx, db, id) })
}

func (h *Handler) CreateNote() http.HandlerFunc {
	return h.handleCreate("笔记", func(r *http.Request, ctx context.Context, db *sql.DB) (any, string, bool) {
		var input model.NoteInput
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			return nil, "请求体格式错误", false
		}
		note, err := queries.CreateNote(ctx, db, input.Title, input.Content)
		if err != nil {
			return nil, "服务器内部错误", false
		}
		return note, "", true
	})
}

func (h *Handler) UpdateNote() http.HandlerFunc {
	return h.handleUpdate("笔记", func(r *http.Request, ctx context.Context, db *sql.DB, id string) (any, string, bool) {
		var input model.NoteInput
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			return nil, "请求体格式错误", false
		}

		existing, err := queries.GetNote(ctx, db, id)
		if err != nil {
			return nil, "服务器内部错误", false
		}
		if existing == nil {
			return nil, "not_found", false
		}

		// 直接使用输入值更新（允许清空字段）
		if _, err := queries.UpdateNote(ctx, db, id, input.Title, input.Content); err != nil {
			return nil, "服务器内部错误", false
		}

		updated, err := queries.GetNote(ctx, db, id)
		if err != nil {
			return nil, "服务器内部错误", false
		}
		return updated, "", true
	})
}

func (h *Handler) DeleteNote() http.HandlerFunc {
	return h.handleDelete("笔记",
		func(ctx context.Context, db *sql.DB, id string) (any, error) { return queries.GetNote(ctx, db, id) },
		queries.DeleteNote)
}
