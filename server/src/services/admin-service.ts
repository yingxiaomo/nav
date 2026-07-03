import { db } from '../db/index.ts';
import { settings } from '../db/schema.ts';
import { eq } from 'drizzle-orm';
import { randomBytes, createHash } from 'node:crypto';

const ADMIN_PW_KEY = 'admin_password_hash';
const API_TOKEN_KEY = 'api_token';
const SALT_KEY = 'admin_salt';

// ===== 管理后台密码（用于登录管理页面）=====

function getSalt(): string {
  // 优先使用环境变量中的固定 salt，保证重启后 hash 一致
  if (process.env.ADMIN_SALT) return process.env.ADMIN_SALT;

  const row = db.select().from(settings).where(eq(settings.key, SALT_KEY)).get();
  if (row) return row.value;

  // 自动生成 salt
  const salt = randomBytes(16).toString('hex');
  try {
    db.insert(settings).values({ key: SALT_KEY, value: salt }).run();
  } catch { /* 并发冲突忽略 */ }
  return salt;
}

function hashPassword(password: string): string {
  const salt = getSalt();
  return createHash('sha256').update(salt + password).digest('hex');
}

/** 管理后台是否已配置密码 */
export function hasAdminPassword(): boolean {
  if (process.env.ROOT_PASSWORD) return true;
  const row = db.select().from(settings).where(eq(settings.key, ADMIN_PW_KEY)).get();
  return !!row;
}

/** 验证管理后台密码 */
export function verifyAdminPassword(input: string): boolean {
  const envPw = process.env.ROOT_PASSWORD;
  if (envPw) {
    // 环境变量密码：直接比较
    if (input.length !== envPw.length) return false;
    let result = 0;
    for (let i = 0; i < input.length; i++) {
      result |= input.charCodeAt(i) ^ envPw.charCodeAt(i);
    }
    return result === 0;
  }

  const row = db.select().from(settings).where(eq(settings.key, ADMIN_PW_KEY)).get();
  if (!row) return false;

  return row.value === hashPassword(input);
}

/** 保存管理后台密码（首次配置用） */
export function saveAdminPassword(password: string): void {
  // 重新生成 salt，使之前的 hash 失效
  const newSalt = randomBytes(16).toString('hex');
  db.insert(settings).values({ key: SALT_KEY, value: newSalt })
    .onConflictDoUpdate({ target: settings.key, set: { value: newSalt } })
    .run();

  const hashed = createHash('sha256').update(newSalt + password).digest('hex');
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
