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
	"github.com/YingXiaoMo/nav/internal/db/queries"
	"github.com/YingXiaoMo/nav/internal/handler"
	"github.com/YingXiaoMo/nav/internal/middleware"
	"github.com/YingXiaoMo/nav/internal/notify"
	"github.com/YingXiaoMo/nav/internal/remote"
	"github.com/YingXiaoMo/nav/internal/service"
	"github.com/YingXiaoMo/nav/internal/tgbot"
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
	healthChecker.Start(context.Background())

	slog.Info("健康检查服务已启动")

	// Initialize Docker stats snapshotter（后台每 10s 轮询）
	var dockerSnap *service.DockerSnapshotter
	if dockerSvc != nil {
		dockerSnap = service.NewDockerSnapshotter(dockerSvc)
		dockerSnap.Start(context.Background())
		slog.Info("Docker stats 快照服务已启动")
	}

	// 启动 Telegram Bot（如果配置了 Token）
	var tgBot *tgbot.Bot
	// 初始化设备管理器（供 Bot SSH 控制使用）
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
			// 读取 AI 配置
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
		UploadDir:     uploadDir,
		DataDir:       dataDir,
	}

	adminMW := middleware.Admin(database)
	app.RegisterRoutes(mux, adminMW)

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

	srv := &http.Server{
		Addr: ":" + strconv.Itoa(port),
		Handler: mux,
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
