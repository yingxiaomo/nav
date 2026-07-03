import { createMiddleware } from 'hono/factory';
import { getCookie } from 'hono/cookie';
import { createHmac } from 'node:crypto';
import { hasAdminPassword } from '../services/admin-service.ts';

const SESSION_SECRET = process.env.SESSION_SECRET ?? 'nav-admin-web-session';
const SESSION_COOKIE = 'admin_web_session';

/** 生成会话签名 */
export function signAdminSession(password: string): string {
  return createHmac('sha256', SESSION_SECRET).update(password).digest('hex');
}

/**
 * 管理后台认证中间件
 *
 * 保护 /api/v1/auth/* 中的管理端点（token 管理等）
 * 登录和设置端点（/login, /setup, /status）免认证
 */
export const adminAuthMiddleware = createMiddleware(async (c, next) => {
  const path = c.req.path;

  // 免认证端点
  const publicPaths = ['/api/v1/auth/login', '/api/v1/auth/setup', '/api/v1/auth/status'];
  if (publicPaths.includes(path)) {
    await next();
    return;
  }

  // 未配置管理密码时允许访问 setup
  if (path === '/api/v1/auth/setup' && !hasAdminPassword()) {
    await next();
    return;
  }

  // 检查会话 cookie
  const cookieValue = getCookie(c, SESSION_COOKIE);
  if (!cookieValue) {
    return c.json({ error: '未登录，请先登录管理后台' }, 401);
  }

  // 验证 session（从 DB 或 env 读取密码来签名比对）
  const { getApiToken } = await import('../services/admin-service.ts');
  const token = getApiToken();
  if (token && cookieValue === signAdminSession(token)) {
    await next();
    return;
  }

  // 也允许通过环境变量密码登录的会话
  if (process.env.ROOT_PASSWORD && cookieValue === signAdminSession(process.env.ROOT_PASSWORD)) {
    await next();
    return;
  }

  return c.json({ error: '会话已过期，请重新登录' }, 401);
});
