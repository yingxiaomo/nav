import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { db, sqlite } from '../db/index.ts';
import { settings } from '../db/schema.ts';
import { eq } from 'drizzle-orm';
import { apiError } from '../utils/response.ts';

const settingRoutes = new Hono();

/** 禁止通过 API 覆盖的内部键 */
const PROTECTED_KEYS = new Set(['api_token', 'admin_password_hash', 'admin_salt']);

function stripProtected(body: Record<string, unknown>): Record<string, unknown> {
  for (const key of Object.keys(body)) {
    if (PROTECTED_KEYS.has(key)) delete body[key];
  }
  return body;
}

// ===== GET /api/v1/settings - 获取所有配置 =====
settingRoutes.get('/', async (c) => {
  const all = await db.select().from(settings);
  // 转成扁平对象 { key: parsedValue }
  const result: Record<string, unknown> = {};
  for (const row of all) {
    try {
      result[row.key] = JSON.parse(row.value);
    } catch {
      result[row.key] = row.value;
    }
  }
  return c.json(result);
});

// ===== GET /api/v1/settings/:key - 获取单个配置 =====
settingRoutes.get('/:key', async (c) => {
  const { key } = c.req.param();
  const row = await db
    .select()
    .from(settings)
    .where(eq(settings.key, key))
    .get();

  if (!row) return c.json(apiError('配置不存在', 'NOT_FOUND'), 404);

  try {
    return c.json(JSON.parse(row.value));
  } catch {
    return c.json(row.value);
  }
});

// ===== PUT /api/v1/settings - 批量更新配置 =====
settingRoutes.put('/', async (c) => {
  const body = stripProtected(await c.req.json() as Record<string, unknown>);

  sqlite.transaction(() => {
    for (const [key, value] of Object.entries(body)) {
      const valueStr = JSON.stringify(value);
      db.insert(settings).values({ key, value: valueStr })
        .onConflictDoUpdate({ target: settings.key, set: { value: valueStr } })
        .run();
    }
  })();

  return c.json({ success: true });
});

// ===== PUT /api/v1/settings/:key - 更新单个配置 =====
settingRoutes.put('/:key', zValidator('json', z.unknown()), async (c) => {
  const { key } = c.req.param();
  if (PROTECTED_KEYS.has(key)) {
    return c.json(apiError('不允许修改系统内部配置', 'FORBIDDEN'), 403);
  }
  const value = c.req.valid('json');
  const valueStr = JSON.stringify(value);

  await db
    .insert(settings)
    .values({ key, value: valueStr })
    .onConflictDoUpdate({ target: settings.key, set: { value: valueStr } });

  return c.json({ success: true });
});

export default settingRoutes;
