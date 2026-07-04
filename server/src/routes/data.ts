import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import type { DataSchema } from '../types/index.ts';
import { getFullData, replaceFullData } from '../services/data-service.ts';

const dataRoutes = new Hono();

// ===== Zod schema 校验 DataSchema =====

const linkItemSchema: z.ZodType<unknown> = z.lazy(() =>
  z.object({
    id: z.string(),
    title: z.string(),
    url: z.string(),
    icon: z.string().optional(),
    description: z.string().optional(),
    type: z.enum(['link', 'folder']).optional(),
    children: z.array(linkItemSchema).optional(),
    updatedAt: z.number().optional(),
    order: z.number().optional(),
  })
);

const categorySchema = z.object({
  id: z.string(),
  title: z.string(),
  icon: z.string().optional(),
  links: z.array(linkItemSchema),
  updatedAt: z.number().optional(),
  order: z.number().optional(),
});

const todoSchema = z.object({
  id: z.string(),
  text: z.string(),
  completed: z.boolean(),
  createdAt: z.number().optional(),
});

const noteSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  updatedAt: z.number().optional(),
});

const siteSettingsSchema = z.object({
  title: z.string(),
  wallpaper: z.string(),
  wallpaperType: z.enum(['custom', 'local', 'bing', 'url']),
  wallpaperList: z.array(z.string()),
  blurLevel: z.enum(['low', 'medium', 'high']),
  showFeatures: z.boolean().optional(),
  homeLayout: z.enum(['folder', 'list', 'sidebar']).optional(),
  theme: z.enum(['light', 'dark', 'system']).optional(),
});

const dataSchema = z.object({
  settings: siteSettingsSchema,
  categories: z.array(categorySchema),
  todos: z.array(todoSchema).optional(),
  notes: z.array(noteSchema).optional(),
  pinnedLinks: z.array(linkItemSchema).optional(),
});

// ===== GET /api/v1/data — 获取完整数据快照 =====

dataRoutes.get('/', async (c) => {
  try {
    const data = await getFullData();
    return c.json(data);
  } catch (error) {
    console.error('获取数据快照失败:', error);
    return c.json({ error: '获取数据失败' }, 500);
  }
});

// ===== PUT /api/v1/data — 全量替换数据 =====

dataRoutes.put('/', zValidator('json', dataSchema), async (c) => {
  try {
    const body = c.req.valid('json') as unknown as DataSchema;
    replaceFullData(body);
    return c.json({ success: true });
  } catch (error) {
    console.error('保存数据快照失败:', error);
    return c.json({ error: '保存数据失败' }, 500);
  }
});

export default dataRoutes;
