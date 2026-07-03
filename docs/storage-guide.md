# 云同步配置指南

本项目支持多种数据存储方式，包括：

- **GitHub 私有仓库**：适合熟悉 GitHub 的用户
- **GitHub Gist**：适合快速上手，无需创建新仓库
- **S3 兼容存储**：如 Cloudflare R2、AWS S3、MinIO 等
- **WebDAV**：适合自建存储或使用 Nextcloud 等服务
- **Dropbox**：适合已有 Dropbox 账号的用户
- **Google Drive**：适合已有 Google 账号的用户

## 选项 A: 使用 GitHub 私有仓库

适合熟悉 GitHub 且已有 GitHub 账号的用户。

### 1. 创建数据仓库
1. 登录 [GitHub](https://github.com/)，点击右上角的 `+`，选择 `New repository`。
2. 填写仓库名称，例如 `my-nav-data`。
3. 关键步骤：选择 `Private`（私有）。这能确保只有你自己能看到你的书签。
4. 勾选 `Add a README file`（初始化仓库，这很重要，否则没有 `main` 分支）。
5. 点击 `Create repository`。

### 2. 获取访问令牌 (Access Token)
1. 访问 [GitHub Token 设置页面](https://github.com/settings/tokens)。
2. 点击 `Generate new token` -> `Generate new token (classic)`。
3. 填写备注，例如 `clean-nav-sync`。
4. 设置 `Expiration` 为 `No expiration`（永不过期），以免以后需要重新配置。
5. 在 `Select scopes (权限设置)` 中，勾选 `repo`（完全控制私有仓库）。
6. 点击底部的 `Generate token` 按钮。
7. 复制生成的令牌（以 `ghp_` 开头的字符串）- 它等于你的密码，任何拿到它的人都可以随意修改你仓库的内容，务必妥善保存，关闭页面后，你将无法再看到这个令牌。

### 3. 填写到 Clean Nav 设置中

| Clean Nav 设置项 | 对应 GitHub 界面上的值 | 说明 |
| :--- | :--- | :--- |
| **Token** | 刚才复制的 `ghp_...` 令牌 | 例如 `ghp_AbC123...` |
| **用户名** | 你的 GitHub 账号名 | 例如 `your-username` |
| **仓库名** | 第一步创建的私有仓库名 | 例如 `my-nav-data` |
| **分支** | 默认分支，通常是 `main` | 例如 `main` |
| **文件路径** | 存数据的文件名，无需手动创建 | 例如 `data.json` |

点击保存并同步，如果提示“同步成功”，恭喜你，配置完成！

---

## 选项 B: 使用 GitHub Gist

GitHub Gist 是一个轻量级的代码片段分享服务，适合快速上手，无需创建新仓库。

### 1. 创建 Gist
1. 登录 [GitHub](https://github.com/)，点击右上角的 `+`，选择 `New gist`。
2. 填写文件名称，例如 `nav-data.json`。
3. 在内容区域可以留空，或者添加一个空的 JSON 对象 `{}`。
4. 选择 `Secret`（私密）。
5. 点击 `Create secret gist`。

### 2. 获取 Gist ID
创建成功后，你会看到 Gist 的详情页面。Gist ID 是 URL 中的一部分，例如：
```
https://gist.github.com/your-username/abc123def456ghi789jkl0
```
其中 `abc123def456ghi789jkl0` 就是 Gist ID。

### 3. 获取访问令牌 (Access Token)
参考 **选项 A** 中的步骤 2，生成一个带有 `gist` 权限的访问令牌。

### 4. 填写到 Clean Nav 设置中

| Clean Nav 设置项 | 对应 GitHub 界面上的值 | 说明 |
| :--- | :--- | :--- |
| **Token** | 刚才复制的 `ghp_...` 令牌 | 例如 `ghp_AbC123...` |
| **Gist ID** | Gist 的 ID | 例如 `abc123def456ghi789jkl0` |
| **文件名** | Gist 中的文件名 | 例如 `nav-data.json` |

点击保存并同步，如果提示“同步成功”，恭喜你，配置完成！

---

## 选项 C: 使用 Cloudflare R2 (免费、高速)

Cloudflare R2 是一个完全兼容 S3 的对象存储服务，它提供 **10GB 的永久免费存储空间**，且**不收取流量费**，非常适合个人使用。

### 1. 创建 R2 存储桶 (Bucket)
1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)。
2. 在左侧菜单点击 **R2**。
3. 点击 **Create bucket** (创建存储桶)。
4. 给桶起个名字，例如 `my-nav-data`，点击 **Create bucket**。

### 2. 关键步骤：配置 CORS (允许浏览器访问)
**注意**：这是最关键的一步。默认情况下，Cloudflare 不允许浏览器直接读写 R2 数据，你需要添加 CORS 规则。

1. 进入你刚才创建的桶 (`my-nav-data`)。
2. 点击顶部的 **Settings** (设置) 标签页。
3. 向下滚动找到 **CORS Policy** (CORS 策略) 区域。
4. 点击 **Add CORS policy** (添加策略)，将以下 JSON 粘贴进去：

```json
[
  {
    "AllowedOrigins": [
      "*"
    ],
    "AllowedMethods": [
      "GET",
      "PUT",
      "HEAD"
    ],
    "AllowedHeaders": [
      "*"
    ],
    "ExposeHeaders": [],
    "MaxAgeSeconds": 3000
  }
]
```
> **安全提示**：如果你有固定的域名（如 `https://nav.yourname.com`），建议将 `"AllowedOrigins"` 中的 `"*"` 替换为你的实际域名，以提高安全性。

5. 点击 **Save**。

### 3. 获取访问密钥 (API Tokens)
1. 回到 **R2 概览 (Overview)** 页面。
2. 在页面右侧边栏找到并点击 **Manage R2 API Tokens** (管理 R2 API 令牌)。
   - *找不到入口？尝试直接访问 `https://dash.cloudflare.com/?to=/:account/r2/api-tokens`*
3. 点击右上角的 **Create API token** (创建 API 令牌)。
4. **Token name**: 随便起个名，例如 `nav-token`。
5. **Permissions (权限)**：
   - 选择 **Object Read & Write** (对象读写)。
   - *务必确保选对了权限，否则无法保存配置。*
6. **Specific bucket(s)** (指定桶):
   - 为了安全，建议只选择你刚才创建的 `my-nav-data`。
   - 或者选 "Apply to all buckets" (不推荐)。
7. **TTL**: 建议选择 `Forever` (永久)。
8. 点击 **Create API Token**。

### 4. 填写到 Clean Nav 设置中
创建 Token 成功后，会弹出一个显示密钥的页面（**只显示一次，请立即保存**），请按下表对应填写：

| Clean Nav 设置项 | 对应 Cloudflare 界面上的值 | 说明 |
| :--- | :--- | :--- |
| **Endpoint (服务地址)** | `https://<Account ID>.r2.cloudflarestorage.com` | **Account ID** 可以在 R2 首页或地址栏找到，或者在桶详情页的 S3 API 链接中直接复制基础域名。 |
| **Access Key ID** | **Access Key ID** | 一串 32 位的字符 (字母和数字组合) |
| **Secret Access Key** | **Secret Access Key** | 一长串字符 (这是真正的密钥，请务必保存) |
| **Bucket (桶名称)** | 你刚才创建的桶名 | 例如 `my-nav-data` |
| **Region (区域)** | `auto` | 填 `auto` 即可 |
| **File Path** | `data.json` | 建议填写 `data.json` |

点击保存并同步，如果提示“同步成功”，恭喜你，配置完成！

---

## 选项 B: 使用 AWS S3 / MinIO / 阿里云 OSS

只要是兼容 S3 协议的存储服务，理论上都可以使用。

**通用要求**：
1. **CORS**：必须配置 CORS 允许 `PUT` 和 `GET` 请求。
2. **权限**：提供的 Access Key 必须拥有对该 Bucket 的读写权限。

### 常见 Endpoint 格式：
- **AWS S3**: `https://s3.us-east-1.amazonaws.com`
- **MinIO**: `https://your-minio-server.com`
- **Aliyun OSS**: `https://oss-cn-hangzhou.aliyuncs.com` (注意：阿里云OSS的浏览器直传配置较复杂，可能需要 STS Token，建议优先使用 R2)。

---

## 选项 D: 使用 WebDAV

WebDAV 是一种基于 HTTP 的文件访问协议，适合自建存储或使用 Nextcloud、Synology NAS 等服务。

### 1. 准备 WebDAV 服务

#### 方案 1: 使用 Nextcloud
1. 登录你的 Nextcloud 实例。
2. 点击右上角的头像，选择 `设置`。
3. 在左侧菜单点击 `安全`。
4. 向下滚动找到 `设备与应用密码`，点击 `生成新密码`。
5. 填写设备名称，例如 `clean-nav`，点击 `创建`。
6. 复制生成的用户名和密码。

#### 方案 2: 使用 Synology NAS
1. 登录你的 Synology DSM。
2. 打开 `控制面板` -> `文件服务` -> `WebDAV`。
3. 勾选 `启用 WebDAV` 和 `启用 HTTPS`。
4. 点击 `应用`。
5. 确保你有一个具有 WebDAV 访问权限的用户账号。

#### 方案 3: 使用其他 WebDAV 服务
请参考你所使用的 WebDAV 服务的文档，获取以下信息：
- WebDAV 服务器地址
- 用户名
- 密码

### 2. 填写到 Clean Nav 设置中

| Clean Nav 设置项 | 对应 WebDAV 服务的值 | 说明 |
| :--- | :--- | :--- |
| **URL** | WebDAV 服务器地址 | 例如 `https://your-nextcloud.com/remote.php/dav/files/your-username/` 或 `https://your-synology.com:5006` |
| **用户名** | WebDAV 用户名 | 例如 `your-username` 或 Nextcloud 生成的设备用户名 |
| **密码** | WebDAV 密码 | 例如 `your-password` 或 Nextcloud 生成的设备密码 |
| **文件路径** | 存数据的文件名 | 例如 `nav-data.json` 或 `Documents/nav-data.json` |

**注意事项：**
- 确保 WebDAV 服务器支持 CORS，允许浏览器直接访问
- 如果使用自签名证书，可能需要在浏览器中信任该证书
- 建议使用 HTTPS 协议，确保数据传输安全

点击保存并同步，如果提示“同步成功”，恭喜你，配置完成！

---

## 选项 E: 使用 Dropbox

适合已有 Dropbox 账号的用户，操作简单，无需复杂配置。

### 1. 获取 Dropbox Access Token

1. 登录 [Dropbox Developer 控制台](https://www.dropbox.com/developers/apps)。
2. 点击 **Create app**（创建应用）。
3. 在 **Choose an API** 中选择 **Scoped access**。
4. 在 **Choose the type of access you need** 中选择 **App folder**（仅访问应用专用文件夹，更安全）或 **Full Dropbox**（访问所有文件夹，不推荐）。
5. 填写 **Name your app**，例如 `clean-nav-sync`。
6. 点击 **Create app**。
7. 在应用详情页中，切换到 **Permissions** 标签页。
8. 勾选以下权限：
   - `files.content.read`（读取文件内容）
   - `files.content.write`（写入文件内容）
9. 点击 **Submit** 保存权限设置。
10. 切换到 **Settings** 标签页。
11. 在 **OAuth 2** 部分，找到 **Generated access token**，点击 **Generate**。
12. 复制生成的访问令牌（以 `sl.` 开头）。

### 2. 填写到 Clean Nav 设置中

| Clean Nav 设置项 | 对应 Dropbox 界面上的值 | 说明 |
| :--- | :--- | :--- |
| **Token** | 刚才复制的 `sl.xxx...` 令牌 | 例如 `sl.ABC123...` |
| **文件路径** | 数据文件在 Dropbox 中的路径 | 例如 `/nav-data.json`（App folder 模式下）或 `/Documents/nav-data.json`（Full Dropbox 模式下） |

点击保存并同步，如果提示“同步成功”，恭喜你，配置完成！

---

## 选项 F: 使用 Google Drive

适合已有 Google 账号的用户，需要创建 OAuth 客户端并获取访问令牌。

### 1. 创建 Google Cloud 项目

1. 登录 [Google Cloud Console](https://console.cloud.google.com/)。
2. 点击左上角的 **Select a project**，然后点击 **New Project**。
3. 填写项目名称，例如 `clean-nav-sync`，点击 **Create**。
4. 等待项目创建完成，然后在顶部选择该项目。

### 2. 启用 Google Drive API

1. 在 Google Cloud Console 中，点击左侧菜单的 **API & Services** -> **Library**。
2. 搜索 **Google Drive API**，点击进入。
3. 点击 **Enable** 启用 API。

### 3. 创建 OAuth 客户端 ID

1. 点击左侧菜单的 **API & Services** -> **Credentials**。
2. 点击 **Create Credentials** -> **OAuth client ID**。
3. 如果提示需要配置 **OAuth consent screen**，点击 **Configure consent screen**：
   - 选择 **External**，点击 **Create**。
   - 填写 **App name**（例如 `Clean Nav`）、**User support email** 和 **Developer contact information**。
   - 点击 **Save and Continue**，跳过其他步骤，最后点击 **Back to Dashboard**。
4. 回到 **Create OAuth client ID** 页面：
   - **Application type** 选择 **Web application**。
   - **Name** 填写 `clean-nav-client`。
   - 在 **Authorized JavaScript origins** 中添加 `http://localhost`（用于本地测试）和你的导航页域名（如果有）。
   - 点击 **Create**。
5. 复制生成的 **Client ID** 和 **Client Secret**（可选，根据需要）。

### 4. 获取访问令牌

由于 Google Drive API 的访问令牌需要通过 OAuth 2.0 授权流程获取，建议使用以下方法之一：

#### 方法 1: 使用 Google OAuth 2.0 Playground

1. 访问 [Google OAuth 2.0 Playground](https://developers.google.com/oauthplayground/)。
2. 点击右上角的 **Settings**（齿轮图标）。
3. 勾选 **Use your own OAuth credentials**。
4. 填写刚才生成的 **Client ID** 和 **Client Secret**。
5. 点击 **Close**。
6. 在左侧 **Step 1** 中，搜索并选择 **https://www.googleapis.com/auth/drive.file** 范围。
7. 点击 **Authorize APIs**，登录你的 Google 账号并授权。
8. 在 **Step 2** 中，点击 **Exchange authorization code for tokens**。
9. 复制生成的 **Access token**（有效期约 1 小时）和 **Refresh token**（永久有效，用于刷新访问令牌）。

#### 方法 2: 使用浏览器开发者工具（高级用户）

1. 在浏览器中打开一个新标签页。
2. 访问以下 URL（替换 `YOUR_CLIENT_ID` 为你的 Client ID）：
   ```
   https://accounts.google.com/o/oauth2/v2/auth?client_id=YOUR_CLIENT_ID&redirect_uri=http://localhost&response_type=token&scope=https://www.googleapis.com/auth/drive.file
   ```
3. 登录并授权后，浏览器地址栏会显示包含访问令牌的 URL，复制其中的 `access_token` 参数值。

### 5. 填写到 Clean Nav 设置中

| Clean Nav 设置项 | 对应 Google Cloud 界面上的值 | 说明 |
| :--- | :--- | :--- |
| **Token** | 刚才复制的访问令牌 | 例如 `ya29.XXX...` |
| **文件 ID** | Google Drive 文件的 ID（可选，首次使用时留空） | 例如 `1ABCDEF1234567890abcdef1234567890abcdef` |
| **文件名** | 数据文件的名称 | 例如 `nav-data.json` |

**首次使用说明**：
- 如果没有现有文件 ID，可以留空，系统会自动创建新文件。
- 创建文件后，你可以在 Google Drive 中找到该文件，然后从 URL 中获取文件 ID（例如 `https://drive.google.com/file/d/ FILE_ID /view` 中的 `FILE_ID`）。

点击保存并同步，如果提示“同步成功”，恭喜你，配置完成！

---

## 安全提示

- 所有存储方式的访问令牌都会在本地加密存储，确保你的数据安全。
- 建议定期更换访问令牌，特别是在使用公共设备时。
- 对于重要数据，建议启用双重验证（2FA）保护你的云存储账号。
- 定期备份你的导航数据，以防万一。
