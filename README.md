<div align="center">
  <img src="./public/icon/logo.png" width="120" height="120" alt="Clean Home Logo">
  <h1>Clean Nav</h1>
  <p>
    <b>A minimal, fast, and beautiful personal homepage / start page.</b>
  </p>
  <p>极简风格个人主页 | 导航页 | 仪表盘</p>

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
  </p>

  <p>
    <a href="https://nav.ovoxo.cc">🔴 演示地址 (Vercel)</a> / <a href="https://nav.396638.xyz">🔵 演示地址 (Cloudflare)</a>
  </p>
</div>

# Clean Nav - 极简纯粹的 Homelab 导航与数字中控台

Nav 是一个专为 Homelab 玩家打造的极速个人导航页与轻量级服务器面板。采用 **Go + React** 重构，将完整的 Web 引擎、SQLite 数据库、原生的底层系统调度彻底淬炼，最终压缩进一个 **15MB** 的 Docker 镜像中。

没有花里胡哨的冗余功能，没有庞大的第三方 SDK，只为你提供最极致的响应速度与绝对的掌控力。

## ✨ 核心特性

* 🪶 **物理级轻量**：极致压缩，采用 `FROM scratch` 构建的 Docker 镜像仅约 **15MB**。运行时内存常年保持在 20MB 以内。
* ⚡️ **毫秒级响应监控**：告别转圈等待。独创的“后台守护进程 + 内存读写锁快照”架构，让监控面板的加载时间永远 `<1ms`，即使面对并发狂刷也稳如磐石。
* 📂 **无限嵌套文件夹**：强大的书签管理系统，支持多级目录树形结构，配合全局右键菜单，极速完成编辑与分类。
* 🔒 **绝对安全与隐私**：零遥测、零外部 API 依赖。Scratch 真空容器内甚至没有 `sh` 和基础 OS 工具链，从物理层面抹除攻击面。
- **极简**：包含时间组件、聚合搜索、链接网格、任务管理和笔记功能
- **方便**：直接导入浏览器书签，避免手动添加
- **双模式部署**：Docker 镜像全功能开箱即用，也可纯静态部署到 Vercel / Cloudflare
- **多存储支持**（静态模式）：
  - GitHub 私有仓库 / Gist
  - S3 / Cloudflare R2
  - WebDAV
  - Dropbox / Google Drive
- **全功能**（Docker 模式）：
  * 直接监听宿主机 Unix Socket，**彻底剔除沉重的 Docker SDK**。
  * 系统监控（CPU/内存/磁盘）、HTTP 健康巡检、WOL 网络唤醒。
  * 系统状态浮窗：直接展示运行状态，支持固定到主页，在面板即可右键完成容器启停、重启。
  * **实时日志**：右键菜单直接唤出黑底绿字的终端视窗，通过 SSE 流式推送无延迟查看实时日志，自带 500 行内存防爆机制。
  * **秩序美学**：支持为容器设置自定义别名（备注名），告别凌乱的默认英文名。
- **管理体验**：
  - 书签导入、自动识别标题和图标、拖拽排序
  - 智能数据合并，多设备同步无冲突
  - 图片上传自动生成访问链接

## 🛠️ 技术栈 (Tech Stack)

* **后端引擎**: Go 纯原生开发，摒弃臃肿框架，极其克制的依赖引入。
* **前端渲染**: React 19 + Tailwind CSS 4，纯粹的声明式 UI 与极致丝滑的交互体验。
* **数据存储**: SQLite 原生驱动，配合极其精简的存储适配器协议，轻量且稳固。


## 🐳 Docker 部署（推荐全功能）

### 镜像

| 镜像 | 地址 | 大小 |
|------|------|------|
| **镜像** | `ghcr.io/yingxiaomo/nav` | ~15MB |

Go 后端编译为纯静态二进制（零运行时依赖），镜像基于 `scratch`，极简安全。

### 快速启动

```bash
docker run -p 8642:8642 -v nav-data:/app/data ghcr.io/yingxiaomo/nav:latest
```
镜像拉取慢可将 **ghcr.io** 替换为镜像站 **ghcr.nju.edu.cn** 

打开 <http://localhost:8642> 即可使用，<http://localhost:8642/admin> 进入管理后台。

如需 **Docker 容器管理** 功能，挂载 Docker socket：

```bash
docker run -p 8642:8642 \
  -v nav-data:/app/data \
  -v /var/run/docker.sock:/var/run/docker.sock \
  ghcr.io/yingxiaomo/nav:latest
```

### Docker Compose

项目根目录的 [docker-compose.yml](./docker-compose.yml) 一键启动：

```bash
docker compose up -d
# 打开 http://localhost:8642
```

### 首次启动

首次打开前端页面时，会自动检测后端可用性：

1. 弹出**初始化管理员密码**窗口，输入密码即完成设置
2. 前端自动连接后端
3. 监控面板、Docker 管理等功能自动可用

> 💡 管理后台 `/admin` 可修改密码、管理书签、巡检目标等。

### 🔗 远程访问

通过反向代理（Nginx / Caddy）暴露到公网：

```nginx
server {
    listen 443 ssl;
    server_name nav.yourdomain.com;

    ssl_certificate /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8642;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_cache off;
    }
}
```

## ☁️ 静态部署（仅前端） [Vercel (推荐)](https://vercel.com) / [Cloudflare Pages ](https://pages.cloudflare.com)

将代码克隆到你的 GitHub 仓库，然后在 Vercel 或 Cloudflare Pages 中导入该项目即可。无需特殊的环境变量配置。
### 🌩️ Cloudflare Pages / Vercel 部署注意
由于本项目采用了纯静态导出，在配置项目时请务必检查以下设置：
| 平台 | 构建命令 (Build Command)|输出目录 (Output Directory)|
|--------------|-----------------------------|---------------------------|
| Vercel        | npm run build  | 留空 (默认) ⚠️ 不要填 out          |
| Cloudflare       | npm run build          | out (必须)          |
| Netlify       | npm run build     | out            |

### 启用在线编辑功能

为了让网页能够保存你修改的数据，你需要在设置面板中配置存储选项：

1. 打开部署好的导航页，点击右下角的 **设置 (⚙️)** 图标。
2. 切换到 **云同步** 标签页。
3. 选择你想要使用的存储类型。
4. 填写相应的配置信息。
5. 点击 **测试连接** 确保配置正确。
6. 点击 **保存** 完成配置。

现在，你在网页上进行的任何修改都会直接同步到你配置的存储服务中！

> 💡 详细配置请参考 [云同步配置指南](./docs/storage-guide.md)



## ☁️ 本地开发

```bash
# 前端
npm install
npm run dev          # http://localhost:3000

# Go 后端（需要前端开发服务器同时在运行）
go run ./cmd/nav-server  # http://localhost:8642
```

后端自动通过 next.config.ts 的 proxy rewrite (`/api/*` → `localhost:8642`) 与前端通信。

### 测试监控服务

启动模拟内网服务用于测试健康巡检和图标识别：

```bash
node test/test-monitor-servers.mjs
# 正常: http://localhost:9001
# 慢速: http://localhost:9002
# 故障: http://localhost:9003
```

## 数据同步说明

### Docker 模式
数据自动保存在容器内的 SQLite 数据库中（挂载到 `nav-data` 卷）。所有修改即时生效。

### 静态模式
需要在设置 → 云同步中配置存储后端（GitHub / S3 / WebDAV 等），修改后需点击保存才会同步到云端。详细配置请参考 [云同步配置指南](./docs/storage-guide.md)。

### 🔖 如何导入浏览器书签？

1. **从您的浏览器导出书签**：
   - **Chrome**: 前往 `书签` -> `书签管理器`，点击右上角的菜单 (⋮)，选择 `导出书签`。
   - **Edge**: 前往 `收藏夹` (Ctrl+Shift+O)，点击右上角的菜单 (...)，选择 `导出收藏夹`。
   - **Firefox**: 前往 `书签` -> `管理所有书签` (Ctrl+Shift+O)，在弹出的窗口中点击 `导入和备份` -> `将书签导出为 HTML...`。
2. **在本站导入**：
   - 点击导航页右下角的 **设置 (⚙️)** 图标。
   - 在 **链接管理** 标签页下，找到 **导入浏览器书签** 区域，点击并选择您刚才导出的 HTML 文件即可。

### ⚠️ 注意事项

- **壁纸打包**：每次构建时从 `public/wallpapers/` 目录随机选取 **5 张**壁纸打包进应用，减小镜像体积。前端「换一张」按钮在已打包的 5 张之间切换。
- **推荐格式**：壁纸建议使用 `.webp` 格式，单张不超过 **2MB**。

## 📄 License

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
