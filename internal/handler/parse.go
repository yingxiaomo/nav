package handler

import (
	"log/slog"
	"net/http"

	"github.com/YingXiaoMo/nav/internal/model"
	"github.com/YingXiaoMo/nav/internal/service"
)

// ParseURLHandler handles GET /api/v1/parse?url=<encoded-url>
// Fetches a webpage and returns its metadata (title, description, icon, og:image).
func ParseURLHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		rawURL := r.URL.Query().Get("url")
		if rawURL == "" {
			model.RespondError(w, http.StatusUnprocessableEntity, "缺少 url 参数")
			return
		}

		result, err := service.ParseURL(rawURL)
		if err != nil {
			slog.Warn("[parse] 解析失败", "url", rawURL, "error", err)
			model.RespondJSON(w, http.StatusUnprocessableEntity, map[string]string{"error": err.Error()})
			return
		}

		model.RespondJSON(w, http.StatusOK, result)
	}
}
