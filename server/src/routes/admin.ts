import { Hono } from 'hono';
import { readRecent } from '../services/logger.ts';
import { apiError } from '../utils/response.ts';
import { exportFullBackup, restoreFullBackup } from '../services/full-backup-service.ts';
import { listContainers, streamContainerLogs, getContainerStats } from '../services/docker-service.ts';
import { getAllDockerMetadata, setDockerMetadata } from '../services/docker-metadata-service.ts';
import fs from 'node:fs';
import path from 'node:path';

const UPLOAD_DIR = process.env.UPLOAD_DIR || './data/uploads';

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
    return c.json({ containers: [], error: msg });
  }
});

// ===== GET /api/v1/admin/docker/stats — Docker 容器实时资源占用 =====

adminRoutes.get('/docker/stats', async (c) => {
  const stats = await getContainerStats();
  return c.json({ stats });
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

// ===== GET /api/v1/admin/uploads — 列出上传文件 =====

adminRoutes.get('/uploads', async (c) => {
  try {
    const dir = path.resolve(UPLOAD_DIR);
    if (!fs.existsSync(dir)) return c.json({ files: [] });
    const names = fs.readdirSync(dir).filter(f => /\.(png|jpg|jpeg|gif|svg|webp|ico)$/i.test(f));
    const files = names.map(name => {
      const stat = fs.statSync(path.join(dir, name));
      return { name, size: stat.size, mtime: stat.mtimeMs };
    }).sort((a, b) => b.mtime - a.mtime);
    return c.json({ files });
  } catch {
    return c.json(apiError('无法读取上传目录', 'IO_ERROR'), 500);
  }
});

// ===== DELETE /api/v1/admin/uploads/:filename — 删除上传文件 =====

adminRoutes.delete('/uploads/:filename', async (c) => {
  const filename = decodeURIComponent(c.req.param('filename'));
  // 防止路径穿越
  if (filename.includes('..') || filename.includes('/')) {
    return c.json(apiError('无效的文件名', 'INVALID_FILENAME'), 400);
  }
  try {
    const filepath = path.resolve(UPLOAD_DIR, filename);
    if (!fs.existsSync(filepath)) return c.json(apiError('文件不存在', 'NOT_FOUND'), 404);
    fs.unlinkSync(filepath);
    return c.json({ success: true });
  } catch {
    return c.json(apiError('删除失败', 'IO_ERROR'), 500);
  }
});

// ===== POST /api/v1/admin/docker/fetch-icon — 自动识别 Docker 容器图标 =====

adminRoutes.post('/docker/fetch-icon', async (c) => {
  try {
    const { image } = await c.req.json() as { image?: string };
    if (!image) return c.json({ icon: null });
    // 从镜像名提取服务名：nginx:latest → nginx
    const name = image.split(':')[0].split('/').pop() || '';
    if (!name) return c.json({ icon: null });
    // 常见项目域名映射
    const knownDomains: Record<string, string> = {
      nginx: 'nginx.org', redis: 'redis.io', postgres: 'postgresql.org',
      mysql: 'mysql.com', mariadb: 'mariadb.org', mongo: 'mongodb.com',
      node: 'nodejs.org', python: 'python.org', alpine: 'alpinelinux.org',
      ubuntu: 'ubuntu.com', debian: 'debian.org', centos: 'centos.org',
      grafana: 'grafana.com', prometheus: 'prometheus.io', 'traefik': 'traefik.io',
      portainer: 'portainer.io', jenkins: 'jenkins.io', gitlab: 'gitlab.com',
      'nextcloud': 'nextcloud.com', 'homeassistant': 'home-assistant.io',
      openwrt: 'openwrt.org', pihole: 'pi-hole.net', 'adguard': 'adguard.com',
      jellyfin: 'jellyfin.org', emby: 'emby.media', plex: 'plex.tv',
      transmission: 'transmissionbt.com', qbittorrent: 'qbittorrent.org',
      sonarr: 'sonarr.tv', radarr: 'radarr.video', jackett: 'jackett.io',
      navidrome: 'navidrome.org', firefly: 'firefly-iii.org',
      outline: 'getoutline.com', frp: 'gofrp.org', ddns: 'ddns.org',
    };
    const domain = knownDomains[name] || `${name}.org`;
    // 尝试 DuckDuckGo 图标服务
    const ddgUrl = `https://icons.duckduckgo.com/ip3/${domain}.ico`;
    try {
      const resp = await fetch(ddgUrl, { method: 'HEAD', signal: AbortSignal.timeout(3000) });
      if (resp.ok) return c.json({ icon: ddgUrl });
    } catch { /* fall through */ }
    // 尝试直接访问 favicon
    const favUrl = `https://${domain}/favicon.ico`;
    try {
      const resp = await fetch(favUrl, { method: 'HEAD', signal: AbortSignal.timeout(3000) });
      if (resp.ok) return c.json({ icon: favUrl });
    } catch { /* fall through */ }
    return c.json({ icon: null });
  } catch { return c.json({ icon: null }); }
});

// ===== GET /api/v1/admin/docker/metadata — 获取所有 Docker 容器持久化元数据 =====

adminRoutes.get('/docker/metadata', async (c) => {
  return c.json(getAllDockerMetadata());
});

// ===== PUT /api/v1/admin/docker/metadata/:name — 保存 Docker 容器元数据（名称/图标）=====

adminRoutes.put('/docker/metadata/:name', async (c) => {
  const name = c.req.param('name');
  const { icon } = await c.req.json() as { icon?: string };
  setDockerMetadata(name, { name, icon });
  return c.json({ success: true });
});

export default adminRoutes;
