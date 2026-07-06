import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { readFileSync } from 'node:fs';
import { authMiddleware } from './middleware/auth.ts';
import { adminAuthMiddleware } from './middleware/admin-auth.ts';
import { apiError } from './utils/response.ts';
import categoryRoutes from './routes/categories.ts';
import bookmarkRoutes from './routes/bookmarks.ts';
import settingRoutes from './routes/settings.ts';
import todoRoutes from './routes/todos.ts';
import noteRoutes from './routes/notes.ts';
import uploadRoutes from './routes/upload.ts';
import dataRoutes from './routes/data.ts';
import parseRoutes from './routes/parse.ts';
import suggestRoutes from './routes/suggest.ts';
import authRoutes from './routes/auth.ts';
import adminRoutes from './routes/admin.ts';
import monitorRoutes from './routes/monitor.ts';

const app = new Hono();

// ===== 全局中间件 =====
const corsOrigin = process.env.CORS_ORIGIN ?? '*';
app.use('*', cors({
  origin: corsOrigin,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// ===== 静态文件（上传目录 + 管理后台）=====
app.use('/uploads/*', serveStatic({ root: './data' }));
app.use('/admin/*', serveStatic({ root: './public' }));

// ===== 健康检查（无需认证）=====
app.get('/api/v1/health', (c) => {
  return c.json({ status: 'ok', time: Date.now() });
});

// ===== 认证中间件 =====
// 请求日志（方便排查）
app.use('/api/v1/*', async (c, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  if (c.res.status >= 400) {
    console.log(`[${c.req.method}] ${c.req.path} → ${c.res.status} (${ms}ms)`);
  }
});

// API 级认证：保护所有 /api/v1/* 路由，/api/v1/auth/* 和 /health 免检
app.use('/api/v1/*', authMiddleware);
// 管理后台认证：保护 /api/v1/auth/* 和 /api/v1/admin/* 中的管理端点
app.use('/api/v1/auth/*', adminAuthMiddleware);
app.use('/api/v1/admin/*', adminAuthMiddleware);

// ===== 注册路由 =====
app.route('/api/v1/auth', authRoutes);
app.route('/api/v1/categories', categoryRoutes);
app.route('/api/v1/bookmarks', bookmarkRoutes);
app.route('/api/v1/settings', settingRoutes);
app.route('/api/v1/todos', todoRoutes);
app.route('/api/v1/notes', noteRoutes);
app.route('/api/v1/upload', uploadRoutes);
app.route('/api/v1/data', dataRoutes);
app.route('/api/v1/parse', parseRoutes);
app.route('/api/v1/suggest', suggestRoutes);
app.route('/api/v1/admin', adminRoutes);
app.route('/api/v1/admin/monitor', monitorRoutes);

// ===== 全局错误处理 =====
app.onError((err, c) => {
  console.error(`[${c.req.method}] ${c.req.path}:`, err);
  return c.json(apiError('服务器内部错误', 'INTERNAL_ERROR'), 500);
});

// ===== 管理后台（Next.js 导出为 flat HTML，显式映射 /admin → /admin.html）=====
app.get('/admin', (c) => {
  try {
    const html = readFileSync('./public/admin.html', 'utf-8');
    return c.html(html);
  } catch {
    return c.redirect('/');
  }
});

// ===== 前端静态文件（合体镜像模式，未匹配 API 的请求走这里）=====
app.use('/*', serveStatic({ root: './public' }));

// ===== 启动 =====
const port = parseInt(process.env.PORT ?? '8642', 10);

console.log(`Nav Server 启动成功`);
console.log(`  地址: http://localhost:${port}`);
console.log(`  API:  http://localhost:${port}/api/v1`);

serve({ fetch: app.fetch, port });