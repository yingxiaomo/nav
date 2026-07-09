package handler

import (
	"database/sql"
	"net/http"

	"github.com/YingXiaoMo/nav/internal/service"
)

// Handler holds all dependencies for HTTP handlers.
type Handler struct {
	DB            *sql.DB
	HealthChecker *service.HealthChecker
	DockerSvc     *service.DockerService
	DockerMeta    *service.DockerMetadataStore
	DockerSnap    *service.DockerSnapshotter
	UploadDir     string
	DataDir       string
}

// RegisterRoutes registers all API routes on the given ServeMux.
// adminMW protects admin/auth endpoints; authMW protects general API endpoints.
func (h *Handler) RegisterRoutes(mux *http.ServeMux, adminMW, authMW func(http.Handler) http.Handler) {
	// Auth
	mux.Handle("POST /api/v1/auth/login", adminMW(http.HandlerFunc(h.Login())))
	mux.Handle("POST /api/v1/auth/logout", adminMW(http.HandlerFunc(h.Logout())))
	mux.Handle("GET /api/v1/auth/status", adminMW(http.HandlerFunc(h.AuthStatus())))
	mux.Handle("POST /api/v1/auth/setup", adminMW(http.HandlerFunc(h.Setup())))
	mux.Handle("GET /api/v1/auth/api-token", adminMW(http.HandlerFunc(h.GetAPIToken())))
	mux.Handle("POST /api/v1/auth/api-token", adminMW(http.HandlerFunc(h.RegenerateAPIToken())))
	mux.Handle("POST /api/v1/auth/change-password", adminMW(http.HandlerFunc(h.ChangePassword())))

	// Categories
	mux.Handle("GET /api/v1/categories", authMW(http.HandlerFunc(h.ListCategories())))
	mux.Handle("GET /api/v1/categories/{id}", authMW(http.HandlerFunc(h.GetCategory())))
	mux.Handle("POST /api/v1/categories", authMW(http.HandlerFunc(h.CreateCategory())))
	mux.Handle("PUT /api/v1/categories/{id}", authMW(http.HandlerFunc(h.UpdateCategory())))
	mux.Handle("DELETE /api/v1/categories/{id}", authMW(http.HandlerFunc(h.DeleteCategory())))

	// Bookmarks
	mux.Handle("GET /api/v1/bookmarks", authMW(http.HandlerFunc(h.ListBookmarks())))
	mux.Handle("GET /api/v1/bookmarks/{id}", authMW(http.HandlerFunc(h.GetBookmark())))
	mux.Handle("POST /api/v1/bookmarks", authMW(http.HandlerFunc(h.CreateBookmark())))
	mux.Handle("PUT /api/v1/bookmarks/{id}", authMW(http.HandlerFunc(h.UpdateBookmark())))
	mux.Handle("DELETE /api/v1/bookmarks/{id}", authMW(http.HandlerFunc(h.DeleteBookmark())))
	mux.Handle("PATCH /api/v1/bookmarks/reorder", authMW(http.HandlerFunc(h.ReorderBookmarks())))

	// Todos
	mux.Handle("GET /api/v1/todos", authMW(http.HandlerFunc(h.ListTodos())))
	mux.Handle("POST /api/v1/todos", authMW(http.HandlerFunc(h.CreateTodo())))
	mux.Handle("PUT /api/v1/todos/{id}", authMW(http.HandlerFunc(h.UpdateTodo())))
	mux.Handle("DELETE /api/v1/todos/{id}", authMW(http.HandlerFunc(h.DeleteTodo())))

	// Notes
	mux.Handle("GET /api/v1/notes", authMW(http.HandlerFunc(h.ListNotes())))
	mux.Handle("GET /api/v1/notes/{id}", authMW(http.HandlerFunc(h.GetNote())))
	mux.Handle("POST /api/v1/notes", authMW(http.HandlerFunc(h.CreateNote())))
	mux.Handle("PUT /api/v1/notes/{id}", authMW(http.HandlerFunc(h.UpdateNote())))
	mux.Handle("DELETE /api/v1/notes/{id}", authMW(http.HandlerFunc(h.DeleteNote())))

	// Settings
	mux.Handle("GET /api/v1/settings", authMW(http.HandlerFunc(h.ListSettings())))
	mux.Handle("GET /api/v1/settings/{key}", authMW(http.HandlerFunc(h.GetSetting())))
	mux.Handle("PUT /api/v1/settings", authMW(http.HandlerFunc(h.UpdateSettings())))
	mux.Handle("PUT /api/v1/settings/{key}", authMW(http.HandlerFunc(h.UpdateSetting())))

	// Data / Upload / Parse / Suggest
	mux.Handle("GET /api/v1/data", authMW(http.HandlerFunc(h.GetData())))
	mux.Handle("PUT /api/v1/data", authMW(http.HandlerFunc(h.PutData())))
	mux.Handle("POST /api/v1/upload", authMW(http.HandlerFunc(h.Upload())))
	mux.Handle("GET /api/v1/parse", authMW(http.HandlerFunc(ParseURLHandler())))
	mux.Handle("GET /api/v1/suggest", authMW(http.HandlerFunc(SuggestHandler())))

	// Admin — Docker
	mux.Handle("GET /api/v1/admin/docker/containers", adminMW(http.HandlerFunc(h.DockerContainers())))
	mux.Handle("GET /api/v1/admin/docker/stats", adminMW(http.HandlerFunc(h.DockerStats())))
	mux.Handle("GET /api/v1/admin/docker/logs/{name}", adminMW(http.HandlerFunc(h.DockerLogs())))
	mux.Handle("POST /api/v1/admin/docker/fetch-icon", adminMW(http.HandlerFunc(FetchDockerIcon())))
	mux.Handle("GET /api/v1/admin/docker/metadata", adminMW(http.HandlerFunc(h.GetDockerMetadata())))
	mux.Handle("PUT /api/v1/admin/docker/metadata/{name}", adminMW(http.HandlerFunc(h.SetDockerMetadata())))
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
