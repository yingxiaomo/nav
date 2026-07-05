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

> 如需使用 Docker 容器日志功能，需挂载 Docker socket：`-v /var/run/docker.sock:/var/run/docker.sock`

## API 概览

所有接口前缀：`/api/v1`

### 核心数据接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /health | 健康检查 |
| GET | /data | 获取完整数据快照（分类、书签、待办、笔记、设置） |
| PUT | /data | 全量替换数据（事务写入） |
| GET | /parse?url=... | 解析网页元数据（标题、描述、图标、封面图） |
| GET | /suggest?q=...&source=... | 搜索联想词 |
| GET/POST | /categories | 分类 CRUD |
| PUT/DELETE | /categories/:id | 分类 CRUD |
| GET/POST | /bookmarks | 书签 CRUD |
| PUT/DELETE | /bookmarks/:id | 书签 CRUD |
| GET/POST | /todos | 待办 CRUD |
| PUT/DELETE | /todos/:id | 待办 CRUD |
| GET/POST | /notes | 笔记 CRUD |
| PUT/DELETE | /notes/:id | 笔记 CRUD |
| GET | /settings | 获取所有配置 |
| PUT | /settings | 批量更新配置 |
| POST | /upload | 上传图片 |

### 系统监控接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /admin/monitor/system | 系统资源（CPU/内存/磁盘/运行时间） |
| GET | /admin/monitor/checks | 所有监控目标及巡检结果 |
| POST | /admin/monitor/checks | 添加监控目标 |
| PUT | /admin/monitor/checks/:id | 编辑监控目标 |
| DELETE | /admin/monitor/checks/:id | 删除监控目标 |
| POST | /admin/monitor/fetch-icon | 自动识别目标页面的 favicon |
| POST | /admin/monitor/wol/:id | 按监控目标 ID 发送 WOL 魔法包 |
| POST | /admin/monitor/wol | 按 MAC 地址发送 WOL 魔法包 |

### Docker 管理接口

> 需要 Docker socket 挂载 (`-v /var/run/docker.sock:/var/run/docker.sock`)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /admin/docker/containers | 列出所有容器 |
| GET | /admin/docker/logs/:name | SSE 流式推送容器日志 |

### 管理后台接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /admin/logs?lines=300 | 获取后端运行日志 |
| GET | /admin/backup | 服务端全量备份（含监控目标） |
| POST | /admin/backup | 导入全量备份（保留内部密钥） |

### 认证接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /auth/setup | 首次配置管理员密码和 API 令牌 |
| POST | /auth/login | 管理员登录 |
| POST | /auth/logout | 退出登录 |
| GET | /auth/status | 检查配置和登录状态 |
| GET | /auth/api-token | 查看当前 API 令牌（需登录） |
| POST | /auth/api-token | 重新生成 API 令牌（需登录） |

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
| DISABLE_MONITORING | false | 设为 true 关闭监控功能（独立后端/公网部署） |

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
