# 云同步配置指南

本项目支持多种数据存储方式，包括：

- **GitHub 私有仓库**：适合熟悉 GitHub 的用户
- **GitHub Gist**：适合快速上手，无需创建新仓库
- **S3 兼容存储**：如 Cloudflare R2、AWS S3、MinIO 等
- **WebDAV**：适合自建存储或使用 Nextcloud 等服务

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
