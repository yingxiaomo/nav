import { Hono } from 'hono';
import { readRecent } from '../services/logger.ts';

const adminRoutes = new Hono();

// ===== GET /api/v1/admin/logs — 获取最近日志 =====

adminRoutes.get('/logs', async (c) => {
  const queryLines = c.req.query('lines');
  const lines = parseInt(queryLines ?? '200', 10) || 200;
  const entries = readRecent(lines);
  return c.json({ lines: entries });
});

export default adminRoutes;
