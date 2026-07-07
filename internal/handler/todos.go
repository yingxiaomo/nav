package handler

import (
	"database/sql"
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/YingXiaoMo/nav/internal/db/queries"
	"github.com/YingXiaoMo/nav/internal/model"
)

func ListTodos(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		todos, err := queries.GetAllTodos(r.Context(), db)
		if err != nil {
			slog.Error("获取待办列表失败", "error", err)
			model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
			return
		}

		model.RespondJSON(w, http.StatusOK, todos)
	}
}

func CreateTodo(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var input model.TodoInput
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			model.RespondError(w, http.StatusBadRequest, "请求体格式错误")
			return
		}
		if input.Text == "" {
			model.RespondError(w, http.StatusBadRequest, "内容不能为空")
			return
		}

		todo, err := queries.CreateTodo(r.Context(), db, input.Text)
		if err != nil {
			slog.Error("创建待办失败", "error", err)
			model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
			return
		}

		model.RespondJSON(w, http.StatusCreated, todo)
	}
}

func UpdateTodo(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")

		var input model.TodoInput
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			model.RespondError(w, http.StatusBadRequest, "请求体格式错误")
			return
		}

		existing, err := queries.GetTodo(r.Context(), db, id)
		if err != nil {
			slog.Error("获取待办失败", "error", err, "id", id)
			model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
			return
		}
		if existing == nil {
			model.RespondError(w, http.StatusNotFound, "待办不存在")
			return
		}

		// Merge: non-empty fields override existing values
		text := existing.Text
		if input.Text != "" {
			text = input.Text
		}
		completed := input.Completed // always use provided value for boolean

		_, err = queries.UpdateTodo(r.Context(), db, id, text, completed)
		if err != nil {
			slog.Error("更新待办失败", "error", err, "id", id)
			model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
			return
		}

		updated, err := queries.GetTodo(r.Context(), db, id)
		if err != nil {
			slog.Error("获取更新后待办失败", "error", err, "id", id)
			model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
			return
		}

		model.RespondJSON(w, http.StatusOK, updated)
	}
}

func DeleteTodo(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")

		existing, err := queries.GetTodo(r.Context(), db, id)
		if err != nil {
			slog.Error("获取待办失败", "error", err, "id", id)
			model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
			return
		}
		if existing == nil {
			model.RespondError(w, http.StatusNotFound, "待办不存在")
			return
		}

		if err := queries.DeleteTodo(r.Context(), db, id); err != nil {
			slog.Error("删除待办失败", "error", err, "id", id)
			model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
			return
		}

		model.RespondJSON(w, http.StatusOK, map[string]any{"success": true})
	}
}
