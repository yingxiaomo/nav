package handler

import (
	"database/sql"
	"net/http"

	"github.com/YingXiaoMo/nav/internal/model"
	"github.com/YingXiaoMo/nav/internal/remote"
	"github.com/YingXiaoMo/nav/internal/service"
	"github.com/YingXiaoMo/nav/internal/tgbot"
)

// Handler holds all dependencies for HTTP handlers.
type Handler struct {
	DB            *sql.DB
	HealthChecker *service.HealthChecker
	DockerSvc     *service.DockerService
	DockerMeta    *service.DockerMetadataStore
	DockerSnap    *service.DockerSnapshotter
	TGBot         *tgbot.Bot
	DeviceMgr     *remote.Manager
	UploadDir     string
	DataDir       string
}

// RegisterRoutes registers all API routes on the given ServeMux.
// adminMW protects write endpoints with session cookie auth.
func (h *Handler) RegisterRoutes(mux *http.ServeMux, adminMW func(http.Handler) http.Handler) {
	// Health check — always public
	mux.HandleFunc("GET /api/v1/health", func(w http.ResponseWriter, r *http.Request) {
		model.RespondJSON(w, http.StatusOK, map[string]any{"status": "ok", "time": model.Now()})
	})

	// Auth
	mux.Handle("POST /api/v1/auth/login", adminMW(http.HandlerFunc(h.Login())))
	mux.Handle("POST /api/v1/auth/logout", adminMW(http.HandlerFunc(h.Logout())))
	mux.Handle("GET /api/v1/auth/status", adminMW(http.HandlerFunc(h.AuthStatus())))
	mux.Handle("POST /api/v1/auth/setup", adminMW(http.HandlerFunc(h.Setup())))
	mux.Handle("POST /api/v1/auth/change-password", adminMW(http.HandlerFunc(h.ChangePassword())))

	// Categories
	mux.Handle("GET /api/v1/categories", http.HandlerFunc(h.ListCategories()))
	mux.Handle("GET /api/v1/categories/{id}", http.HandlerFunc(h.GetCategory()))
	mux.Handle("POST /api/v1/categories", adminMW(http.HandlerFunc(h.CreateCategory())))
	mux.Handle("PUT /api/v1/categories/{id}", adminMW(http.HandlerFunc(h.UpdateCategory())))
	mux.Handle("DELETE /api/v1/categories/{id}", adminMW(http.HandlerFunc(h.DeleteCategory())))

	// Bookmarks
	mux.Handle("GET /api/v1/bookmarks", http.HandlerFunc(h.ListBookmarks()))
	mux.Handle("GET /api/v1/bookmarks/{id}", http.HandlerFunc(h.GetBookmark()))
	mux.Handle("POST /api/v1/bookmarks", adminMW(http.HandlerFunc(h.CreateBookmark())))
	mux.Handle("PUT /api/v1/bookmarks/{id}", adminMW(http.HandlerFunc(h.UpdateBookmark())))
	mux.Handle("DELETE /api/v1/bookmarks/{id}", adminMW(http.HandlerFunc(h.DeleteBookmark())))
	mux.Handle("PATCH /api/v1/bookmarks/reorder", adminMW(http.HandlerFunc(h.ReorderBookmarks())))

	// Todos
	mux.Handle("GET /api/v1/todos", http.HandlerFunc(h.ListTodos()))
	mux.Handle("POST /api/v1/todos", adminMW(http.HandlerFunc(h.CreateTodo())))
	mux.Handle("PUT /api/v1/todos/{id}", adminMW(http.HandlerFunc(h.UpdateTodo())))
	mux.Handle("DELETE /api/v1/todos/{id}", adminMW(http.HandlerFunc(h.DeleteTodo())))

	// Notes
	mux.Handle("GET /api/v1/notes", http.HandlerFunc(h.ListNotes()))
	mux.Handle("GET /api/v1/notes/{id}", http.HandlerFunc(h.GetNote()))
	mux.Handle("POST /api/v1/notes", adminMW(http.HandlerFunc(h.CreateNote())))
	mux.Handle("PUT /api/v1/notes/{id}", adminMW(http.HandlerFunc(h.UpdateNote())))
	mux.Handle("DELETE /api/v1/notes/{id}", adminMW(http.HandlerFunc(h.DeleteNote())))

	// Settings
	mux.Handle("GET /api/v1/settings", adminMW(http.HandlerFunc(h.ListSettings())))
	mux.Handle("GET /api/v1/settings/{key}", adminMW(http.HandlerFunc(h.GetSetting())))
	mux.Handle("PUT /api/v1/settings", adminMW(http.HandlerFunc(h.UpdateSettings())))
	mux.Handle("PUT /api/v1/settings/{key}", adminMW(http.HandlerFunc(h.UpdateSetting())))

	// Data / Upload / Parse / Suggest
	mux.Handle("GET /api/v1/data", adminMW(http.HandlerFunc(h.GetData())))
	mux.Handle("PUT /api/v1/data", adminMW(http.HandlerFunc(h.PutData())))
	mux.Handle("POST /api/v1/upload", adminMW(http.HandlerFunc(h.Upload())))
	mux.Handle("GET /api/v1/parse", adminMW(http.HandlerFunc(ParseURLHandler())))
	mux.Handle("GET /api/v1/suggest", adminMW(http.HandlerFunc(SuggestHandler())))
	mux.Handle("GET /api/v1/search", adminMW(http.HandlerFunc(SearchHandler(h.DB))))

	// Admin — Docker
	mux.Handle("GET /api/v1/admin/docker/containers", adminMW(http.HandlerFunc(h.DockerContainers())))
	mux.Handle("GET /api/v1/admin/docker/stats", adminMW(http.HandlerFunc(h.DockerStats())))
	mux.Handle("GET /api/v1/admin/docker/logs/{name}", adminMW(http.HandlerFunc(h.DockerLogs())))
	mux.Handle("POST /api/v1/admin/docker/fetch-icon", adminMW(http.HandlerFunc(FetchDockerIcon())))
	mux.Handle("GET /api/v1/admin/docker/metadata", adminMW(http.HandlerFunc(h.GetDockerMetadata())))
	mux.Handle("PUT /api/v1/admin/docker/metadata/{name}", adminMW(http.HandlerFunc(h.SetDockerMetadata())))
	mux.Handle("PUT /api/v1/admin/docker/reorder", adminMW(http.HandlerFunc(h.ReorderContainers())))
	mux.Handle("POST /api/v1/admin/docker/{name}/start", adminMW(http.HandlerFunc(h.DockerStartContainer())))
	mux.Handle("POST /api/v1/admin/docker/{name}/stop", adminMW(http.HandlerFunc(h.DockerStopContainer())))
	mux.Handle("POST /api/v1/admin/docker/{name}/restart", adminMW(http.HandlerFunc(h.DockerRestartContainer())))

	// Admin — Monitor
	mux.Handle("GET /api/v1/admin/monitor/system", adminMW(http.HandlerFunc(SystemInfo())))
	mux.Handle("GET /api/v1/admin/monitor/all", adminMW(http.HandlerFunc(h.MonitorAll())))
	mux.Handle("GET /api/v1/admin/monitor/checks", adminMW(http.HandlerFunc(h.ListChecks())))
	mux.Handle("POST /api/v1/admin/monitor/checks", adminMW(http.HandlerFunc(h.CreateCheck())))
	mux.Handle("PUT /api/v1/admin/monitor/checks/{id}", adminMW(http.HandlerFunc(h.UpdateCheck())))
	mux.Handle("DELETE /api/v1/admin/monitor/checks/{id}", adminMW(http.HandlerFunc(h.DeleteCheck())))
	mux.Handle("POST /api/v1/admin/monitor/fetch-icon", adminMW(http.HandlerFunc(FetchMonitorIcon())))
	mux.Handle("POST /api/v1/admin/monitor/wol/{id}", adminMW(http.HandlerFunc(h.WOLById())))
	mux.Handle("POST /api/v1/admin/monitor/wol", adminMW(http.HandlerFunc(WOLDirect())))

	// Admin — Backup / Logs / Uploads
	mux.Handle("GET /api/v1/admin/backup", adminMW(http.HandlerFunc(h.ExportBackup())))
	mux.Handle("POST /api/v1/admin/backup", adminMW(http.HandlerFunc(h.ImportBackup())))
	mux.Handle("GET /api/v1/admin/logs", adminMW(http.HandlerFunc(h.Logs())))
	mux.Handle("GET /api/v1/admin/uploads", adminMW(http.HandlerFunc(h.ListUploads())))
	mux.Handle("DELETE /api/v1/admin/uploads/{filename}", adminMW(http.HandlerFunc(h.DeleteUpload())))
}
