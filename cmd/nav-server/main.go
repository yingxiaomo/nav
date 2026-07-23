package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/YingXiaoMo/nav/internal/db"
	"github.com/YingXiaoMo/nav/internal/db/queries"
	"github.com/YingXiaoMo/nav/internal/handler"
	"github.com/YingXiaoMo/nav/internal/middleware"
	"github.com/YingXiaoMo/nav/internal/notify"
	"github.com/YingXiaoMo/nav/internal/remote"
	"github.com/YingXiaoMo/nav/internal/service"
	"github.com/YingXiaoMo/nav/internal/tgbot"
)

// Config 包装所有运行时配置
type Config struct {
	Port      int
	DBPath    string
	UploadDir string
	DataDir   string
	StaticDir string // 静态文件目录（全合一模式），空字符串表示不启用
}

// loadConfig 从环境变量读取配置
func loadConfig() Config {
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

	uploadDir := os.Getenv("UPLOAD_DIR")
	if uploadDir == "" {
		uploadDir = "./data/uploads"
	}

	dataDir := os.Getenv("DATA_DIR")
	if dataDir == "" {
		dataDir = "./data"
	}

	staticDir := "./public"
	if info, err := os.Stat(staticDir); err != nil || !info.IsDir() {
		staticDir = "" // 不启用全合一模式
	}

	return Config{
		Port:      port,
		DBPath:    dbPath,
		UploadDir: uploadDir,
		DataDir:   dataDir,
		StaticDir: staticDir,
	}
}

	// recoveryMiddleware 捕获 handler panic，防止服务崩溃
func recoveryMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if err := recover(); err != nil {
				slog.Error("handler panic 已恢复", "error", err, "path", r.URL.Path)
				http.Error(w, "Internal Server Error", http.StatusInternalServerError)
			}
		}()
		next.ServeHTTP(w, r)
	})
}

// run 执行服务初始化流程，可单元测试
func run(ctx context.Context, cfg Config) error {
	database, err := db.Open(cfg.DBPath)
	if err != nil {
		return fmt.Errorf("数据库初始化失败: %w", err)
	}
	defer database.Close()

	if err := db.Migrate(database); err != nil {
		return fmt.Errorf("数据库迁移失败: %w", err)
	}
	slog.Info("数据库初始化完成", "path", cfg.DBPath)

	if err := os.MkdirAll(cfg.UploadDir, 0755); err != nil {
		return fmt.Errorf("创建上传目录失败: %w", err)
	}

	// 启动后台清理任务
	handler.StartLoginAttemptsCleanup(ctx)
	tgbot.StartHistoryCleanup(ctx)

	// Docker service (optional)
	dockerSvc, err := service.NewDockerService()
	if err != nil {
		slog.Warn("Docker 服务初始化失败（无 Docker socket?）", "error", err)
	} else {
		slog.Info("Docker 服务初始化完成")
		defer dockerSvc.Close()
	}

	dockerMetaStore := service.NewDockerMetadataStore(cfg.DataDir + "/docker-metadata.json")

	// Health checker
	notifyCfg := notify.Config{CooldownMinutes: 30}
	if nv, err := queries.GetSetting(context.Background(), database, "monitor_notify"); err == nil && nv != "" {
		json.Unmarshal([]byte(nv), &notifyCfg)
	}
	var hcNotifier service.Notifier
	if notifyCfg.Enabled {
		hcNotifier = notify.NewSender(notifyCfg)
		slog.Info("监控通知已启用", "apprise", notifyCfg.AppriseURL != "")
	}
	healthChecker := service.NewHealthChecker(database, hcNotifier)
	healthChecker.Start(ctx)
	slog.Info("健康检查服务已启动")

	// Docker stats snapshotter
	var dockerSnap *service.DockerSnapshotter
	if dockerSvc != nil {
		dockerSnap = service.NewDockerSnapshotter(dockerSvc)
		dockerSnap.Start(ctx)
		slog.Info("Docker stats 快照服务已启动")
	}

	// Telegram Bot + device manager
	var tgBot *tgbot.Bot
	deviceMgr := remote.NewManager(remote.NewSSHExec())
	if devCfg, err := queries.GetSetting(context.Background(), database, "device_config"); err == nil {
		deviceMgr.Load(devCfg)
	}
	if bt, err := queries.GetSetting(context.Background(), database, "bot_config"); err == nil && bt != "" {
		var bc tgbot.BotConfig
		if json.Unmarshal([]byte(bt), &bc) == nil && bc.Token != "" {
			tgBot = tgbot.NewBot(bc)
			cmdHandler := &tgbot.CmdHandler{
				Health:  healthChecker,
				Docker:  dockerSvc,
				Devices: deviceMgr,
				DB:      database,
			}
			if aiCfgStr, err := queries.GetSetting(context.Background(), database, "ai_config"); err == nil && aiCfgStr != "" {
				var aiCfg tgbot.LLMConfig
				json.Unmarshal([]byte(aiCfgStr), &aiCfg)
				cmdHandler.LLM = aiCfg
			}
			tgBot.Start(cmdHandler)
			slog.Info("TG Bot 已启动")
		}
	}

	mux := http.NewServeMux()
	app := &handler.Handler{
		DB:            database,
		HealthChecker: healthChecker,
		DockerSvc:     dockerSvc,
		DockerMeta:    dockerMetaStore,
		DockerSnap:    dockerSnap,
		UploadDir:     cfg.UploadDir,
		DataDir:       cfg.DataDir,
	}

		app.RegisterRoutes(mux)

	// Wrap with session auth (protects all POST/PUT/DELETE/PATCH)
	muxWithAuth := middleware.SessionAuth(database)(mux)

	// Uploads
	mux.Handle("GET /uploads/", http.StripPrefix("/uploads/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/") {
			http.NotFound(w, r)
			return
		}
		http.FileServer(http.Dir(cfg.UploadDir)).ServeHTTP(w, r)
	})))

	// All-in-one static serving
	if cfg.StaticDir != "" {
		slog.Info("检测到静态文件，启用合体模式", "dir", cfg.StaticDir)
		mux.Handle("GET /admin", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			http.ServeFile(w, r, cfg.StaticDir+"/admin.html")
		}))
		mux.Handle("GET /", http.FileServer(http.Dir(cfg.StaticDir)))
	}

	handler := recoveryMiddleware(muxWithAuth)

	srv := &http.Server{
		Addr:         ":" + strconv.Itoa(cfg.Port),
		Handler:      handler,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	// Graceful shutdown
	go func() {
		<-ctx.Done()
		slog.Info("收到关闭信号，开始优雅关闭...")
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()
		srv.Shutdown(shutdownCtx)
		healthChecker.Stop()
		slog.Info("服务已完全关闭")
	}()

	slog.Info("Nav Server 启动", "addr", srv.Addr)
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		return fmt.Errorf("服务异常退出: %w", err)
	}
	return nil
}

func main() {
	if len(os.Args) > 1 && os.Args[1] == "healthcheck" {
		healthcheckMain()
		return
	}

	cfg := loadConfig()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go func() {
		sigCh := make(chan os.Signal, 1)
		signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
		<-sigCh
		cancel()
	}()

	if err := run(ctx, cfg); err != nil {
		slog.Error("服务启动失败", "error", err)
		os.Exit(1)
	}
}

// healthcheckMain 用于 scratch 镜像容器健康检查
func healthcheckMain() {
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
