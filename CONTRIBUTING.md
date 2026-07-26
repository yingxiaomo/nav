# 开发文档 / 贡献指南

本文面向想要二次开发或贡献代码的开发者，帮助你快速建立全局认知并找到下手点。

## 一、项目定位（先读这条）

Clean Nav 是一个**极简 Homelab 导航页**，工程决策始终以**轻量、高内聚**优先，**拒绝企业级过度工程化**。

关键的架构约束：

- **前端是一个可独立部署的项目**：`next build`（`output: export`）产出纯静态站，可托管到 GitHub Pages 等任意静态托管。此形态下仅纯前端功能可用——书签管理、`localStorage` 持久化、云同步适配器（GitHub / Gist / S3 / WebDAV / Dropbox / Google Drive）。
- **后端只是 Docker 全合一部署的增强**，不是前端的依赖。Go 后端提供 SQLite 持久化、监控、Docker 管理、SSH、Telegram Bot 等增强能力。
- **改动前端时，任何变更都不得让静态导出功能退化。** 验证方式：`npx next build` 应成功产出 `out/`。

三种部署形态：

| 形态 | 说明 | 数据存储 |
|------|------|---------|
| 纯静态托管 | `next build` → 托管静态站 | localStorage + 云同步适配器 |
| Docker 全合一 | Go 后端 + 前端静态产物同容器 | SQLite（后端） |
| 本地开发 | 前端 `next dev` + 后端分别跑，前端经 rewrite 代理到后端 | 视配置 |

## 二、技术栈

| 层 | 技术 |
|----|------|
| 前端 | Next.js 16 (App Router) · React 19 · Tailwind 4 · shadcn/ui · zustand · TanStack Query · Fuse.js · dnd-kit |
| 后端 | Go 1.25+ · `modernc.org/sqlite`（纯 Go）· 标准库 `net/http` ServeMux |
| 容器 | 多阶段构建 → `FROM scratch` |

## 三、目录结构

```
app/            Next.js 页面（首页 / admin / probe）
components/     React 组件（ui 原语 / nav 主页 / features 功能 / admin 后台）
lib/            纯前端代码（adapters 云同步 / hooks / parsers / stores / types / utils）
cmd/nav-server/ Go 服务入口 main.go
internal/       Go 后端
  ├─ db/        连接 + 迁移(db.go 的 Migrate) + queries/ 各领域 CRUD
  ├─ handler/   HTTP 处理器，共享 Handler 结构体；路由集中在 handler.go 的 RegisterRoutes
  ├─ middleware/ SessionAuth（默认拒绝授权）
  ├─ model/     数据模型 + RespondJSON/RespondError/NewID/Now 等工具
  ├─ service/   业务逻辑（monitor / docker / parser / wol / sysinfo）
  ├─ remote/    SSH 执行 + 主机密钥 TOFU
  ├─ secret/    敏感字段静态加密（NAV_SECRET_KEY）
  ├─ notify/    监控告警（Apprise 后端）
  └─ tgbot/     Telegram Bot
```

## 四、本地开发

```bash
# 后端（终端 1）
go build -o nav-server.exe ./cmd/nav-server/ && ./nav-server.exe   # 监听 :8642

# 前端（终端 2）—— 开发时 /api 经 next.config.ts 的 rewrite 代理到 :8642
npm run dev                                                        # 监听 :3000

# 检查
go build ./...        # Go 编译
go vet ./...          # Go 静态分析
go test ./...         # Go 测试
npx tsc --noEmit      # 前端类型检查
npm test              # 前端单测（vitest）
npx next build        # 前端构建（同时验证静态导出）
```

全合一部署产物：`npx next build` 生成的 `out/` 拷入 `public/`，由 Go 后端一并提供静态服务。

## 五、扩展点 Recipes（常见二次开发）

### 加一个云同步适配器（纯前端）
1. 在 `lib/adapters/` 新建 `xxx-adapter.ts`，实现 `StorageAdapter` 接口（见 `lib/adapters/storage.ts`：`load()` / `save()` / 可选 `uploadFile()`）。
2. 在 `lib/adapters/index.ts` 导出。
3. 在 `lib/hooks/use-storage-config.ts` 的 `getAdapter` switch 里加一个 `case`。
4. 在设置对话框的存储 tab（`components/nav/settings/storage-tab.tsx`）加对应表单。

### 加一个 API 端点（后端）
1. 在 `internal/handler/` 对应文件写 `func (h *Handler) Xxx() http.HandlerFunc`，用 `model.RespondJSON` / `model.RespondError` 响应。
2. 在 `internal/handler/handler.go` 的 `RegisterRoutes` 注册路由（分组注释保持清晰）。
3. **鉴权**：`middleware/admin.go` 是默认拒绝——公开只读 GET 端点需加入 `publicReadExact` 白名单；其余端点自动要求登录会话。切勿把返回机密的端点开成公开。

### 加一个 Admin 标签页（前端）
1. 在 `components/admin/tabs/` 新建组件，用 `req()`（来自 `admin-tabs.tsx`）调后端 API。
2. 在 `components/admin/admin-tabs.tsx` 的 tab 列表注册。

### 加一个数据库迁移（后端）
- 只在 `internal/db/db.go` 的 `Migrate()` **末尾追加**，用 `CREATE TABLE IF NOT EXISTS` / `addColumnIfNotExists()`。**不要修改已有迁移**（破坏向前兼容）。

## 六、安全约定（务必遵守）

- **授权默认拒绝**：`middleware/admin.go` 中，敏感端点无论 GET/POST 都要求会话；只有 `publicReadExact` 白名单里的 GET 对匿名访客开放（首页展示数据走已脱敏的 `/api/v1/data`）。
- **敏感凭证**：SSH / 设备密码经 `internal/secret` 可选静态加密，主密钥来自环境变量 `NAV_SECRET_KEY`（不设则明文，向后兼容）。
- **SSRF**：服务端拉取用户 URL（`service/parser.go`）按**解析后的 IP** 判定内网，拒绝内网/元数据地址。
- **SSH 主机密钥**：`remote/hostkey.go` 采用 TOFU（首次信任、之后校验指纹），known_hosts 存 `data/ssh_known_hosts.json`。
- **限流 key** 必须用 `ipFromRemote()` 剥离端口。
- SQL 一律参数化（`?` 占位），查询用 `*Context` 变体传 `r.Context()`。

## 七、代码规范要点

- Go handler 统一 `(h *Handler)` 接收者，与路由同名；错误/成功响应统一走 `model.RespondError` / `RespondJSON`。
- 前端客户端组件加 `"use client"`；`ui/` 只放无业务逻辑的原语；全局 UI 状态用 zustand，服务端数据用 TanStack Query。
- 导入别名 `@/` 映射项目根；图标统一 `lucide-react`。
- 提交信息用中文，简明扼要。

## 八、明确拒绝的方向（不要提 PR）

为保持极简，以下方向**不接受**：第三方路由框架（chi/gin 等）、前后端类型自动生成、RBAC 权限分级、CSRF anti-token、为假想扩展性引入的抽象层/插件系统/DI 框架。需要扩展时，针对具体扩展点做最小改动即可。
