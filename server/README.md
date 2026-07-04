# Nav Server

Clean Nav 的配套后端 API 服务。提供本地 SQLite 持久化存储，支持 Docker 或直接运行。

## 快速启动

### 直接运行

```bash
npm install
npm run db:push
npm run dev
```

### Docker

```bash
docker compose -f server/docker-compose.yml up -d
```

## API 概览

所有接口前缀：`/api/v1`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /health | 健康检查 |
| GET | /data | 获取完整数据快照（一次性返回所有数据） |
| PUT | /data | 全量替换数据（事务写入） |
| GET | /parse?url=... | 解析网页元数据（标题、描述、图标、封面图） |
| GET | /suggest?q=...&source=... | 搜索联想词（支持 duckduckgo / google / baidu） |
| GET | /categories | 获取全部分类（含书签） |
| POST | /categories | 创建分类 |
| PUT | /categories/:id | 更新分类 |
| DELETE | /categories/:id | 删除分类 |
| GET | /bookmarks | 获取书签（支持 ?categoryId= 筛选） |
| POST | /bookmarks | 创建书签 |
| PUT | /bookmarks/:id | 更新书签 |
| DELETE | /bookmarks/:id | 删除书签 |
| PATCH | /bookmarks/reorder | 批量排序 |
| GET | /todos | 获取待办 |
| POST | /todos | 创建待办 |
| PUT | /todos/:id | 更新待办 |
| DELETE | /todos/:id | 删除待办 |
| GET | /notes | 获取笔记 |
| POST | /notes | 创建笔记 |
| PUT | /notes/:id | 更新笔记 |
| DELETE | /notes/:id | 删除笔记 |
| GET | /settings | 获取所有配置 |
| PUT | /settings | 批量更新配置 |
| POST | /upload | 上传图片 |

## 数据模型

后端返回的 JSON 字段采用 **camelCase**，与前端的 `DataSchema` 类型完全对齐：

```json
{
  "settings": { "title": "Clean Nav", "blurLevel": "medium", ... },
  "categories": [
    {
      "id": "...",
      "title": "开发工具",
      "links": [
        { "id": "...", "title": "GitHub", "url": "...", "description": "...", "icon": "..." }
      ]
    }
  ],
  "todos": [
    { "id": "...", "text": "完成文档", "completed": false, "createdAt": 1700000000000 }
  ],
  "notes": [
    { "id": "...", "title": "备忘", "content": "...", "updatedAt": 1700000000000 }
  ],
  "pinnedLinks": [
    { "id": "...", "title": "GitHub", "url": "https://github.com" }
  ]
}
```

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| PORT | 8642 | 服务端口 |
| DATABASE_URL | ./data/nav.db | 数据库文件路径 |
| UPLOAD_DIR | ./data/uploads | 上传文件存储目录 |
| CORS_ORIGIN | * | CORS 允许的起源，生产环境建议设为前端域名 |
| ROOT_PASSWORD | 空 | 管理员密码（不设则首次启动通过 Web 界面配置）|
| ADMIN_SALT | 自动生成 | 密码加密盐值 |

## 安全

### 两套认证体系

后端有两层独立的认证：

| 凭据 | 用途 | 配置方式 |
|------|------|---------|
| **管理员密码** | 登录 Web 管理后台 | 首次启动通过 `/admin/` 页面设置，或设环境变量 `ROOT_PASSWORD` |
| **API 令牌** | 前端连接后端使用 | 登录管理后台后生成，前端通过 `Authorization: Bearer <token>` 发送 |

### 首次启动流程

1. 启动服务后，访问 `http://your-server:8642/admin/`
2. 页面自动进入配置界面
3. 设置管理员密码（6 位以上）
4. 系统自动生成一个 API 令牌
5. **保存此令牌**（仅显示一次）

### 前端连接方式

1. 在导航页设置 → 云同步 → 选择「本地服务器」
2. 后端地址填入 `http://your-server:8642`
3. API 令牌填入上一步保存的密钥
4. 所有数据读写将通过 API 令牌进行认证

> **合体镜像用户**：如果你使用的是合体镜像（前端+后端同一容器），前端和后端同源，自动免令牌认证，无需额外配置。

### API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/v1/health | 健康检查（无需认证） |
| POST | /api/v1/auth/setup | 首次配置管理员密码和 API 令牌 |
| POST | /api/v1/auth/login | 管理员登录 |
| POST | /api/v1/auth/logout | 退出登录 |
| GET | /api/v1/auth/status | 检查配置和登录状态 |
| GET | /api/v1/auth/api-token | 查看当前 API 令牌（需登录） |
| POST | /api/v1/auth/api-token | 重新生成 API 令牌（需登录） |

### HTTPS 要求

公网部署**必须使用 HTTPS**，否则 API Token 明文传输无安全意义。推荐：

- 使用 [Caddy](https://caddyserver.com/) 反向代理（自动 HTTPS）
- 使用 [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) 隧道（零配置 HTTPS）
- 使用 Nginx + Let's Encrypt

### 网络隔离

后端默认允许跨域（`CORS_ORIGIN=*`）。生产环境建议：

1. 设置 `CORS_ORIGIN=https://你的前端域名.com`
2. 用防火墙限制端口（`8642`）的来源 IP，不直接暴露给公网
3. 推荐架构：用户 → CDN（前端静态文件）→ 反向代理 → 后端 API

## 技术栈

- **框架**: Hono
- **数据库**: SQLite (better-sqlite3) + Drizzle ORM
- **运行时**: TypeScript (tsx)
