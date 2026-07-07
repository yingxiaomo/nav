package handler

import (
	"database/sql"
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/YingXiaoMo/nav/internal/db/queries"
	"github.com/YingXiaoMo/nav/internal/model"
)

var protectedSettings = map[string]bool{
	"api_token":          true,
	"admin_password_hash": true,
	"admin_salt":         true,
	"session_secret":     true,
}

func ListSettings(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		settings, err := queries.GetAllSettings(r.Context(), db)
		if err != nil {
			slog.Error("获取设置列表失败", "error", err)
			model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
			return
		}

		model.RespondJSON(w, http.StatusOK, settings)
	}
}

func GetSetting(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		key := r.PathValue("key")

		value, err := queries.GetSetting(r.Context(), db, key)
		if err != nil {
			slog.Error("获取设置失败", "error", err, "key", key)
			model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
			return
		}
		if value == "" {
			// Distinguish empty value from missing key
			all, err := queries.GetAllSettings(r.Context(), db)
			if err != nil {
				slog.Error("获取所有设置失败", "error", err)
				model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
				return
			}
			if _, exists := all[key]; !exists {
				model.RespondError(w, http.StatusNotFound, "配置项不存在")
				return
			}
		}

		model.RespondJSON(w, http.StatusOK, map[string]string{"key": key, "value": value})
	}
}

func UpdateSettings(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var body map[string]string
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

		stmt, err := tx.PrepareContext(r.Context(),
			"INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?")
		if err != nil {
			slog.Error("准备语句失败", "error", err)
			model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
			return
		}
		defer stmt.Close()

		for key, value := range body {
			if protectedSettings[key] {
				slog.Warn("跳过保护键", "key", key)
				continue
			}
			if _, err := stmt.ExecContext(r.Context(), key, value, value); err != nil {
				slog.Error("批量更新设置失败", "error", err, "key", key)
				model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
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

func UpdateSetting(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		key := r.PathValue("key")

		if protectedSettings[key] {
			model.RespondError(w, http.StatusForbidden, "不允许修改系统内部配置")
			return
		}

		var body struct {
			Value string `json:"value"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			model.RespondError(w, http.StatusBadRequest, "请求体格式错误")
			return
		}

		if err := queries.SetSetting(r.Context(), db, key, body.Value); err != nil {
			slog.Error("更新设置失败", "error", err, "key", key)
			model.RespondError(w, http.StatusInternalServerError, "服务器内部错误")
			return
		}

		model.RespondJSON(w, http.StatusOK, map[string]any{"success": true})
	}
}
