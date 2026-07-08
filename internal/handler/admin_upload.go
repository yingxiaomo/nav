package handler

import (
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"

	"github.com/YingXiaoMo/nav/internal/model"
)

// ===== Types =====

type uploadFile struct {
	Name  string `json:"name"`
	Size  int64  `json:"size"`
	MTime int64  `json:"mtime"`
}

// ===== Handlers =====

// Logs handles GET /api/v1/admin/logs.
// It reads the last N lines from nav-server.log in the data directory.
func (h *Handler) Logs() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		logPath := filepath.Join(h.DataDir, "nav-server.log")

		lines := 100
		if l := r.URL.Query().Get("lines"); l != "" {
			if n, err := strconv.Atoi(l); err == nil && n > 0 {
				lines = n
			}
		}

		data, err := os.ReadFile(logPath)
		if err != nil {
			model.RespondJSON(w, http.StatusOK, map[string]any{"lines": []string{}})
			return
		}

		content := strings.TrimRight(string(data), "\n")
		allLines := strings.Split(content, "\n")
		if lines > len(allLines) {
			lines = len(allLines)
		}
		lastLines := allLines[len(allLines)-lines:]

		model.RespondJSON(w, http.StatusOK, map[string]any{"lines": lastLines})
	}
}

// ListUploads handles GET /api/v1/admin/uploads.
// It lists all uploaded files sorted by mtime descending.
func (h *Handler) ListUploads() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		entries, err := os.ReadDir(h.UploadDir)
		if err != nil {
			model.RespondJSON(w, http.StatusOK, map[string]any{"files": []any{}})
			return
		}

		var files []uploadFile
		for _, entry := range entries {
			if entry.IsDir() {
				continue
			}
			name := strings.ToLower(entry.Name())
			if !strings.HasSuffix(name, ".png") && !strings.HasSuffix(name, ".jpg") &&
				!strings.HasSuffix(name, ".jpeg") && !strings.HasSuffix(name, ".gif") &&
				!strings.HasSuffix(name, ".svg") && !strings.HasSuffix(name, ".webp") &&
				!strings.HasSuffix(name, ".ico") {
				continue
			}

			info, err := entry.Info()
			if err != nil {
				continue
			}

			files = append(files, uploadFile{
				Name:  entry.Name(),
				Size:  info.Size(),
				MTime: info.ModTime().UnixMilli(),
			})
		}

		sort.Slice(files, func(i, j int) bool {
			return files[i].MTime > files[j].MTime
		})

		model.RespondJSON(w, http.StatusOK, map[string]any{"files": files})
	}
}

// DeleteUpload handles DELETE /api/v1/admin/uploads/{filename}.
func (h *Handler) DeleteUpload() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		filename := r.PathValue("filename")
		filename = cleanUploadFilename(filename)

		if filename == "" || strings.Contains(filename, "..") || strings.Contains(filename, "/") || strings.Contains(filename, "\\") {
			model.RespondError(w, http.StatusBadRequest, "无效的文件名")
			return
		}

		fp := filepath.Join(h.UploadDir, filename)
		if _, err := os.Stat(fp); os.IsNotExist(err) {
			model.RespondError(w, http.StatusNotFound, "文件不存在")
			return
		}
		if err := os.Remove(fp); err != nil {
			slog.Error("删除上传文件失败", "error", err)
			model.RespondError(w, http.StatusInternalServerError, "删除失败")
			return
		}

		model.RespondJSON(w, http.StatusOK, map[string]any{"success": true})
	}
}

// cleanUploadFilename sanitizes a filename to prevent path traversal.
func cleanUploadFilename(filename string) string {
	return filepath.Base(filepath.Clean(filename))
}
