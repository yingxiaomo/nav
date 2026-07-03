import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { db } from '../db/index.ts';
import { settings } from '../db/schema.ts';
import { eq } from 'drizzle-orm';

const settingRoutes = new Hono();

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

  if (!row) return c.json({ error: '配置不存在' }, 404);

  try {
    return c.json(JSON.parse(row.value));
  } catch {
    return c.json(row.value);
  }
});

// ===== PUT /api/v1/settings - 批量更新配置 =====
settingRoutes.put('/', zValidator('json', z.record(z.unknown())), async (c) => {
  const body = c.req.valid('json');

  for (const [key, value] of Object.entries(body)) {
    const valueStr = JSON.stringify(value);
    await db
      .insert(settings)
      .values({ key, value: valueStr })
      .onConflictDoUpdate({ target: settings.key, set: { value: valueStr } });
  }

  return c.json({ success: true });
});

// ===== PUT /api/v1/settings/:key - 更新单个配置 =====
settingRoutes.put('/:key', zValidator('json', z.unknown()), async (c) => {
  const { key } = c.req.param();
  const value = c.req.valid('json');
  const valueStr = JSON.stringify(value);

  await db
    .insert(settings)
    .values({ key, value: valueStr })
    .onConflictDoUpdate({ target: settings.key, set: { value: valueStr } });

  return c.json({ success: true });
});

export default settingRoutes;
