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
// sessionMW protects write endpoints with session cookie auth.
func (h *Handler) RegisterRoutes(mux *http.ServeMux, sessionMW func(http.Handler) http.Handler) {
	// Health check — always public
	mux.HandleFunc("GET /api/v1/health", func(w http.ResponseWriter, r *http.Request) {
		model.RespondJSON(w, http.StatusOK, map[string]any{"status": "ok", "time": model.Now()})
	})

	// Auth
	mux.Handle("POST /api/v1/auth/login", http.HandlerFunc(h.Login()))
	mux.Handle("POST /api/v1/auth/logout", http.HandlerFunc(h.Logout()))
	mux.Handle("GET /api/v1/auth/status", http.HandlerFunc(h.AuthStatus()))
	mux.Handle("POST /api/v1/auth/setup", http.HandlerFunc(h.Setup()))
	mux.Handle("POST /api/v1/auth/change-password", http.HandlerFunc(h.ChangePassword()))

	// Categories
	mux.Handle("GET /api/v1/categories", http.HandlerFunc(h.ListCategories()))
	mux.Handle("GET /api/v1/categories/{id}", http.HandlerFunc(h.GetCategory()))
	mux.Handle("POST /api/v1/categories", http.HandlerFunc(h.CreateCategory()))
	mux.Handle("PUT /api/v1/categories/{id}", http.HandlerFunc(h.UpdateCategory()))
	mux.Handle("DELETE /api/v1/categories/{id}", http.HandlerFunc(h.DeleteCategory()))

	// Bookmarks
	mux.Handle("GET /api/v1/bookmarks", http.HandlerFunc(h.ListBookmarks()))
	mux.Handle("GET /api/v1/bookmarks/{id}", http.HandlerFunc(h.GetBookmark()))
	mux.Handle("POST /api/v1/bookmarks", http.HandlerFunc(h.CreateBookmark()))
	mux.Handle("PUT /api/v1/bookmarks/{id}", http.HandlerFunc(h.UpdateBookmark()))
	mux.Handle("DELETE /api/v1/bookmarks/{id}", http.HandlerFunc(h.DeleteBookmark()))
	mux.Handle("PATCH /api/v1/bookmarks/reorder", http.HandlerFunc(h.ReorderBookmarks()))

	// Todos
	mux.Handle("GET /api/v1/todos", http.HandlerFunc(h.ListTodos()))
	mux.Handle("POST /api/v1/todos", http.HandlerFunc(h.CreateTodo()))
	mux.Handle("PUT /api/v1/todos/{id}", http.HandlerFunc(h.UpdateTodo()))
	mux.Handle("DELETE /api/v1/todos/{id}", http.HandlerFunc(h.DeleteTodo()))

	// Notes
	mux.Handle("GET /api/v1/notes", http.HandlerFunc(h.ListNotes()))
	mux.Handle("GET /api/v1/notes/{id}", http.HandlerFunc(h.GetNote()))
	mux.Handle("POST /api/v1/notes", http.HandlerFunc(h.CreateNote()))
	mux.Handle("PUT /api/v1/notes/{id}", http.HandlerFunc(h.UpdateNote()))
	mux.Handle("DELETE /api/v1/notes/{id}", http.HandlerFunc(h.DeleteNote()))

	// Settings
	mux.Handle("GET /api/v1/settings", http.HandlerFunc(h.ListSettings()))
	mux.Handle("GET /api/v1/settings/{key}", http.HandlerFunc(h.GetSetting()))
	mux.Handle("PUT /api/v1/settings", http.HandlerFunc(h.UpdateSettings()))
	mux.Handle("PUT /api/v1/settings/{key}", http.HandlerFunc(h.UpdateSetting()))

	// AI
	mux.Handle("POST /api/v1/ai/chat", http.HandlerFunc(h.AIChat()))
	mux.Handle("POST /api/v1/ai/conversation", http.HandlerFunc(h.AIConversation()))

	// SSH
	mux.Handle("GET /api/v1/ws/ssh", http.HandlerFunc(h.SSHWebSocket()))

	// Data / Upload / Parse / Suggest
	mux.Handle("GET /api/v1/data", http.HandlerFunc(h.GetData()))
	mux.Handle("PUT /api/v1/data", http.HandlerFunc(h.PutData()))
	mux.Handle("POST /api/v1/upload", http.HandlerFunc(h.Upload()))
	mux.Handle("GET /api/v1/parse", http.HandlerFunc(ParseURLHandler()))
	mux.Handle("GET /api/v1/suggest", http.HandlerFunc(SuggestHandler()))
	mux.Handle("GET /api/v1/search", http.HandlerFunc(SearchHandler(h.DB)))

	// Admin — Docker
	mux.Handle("GET /api/v1/admin/docker/containers", http.HandlerFunc(h.DockerContainers()))
	mux.Handle("GET /api/v1/admin/docker/stats", http.HandlerFunc(h.DockerStats()))
	mux.Handle("GET /api/v1/admin/docker/logs/{name}", http.HandlerFunc(h.DockerLogs()))
	mux.Handle("POST /api/v1/admin/docker/fetch-icon", http.HandlerFunc(FetchDockerIcon()))
	mux.Handle("GET /api/v1/admin/docker/metadata", http.HandlerFunc(h.GetDockerMetadata()))
	mux.Handle("PUT /api/v1/admin/docker/metadata/{name}", http.HandlerFunc(h.SetDockerMetadata()))
	mux.Handle("PUT /api/v1/admin/docker/reorder", http.HandlerFunc(h.ReorderContainers()))
	mux.Handle("POST /api/v1/admin/docker/{name}/{action}", http.HandlerFunc(h.DockerContainerAction()))

	// Admin — Monitor
	mux.Handle("GET /api/v1/admin/monitor/system", http.HandlerFunc(SystemInfo()))
	mux.Handle("GET /api/v1/admin/monitor/all", http.HandlerFunc(h.MonitorAll()))
	mux.Handle("GET /api/v1/admin/monitor/checks", http.HandlerFunc(h.ListChecks()))
	mux.Handle("POST /api/v1/admin/monitor/checks", http.HandlerFunc(h.CreateCheck()))
	mux.Handle("PUT /api/v1/admin/monitor/checks/{id}", http.HandlerFunc(h.UpdateCheck()))
	mux.Handle("DELETE /api/v1/admin/monitor/checks/{id}", http.HandlerFunc(h.DeleteCheck()))
	mux.Handle("POST /api/v1/admin/monitor/fetch-icon", http.HandlerFunc(FetchMonitorIcon()))
	mux.Handle("POST /api/v1/admin/monitor/wol/{id}", http.HandlerFunc(h.WOLById()))
	mux.Handle("POST /api/v1/admin/monitor/wol", http.HandlerFunc(WOLDirect()))

	// Admin — Backup / Logs / Uploads
	mux.Handle("GET /api/v1/admin/backup", http.HandlerFunc(h.ExportBackup()))
	mux.Handle("POST /api/v1/admin/backup", http.HandlerFunc(h.ImportBackup()))
	mux.Handle("GET /api/v1/admin/logs", http.HandlerFunc(h.Logs()))
	mux.Handle("GET /api/v1/admin/uploads", http.HandlerFunc(h.ListUploads()))
	mux.Handle("DELETE /api/v1/admin/uploads/{filename}", http.HandlerFunc(h.DeleteUpload()))
}
