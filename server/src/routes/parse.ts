import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { parseUrl } from '../services/parse-service.ts';

const parseRoutes = new Hono();

const querySchema = z.object({
  url: z.string().min(1, '缺少 url 参数'),
});

// ===== GET /api/v1/parse?url=https://example.com =====

parseRoutes.get('/', zValidator('query', querySchema), async (c) => {
  const { url } = c.req.valid('query');

  try {
    const metadata = await parseUrl(url);
    return c.json(metadata);
  } catch (error) {
    const message = error instanceof Error ? error.message : '解析失败';
    console.warn(`[parse] ${url} — ${message}`);
    return c.json({ error: message }, 422);
  }
});

export default parseRoutes;
