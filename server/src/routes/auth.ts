import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { signAdminSession } from '../middleware/admin-auth.ts';
import {
  hasAdminPassword, verifyAdminPassword, saveAdminPassword,
  hasApiToken, getApiToken, verifyApiToken, generateApiToken, saveApiToken,
} from '../services/admin-service.ts';

const authRoutes = new Hono();
const SESSION_COOKIE = 'admin_web_session';

/** 检查当前请求的 admin session 是否有效 */
function checkSession(c: Parameters<typeof authRoutes.get>[1] extends (...a: infer A) => unknown ? A[0] : never): boolean {
  const cookieValue = getCookie(c, SESSION_COOKIE);
  if (!cookieValue) return false;

  // 对比环境变量密码
  if (process.env.ROOT_PASSWORD && cookieValue === signAdminSession(process.env.ROOT_PASSWORD)) {
    return true;
  }

  // 对比 API token（作为 session 签名因子）
  const apiToken = getApiToken();
  if (apiToken && cookieValue === signAdminSession(apiToken)) {
    return true;
  }

  return false;
}

// ===== GET /api/v1/auth/status — 检查状态 =====

authRoutes.get('/status', async (c) => {
  const pwConfigured = hasAdminPassword();
  const tokenConfigured = hasApiToken();
  const loggedIn = checkSession(c);

  return c.json({
    setupRequired: !pwConfigured,
    tokenConfigured,
    loggedIn,
  });
});

// ===== POST /api/v1/auth/setup — 首次配置（创建管理员密码 + API 令牌）=====

const setupSchema = z.object({
  password: z.string().min(6, '密码至少 6 位'),
  token: z.string().optional(), // 可选：自定义 API 令牌
});

authRoutes.post('/setup', zValidator('json', setupSchema), async (c) => {
  if (hasAdminPassword()) {
    return c.json({ error: '管理员密码已配置，不能重复初始化' }, 400);
  }

  const body = c.req.valid('json');

  // 创建管理员密码
  saveAdminPassword(body.password);

  // 生成 API 令牌
  const apiToken = body.token ?? generateApiToken();
  saveApiToken(apiToken);

  // 自动登录
  setCookie(c, SESSION_COOKIE, signAdminSession(apiToken), {
    httpOnly: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: 86400 * 7,
  });

  return c.json({
    success: true,
    token: apiToken,
    message: '管理员密码和 API 令牌已配置，请保存此令牌',
  }, 201);
});

// ===== POST /api/v1/auth/login — 管理员登录 =====

const loginSchema = z.object({
  password: z.string().min(1, '请输入管理员密码'),
});

authRoutes.post('/login', zValidator('json', loginSchema), async (c) => {
  const { password } = c.req.valid('json');

  if (!hasAdminPassword()) {
    return c.json({ error: '管理员密码未配置，请先完成初始化', setupRequired: true }, 400);
  }

  if (!verifyAdminPassword(password)) {
    return c.json({ error: '密码错误' }, 401);
  }

  // 用 API token 签名 session
  const apiToken = getApiToken();
  const sessionValue = apiToken ? signAdminSession(apiToken) : signAdminSession(password);

  setCookie(c, SESSION_COOKIE, sessionValue, {
    httpOnly: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: 86400 * 7,
  });

  return c.json({ success: true });
});

// ===== POST /api/v1/auth/logout =====

authRoutes.post('/logout', async (c) => {
  deleteCookie(c, SESSION_COOKIE, { path: '/' });
  return c.json({ success: true });
});

// ===== GET /api/v1/auth/api-token — 查看当前 API 令牌 =====

authRoutes.get('/api-token', async (c) => {
  if (!checkSession(c)) {
    return c.json({ error: '未登录' }, 401);
  }
  return c.json({ token: getApiToken() ?? '' });
});

// ===== POST /api/v1/auth/api-token — 重新生成 API 令牌 =====

authRoutes.post('/api-token', async (c) => {
  if (!checkSession(c)) {
    return c.json({ error: '未登录' }, 401);
  }

  const newToken = generateApiToken();
  saveApiToken(newToken);

  // 刷新 session
  setCookie(c, SESSION_COOKIE, signAdminSession(newToken), {
    httpOnly: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: 86400 * 7,
  });

  return c.json({
    success: true,
    token: newToken,
    message: 'API 令牌已重新生成，前端需要使用新令牌连接',
  });
});

export default authRoutes;
