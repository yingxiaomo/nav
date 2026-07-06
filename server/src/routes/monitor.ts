import { Hono } from 'hono';
import { apiError } from '../utils/response.ts';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { isPrivateHost } from '../services/security.ts';
import { getSystemInfo } from '../services/monitor-service.ts';
import { fetchMonitorIconUrl } from '../services/monitor-icon-service.ts';
import { wakeOnLan } from '../services/wol-service.ts';
import {
  getTargets, addTarget, updateTarget, deleteTarget, getCheckResults,
  startHealthChecks,
} from '../services/health-check-service.ts';

const monitorRoutes = new Hono();

const disabled = process.env.DISABLE_MONITORING === 'true';

if (disabled) {
  // 独立后端/公网部署：监控功能完全关闭
  monitorRoutes.all('*', async (c) => {
    return c.json(apiError('监控功能已禁用', 'DISABLED'), 403);
  });
} else {
  // ===== 内网地址校验 =====
  // 仅允许通过内网地址访问监控接口
  monitorRoutes.use('*', async (c, next) => {
    const host = c.req.header('host') || '';
    const hostname = host.split(':')[0];
    // Docker 内部网络（172.x 属于内网）和 localhost 均放行
    if (!isPrivateHost(hostname)) {
      return c.json(apiError('监控接口仅限内网访问', 'FORBIDDEN'), 403);
    }
    await next();
  });

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
    icon: z.string().optional(),
    mac: z.string().optional(),
    timeout: z.number().optional(),
  });

  monitorRoutes.post('/checks', zValidator('json', addSchema), async (c) => {
    const { name, url, icon, mac, timeout } = c.req.valid('json');
    // 自动补协议（防止前端漏传）
    const normalizedUrl = /^https?:\/\//i.test(url) ? url : `http://${url}`;
    const target = addTarget(name, normalizedUrl, timeout, icon, mac);
    return c.json(target, 201);
  });

  // ===== PUT /api/v1/admin/monitor/checks/:id — 编辑巡检目标 =====
  const updateSchema = z.object({
    name: z.string().min(1).optional(),
    url: z.string().url().optional(),
    icon: z.string().optional(),
    mac: z.string().optional(),
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

  // ===== POST /api/v1/admin/monitor/fetch-icon — 自动识别图标 =====
  const fetchIconSchema = z.object({
    url: z.string().url('请输入有效 URL'),
  });

  monitorRoutes.post('/fetch-icon', zValidator('json', fetchIconSchema), async (c) => {
    const { url } = c.req.valid('json');
    const iconUrl = await fetchMonitorIconUrl(url);
    return c.json({ icon: iconUrl });
  });

  // ===== POST /api/v1/admin/monitor/wol/:id — 按目标 ID 唤醒（使用配置的 MAC）=====
  monitorRoutes.post('/wol/:id', async (c) => {
    const { id } = c.req.param();
    const targets = getTargets();
    const target = targets.find(t => t.id === id);
    if (!target) return c.json(apiError('目标不存在', 'NOT_FOUND'), 404);
    if (!target.mac) return c.json(apiError('未配置 MAC 地址', 'NO_MAC'), 400);

    const ok = await wakeOnLan(target.mac);
    if (!ok) return c.json(apiError('唤醒失败，请检查 MAC 地址', 'WOL_FAILED'), 500);
    return c.json({ success: true, mac: target.mac });
  });

  // ===== POST /api/v1/admin/monitor/wol — 按 MAC 地址直接唤醒 =====
  const wolSchema = z.object({
    mac: z.string().min(1, '请输入 MAC 地址'),
  });

  monitorRoutes.post('/wol', zValidator('json', wolSchema), async (c) => {
    const { mac } = c.req.valid('json');
    const ok = await wakeOnLan(mac);
    if (!ok) return c.json(apiError('唤醒失败，请检查 MAC 地址', 'WOL_FAILED'), 500);
    return c.json({ success: true });
  });
}

export default monitorRoutes;
