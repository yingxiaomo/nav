import { db } from '../db/index.ts';
import { settings } from '../db/schema.ts';
import { eq } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';

const ADMIN_PW_KEY = 'admin_password_hash';
const API_TOKEN_KEY = 'api_token';
const SESSION_KEY = 'admin_session_secret';

// ===== 会话密钥（管理后台登录用）=====

/** 生成并持久化会话密钥，返回密钥值 */
export function rotateSessionSecret(): string {
  const secret = randomBytes(32).toString('hex');
  db.insert(settings)
    .values({ key: SESSION_KEY, value: secret })
    .onConflictDoUpdate({ target: settings.key, set: { value: secret } })
    .run();
  return secret;
}

/** 获取当前会话密钥 */
export function getSessionSecret(): string | null {
  const row = db.select().from(settings).where(eq(settings.key, SESSION_KEY)).get();
  return row?.value ?? null;
}

// ===== 管理后台密码（用于登录管理页面）=====

/** 管理后台是否已配置密码 */
export function hasAdminPassword(): boolean {
  if (process.env.ROOT_PASSWORD) return true;
  const row = db.select().from(settings).where(eq(settings.key, ADMIN_PW_KEY)).get();
  return !!row;
}

/** 恒定时间比较 */
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/** 验证管理后台密码 */
export function verifyAdminPassword(input: string): boolean {
  const envPw = process.env.ROOT_PASSWORD;
  if (envPw) {
    // 环境变量密码：直接恒定时间比较
    return constantTimeCompare(input, envPw);
  }

  const row = db.select().from(settings).where(eq(settings.key, ADMIN_PW_KEY)).get();
  if (!row) return false;

  try {
    return bcrypt.compareSync(input, row.value);
  } catch {
    return false;
  }
}

/** 保存管理后台密码（首次配置用） */
export function saveAdminPassword(password: string): void {
  const hashed = bcrypt.hashSync(password, 10);
  db.insert(settings).values({ key: ADMIN_PW_KEY, value: hashed })
    .onConflictDoUpdate({ target: settings.key, set: { value: hashed } })
    .run();
}

// ===== API 令牌（前端连接用）=====

/** 后端是否已配置 API 令牌 */
export function hasApiToken(): boolean {
  if (process.env.API_TOKEN) return true;
  const row = db.select().from(settings).where(eq(settings.key, API_TOKEN_KEY)).get();
  return !!row;
}

/** 获取当前 API 令牌 */
export function getApiToken(): string | null {
  if (process.env.API_TOKEN) return process.env.API_TOKEN;
  const row = db.select().from(settings).where(eq(settings.key, API_TOKEN_KEY)).get();
  return row?.value ?? null;
}

/** 验证 API 令牌（时长恒定比较） */
export function verifyApiToken(input: string): boolean {
  const token = getApiToken();
  if (!token) return false;
  if (input.length !== token.length) return false;
  let result = 0;
  for (let i = 0; i < input.length; i++) {
    result |= input.charCodeAt(i) ^ token.charCodeAt(i);
  }
  return result === 0;
}

/** 生成随机 API 令牌 */
export function generateApiToken(): string {
  const bytes = randomBytes(32);
  return 'sk-' + bytes.toString('base64url');
}

/** 保存 API 令牌到数据库 */
export function saveApiToken(token: string): void {
  db.insert(settings)
    .values({ key: API_TOKEN_KEY, value: token })
    .onConflictDoUpdate({ target: settings.key, set: { value: token } })
    .run();
}
