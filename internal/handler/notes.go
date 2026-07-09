package handler

import (
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/YingXiaoMo/nav/internal/db/queries"
	"github.com/YingXiaoMo/nav/internal/model"
)

func (h *Handler) ListNotes() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		notes, err := queries.GetAllNotes(r.Context(), h.DB)
		if err != nil {
			slog.Error("获取笔记列表失败", "error", err)
			model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
			return
		}
		model.RespondJSON(w, http.StatusOK, notes)
	}
}

func (h *Handler) GetNote() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		note, err := queries.GetNote(r.Context(), h.DB, id)
		if err != nil {
			slog.Error("获取笔记失败", "error", err, "id", id)
			model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
			return
		}
		if note == nil {
			model.RespondError(w, http.StatusNotFound, "笔记不存在")
			return
		}
		model.RespondJSON(w, http.StatusOK, note)
	}
}

func (h *Handler) CreateNote() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var input model.NoteInput
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			model.RespondError(w, http.StatusBadRequest, "请求体格式错误")
			return
		}

		note, err := queries.CreateNote(r.Context(), h.DB, input.Title, input.Content)
		if err != nil {
			slog.Error("创建笔记失败", "error", err)
			model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
			return
		}
		model.RespondJSON(w, http.StatusCreated, note)
	}
}

func (h *Handler) UpdateNote() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		db := h.DB
		id := r.PathValue("id")

		var input model.NoteInput
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			model.RespondError(w, http.StatusBadRequest, "请求体格式错误")
			return
		}

		existing, err := queries.GetNote(r.Context(), db, id)
		if err != nil {
			slog.Error("获取笔记失败", "error", err, "id", id)
			model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
			return
		}
		if existing == nil {
			model.RespondError(w, http.StatusNotFound, "笔记不存在")
			return
		}

		title := existing.Title
		if input.Title != "" {
			title = input.Title
		}
		content := existing.Content
		if input.Content != "" {
			content = input.Content
		}

		_, err = queries.UpdateNote(r.Context(), db, id, title, content)
		if err != nil {
			slog.Error("更新笔记失败", "error", err, "id", id)
			model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
			return
		}

		updated, err := queries.GetNote(r.Context(), db, id)
		if err != nil {
			slog.Error("获取更新后笔记失败", "error", err, "id", id)
			model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
			return
		}
		model.RespondJSON(w, http.StatusOK, updated)
	}
}

func (h *Handler) DeleteNote() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		db := h.DB
		id := r.PathValue("id")

		existing, err := queries.GetNote(r.Context(), db, id)
		if err != nil {
			slog.Error("获取笔记失败", "error", err, "id", id)
			model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
			return
		}
		if existing == nil {
			model.RespondError(w, http.StatusNotFound, "笔记不存在")
			return
		}

		if err := queries.DeleteNote(r.Context(), db, id); err != nil {
			slog.Error("删除笔记失败", "error", err, "id", id)
			model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
			return
		}
		model.RespondJSON(w, http.StatusOK, map[string]any{"success": true})
	}
}
