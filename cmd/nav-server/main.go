package main

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

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

	app := &handler.Handler{
		DB:            database,
		HealthChecker: healthChecker,
		DockerSvc:     dockerSvc,
		DockerMeta:    dockerMetaStore,
		UploadDir:     uploadDir,
		DataDir:       dataDir,
	}

	adminMW := middleware.Admin(database)
	mux.Handle("POST /api/v1/auth/login", adminMW(http.HandlerFunc(app.Login())))
	mux.Handle("POST /api/v1/auth/logout", adminMW(http.HandlerFunc(app.Logout())))
	mux.Handle("GET /api/v1/auth/status", adminMW(http.HandlerFunc(app.AuthStatus())))
	mux.Handle("POST /api/v1/auth/setup", adminMW(http.HandlerFunc(app.Setup())))
	mux.Handle("GET /api/v1/auth/api-token", adminMW(http.HandlerFunc(app.GetAPIToken())))
	mux.Handle("POST /api/v1/auth/api-token", adminMW(http.HandlerFunc(app.RegenerateAPIToken())))
	mux.Handle("POST /api/v1/auth/change-password", adminMW(http.HandlerFunc(app.ChangePassword())))

	// API routes (token or same-origin auth)
	authMW := middleware.Auth(database)
	mux.Handle("GET /api/v1/categories", authMW(http.HandlerFunc(app.ListCategories())))
	mux.Handle("GET /api/v1/categories/{id}", authMW(http.HandlerFunc(app.GetCategory())))
	mux.Handle("POST /api/v1/categories", authMW(http.HandlerFunc(app.CreateCategory())))
	mux.Handle("PUT /api/v1/categories/{id}", authMW(http.HandlerFunc(app.UpdateCategory())))
	mux.Handle("DELETE /api/v1/categories/{id}", authMW(http.HandlerFunc(app.DeleteCategory())))

	mux.Handle("GET /api/v1/bookmarks", authMW(http.HandlerFunc(app.ListBookmarks())))
	mux.Handle("GET /api/v1/bookmarks/{id}", authMW(http.HandlerFunc(app.GetBookmark())))
	mux.Handle("POST /api/v1/bookmarks", authMW(http.HandlerFunc(app.CreateBookmark())))
	mux.Handle("PUT /api/v1/bookmarks/{id}", authMW(http.HandlerFunc(app.UpdateBookmark())))
	mux.Handle("DELETE /api/v1/bookmarks/{id}", authMW(http.HandlerFunc(app.DeleteBookmark())))
	mux.Handle("PATCH /api/v1/bookmarks/reorder", authMW(http.HandlerFunc(app.ReorderBookmarks())))

	mux.Handle("GET /api/v1/todos", authMW(http.HandlerFunc(app.ListTodos())))
	mux.Handle("POST /api/v1/todos", authMW(http.HandlerFunc(app.CreateTodo())))
	mux.Handle("PUT /api/v1/todos/{id}", authMW(http.HandlerFunc(app.UpdateTodo())))
	mux.Handle("DELETE /api/v1/todos/{id}", authMW(http.HandlerFunc(app.DeleteTodo())))

	mux.Handle("GET /api/v1/notes", authMW(http.HandlerFunc(app.ListNotes())))
	mux.Handle("GET /api/v1/notes/{id}", authMW(http.HandlerFunc(app.GetNote())))
	mux.Handle("POST /api/v1/notes", authMW(http.HandlerFunc(app.CreateNote())))
	mux.Handle("PUT /api/v1/notes/{id}", authMW(http.HandlerFunc(app.UpdateNote())))
	mux.Handle("DELETE /api/v1/notes/{id}", authMW(http.HandlerFunc(app.DeleteNote())))

	mux.Handle("GET /api/v1/settings", authMW(http.HandlerFunc(app.ListSettings())))
	mux.Handle("GET /api/v1/settings/{key}", authMW(http.HandlerFunc(app.GetSetting())))
	mux.Handle("PUT /api/v1/settings", authMW(http.HandlerFunc(app.UpdateSettings())))
	mux.Handle("PUT /api/v1/settings/{key}", authMW(http.HandlerFunc(app.UpdateSetting())))

	mux.Handle("GET /api/v1/data", authMW(http.HandlerFunc(app.GetData())))
	mux.Handle("PUT /api/v1/data", authMW(http.HandlerFunc(app.PutData())))
	mux.Handle("POST /api/v1/upload", authMW(http.HandlerFunc(app.Upload())))

	mux.Handle("GET /api/v1/parse", authMW(http.HandlerFunc(handler.ParseURLHandler())))
	mux.Handle("GET /api/v1/suggest", authMW(http.HandlerFunc(handler.SuggestHandler())))

	// Admin routes (protected by admin auth middleware)
	mux.Handle("GET /api/v1/admin/logs", adminMW(http.HandlerFunc(app.Logs())))
	mux.Handle("GET /api/v1/admin/backup", adminMW(http.HandlerFunc(app.ExportBackup())))
	mux.Handle("POST /api/v1/admin/backup", adminMW(http.HandlerFunc(app.ImportBackup())))
	mux.Handle("GET /api/v1/admin/docker/containers", adminMW(http.HandlerFunc(app.DockerContainers())))
	mux.Handle("GET /api/v1/admin/docker/stats", adminMW(http.HandlerFunc(app.DockerStats())))
	mux.Handle("GET /api/v1/admin/docker/logs/{name}", adminMW(http.HandlerFunc(app.DockerLogs())))
	mux.Handle("GET /api/v1/admin/uploads", adminMW(http.HandlerFunc(app.ListUploads())))
	mux.Handle("DELETE /api/v1/admin/uploads/{filename}", adminMW(http.HandlerFunc(app.DeleteUpload())))
	mux.Handle("POST /api/v1/admin/docker/fetch-icon", adminMW(http.HandlerFunc(handler.FetchDockerIcon())))
	mux.Handle("GET /api/v1/admin/docker/metadata", adminMW(http.HandlerFunc(app.GetDockerMetadata())))
	mux.Handle("PUT /api/v1/admin/docker/metadata/{name}", adminMW(http.HandlerFunc(app.SetDockerMetadata())))
	mux.Handle("POST /api/v1/admin/docker/{name}/start", adminMW(http.HandlerFunc(app.DockerStartContainer())))
	mux.Handle("POST /api/v1/admin/docker/{name}/stop", adminMW(http.HandlerFunc(app.DockerStopContainer())))
	mux.Handle("POST /api/v1/admin/docker/{name}/restart", adminMW(http.HandlerFunc(app.DockerRestartContainer())))

	// Monitor routes (protected by admin auth middleware)
	mux.Handle("GET /api/v1/admin/monitor/system", adminMW(http.HandlerFunc(handler.SystemInfo())))
	mux.Handle("GET /api/v1/admin/monitor/all", adminMW(http.HandlerFunc(app.MonitorAll())))
	mux.Handle("GET /api/v1/admin/monitor/checks", adminMW(http.HandlerFunc(app.ListChecks())))
	mux.Handle("POST /api/v1/admin/monitor/checks", adminMW(http.HandlerFunc(app.CreateCheck())))
	mux.Handle("PUT /api/v1/admin/monitor/checks/{id}", adminMW(http.HandlerFunc(app.UpdateCheck())))
	mux.Handle("DELETE /api/v1/admin/monitor/checks/{id}", adminMW(http.HandlerFunc(app.DeleteCheck())))
	mux.Handle("POST /api/v1/admin/monitor/fetch-icon", adminMW(http.HandlerFunc(handler.FetchMonitorIcon())))
	mux.Handle("POST /api/v1/admin/monitor/wol/{id}", adminMW(http.HandlerFunc(app.WOLById())))
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

	wrappedHandler := middleware.CORS(corsOrigin)(mux)

	srv := &http.Server{
		Addr:         ":" + strconv.Itoa(port),
		Handler:      wrappedHandler,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	// Start server in background goroutine
	go func() {
		slog.Info("Nav Server 启动", "addr", srv.Addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("服务异常退出", "error", err)
			os.Exit(1)
		}
	}()

	// Wait for interrupt signal for graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	sig := <-quit
	slog.Info("收到关闭信号，开始优雅关闭...", "signal", sig)

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		slog.Error("服务关闭超时", "error", err)
	}
	healthChecker.Stop()
	slog.Info("服务已完全关闭")
}
