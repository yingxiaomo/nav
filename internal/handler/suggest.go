package handler

import (
	"log/slog"
	"net/http"

	"github.com/YingXiaoMo/nav/internal/model"
	"github.com/YingXiaoMo/nav/internal/service"
)

// SuggestHandler handles GET /api/v1/suggest?q=<query>&source=<source>
// Fetches search suggestions from the specified provider.
func SuggestHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query().Get("q")
		if q == "" {
			model.RespondError(w, http.StatusUnprocessableEntity, "缺少搜索关键词")
			return
		}
		if len(q) > 100 {
			model.RespondError(w, http.StatusUnprocessableEntity, "搜索关键词过长")
			return
		}

		source := r.URL.Query().Get("source")
		if source == "" {
			source = "duckduckgo"
		}

		result, err := service.GetSuggestions(q, source)
		if err != nil {
			slog.Warn("[suggest] 获取搜索建议失败", "q", q, "source", source, "error", err)
			model.RespondJSON(w, http.StatusUnprocessableEntity, map[string]any{
				"error":       err.Error(),
				"suggestions": []string{},
			})
			return
		}

		model.RespondJSON(w, http.StatusOK, result)
	}
}
