<div align="center">
  <img src="./public/icon/logo.png" width="120" height="120" alt="Clean Home Logo">
  <h1>Clean Nav</h1>
  <p>
    <b>A minimal, fast, and beautiful personal homepage / start page.</b>
  </p>
  <p>极简风格个人主页 | 导航页 | 仪表盘</p>

  <p>
    <a href="https://github.com/yingxiaomo/nav/blob/main/LICENSE">
      <img src="https://img.shields.io/github/license/yingxiaomo/nav?style=flat-square" alt="license" />
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

## ☁️ 极速上手 (无需部署)
如果你不想购买服务器或折腾 Docker，你可以直接使用我的演示站，并将数据存储在你自己的 GitHub 私有仓库 中。
#### 你的数据只会在 浏览器 <-> GitHub 之间传输，演示站无法读取你的隐私数据。

## 1. 创建数据仓库 (存放数据)
我们需要一个地方来存你的书签和配置。按照以下步骤创建 GitHub 仓库：
1. 登录 GitHub，点击右上角的 `+`，选择 `New repository`。
2. 填写仓库名称，例如 `my-nav-data`。
3. 关键步骤：选择 `Private`（私有）。这能确保只有你自己能看到你的书签。
4. 勾选 `Add a README file`（初始化仓库，这很重要，否则没有 `main` 分支）。
5. 点击 `Create repository`。

## 2. 获取访问令牌 (Access Token)
我们需要一把“钥匙”来让网页读写你的仓库。请按照以下步骤生成访问令牌：
1. 访问 GitHub [Token 设置页面](https://github.com/settings/tokens)。
2. 填写备注，例如 `clean-nav-sync`。
3. 设置 `Expiration` 为 `No expiration`（永不过期），以免以后需要重新配置。
4. 在 `Select scopes (权限设置)` 中，勾选 `repo`（完全控制私有仓库）。
5. 点击底部的 `Generate token` 按钮。
6. 复制生成的令牌（以 `ghp_` 开头的字符串）它等于你的密码，任何拿到它的人都可以随意修改你仓库的内容，务必妥善保存，关闭页面后，你将无法再看到这个令牌。


## 3. 在网页中配置
1. 打开 [Clean Nav 演示站](https://nav.ovoxo.cc)。
2. 点击右下角的 `设置 (⚙️)` 图标，切换到 `云同步` 标签。
3. 按照以下表格填写配置：

| 选项         | 说明                        | 示例填写                  |
|--------------|-----------------------------|---------------------------|
| Token        | 刚才复制的 `ghp_...` 令牌   | `ghp_AbC123...`           |
| 用户名       | 你的 GitHub 账号名          | `your-username`           |
| 仓库名       | 第一步创建的私有仓库名      | `my-nav-data`             |
| 分支         | 默认分支，通常是 `main`     | `main`                    |
| 文件路径     | 存数据的文件名，无需手动创建 | `data.json`               |

4. 点击 `保存`。

## 4. 完成配置
🎉 大功告成！你现在可以添加一个书签并再次点击保存，数据就会自动写入你的私有仓库了。以后无论你在哪台电脑访问演示站，只要填入这套配置，你的导航页就回来了。




## ☁️ 本地开发
 1. Fork 项目
 2. 将你 Fork 后的仓库克隆到本地（将 `your-username` 替换为你的 GitHub 用户名）:
```bash
git clone https://github.com/your-username/nav.git
cd nav
```
 3. 安装与运行

```bash
npm install
npm run dev
```
现在，你可以在 `http://localhost:3000` 预览你的导航页了。

## 🌐 部署与配置

### 1. 部署到 [Vercel (推荐)](https://vercel.com) / [Cloudflare Pages ](https://pages.cloudflare.com)

将代码推送到你的 GitHub 仓库，然后在 Vercel 或 Cloudflare Pages 中导入该项目即可。无需特殊的环境变量配置。
### 🌩️ Cloudflare Pages / Vercel 部署注意
由于本项目采用了纯静态导出，在配置项目时请务必检查以下设置：
| 平台 | 构建命令 (Build Command)|输出目录 (Output Directory)|
|--------------|-----------------------------|---------------------------|
| Vercel        | npm run build  | 留空 (默认) ⚠️ 不要填 out          |
| Cloudflare       | npm run build          | out (必须手动填写)          |
| Netlify       | npm run build     | out            |

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

## 🐳 Docker 部署

如果您更习惯使用 Docker 进行部署，可以使用以下方法。

### 1. 使用 Docker Hub 镜像 (推荐)

直接运行以下命令即可启动服务：

```bash
docker run -d \
  -p 20261:20261 \
  --name clean-nav \
  --restart always \
  yingxiaomo/clean-nav:latest
```

启动后，访问 `http://localhost:20261` 即可使用。

### 2. 使用 Docker Compose

创建 `docker-compose.yml` 文件：

```yaml
version: '3'
services:
  clean-nav:
    image: yingxiaomo/clean-nav:latest
    container_name: clean-nav
    ports:
      - "20261:20261"
    restart: always
```

然后运行：
```bash
docker-compose up -d
```

### 3. 本地构建

如果您对源码进行了修改，可以构建自己的镜像：

```bash
# 构建镜像
docker build -t clean-nav .

# 运行容器
docker run -d -p 20261:20261 --name clean-nav clean-nav
```

🔐 **安全提示**: 您的 GitHub Token **只会被安全地存储在您浏览器本地的缓存** 中，它不会被上传到任何服务器。这意味着只有您自己能接触到这个 Token，他人无法获取，非常安全！但是更换浏览器或者清除缓存后需要重新输入。



### 🔖 如何导入浏览器书签？

为了方便您快速设置，本站支持导入主流浏览器的书签文件。

1.  **从您的浏览器导出书签**：
    *   **Chrome**: 前往 `书签` -> `书签管理器`，点击右上角的菜单 (⋮)，选择 `导出书签`。
    *   **Edge**: 前往 `收藏夹` (Ctrl+Shift+O)，点击右上角的菜单 (...)，选择 `导出收藏夹`。
    *   **Firefox**: 前往 `书签` -> `管理所有书签` (Ctrl+Shift+O)，在弹出的窗口中点击 `导入和备份` -> `将书签导出为 HTML...`。
2.  **在本站导入**：
    *   点击导航页右下角的**设置 (⚙️)** 图标。
    *   在 **链接管理** 标签页下，找到 **导入浏览器书签** 区域，点击并选择您刚才导出的 HTML 文件即可。


### ⚠️ 注意事项与构建策略
为了保证页面加载性能，构建脚本包含以下策略：

- **随机采样**：如果 `public/wallpapers` 目录下的图片超过 **10张**，每次构建（`npm run build` 或 `npm run dev`）时只会自动**随机选取 10 张**打包进应用。
- **推荐格式**：建议使用 `.webp` 格式，单张图片建议控制在 **2MB 以内**。

如果你希望打包更多图片，可以在设置中修改。


## 📄 License:
[![License: CC BY-NC 4.0](https://img.shields.io/badge/License-CC%20BY--NC%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc/4.0/)