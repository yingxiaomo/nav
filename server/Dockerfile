# ===== 构建阶段 =====
FROM node:20-alpine AS builder
WORKDIR /app

RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# ===== 运行阶段 =====
FROM node:20-alpine AS runner
WORKDIR /app

# 创建非 root 用户
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 node

# 只安装生产依赖
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# 从构建阶段复制源码和迁移文件
COPY --from=builder /app/src ./src
COPY --from=builder /app/drizzle ./drizzle

# 数据目录
RUN mkdir -p /app/data/uploads && chown -R node:nodejs /app/data

# ---- 环境变量 ----
ENV NODE_ENV=production
ENV PORT=8642
ENV DATABASE_URL=/app/data/nav.db
ENV UPLOAD_DIR=/app/data/uploads
ENV CORS_ORIGIN=*

EXPOSE 8642

USER node

CMD ["npx", "tsx", "src/index.ts"]
