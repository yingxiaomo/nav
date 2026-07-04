import { Hono } from 'hono';
import { apiError } from '../utils/response.ts';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { readRecent } from '../services/logger.ts';

const logRoutes = new Hono();

// ===== GET /api/v1/admin/logs — 获取最近日志 =====

logRoutes.get('/logs', async (c) => {
  const queryLines = c.req.query('lines');
  const lines = parseInt(queryLines ?? '200', 10) || 200;
  const entries = readRecent(lines);
  return c.json({ lines: entries });
});

export default logRoutes;
