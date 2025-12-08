<div align="center">
  <img src="./public/icon/logo.png" width="120" height="120" alt="Clean Home Logo">
  <h1>Clean Home</h1>
  <p>
    <b>A minimal, fast, and beautiful personal homepage / start page.</b>
  </p>
  <p>极简风格个人主页 | 导航页 | 仪表盘</p>

  <p>
    <a href="https://github.com/yingxiaomo/clean-home/blob/main/LICENSE">
      <img src="https://img.shields.io/github/license/yingxiaomo/clean-home?style=flat-square" alt="license" />
    </a>
    <a href="https://github.com/yingxiaomo/clean-home/stargazers">
      <img src="https://img.shields.io/github/stars/yingxiaomo/clean-home?style=flat-square" alt="stars" />
    </a>
    <a href="https://github.com/yingxiaomo/clean-home/network/members">
      <img src="https://img.shields.io/github/forks/yingxiaomo/clean-home?style=flat-square" alt="forks" />
    </a>
  </p>

  <p>
    <a href="https://nav.ovoxo.cc">🔴 Live Demo (演示地址)</a>
  </p>
</div>


# Clean Nav - 极简静态导航页

基于 Next.js + Shadcn/ui + Tailwind CSS 构建的极简导航页，**可直接设为浏览器主页**。支持自定义壁纸，并利用 GitHub API 实现无服务器数据同步。

## ✨ 特性

- **完全免费**: 部署在 Vercel 或 Cloudflare Pages，无需数据库。
- **极简**: 包含时间组件、聚合搜索和链接网格。
- **便捷**：直接导入浏览器书签，避免手动添加。
- **无后端数据同步**：使用 **GitHub API** 直接读写仓库中的 `data.json` 文件，配置修改会自动同步到 GitHub，抛弃传统数据库，享受静态网页的极速加载，同时具备动态配置能力。
- **管理体验**  
   - **书签导入**：支持一键导入浏览器书签，快速完成初始化。
   - **自动识别**：自动抓取链接标题和图标。
   - **拖拽排序**：在设置面板中，支持通过拖拽调整分类顺序。
   - **图标库**：内置 400+ 精选功能性图标，支持自定义图标。
## 🚀 快速开始

### 1. Fork 项目

点击仓库右上角的 **Fork** 按钮，将此项目复制到你自己的 GitHub 账户下。这是实现数据同步的关键一步。

### 2. 克隆到本地

将你 Fork 后的仓库克隆到本地（将 `your-username` 替换为你的 GitHub 用户名）:
```bash
git clone https://github.com/your-username/clean-nav.git
cd clean-nav
```

### 3. 安装与运行

```bash
npm install
npm run dev
```
现在，你可以在 `http://localhost:3000` 预览你的导航页了。

## 🌐 部署与配置

### 1. 部署到 [Vercel (推荐)](https://vercel.com) / [Cloudflare Pages ](https://pages.cloudflare.com)

将代码推送到你的 GitHub 仓库，然后在 Vercel 或 Cloudflare Pages 中导入该项目即可。无需特殊的环境变量配置。

### 2. 启用在线编辑功能

为了让网页能够保存你修改的数据，你需要配置 GitHub Token：

1. 前往 [GitHub Settings > Developer settings > Personal access tokens](https://github.com/settings/tokens)。
2. 生成一个新的 **Classic Token**，勾选 `repo` 权限 (用于读写仓库文件)。
3. 打开部署好的导航页，点击右下角的 **设置 (⚙️)** 图标。
4. 切换到 **GitHub 同步** 标签页，填入：
   - **Token**: `ghp_xxxxxxxx...` (你刚才生成的 Token)
   - **用户名**: 你的 GitHub 用户名
   - **仓库名**: `clean-nav` (或者你命名的仓库)
   - **分支**: `main` (默认为 `main`，您可以根据需要修改为其他分支)
   - **文件路径**: `public/data.json` (默认)
5. 点击保存。

现在，你在网页上进行的任何修改都会直接同步到你的 GitHub 仓库中！

🔐 **安全提示**: 您的 GitHub Token **只会被安全地存储在您浏览器本地的缓存** 中，它永远不会被上传到任何服务器。这意味着只有您自己能接触到这个 Token，他人无法获取，非常安全！但是更换浏览器或者清除缓存后需要重新输入。



### 🔖 如何导入浏览器书签？

为了方便您快速设置，本站支持导入主流浏览器的书签文件。

1.  **从您的浏览器导出书签**：
    *   **Chrome**: 前往 `书签` -> `书签管理器`，点击右上角的菜单 (⋮)，选择 `导出书签`。
    *   **Edge**: 前往 `收藏夹` (Ctrl+Shift+O)，点击右上角的菜单 (...)，选择 `导出收藏夹`。
    *   **Firefox**: 前往 `书签` -> `管理所有书签` (Ctrl+Shift+O)，在弹出的窗口中点击 `导入和备份` -> `将书签导出为 HTML...`。
2.  **在本站导入**：
    *   点击导航页右下角的**设置 (⚙️)** 图标。
    *   在 **链接管理** 标签页下，找到 **导入浏览器书签** 区域，点击并选择您刚才导出的 HTML 文件即可。


## 🎨 自定义本地壁纸

项目支持使用本地图片作为壁纸，并具备极速加载和随机切换功能。

### 使用方法
1. 将你的图片文件放入 `public/wallpapers` 目录。
2. 支持格式：`.jpg`, `.png`, `.webp`, `.gif`, `.svg`。
3. 重新运行开发服务器或构建项目，系统会自动扫描该目录。

### ⚠️ 注意事项与构建策略
为了保证页面加载性能（Seconds-to-Interactive），构建脚本包含以下策略：

- **随机采样**：如果 `public/wallpapers` 目录下的图片超过 **10张**，每次构建（`npm run build` 或 `npm run dev`）时只会自动**随机选取 10 张**打包进应用。
- **推荐格式**：建议使用 `.webp` 格式，单张图片建议控制在 **2MB 以内**。

如果你希望包含更多图片，请修改 `app\page.tsx` 中的 `MAX_WALLPAPERS` 常量。


## 📄 License:
MIT License © 2025 YingXiaoMo