<div align="center">
  <img src="./public/icon/logo.png" width="120" height="120" alt="Clean Nav Logo">
  <h1>Clean Nav</h1>
  <p><b>A lightweight, self-hosted navigation dashboard & server monitor for your homelab.</b></p>
  <p>极简 Homelab 导航页 · 服务监控 · Docker 管理 · 多端同步</p>

  <p>
    <a href="https://github.com/yingxiaomo/nav/blob/main/LICENSE">
      <img src="https://img.shields.io/badge/License-AGPL%20v3-blue.svg" alt="license" />
    </a>
    <a href="https://github.com/yingxiaomo/nav/stargazers">
      <img src="https://img.shields.io/github/stars/yingxiaomo/nav?style=flat-square" alt="stars" />
    </a>
    <a href="https://github.com/yingxiaomo/nav/network/members">
      <img src="https://img.shields.io/github/forks/yingxiaomo/nav?style=flat-square" alt="forks" />
    </a>
    <a href="https://github.com/yingxiaomo/nav/actions">
      <img src="https://img.shields.io/github/actions/workflow/status/yingxiaomo/nav/docker-publish.yml?style=flat-square" alt="build" />
    </a>
    <img src="https://img.shields.io/badge/Go-1.25-blue?style=flat-square&logo=go" alt="go" />
    <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react" alt="react" />
    <img src="https://img.shields.io/badge/docker%20image-15MB-2496ED?style=flat-square&logo=docker" alt="size" />
  </p>

  <p>
    <a href="https://nav.ovoxo.cc">🔴 演示地址 / Live Demo</a>
    &nbsp;·&nbsp;
    <a href="https://github.com/yingxiaomo/nav/pkgs/container/nav">
      🐳 ghcr.io/yingxiaomo/nav
    </a>
  </p>
</div>

<br>

**Clean Nav** is a homelab-focused navigation dashboard that combines a beautiful start page with a lightweight server management panel. Built with Go + React and packaged as a **15MB** Docker image — no heavy SDKs, no telemetry, no bloat.

---

## ✨ Features

| Category | Features |
|----------|----------|
| **📌 书签管理** | 嵌套文件夹 · 拖拽排序 · 浏览器导入 · 右键编辑 · 图标自动识别 |
| **📡 服务监控** | HTTP 健康巡检 · HTTPS 自签证书支持 · HEAD→GET 自动降级 · 在线率统计 |
| **🐳 Docker 管理** | 容器列表/状态 · 实时日志 · 启动/停止/重启 · 自定义别名和跳转地址 · 拖拽排序 |
| **🔔 告警通知** | 服务离线自动推送 · 支持 Apprise（Telegram/Discord/Slack 等） · 冷却防刷 |
| **☁️ 多端同步** | GitHub / S3 / WebDAV / Dropbox / Google Drive / 本地后端 |
| **🔍 聚合搜索** | 书签 · 笔记 · 监控目标 · Docker 容器 · 网络搜索引擎 |
| **📝 效率工具** | 待办事项 · 笔记 · 自定义壁纸 · 快捷键 · 多主题 |

## 🚀 Quick Start

```bash
docker run -d \
  -p 8642:8642 \
  -v ./data:/app/data \
  -v /var/run/docker.sock:/var/run/docker.sock \
  ghcr.io/yingxiaomo/nav:latest
```

Then open **http://localhost:8642** and set your admin password.

> 也可以纯静态部署到 Vercel / Cloudflare，仅使用书签和壁纸功能（无需后端）。

## 🏗️ Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | **Go 1.25** — single binary, no runtime deps |
| Frontend | **Next.js 16** + **React 19** + **Tailwind CSS 4** |
| Database | **SQLite** (embedded via modernc.org/sqlite) |
| Container | **FROM scratch** — 15MB image, no OS layer |
| Sync | Multi-adapter: GitHub, S3/R2, WebDAV, Dropbox, Google Drive |

## 📸 Screenshots

> _截图待补充 — 如果你喜欢这个项目，欢迎截图提交 PR！_

<!-- 
  截图示例：
  - 主页面（搜索栏 + 书签网格 + 壁纸）
  - 监控面板浮层（系统状态 + 服务巡检 + Docker 容器）
  - Docker 日志查看器
  - 设置界面（存储配置 / 壁纸选择）
-->

## 📦 Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8642` | Server port |
| `DATABASE_URL` | `./data/nav.db` | SQLite database path |
| `UPLOAD_DIR` | `./data/uploads` | File upload directory |
| `DATA_DIR` | `./data` | Data directory (Docker metadata, etc.) |
| `CORS_ORIGIN` | `*` | CORS allowed origin |

## 🔗 Related

- [Homelab](https://www.reddit.com/r/selfhosted/) — self-hosting community
- [Startpage](https://www.reddit.com/r/startpages/) — browser start page inspiration
- [Apprise](https://github.com/caronc/apprise) — notification gateway used for alerts

## 📄 License

AGPL v3
