import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { db, sqlite } from '../db/index.ts';
import { bookmarks, categories } from '../db/schema.ts';
import { eq, and, asc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { apiError } from '../utils/response.ts';

const bookmarkRoutes = new Hono();

const createSchema = z.object({
  categoryId: z.string().min(1),
  title: z.string().min(1, '标题不能为空'),
  url: z.string().url('链接格式无效').refine(
    (u) => u.startsWith('http://') || u.startsWith('https://'),
    { message: '仅允许 http/https 链接' },
  ),
  icon: z.string().optional(),
  description: z.string().optional(),
});

const updateSchema = createSchema.partial();

// ===== GET /api/v1/bookmarks - 获取书签（支持 ?categoryId= 筛选）=====
bookmarkRoutes.get('/', async (c) => {
  const categoryId = c.req.query('categoryId');

  const query = db
    .select()
    .from(bookmarks)
    .orderBy(asc(bookmarks.order));

  if (categoryId) {
    query.where(eq(bookmarks.categoryId, categoryId));
  }

  const result = await query;
  return c.json(result);
});

// ===== GET /api/v1/bookmarks/:id =====
bookmarkRoutes.get('/:id', async (c) => {
  const { id } = c.req.param();
  const bookmark = await db
    .select()
    .from(bookmarks)
    .where(eq(bookmarks.id, id))
    .get();

  if (!bookmark) return c.json(apiError('书签不存在', 'NOT_FOUND'), 404);
  return c.json(bookmark);
});

// ===== POST /api/v1/bookmarks - 创建书签 =====
bookmarkRoutes.post('/', zValidator('json', createSchema), async (c) => {
  const body = c.req.valid('json');

  // 验证分类存在
  const cat = await db
    .select()
    .from(categories)
    .where(eq(categories.id, body.categoryId))
    .get();

  if (!cat) return c.json(apiError('所属分类不存在', 'NOT_FOUND'), 404);

  const now = Date.now();

  const maxOrder = db
    .select({ max: bookmarks.order })
    .from(bookmarks)
    .where(eq(bookmarks.categoryId, body.categoryId))
    .get();

  const newBookmark = {
    id: nanoid(),
    categoryId: body.categoryId,
    title: body.title,
    url: body.url,
    icon: body.icon ?? null,
    description: body.description ?? null,
    order: (maxOrder?.max ?? -1) + 1,
    createdAt: now,
  };

  await db.insert(bookmarks).values(newBookmark);
  return c.json(newBookmark, 201);
});

// ===== PUT /api/v1/bookmarks/:id =====
bookmarkRoutes.put('/:id', zValidator('json', updateSchema), async (c) => {
  const { id } = c.req.param();
  const body = c.req.valid('json');

  const existing = await db
    .select()
    .from(bookmarks)
    .where(eq(bookmarks.id, id))
    .get();

  if (!existing) return c.json(apiError('书签不存在', 'NOT_FOUND'), 404);

  // 如果更换了分类，验证目标分类存在
  if (body.categoryId && body.categoryId !== existing.categoryId) {
    const cat = await db.select().from(categories).where(eq(categories.id, body.categoryId)).get();
    if (!cat) return c.json(apiError('目标分类不存在', 'NOT_FOUND'), 400);
  }

  await db
    .update(bookmarks)
    .set({
      ...(body.title !== undefined && { title: body.title }),
      ...(body.url !== undefined && { url: body.url }),
      ...(body.icon !== undefined && { icon: body.icon }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.categoryId !== undefined && { categoryId: body.categoryId }),
    })
    .where(eq(bookmarks.id, id));

  const updated = await db
    .select()
    .from(bookmarks)
    .where(eq(bookmarks.id, id))
    .get();

  return c.json(updated);
});

// ===== DELETE /api/v1/bookmarks/:id =====
bookmarkRoutes.delete('/:id', async (c) => {
  const { id } = c.req.param();

  const existing = await db
    .select()
    .from(bookmarks)
    .where(eq(bookmarks.id, id))
    .get();

  if (!existing) return c.json(apiError('书签不存在', 'NOT_FOUND'), 404);

  await db.delete(bookmarks).where(eq(bookmarks.id, id));
  return c.json({ success: true });
});

// ===== PATCH /api/v1/bookmarks/reorder - 批量排序 =====
bookmarkRoutes.patch('/reorder', zValidator('json', z.object({
  items: z.array(z.object({
    id: z.string(),
    order: z.number(),
  })).max(500, '单次排序数量不能超过 500'),
})), async (c) => {
  const { items } = c.req.valid('json');

  sqlite.transaction(() => {
    for (const item of items) {
      db
        .update(bookmarks)
        .set({ order: item.order })
        .where(eq(bookmarks.id, item.id))
        .run();
    }
  })();

  return c.json({ success: true });
});

export default bookmarkRoutes;
