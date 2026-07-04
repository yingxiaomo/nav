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

// ===== GET /api/v1/data — 获取完整数据快照（全局 onError 兜底未捕获异常）=====

dataRoutes.get('/', async (c) => {
  const data = await getFullData();
  return c.json(data);
});

// ===== PUT /api/v1/data — 全量替换数据 =====

dataRoutes.put('/', zValidator('json', dataSchema), async (c) => {
  const body = c.req.valid('json') as unknown as DataSchema;
  replaceFullData(body);
  return c.json({ success: true });
});

export default dataRoutes;
