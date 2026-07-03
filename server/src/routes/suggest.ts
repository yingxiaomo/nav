import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { getSuggestions } from '../services/suggest-service.ts';

const suggestRoutes = new Hono();

const querySchema = z.object({
  q: z.string().min(1, '缺少搜索关键词').max(100, '搜索关键词过长'),
  source: z.enum(['duckduckgo', 'baidu', 'google']).optional().default('duckduckgo'),
});

// ===== GET /api/v1/suggest?q=hello&source=duckduckgo =====

suggestRoutes.get('/', zValidator('query', querySchema), async (c) => {
  const { q, source } = c.req.valid('query');

  try {
    const result = await getSuggestions(q, source);
    return c.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : '获取搜索建议失败';
    console.warn(`[suggest] ${q} — ${message}`);
    return c.json({ error: message, suggestions: [] }, 422);
  }
});

export default suggestRoutes;
