<div align="center">
  <img src="./public/icon/logo.png" width="120" height="120" alt="Clean Home Logo">
  <h1>Clean Nav</h1>
  <p>
    <b>A minimal, fast, and beautiful personal homepage / start page.</b>
  </p>
  <p>极简风格个人主页 | 导航页 | 仪表盘</p>

  <p>
    <a href="https://github.com/yingxiaomo/nav/blob/main/LICENSE">
      <img src="https://img.shields.io/github/license/yingxiaomo/nav?color=green&style=flat-square" alt="license" />
    </a>
    <a href="https://github.com/yingxiaomo/nav/stargazers">
      <img src="https://img.shields.io/github/stars/yingxiaomo/nav?style=flat-square" alt="stars" />
    </a>
    <a href="https://github.com/yingxiaomo/nav/network/members">
      <img src="https://img.shields.io/github/forks/yingxiaomo/nav?style=flat-square" alt="forks" />
    </a>
  </p>

  <p>
    <a href="https://nav.ovoxo.cc">🔴 演示地址</a>
  </p>
</div>

# Clean Nav - 极简静态导航页

基于 **Next.js 16** + **React 19** + **Shadcn/ui** + **Tailwind CSS 4** 构建的极简导航页，**可直接设为浏览器主页**。支持自定义壁纸、任务管理、笔记功能，并利用多种无服务器存储方案实现数据同步。

## ✨ 特性

- **完全免费**: 部署在 Vercel 或 Cloudflare Pages，无需数据库。
- **极简**: 包含时间组件、聚合搜索、链接网格、任务管理和笔记功能。
- **便捷**：直接导入浏览器书签，避免手动添加。
- **无后端数据同步**：支持多种存储方案，配置修改会自动同步到云端，享受静态网页的极速加载，同时具备动态配置能力。
- **多存储支持**：
  - GitHub 私有仓库
  - GitHub Gist
  - S3 / Cloudflare R2
  - WebDAV
  - Dropbox
  - Google Drive
- **扩展功能**：
  - **任务管理**：支持添加、编辑、完成和删除任务
  - **笔记功能**：支持创建和管理简单笔记
  - **系统监控**（需部署后端）：实时 CPU/内存/磁盘监控，HTTP 服务健康巡检，支持自定义图标
  - **Docker 管理**（需 Docker socket 挂载）：容器列表查看，实时日志流式推送
  - **WOL 网络唤醒**（需配置 MAC）：一键唤醒局域网内关机设备
- **管理体验**
  - **书签导入**：支持一键导入浏览器书签，快速完成初始化。
  - **自动识别**：自动抓取链接标题和图标。
  - **拖拽排序**：在设置面板中，支持通过拖拽调整分类顺序。
  - **图标库**：内置 400+ 精选功能性图标，支持自定义图标。
  - **智能数据合并**：多设备同步时自动合并数据，避免冲突。
  - **图片上传**：支持上传图片到配置的存储服务，自动生成访问链接。
    - 支持 S3/R2、GitHub、WebDAV、Dropbox、Google Drive 等多种存储方式
    - 上传图片后自动填充链接到输入框
    - 提供详细的上传进度反馈

## ☁️ 极速上手 (无需部署)

如果你不想购买服务器或折腾 Docker，你可以直接使用我的演示站，并将数据存储在你自己的 GitHub 私有仓库或 Cloudflare R2 中。演示站是使用[Vercel](https://vercel.com)部署的，直连访问可能会加载很慢，还是推荐自行部署。

#### 你的数据只会在 浏览器 <-> 云端存储 之间传输，演示站无法读取你的隐私数据。

## 数据同步配置

本项目支持多种存储后端，你可以根据喜好选择：

### 1. GitHub 私有仓库 (推荐)

无需任何服务器，直接利用 GitHub API 读写你的私有仓库。

### 2. GitHub Gist

利用 GitHub Gist 服务存储数据，适合快速上手，无需创建新仓库。

### 3. S3 / Cloudflare R2 (推荐)

支持 AWS S3、Cloudflare R2 等兼容 S3 协议的对象存储。R2 提供 10GB 免费空间，速度快且稳定。

### 4. WebDAV

支持连接到任何 WebDAV 服务器，适合自建存储或使用 Nextcloud 等服务。

### 5. Dropbox

支持使用 Dropbox 存储数据，适合已有 Dropbox 账号的用户。

### 6. Google Drive

支持使用 Google Drive 存储数据，适合已有 Google 账号的用户。

### 7. 本地服务器（推荐自部署）

如果你不想依赖第三方服务，可以使用配套的后端 API 服务，将数据持久化到本地 SQLite 数据库。后端还提供网页元数据解析、搜索联想、系统监控、Docker 容器管理和 WOL 网络唤醒等增强功能。

需要部署后端服务，详情见下方 Docker 部署章节。

### 📘 详细配置指南

请参考 [云同步配置指南](./docs/storage-guide.md) 获取完整的配置步骤和示例。

***

## 配置步骤

1. **打开设置面板**：点击导航页右下角的 `设置 (⚙️)` 图标
2. **选择存储类型**：在 `云同步` 标签页中选择你想要使用的存储类型
3. **填写配置信息**：根据所选存储类型填写相应的配置信息
4. **测试连接**：点击 `测试连接` 按钮确保配置正确
5. **保存配置**：点击 `保存` 按钮保存配置

## 数据安全

🔐 **安全提示**: 您的所有配置信息（包括访问令牌）**只会被安全地存储在您浏览器本地的缓存** 中，它不会被上传到任何服务器。这意味着只有您自己能接触到这些配置，他人无法获取，非常安全！但是更换浏览器或者清除缓存后需要重新输入。

## 🐳 Docker 部署

项目提供两个 Docker 镜像，托管在 **GitHub Container Registry** (`ghcr.io`)：

| 镜像       | 地址                              | 包含                   |
| -------- | ------------------------------- | -------------------- |
| **合体镜像** | `ghcr.io/yingxiaomo/nav`        | 前端页面 + 后端 API + 管理后台 |
| **后端镜像** | `ghcr.io/yingxiaomo/nav-server` | 后端 API + 管理后台        |

国内用户可使用镜像站 `ghcr.nju.edu.cn` 替换 `ghcr.io`。

### 方式一: 合体镜像 (推荐)

一个容器包含前端和全部后端功能，适合小白:

```bash
docker run -p 8642:8642 -v nav-data:/app/data ghcr.io/yingxiaomo/nav:latest
```

打开 <http://localhost:8642> 即可看到导航页，<http://localhost:8642/admin> 进入管理后台。

如需使用 **Docker 容器日志** 和 **容器列表** 功能，需挂载 Docker socket：

```bash
docker run -p 8642:8642 -v nav-data:/app/data -v /var/run/docker.sock:/var/run/docker.sock ghcr.io/yingxiaomo/nav:latest
```

### 方式二: 独立后端

前端部署到 Vercel / Cloudflare Pages，后端单独运行:

```bash
docker run -p 8642:8642 -v nav-data:/app/data ghcr.io/yingxiaomo/nav-server:latest
```

前端设置 → 云同步 → 选择「本地服务器」，填入后端地址和 API 令牌。

### 方式三: docker-compose

项目根目录提供了两份配置:

**合体模式** (`docker-compose.yml`):

```bash
docker compose up -d
# 打开 http://localhost:8642
```

**纯后端模式** (`server/docker-compose.yml`):

```bash
docker compose -f server/docker-compose.yml up -d
```

### 首次启动

首次打开 /admin/ 管理后台时，页面会引导你:

1. 设置管理员密码
2. 自动生成 API 令牌&#x20;
3. 在前端设置中填入后端地址 + 令牌，完成连接

***

## ☁️ 本地开发

1. Fork 项目
2. 将你 Fork 后的仓库克隆到本地（将 `your-username` 替换为你的 GitHub 用户名）:

```bash
git clone https://github.com/your-username/nav.git
cd nav
```

1. 安装与运行

```bash
npm install
npm run dev
```

现在，你可以在 `http://localhost:3000` 预览你的导航页了。

## 🌐 部署与配置

### 1. 部署到 [Vercel (推荐)](https://vercel.com) / [Cloudflare Pages](https://pages.cloudflare.com)&#x20;

将代码推送到你的 GitHub 仓库，然后在 Vercel 或 Cloudflare Pages 中导入该项目即可。无需特殊的环境变量配置。

### 🌩️ Cloudflare Pages / Vercel 部署注意

由于本项目采用了纯静态导出，在配置项目时请务必检查以下设置：

| 平台         | 构建命令 (Build Command) | 输出目录 (Output Directory) |
| ---------- | -------------------- | ----------------------- |
| Vercel     | npm run build        | 留空 (默认) ⚠️ 不要填 out      |
| Cloudflare | npm run build        | out (必须)                |
| Netlify    | npm run build        | out                     |

### 2. 启用在线编辑功能

为了让网页能够保存你修改的数据，你需要在设置面板中配置存储选项：

1. 打开部署好的导航页，点击右下角的 **设置 (⚙️)** 图标。
2. 切换到 **云同步** 标签页。
3. 选择你想要使用的存储类型。
4. 填写相应的配置信息。
5. 点击 **测试连接** 确保配置正确。
6. 点击 **保存** 完成配置。

现在，你在网页上进行的任何修改都会直接同步到你配置的存储服务中！

### 🔖 如何导入浏览器书签？

为了方便您快速设置，本站支持导入主流浏览器的书签文件。

1. **从您的浏览器导出书签**：
   - **Chrome**: 前往 `书签` -> `书签管理器`，点击右上角的菜单 (⋮)，选择 `导出书签`。
   - **Edge**: 前往 `收藏夹` (Ctrl+Shift+O)，点击右上角的菜单 (...)，选择 `导出收藏夹`。
   - **Firefox**: 前往 `书签` -> `管理所有书签` (Ctrl+Shift+O)，在弹出的窗口中点击 `导入和备份` -> `将书签导出为 HTML...`。
2. **在本站导入**：
   - 点击导航页右下角的**设置 (⚙️)** 图标。
   - 在 **链接管理** 标签页下，找到 **导入浏览器书签** 区域，点击并选择您刚才导出的 HTML 文件即可。

### ⚠️ 注意事项

- **壁纸打包**：每次构建时从 `public/wallpapers/` 目录随机选取 **5 张**壁纸打包进应用，减小镜像体积。前端「换一张」按钮在已打包的 5 张之间切换。
- **推荐格式**：壁纸建议使用 `.webp` 格式，单张不超过 **2MB**。

## 📄 License:

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
