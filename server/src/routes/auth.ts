import { Hono, type Context } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { signAdminSession, verifySession } from '../middleware/admin-auth.ts';
import {
  hasAdminPassword, verifyAdminPassword, saveAdminPassword,
  hasApiToken, getApiToken, generateApiToken, saveApiToken,
  rotateSessionSecret, getSessionSecret,
} from '../services/admin-service.ts';
import { info, warn } from '../services/logger.ts';

const authRoutes = new Hono();
const SESSION_COOKIE = 'admin_web_session';

// ===== 登录频率限制（内存中，重启重置）=====
const loginAttempts = new Map<string, { count: number; until: number }>();
const MAX_ATTEMPTS = 5;
const BLOCK_DURATION = 15 * 60 * 1000; // 15 分钟

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (entry && entry.until > now) return false; // 还处于封锁期
  if (entry && entry.until <= now) loginAttempts.delete(ip); // 封锁期过了
  return true;
}

function recordAttempt(ip: string, success: boolean): void {
  if (success) {
    loginAttempts.delete(ip);
    return;
  }
  const now = Date.now();
  const entry = loginAttempts.get(ip) ?? { count: 0, until: now };
  entry.count++;
  if (entry.count >= MAX_ATTEMPTS) {
    entry.until = now + BLOCK_DURATION;
    entry.count = 0;
  }
  loginAttempts.set(ip, entry);
}

/** 检查当前请求的 admin session 是否有效 */
function checkSession(c: Context): boolean {
  const cookieValue = getCookie(c, SESSION_COOKIE);
  if (!cookieValue) return false;

  // 用 DB 中的会话密钥验证 session
  const sessionSecret = getSessionSecret();
  if (sessionSecret && verifySession(cookieValue, sessionSecret)) {
    return true;
  }

  // 用 API token 验证 session（兼容旧版）
  const apiToken = getApiToken();
  if (apiToken && verifySession(cookieValue, apiToken)) {
    return true;
  }

  // 用环境变量密码验证 session
  if (process.env.ROOT_PASSWORD && verifySession(cookieValue, process.env.ROOT_PASSWORD)) {
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

// ===== POST /api/v1/auth/setup — 首次配置（仅创建管理员密码）=====

const setupSchema = z.object({
  password: z.string().min(6, '密码至少 6 位'),
});

authRoutes.post('/setup', zValidator('json', setupSchema), async (c) => {
  if (hasAdminPassword()) {
    warn(`setup rejected — already configured`);
    return c.json({ error: '管理员密码已配置，不能重复初始化' }, 400);
  }

  const { password } = c.req.valid('json');
  saveAdminPassword(password);
  info('[auth] setup complete — admin password saved');

  return c.json({ success: true }, 201);
});

// ===== POST /api/v1/auth/login — 管理员登录 =====

const loginSchema = z.object({
  password: z.string().min(1, '请输入管理员密码'),
});

authRoutes.post('/login', zValidator('json', loginSchema), async (c) => {
  const { password } = c.req.valid('json');
  const ip = c.req.header('x-forwarded-for') ?? c.req.header('cf-connecting-ip') ?? 'unknown';

  if (!hasAdminPassword()) {
    warn(`[auth] login failed — no admin password configured (ip=${ip})`);
    return c.json({ error: '管理员密码未配置，请先完成初始化', setupRequired: true }, 400);
  }

  // 限流检查
  if (!checkRateLimit(ip)) {
    warn(`[auth] login rate limited (ip=${ip})`);
    return c.json({ error: '登录尝试过于频繁，请 15 分钟后再试' }, 429);
  }

  if (!verifyAdminPassword(password)) {
    recordAttempt(ip, false);
    warn(`[auth] login failed — wrong password (ip=${ip})`);
    return c.json({ error: '密码错误' }, 401);
  }

  recordAttempt(ip, true);

  // 生成会话密钥并签名
  const secret = rotateSessionSecret();
  info(`[auth] login success (ip=${ip})`);

  // 判断是否 HTTPS：X-Forwarded-Proto 用于反代场景，fallback 检测 URL
  const isSecure = c.req.header('X-Forwarded-Proto') === 'https' ||
                   c.req.url.startsWith('https://');

  setCookie(c, SESSION_COOKIE, signAdminSession(secret), {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'Lax',
    path: '/',
    maxAge: 86400 * 7,
  });

  return c.json({ success: true });
});

// ===== POST /api/v1/auth/logout =====

authRoutes.post('/logout', async (c) => {
  rotateSessionSecret(); // 使所有现有 session 失效
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
  info('[auth] API token regenerated');

  return c.json({
    success: true,
    token: newToken,
    message: 'API 令牌已重新生成，前端需要使用新令牌连接',
  });
});

// ===== POST /api/v1/auth/change-password — 修改管理员密码 =====

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, '请输入当前密码'),
  newPassword: z.string().min(6, '新密码至少 6 位'),
});

authRoutes.post('/change-password', zValidator('json', changePasswordSchema), async (c) => {
  if (!checkSession(c)) {
    return c.json({ error: '未登录' }, 401);
  }

  const { currentPassword, newPassword } = c.req.valid('json');

  if (!verifyAdminPassword(currentPassword)) {
    warn(`[auth] change-password failed — wrong current password`);
    return c.json({ error: '当前密码错误' }, 403);
  }

  saveAdminPassword(newPassword);
  rotateSessionSecret(); // 使所有现有 session 失效，强制重新登录
  info(`[auth] password changed successfully`);

  return c.json({
    success: true,
    message: '密码已修改，请重新登录',
  });
});

export default authRoutes;
