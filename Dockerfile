# ===== All-in-One 镜像 =====
# 一个容器同时提供前端页面 + 后端 API
# 前端构建为静态导出，由 Hono 直接 serve

# ---- 阶段 1：构建前端静态文件 ----
FROM node:20-alpine AS frontend
WORKDIR /app
RUN apk add --no-cache libc6-compat

ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build

# ---- 阶段 2：运行后端 ----
FROM node:20-alpine AS runner
WORKDIR /app

# node:alpine 镜像已内置 node 用户，复用即可

# 后端依赖（better-sqlite3 需要编译，需安装 Python）
COPY server/package.json server/package-lock.json ./
RUN apk add --no-cache --virtual .build-deps python3 make g++ && \
    npm ci --omit=dev && \
    apk del .build-deps && \
    npm cache clean --force

# 前端静态文件（Hono 以 ./public/ 根目录 serve）
COPY --from=frontend --chown=node /app/out ./public

# 管理后台页面（与前端静态文件不冲突）
COPY --from=frontend --chown=node /app/server/public ./public

# 后端代码
COPY --from=frontend --chown=node /app/server/src ./src
COPY --from=frontend --chown=node /app/server/drizzle ./drizzle

# 数据目录
RUN mkdir -p /app/data/uploads && chown -R node /app/data

ENV NODE_ENV=production
ENV PORT=8642
ENV DATABASE_URL=/app/data/nav.db
ENV UPLOAD_DIR=/app/data/uploads
ENV CORS_ORIGIN=*

EXPOSE 8642

USER node

CMD ["npx", "tsx", "src/index.ts"]
