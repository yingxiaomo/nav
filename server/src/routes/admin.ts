import { Hono } from 'hono';
import { readRecent } from '../services/logger.ts';
import { apiError } from '../utils/response.ts';
import { exportFullBackup, restoreFullBackup } from '../services/full-backup-service.ts';
import { listContainers, streamContainerLogs } from '../services/docker-service.ts';

const adminRoutes = new Hono();

// ===== GET /api/v1/admin/logs — 获取最近日志 =====

adminRoutes.get('/logs', async (c) => {
  const queryLines = c.req.query('lines');
  const lines = parseInt(queryLines ?? '200', 10) || 200;
  const entries = readRecent(lines);
  return c.json({ lines: entries });
});

// ===== GET /api/v1/admin/backup — 服务端全量备份 =====

adminRoutes.get('/backup', async (c) => {
  try {
    const data = exportFullBackup();
    return c.json(data);
  } catch (e) {
    console.error('备份失败:', e);
    return c.json(apiError('备份失败', 'BACKUP_ERROR'), 500);
  }
});

// ===== POST /api/v1/admin/backup — 导入全量备份 =====

adminRoutes.post('/backup', async (c) => {
  try {
    const body = await c.req.json();
    if (body.version !== 1) {
      return c.json(apiError('不兼容的备份版本', 'INVALID_VERSION'), 400);
    }
    restoreFullBackup(body);
    return c.json({ success: true });
  } catch (e) {
    console.error('恢复失败:', e);
    return c.json(apiError('恢复失败', 'RESTORE_ERROR'), 500);
  }
});

// ===== GET /api/v1/admin/docker/containers — Docker 容器列表 =====

adminRoutes.get('/docker/containers', async (c) => {
  try {
    const containers = await listContainers();
    return c.json({ containers });
  } catch (e) {
    const msg = (e as Error).message || 'Docker 不可用';
    return c.json(apiError(msg, 'DOCKER_ERROR'), 500);
  }
});

// ===== GET /api/v1/admin/docker/logs/:name — SSE 容器日志流 =====

adminRoutes.get('/docker/logs/:name', async (c) => {
  const name = c.req.param('name');

  c.header('Content-Type', 'text/event-stream');
  c.header('Cache-Control', 'no-cache');
  c.header('Connection', 'keep-alive');

  const emitter = streamContainerLogs(name);

  const stream = new ReadableStream({
    start(controller) {
      emitter.on('data', (line: string) => {
        // SSE format: "data: <text>\n\n"
        const escaped = line.replace(/\n/g, '\\n').replace(/\r/g, '');
        controller.enqueue(new TextEncoder().encode(`data: ${escaped}\n\n`));
      });

      emitter.on('end', () => {
        controller.enqueue(new TextEncoder().encode('event: end\ndata: \n\n'));
        controller.close();
      });

      emitter.on('error', (msg: string) => {
        controller.enqueue(new TextEncoder().encode(`event: error\ndata: ${msg}\n\n`));
        controller.close();
      });
    },
    cancel() {
      emitter.emit('close');
    },
  });

  return c.newResponse(stream);
});

export default adminRoutes;
