package main

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"os"
	"strconv"
	"strings"

	"github.com/YingXiaoMo/nav/internal/db"
	"github.com/YingXiaoMo/nav/internal/handler"
	"github.com/YingXiaoMo/nav/internal/middleware"
	"github.com/YingXiaoMo/nav/internal/model"
	"github.com/YingXiaoMo/nav/internal/service"
)

func main() {
	// healthcheck 子命令：scratch 镜像容器健康检查用
	if len(os.Args) > 1 && os.Args[1] == "healthcheck" {
		port := "8642"
		if p := os.Getenv("PORT"); p != "" {
			port = p
		}
		resp, err := http.Get("http://127.0.0.1:" + port + "/api/v1/health")
		if err != nil || resp.StatusCode != 200 {
			os.Exit(1)
		}
		os.Exit(0)
	}

	port := 8642
	if p := os.Getenv("PORT"); p != "" {
		if v, err := strconv.Atoi(p); err == nil {
			port = v
		}
	}
	dbPath := os.Getenv("DATABASE_URL")
	if dbPath == "" {
		dbPath = "./data/nav.db"
	}

	database, err := db.Open(dbPath)
	if err != nil {
		slog.Error("数据库初始化失败", "error", err)
		os.Exit(1)
	}
	defer database.Close()
	if err := db.Migrate(database); err != nil {
		slog.Error("数据库迁移失败", "error", err)
		os.Exit(1)
	}
	slog.Info("数据库初始化完成", "path", dbPath)

	uploadDir := os.Getenv("UPLOAD_DIR")
	if uploadDir == "" {
		uploadDir = "./data/uploads"
	}
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		slog.Error("创建上传目录失败", "error", err)
		os.Exit(1)
	}

	// Initialize Docker service (optional — may not have Docker socket)
	dockerSvc, err := service.NewDockerService()
	if err != nil {
		slog.Warn("Docker 服务初始化失败（无 Docker socket?）", "error", err)
	} else {
		slog.Info("Docker 服务初始化完成")
		defer dockerSvc.Close()
	}

	// Initialize Docker metadata store
	dataDir := os.Getenv("DATA_DIR")
	if dataDir == "" {
		dataDir = "./data"
	}
	dockerMetaStore := service.NewDockerMetadataStore(dataDir + "/docker-metadata.json")

	// Initialize health checker
	healthChecker := service.NewHealthChecker(database)
	healthChecker.Start(context.Background())
	defer healthChecker.Stop()
	slog.Info("健康检查服务已启动")

	corsOrigin := os.Getenv("CORS_ORIGIN")
	if corsOrigin == "" {
		corsOrigin = "*"
	}

	mux := http.NewServeMux()

	mux.HandleFunc("GET /api/v1/health", func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]any{"status": "ok", "time": model.Now()})
	})

	adminMW := middleware.Admin(database)
	mux.Handle("POST /api/v1/auth/login", adminMW(http.HandlerFunc(handler.Login(database))))
	mux.Handle("POST /api/v1/auth/logout", adminMW(http.HandlerFunc(handler.Logout(database))))
	mux.Handle("GET /api/v1/auth/status", adminMW(http.HandlerFunc(handler.AuthStatus(database))))
	mux.Handle("POST /api/v1/auth/setup", adminMW(http.HandlerFunc(handler.Setup(database))))
	mux.Handle("GET /api/v1/auth/api-token", adminMW(http.HandlerFunc(handler.GetAPIToken(database))))
	mux.Handle("POST /api/v1/auth/api-token", adminMW(http.HandlerFunc(handler.RegenerateAPIToken(database))))
	mux.Handle("POST /api/v1/auth/change-password", adminMW(http.HandlerFunc(handler.ChangePassword(database))))

	// API routes (token or same-origin auth)
	authMW := middleware.Auth(database)
	mux.Handle("GET /api/v1/categories", authMW(http.HandlerFunc(handler.ListCategories(database))))
	mux.Handle("GET /api/v1/categories/{id}", authMW(http.HandlerFunc(handler.GetCategory(database))))
	mux.Handle("POST /api/v1/categories", authMW(http.HandlerFunc(handler.CreateCategory(database))))
	mux.Handle("PUT /api/v1/categories/{id}", authMW(http.HandlerFunc(handler.UpdateCategory(database))))
	mux.Handle("DELETE /api/v1/categories/{id}", authMW(http.HandlerFunc(handler.DeleteCategory(database))))

	mux.Handle("GET /api/v1/bookmarks", authMW(http.HandlerFunc(handler.ListBookmarks(database))))
	mux.Handle("GET /api/v1/bookmarks/{id}", authMW(http.HandlerFunc(handler.GetBookmark(database))))
	mux.Handle("POST /api/v1/bookmarks", authMW(http.HandlerFunc(handler.CreateBookmark(database))))
	mux.Handle("PUT /api/v1/bookmarks/{id}", authMW(http.HandlerFunc(handler.UpdateBookmark(database))))
	mux.Handle("DELETE /api/v1/bookmarks/{id}", authMW(http.HandlerFunc(handler.DeleteBookmark(database))))
	mux.Handle("PATCH /api/v1/bookmarks/reorder", authMW(http.HandlerFunc(handler.ReorderBookmarks(database))))

	mux.Handle("GET /api/v1/todos", authMW(http.HandlerFunc(handler.ListTodos(database))))
	mux.Handle("POST /api/v1/todos", authMW(http.HandlerFunc(handler.CreateTodo(database))))
	mux.Handle("PUT /api/v1/todos/{id}", authMW(http.HandlerFunc(handler.UpdateTodo(database))))
	mux.Handle("DELETE /api/v1/todos/{id}", authMW(http.HandlerFunc(handler.DeleteTodo(database))))

	mux.Handle("GET /api/v1/notes", authMW(http.HandlerFunc(handler.ListNotes(database))))
	mux.Handle("GET /api/v1/notes/{id}", authMW(http.HandlerFunc(handler.GetNote(database))))
	mux.Handle("POST /api/v1/notes", authMW(http.HandlerFunc(handler.CreateNote(database))))
	mux.Handle("PUT /api/v1/notes/{id}", authMW(http.HandlerFunc(handler.UpdateNote(database))))
	mux.Handle("DELETE /api/v1/notes/{id}", authMW(http.HandlerFunc(handler.DeleteNote(database))))

	mux.Handle("GET /api/v1/settings", authMW(http.HandlerFunc(handler.ListSettings(database))))
	mux.Handle("GET /api/v1/settings/{key}", authMW(http.HandlerFunc(handler.GetSetting(database))))
	mux.Handle("PUT /api/v1/settings", authMW(http.HandlerFunc(handler.UpdateSettings(database))))
	mux.Handle("PUT /api/v1/settings/{key}", authMW(http.HandlerFunc(handler.UpdateSetting(database))))

	mux.Handle("GET /api/v1/data", authMW(http.HandlerFunc(handler.GetData(database))))
	mux.Handle("PUT /api/v1/data", authMW(http.HandlerFunc(handler.PutData(database))))
	mux.Handle("POST /api/v1/upload", authMW(http.HandlerFunc(handler.Upload(uploadDir))))

	mux.Handle("GET /api/v1/parse", authMW(http.HandlerFunc(handler.ParseURLHandler())))
	mux.Handle("GET /api/v1/suggest", authMW(http.HandlerFunc(handler.SuggestHandler())))

	// Admin routes (protected by admin auth middleware)
	mux.Handle("GET /api/v1/admin/logs", adminMW(http.HandlerFunc(handler.Logs(dataDir))))
	mux.Handle("GET /api/v1/admin/backup", adminMW(http.HandlerFunc(handler.ExportBackup(database))))
	mux.Handle("POST /api/v1/admin/backup", adminMW(http.HandlerFunc(handler.ImportBackup(database))))
	mux.Handle("GET /api/v1/admin/docker/containers", adminMW(http.HandlerFunc(handler.DockerContainers(dockerSvc))))
	mux.Handle("GET /api/v1/admin/docker/stats", adminMW(http.HandlerFunc(handler.DockerStats(dockerSvc))))
	mux.Handle("GET /api/v1/admin/docker/logs/{name}", adminMW(http.HandlerFunc(handler.DockerLogs(dockerSvc))))
	mux.Handle("GET /api/v1/admin/uploads", adminMW(http.HandlerFunc(handler.ListUploads(uploadDir))))
	mux.Handle("DELETE /api/v1/admin/uploads/{filename}", adminMW(http.HandlerFunc(handler.DeleteUpload(uploadDir))))
	mux.Handle("POST /api/v1/admin/docker/fetch-icon", adminMW(http.HandlerFunc(handler.FetchDockerIcon())))
	mux.Handle("GET /api/v1/admin/docker/metadata", adminMW(http.HandlerFunc(handler.GetDockerMetadata(dockerMetaStore))))
	mux.Handle("PUT /api/v1/admin/docker/metadata/{name}", adminMW(http.HandlerFunc(handler.SetDockerMetadata(dockerMetaStore))))
	mux.Handle("POST /api/v1/admin/docker/{name}/start", adminMW(http.HandlerFunc(handler.DockerStartContainer(dockerSvc))))
	mux.Handle("POST /api/v1/admin/docker/{name}/stop", adminMW(http.HandlerFunc(handler.DockerStopContainer(dockerSvc))))
	mux.Handle("POST /api/v1/admin/docker/{name}/restart", adminMW(http.HandlerFunc(handler.DockerRestartContainer(dockerSvc))))

	// Monitor routes (protected by admin auth middleware)
	mux.Handle("GET /api/v1/admin/monitor/system", adminMW(http.HandlerFunc(handler.SystemInfo())))
	mux.Handle("GET /api/v1/admin/monitor/checks", adminMW(http.HandlerFunc(handler.ListChecks(healthChecker))))
	mux.Handle("POST /api/v1/admin/monitor/checks", adminMW(http.HandlerFunc(handler.CreateCheck(database, healthChecker))))
	mux.Handle("PUT /api/v1/admin/monitor/checks/{id}", adminMW(http.HandlerFunc(handler.UpdateCheck(database, healthChecker))))
	mux.Handle("DELETE /api/v1/admin/monitor/checks/{id}", adminMW(http.HandlerFunc(handler.DeleteCheck(database, healthChecker))))
	mux.Handle("POST /api/v1/admin/monitor/fetch-icon", adminMW(http.HandlerFunc(handler.FetchMonitorIcon())))
	mux.Handle("POST /api/v1/admin/monitor/wol/{id}", adminMW(http.HandlerFunc(handler.WOLById(database))))
	mux.Handle("POST /api/v1/admin/monitor/wol", adminMW(http.HandlerFunc(handler.WOLDirect())))

	mux.Handle("GET /uploads/", http.StripPrefix("/uploads/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/") {
			http.NotFound(w, r)
			return
		}
		http.FileServer(http.Dir(uploadDir)).ServeHTTP(w, r)
	})))

	// All-in-one mode: serve static frontend if ./public exists
	staticDir := "./public"
	if info, err := os.Stat(staticDir); err == nil && info.IsDir() {
		slog.Info("检测到静态文件，启用合体模式", "dir", staticDir)
		mux.Handle("GET /admin", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			http.ServeFile(w, r, staticDir+"/admin.html")
		}))
		mux.Handle("GET /", http.FileServer(http.Dir(staticDir)))
	}

	h := middleware.CORS(corsOrigin)(mux)

	addr := ":" + strconv.Itoa(port)
	slog.Info("Nav Server 启动", "addr", addr)
	if err := http.ListenAndServe(addr, h); err != nil {
		slog.Error("服务启动失败", "error", err)
		os.Exit(1)
	}
}
