package handler

import (
	"database/sql"
	"net/http"
	"strings"

	"github.com/YingXiaoMo/nav/internal/model"
)

// SearchResult 统一搜索结果条目
type SearchResult struct {
	Title string `json:"title"`
	URL   string `json:"url,omitempty"`
	Type  string `json:"type"` // bookmark / note / container / monitor
	Icon  string `json:"icon,omitempty"`
}

// SearchHandler handles GET /api/v1/search?q=xxx.
func SearchHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		q := strings.TrimSpace(r.URL.Query().Get("q"))
		if q == "" {
			model.RespondJSON(w, http.StatusOK, []SearchResult{})
			return
		}
		qLower := strings.ToLower(q)

		// 转义 LIKE 通配符：否则 q=% 等于全表扫描，匿名可批量枚举内容
		escapeLike := func(s string) string {
			s = strings.ReplaceAll(s, `\`, `\\`)
			s = strings.ReplaceAll(s, `%`, `\%`)
			s = strings.ReplaceAll(s, `_`, `\_`)
			return s
		}
		pattern := "%" + escapeLike(qLower) + "%"

		results := make([]SearchResult, 0, 10)
		seen := make(map[string]bool)

		// 搜索书签（标题和 URL）
		rows, err := db.QueryContext(r.Context(),
			"SELECT title, url, COALESCE(icon,'') FROM bookmarks WHERE LOWER(title) LIKE ? ESCAPE '\\' OR LOWER(url) LIKE ? ESCAPE '\\' LIMIT 10",
			pattern, pattern,
		)
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var title, url, icon string
				if err := rows.Scan(&title, &url, &icon); err == nil && !seen[url] {
					seen[url] = true
					results = append(results, SearchResult{Title: title, URL: url, Type: "bookmark", Icon: icon})
				}
			}
		}

		// 搜索笔记
		noteRows, err := db.QueryContext(r.Context(),
			"SELECT title, content FROM notes WHERE LOWER(title) LIKE ? ESCAPE '\\' OR LOWER(content) LIKE ? ESCAPE '\\' LIMIT 5",
			pattern, pattern,
		)
		if err == nil {
			defer noteRows.Close()
			for noteRows.Next() {
				var title, content string
				if err := noteRows.Scan(&title, &content); err == nil {
					key := "note:" + title
					if !seen[key] {
						seen[key] = true
						results = append(results, SearchResult{Title: title, Type: "note"})
					}
				}
			}
		}

		// 搜索监控目标
		monRows, err := db.QueryContext(r.Context(),
			"SELECT name, url, COALESCE(icon,'') FROM monitor_targets WHERE LOWER(name) LIKE ? ESCAPE '\\' OR LOWER(url) LIKE ? ESCAPE '\\' LIMIT 5",
			pattern, pattern,
		)
		if err == nil {
			defer monRows.Close()
			for monRows.Next() {
				var name, url, icon string
				if err := monRows.Scan(&name, &url, &icon); err == nil && !seen[url] {
					seen[url] = true
					results = append(results, SearchResult{Title: name, URL: url, Type: "monitor", Icon: icon})
				}
			}
		}

		model.RespondJSON(w, http.StatusOK, results)
	}
}
