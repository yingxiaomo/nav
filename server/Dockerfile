# ===== 构建阶段 =====
FROM node:20-alpine AS builder
WORKDIR /app

RUN apk add --no-cache python3 make g++ libc6-compat

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# ===== 运行阶段 =====
FROM node:20-alpine AS runner
WORKDIR /app

# 从构建阶段复制编译好的依赖（better-sqlite3 需要编译）
COPY --from=builder /app/node_modules ./node_modules
RUN npm prune --omit=dev && npm cache clean --force

# 从构建阶段复制源码和迁移文件
COPY --from=builder /app/src ./src
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/public ./public

# 数据目录
RUN mkdir -p /app/data/uploads

# ---- 环境变量 ----
ENV NODE_ENV=production
ENV PORT=8642
ENV DATABASE_URL=/app/data/nav.db
ENV UPLOAD_DIR=/app/data/uploads
ENV CORS_ORIGIN=*

EXPOSE 8642

USER node

CMD ["npx", "tsx", "src/index.ts"]
