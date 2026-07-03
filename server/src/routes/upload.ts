import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import fs from 'node:fs';
import path from 'node:path';
import { nanoid } from 'nanoid';

const uploadRoutes = new Hono();

const uploadDir = path.resolve(process.env.UPLOAD_DIR ?? './data/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 允许的图片类型
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];

// ===== POST /api/v1/upload - 上传图片 =====
uploadRoutes.post('/', async (c) => {
  const formData = await c.req.formData();
  const file = formData.get('file');

  if (!file || !(file instanceof File)) {
    return c.json({ error: '请选择文件' }, 400);
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return c.json({
      error: `不支持的文件类型: ${file.type}，仅允许 ${ALLOWED_TYPES.join(', ')}`,
    }, 400);
  }

  // 限制 10MB
  const MAX_SIZE = 10 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    return c.json({ error: '文件大小不能超过 10MB' }, 400);
  }

  const ext = file.name.split('.').pop() ?? 'png';
  const filename = `${nanoid()}.${ext}`;
  const filepath = path.join(uploadDir, filename);

  const buffer = await file.arrayBuffer();
  fs.writeFileSync(filepath, Buffer.from(buffer));

  // 返回可访问的 URL
  const protocol = c.req.header('x-forwarded-proto') ?? 'http';
  const host = c.req.header('host') ?? `localhost:${process.env.PORT ?? 3001}`;
  const url = `${protocol}://${host}/uploads/${filename}`;

  return c.json({ url, filename }, 201);
});

export default uploadRoutes;
