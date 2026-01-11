# 云同步配置指南

本项目支持多种数据存储方式，除了默认的 GitHub 仓库同步外，还支持兼容 S3 协议的对象存储（如 Cloudflare R2）。

---

## 推荐：使用 Cloudflare R2 (免费、高速)

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
