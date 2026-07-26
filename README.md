<div align="center">
  <img src="./public/icon/logo.png" width="120" height="120" alt="Clean Nav Logo">
  <h1>Clean Nav</h1>
  <p><b>面向 Homelab 的轻量自托管导航页 & 服务监控面板</b></p>
  <p>极简导航起始页 · 服务监控 · Docker 管理 · 多端同步</p>

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
    <a href="https://nav.ovoxo.cc">🔴 在线演示</a>
    &nbsp;·&nbsp;
    <a href="https://github.com/yingxiaomo/nav/pkgs/container/nav">🐳 容器镜像</a>
    &nbsp;·&nbsp;
    <a href="./CONTRIBUTING.md">🛠️ 开发文档</a>
  </p>
</div>

<br>

**Clean Nav** 是一个面向 Homelab 的导航起始页，把一块好看的浏览器主页和一个轻量的服务器管理面板合二为一。Go + React 编写，打包成 **15MB** 的 Docker 镜像——没有臃肿的 SDK、没有遥测、没有多余抽象。

它有两种用法，取决于你需要什么：

- 🌐 **纯静态起始页**——导出静态站托管到 Cloudflare Pages / Vercel / GitHub Pages，仅用书签 + 壁纸 + 云同步，**完全不需要后端**。
- 🐳 **Docker 全合一**——一个容器跑起 Go 后端 + 前端，解锁服务监控、Docker 管理、告警、SSH 等全部增强能力，数据落 SQLite。

> 换句话说：**前端是可独立部署的展示层，后端是可选的增强。** 你可以只要主页，也可以要整套面板。

---

## ✨ 功能特性

| 分类 | 功能 |
|----------|----------|
| **📌 书签管理** | 嵌套文件夹 · 拖拽排序 · 浏览器书签导入 · 右键编辑 · 图标自动识别 |
| **📡 服务监控** | HTTP 健康巡检 · ICMP Ping · HTTPS 自签证书支持 · HEAD→GET 自动降级 · 在线率统计 |
| **🐳 Docker 管理** | 容器列表/状态 · 实时日志流 · 启动/停止/重启 · 自定义别名和跳转地址 · 拖拽排序 |
| **🔔 告警通知** | 服务离线自动推送 · 支持 Apprise（Telegram/Discord/Slack 等） · 冷却防刷 |
| **☁️ 多端同步** | GitHub 仓库 / Gist / S3·R2 / WebDAV / Dropbox / Google Drive / 本地后端 |
| **🔍 聚合搜索** | 书签 · 笔记 · 监控目标 · Docker 容器 · 外部搜索引擎 |
| **⚡ 效率工具** | 命令面板（⌘K） · SSH 网页终端 · AI 对话面板 · 待办 · 笔记 · 自定义壁纸 · 快捷键 · 多主题 |

## 🚀 快速开始（Docker 全合一）

```bash
docker run -d \
  -p 8642:8642 \
  -v ./data:/app/data \
  -v /var/run/docker.sock:/var/run/docker.sock \
  ghcr.io/yingxiaomo/nav:latest
```

或用 `docker-compose.yml`：

```yaml
services:
  nav:
    image: ghcr.io/yingxiaomo/nav:latest
    ports:
      - "8642:8642"
    volumes:
      - ./data:/app/data
      # Docker 管理功能需要挂载 socket（可选）
      - /var/run/docker.sock:/var/run/docker.sock
    restart: unless-stopped
```

打开 **http://localhost:8642** 设置管理员密码，管理后台在 **/admin**。

## 🌐 静态托管部署（纯前端，无需后端）

前端可以 `output: export` 导出为纯静态站点，托管到任意静态平台。此形态**不含后端**，可用功能为书签、壁纸、云同步（数据存到你自己的 GitHub/S3/WebDAV 等），适合只想要一个跨设备同步的浏览器起始页的场景。

**构建产物：**

```bash
npm install
npm run build     # 产出静态站点到 out/ 目录
```

### Cloudflare Pages（推荐）

在 Cloudflare Pages 连接本仓库，构建设置填：

| 设置项 | 值 |
|--------|-----|
| 框架预设 | `None`（或 Next.js Static Export） |
| 构建命令 | `npm run build` |
| 构建输出目录 | `out` |

部署完成后，打开站点 → **设置 → 存储**，选择一种云同步方式（GitHub 私有仓库 / Gist / S3·R2 / WebDAV 等）并填入凭证，数据即存到云端、多设备共享。详见 [云同步配置指南](./docs/storage-guide.md)。

### GitHub Pages

```bash
npm run build
npx gh-pages -d out          # 或手动把 out/ 推到 gh-pages 分支
```

在仓库 **Settings → Pages** 里将来源设为 `gh-pages` 分支即可。

### Vercel

直接在 Vercel 导入本仓库，会自动识别 Next.js 并部署。注意此模式下没有后端，API 路由不可用，但书签/壁纸/云同步等纯前端功能照常工作。

> 💡 静态托管下**不需要**配置任何环境变量或后端；所有数据要么存浏览器 `localStorage`，要么存你在设置里配置的云端。

## 🚢 部署形态对比

| 形态 | 命令 | 数据存储 | 可用功能 |
|------|------|---------|---------|
| 纯静态托管 | `npm run build` → 托管 `out/` | localStorage + 云同步 | 书签 / 壁纸 / 同步 |
| Docker 全合一 | `docker run …` | 容器内 SQLite | 全部功能 |

全合一模式下前端产物由 Go 后端从 `./public` 直接提供，无需前后端分离部署。

## 🔒 安全

面向自托管场景的默认安全姿态：

- **默认拒绝授权**——所有敏感端点（设置 / 管理 / SSH / 解析）无论请求方法都要求有效会话；仅首页展示所需的少数只读接口对匿名开放，且已脱敏。
- **凭证静态加密**——设置 `NAV_SECRET_KEY` 后，SSH / 设备密码以 AES-256-GCM 加密落库（见下方配置）。
- **SSRF 防护**——服务端抓取用户 URL 时按**解析后的 IP** 判定内网/回环，拒绝内网与云元数据地址。
- **SSH 主机密钥 TOFU**——首次连接记录指纹，之后指纹变化即拒绝（防中间人）。
- 会话用 HMAC-SHA256 签名；密码 bcrypt 哈希；登录按 IP 限流。

## 🏗️ 技术栈

| 层 | 技术 |
|-------|------------|
| 后端 | **Go 1.25** — 单二进制，零运行时依赖 |
| 前端 | **Next.js 16** + **React 19** + **Tailwind CSS 4** + shadcn/ui |
| 数据库 | **SQLite**（纯 Go 实现 modernc.org/sqlite） |
| 容器 | **FROM scratch** — 15MB 镜像，无 OS 层 |
| 同步 | 多适配器：GitHub、Gist、S3/R2、WebDAV、Dropbox、Google Drive |

## 📦 配置（环境变量）

| 变量 | 默认值 | 说明 |
|----------|---------|-------------|
| `PORT` | `8642` | 服务端口 |
| `DATABASE_URL` | `./data/nav.db` | SQLite 数据库路径 |
| `UPLOAD_DIR` | `./data/uploads` | 文件上传目录 |
| `DATA_DIR` | `./data` | 数据目录（Docker 元数据、SSH 主机密钥等） |
| `CORS_ORIGIN` | `*` | 允许的 CORS 来源 |
| `NAV_SECRET_KEY` | *(未设置)* | 可选。设置后，敏感凭证（SSH / 设备密码）以 AES-256-GCM 加密落库。用任意强随机串即可（如 `openssl rand -hex 32`）。不设则明文存储（向后兼容）。更换此值会使已加密的旧凭证无法解密。 |

> 以上仅全合一（后端）模式相关；静态托管无需任何环境变量。

## 🛠️ 开发

本地开发、目录结构、扩展点（新增云同步适配器 / API 端点 / admin 标签页）与安全约定见 **[CONTRIBUTING.md](./CONTRIBUTING.md)**。

```bash
go build -o nav-server ./cmd/nav-server/ && ./nav-server   # 后端 :8642
npm run dev                                                 # 前端 :3000（/api 代理到后端）
```

## 🔗 相关

- [r/selfhosted](https://www.reddit.com/r/selfhosted/) — 自托管社区
- [r/startpages](https://www.reddit.com/r/startpages/) — 浏览器起始页灵感
- [Apprise](https://github.com/caronc/apprise) — 告警使用的通知网关

## 📄 许可证

[AGPL v3](./LICENSE)
