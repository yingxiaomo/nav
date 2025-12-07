# Clean Nav - 极简 GitHub 静态导航页

基于 Next.js + Shadcn/ui + Tailwind CSS 构建的极简导航页。支持毛玻璃特效、自定义壁纸，并利用 GitHub API 实现无服务器数据同步。

## ✨ 特性

- **完全免费**: 部署在 Vercel 或 Cloudflare Pages，无需数据库。
- **在线编辑**: 直接在网页上修改链接、分类及壁纸，数据自动同步到 GitHub 仓库。
- **美观 UI**: 全局毛玻璃 (Glassmorphism) 风格，响应式设计。
- **极简**: 包含时间组件、聚合搜索 (Google/Baidu/Bing) 和链接网格。

## 🚀 快速开始

### 本地运行

1. 克隆仓库:
   ```bash
   git clone https://github.com/your-username/clean-nav.git
   cd clean-nav
   ```

2. 安装依赖:
   ```bash
   npm install
   ```

3. 启动开发服务器:
   ```bash
   npm run dev
   ```

4. 打开浏览器访问 `http://localhost:3000`。

## 🌐 部署与配置

### 1. 部署到 Vercel / Cloudflare Pages

将代码推送到你的 GitHub 仓库，然后在 Vercel 或 Cloudflare Pages 中导入该项目即可。无需特殊的环境变量配置。

### 2. 启用在线编辑功能 (核心)

为了让网页能够保存你修改的数据，你需要配置 GitHub Token：

1. 前往 [GitHub Settings > Developer settings > Personal access tokens](https://github.com/settings/tokens)。
2. 生成一个新的 **Classic Token**，勾选 `repo` 权限 (用于读写仓库文件)。
3. 打开部署好的导航页，点击右下角的 **设置 (⚙️)** 图标。
4. 切换到 **GitHub 同步** 标签页，填入：
   - **Token**: `ghp_xxxxxxxx...` (你刚才生成的 Token)
   - **用户名**: 你的 GitHub 用户名
   - **仓库名**: `clean-nav` (或者你命名的仓库)
   - **文件路径**: `public/data.json` (默认)
5. 点击保存。

现在，你在网页上进行的任何修改都会直接 Commit 到你的 GitHub 仓库中！

## 🛠️ 技术栈

- **框架**: [Next.js](https://nextjs.org) (App Router)
- **UI 库**: [Shadcn/ui](https://ui.shadcn.com)
- **样式**: [Tailwind CSS](https://tailwindcss.com)
- **图标**: [Lucide React](https://lucide.dev)
- **数据层**: GitHub API (Octokit)

## 📁 目录结构

- `app/page.tsx`: 主页面逻辑
- `components/nav/`: 核心组件 (时钟、搜索、网格、设置)
- `lib/github.ts`: GitHub API 交互逻辑
- `public/data.json`: 默认导航数据