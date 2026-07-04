import { Hono } from 'hono';
import { apiError } from '../utils/response.ts';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { getSystemInfo } from '../services/monitor-service.ts';
import {
  getTargets, addTarget, updateTarget, deleteTarget, getCheckResults, startHealthChecks,
} from '../services/health-check-service.ts';

const monitorRoutes = new Hono();

// 启动定时巡检
startHealthChecks();

// ===== GET /api/v1/admin/monitor/system — 系统信息 =====
monitorRoutes.get('/system', async (c) => {
  return c.json(getSystemInfo());
});

// ===== GET /api/v1/admin/monitor/checks — 所有巡检结果 =====
monitorRoutes.get('/checks', async (c) => {
  return c.json({ targets: getTargets(), results: getCheckResults() });
});

// ===== POST /api/v1/admin/monitor/checks — 添加巡检目标 =====
const addSchema = z.object({
  name: z.string().min(1, '请输入名称'),
  url: z.string().url('请输入有效 URL'),
  timeout: z.number().optional(),
});

monitorRoutes.post('/checks', zValidator('json', addSchema), async (c) => {
  const { name, url, timeout } = c.req.valid('json');
  const target = addTarget(name, url, timeout);
  return c.json(target, 201);
});

// ===== PUT /api/v1/admin/monitor/checks/:id — 编辑巡检目标 =====
const updateSchema = z.object({
  name: z.string().min(1).optional(),
  url: z.string().url().optional(),
  timeout: z.number().optional(),
});

monitorRoutes.put('/checks/:id', zValidator('json', updateSchema), async (c) => {
  const { id } = c.req.param();
  const data = c.req.valid('json');
  const ok = updateTarget(id, data);
  if (!ok) return c.json(apiError('目标不存在', 'NOT_FOUND'), 404);
  return c.json({ success: true });
});

// ===== DELETE /api/v1/admin/monitor/checks/:id — 删除巡检目标 =====
monitorRoutes.delete('/checks/:id', async (c) => {
  const { id } = c.req.param();
  const ok = deleteTarget(id);
  if (!ok) return c.json(apiError('目标不存在', 'NOT_FOUND'), 404);
  return c.json({ success: true });
});

export default monitorRoutes;
