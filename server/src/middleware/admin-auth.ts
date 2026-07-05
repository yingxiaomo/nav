import { createMiddleware } from 'hono/factory';
import { getCookie } from 'hono/cookie';
import { createHmac, randomBytes } from 'node:crypto';
import { hasAdminPassword, getApiToken, verifyApiToken, getSessionSecret } from '../services/admin-service.ts';

// 启动时生成随机 fallback secret，容器重启后旧 session 失效
const SESSION_SECRET = process.env.SESSION_SECRET ?? randomBytes(32).toString('hex');
const SESSION_COOKIE = 'admin_web_session';
const SESSION_TTL = 7 * 24 * 60 * 60 * 1000; // 7 天

/** 生成会话签名（内嵌过期时间） */
export function signAdminSession(value: string): string {
  const expires = Date.now() + SESSION_TTL;
  const payload = `${expires}:${value}`;
  const hmac = createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
  return `${expires}:${hmac}`;
}

/** 验证会话签名，通过返回 true，过期或无效返回 false */
export function verifySession(cookieValue: string, secret: string): boolean {
  const parts = cookieValue.split(':');
  if (parts.length !== 2) return false;
  const [expiresStr, hmac] = parts;
  const expires = parseInt(expiresStr, 10);
  if (isNaN(expires) || Date.now() > expires) return false;

  const payload = `${expiresStr}:${secret}`;
  const expected = createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
  if (hmac.length !== expected.length) return false;

  // 恒定时间比较
  let result = 0;
  for (let i = 0; i < hmac.length; i++) {
    result |= hmac.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return result === 0;
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

  // 允许前端页面获取监控数据（只读 GET）
  if (c.req.method === 'GET' && path.startsWith('/api/v1/admin/monitor/')) {
    await next();
    return;
  }

  // 检查 Authorization: Bearer <api-token>（用于前端 Widget 等非浏览器客户端）
  const authHeader = c.req.header('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    if (verifyApiToken(token)) {
      await next();
      return;
    }
    return c.json({ error: 'API 令牌无效' }, 401);
  }

  // 检查会话 cookie
  const cookieValue = getCookie(c, SESSION_COOKIE);
  if (!cookieValue) {
    return c.json({ error: '未登录，请先登录管理后台' }, 401);
  }

  // 验证 session
  const sessionSecret = getSessionSecret();
  if (sessionSecret && verifySession(cookieValue, sessionSecret)) {
    await next();
    return;
  }

  // 兼容旧版：用 API token 验证
  const apiToken = getApiToken();
  if (apiToken && verifySession(cookieValue, apiToken)) {
    await next();
    return;
  }

  if (process.env.ROOT_PASSWORD && verifySession(cookieValue, process.env.ROOT_PASSWORD)) {
    await next();
    return;
  }

  return c.json({ error: '会话已过期，请重新登录' }, 401);
});
