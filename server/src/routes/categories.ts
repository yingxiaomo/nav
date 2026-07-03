import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { db } from '../db/index.ts';
import { categories, bookmarks } from '../db/schema.ts';
import { eq, asc } from 'drizzle-orm';
import { nanoid } from 'nanoid';

const categoryRoutes = new Hono();

// 创建分类校验
const createSchema = z.object({
  title: z.string().min(1, '分类名称不能为空'),
  icon: z.string().optional(),
});

// 更新分类校验
const updateSchema = createSchema.partial();

// ===== GET /api/v1/categories - 获取全部分类（含书签）=====
categoryRoutes.get('/', async (c) => {
  const allCategories = await db
    .select()
    .from(categories)
    .orderBy(asc(categories.order));

  const result = await Promise.all(
    allCategories.map(async (cat) => {
      const links = await db
        .select()
        .from(bookmarks)
        .where(eq(bookmarks.categoryId, cat.id))
        .orderBy(asc(bookmarks.order));
      return { ...cat, links };
    })
  );

  return c.json(result);
});

// ===== GET /api/v1/categories/:id - 获取单个分类 =====
categoryRoutes.get('/:id', async (c) => {
  const { id } = c.req.param();
  const cat = await db
    .select()
    .from(categories)
    .where(eq(categories.id, id))
    .get();

  if (!cat) return c.json({ error: '分类不存在' }, 404);

  const links = await db
    .select()
    .from(bookmarks)
    .where(eq(bookmarks.categoryId, id))
    .orderBy(asc(bookmarks.order));

  return c.json({ ...cat, links });
});

// ===== POST /api/v1/categories - 创建分类 =====
categoryRoutes.post('/', zValidator('json', createSchema), async (c) => {
  const body = c.req.valid('json');
  const now = Date.now();

  // 获取当前最大排序值
  const maxOrder = db
    .select({ max: categories.order })
    .from(categories)
    .get();

  const newCategory = {
    id: nanoid(),
    title: body.title,
    icon: body.icon ?? null,
    order: (maxOrder?.max ?? -1) + 1,
    createdAt: now,
  };

  await db.insert(categories).values(newCategory);
  return c.json(newCategory, 201);
});

// ===== PUT /api/v1/categories/:id - 更新分类 =====
categoryRoutes.put('/:id', zValidator('json', updateSchema), async (c) => {
  const { id } = c.req.param();
  const body = c.req.valid('json');

  const existing = await db
    .select()
    .from(categories)
    .where(eq(categories.id, id))
    .get();

  if (!existing) return c.json({ error: '分类不存在' }, 404);

  await db
    .update(categories)
    .set({
      ...(body.title !== undefined && { title: body.title }),
      ...(body.icon !== undefined && { icon: body.icon }),
    })
    .where(eq(categories.id, id));

  const updated = await db
    .select()
    .from(categories)
    .where(eq(categories.id, id))
    .get();

  return c.json(updated);
});

// ===== DELETE /api/v1/categories/:id - 删除分类 =====
categoryRoutes.delete('/:id', async (c) => {
  const { id } = c.req.param();

  const existing = await db
    .select()
    .from(categories)
    .where(eq(categories.id, id))
    .get();

  if (!existing) return c.json({ error: '分类不存在' }, 404);

  await db.delete(categories).where(eq(categories.id, id));
  return c.json({ success: true });
});

export default categoryRoutes;
