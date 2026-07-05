import { createMiddleware } from 'hono/factory';
import { verifyApiToken, hasApiToken } from '../services/admin-service.ts';

/**
 * API 认证中间件
 *
 * 保护所有 /api/v1/* 路由（排除 auth 端点和 health）
 * 前端通过 Authorization: Bearer <api-token> 访问
 */
export const authMiddleware = createMiddleware(async (c, next) => {
  const path = c.req.path;

  // 健康检查和 CORS 预检放行
  if (path === '/api/v1/health' || c.req.method === 'OPTIONS') {
    await next();
    return;
  }

  // Auth 端点和管理 API（登录、状态等）不要求 Bearer token
  if (path.startsWith('/api/v1/auth/') || path.startsWith('/api/v1/admin/')) {
    await next();
    return;
  }

  // 合体镜像模式：同源请求（前端页面 → 后端 API）免令牌
  // 检查 Origin 或 Referer 是否与服务器地址匹配
  const host = c.req.header('Host') ?? '';
  const origin = c.req.header('Origin');
  const referer = c.req.header('Referer');

  const isSameOrigin =
    (origin && (origin.includes(`://${host}`) || origin.includes('://localhost'))) ||
    (referer && (referer.includes(`://${host}`) || referer.includes('://localhost')));

  if (isSameOrigin) {
    await next();
    return;
  }

  // 需要 API 令牌的请求
  if (!hasApiToken()) {
    return c.json({ error: '服务未初始化，请先配置 API 令牌' }, 503);
  }

  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: '缺少 Authorization 头，格式: Bearer <api-token>' }, 401);
  }

  if (!verifyApiToken(authHeader.slice(7))) {
    return c.json({ error: 'API 令牌无效' }, 401);
  }

  await next();
});
