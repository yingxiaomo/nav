import { Hono } from 'hono';
import fs from 'node:fs';
import path from 'node:path';
import { nanoid } from 'nanoid';
import { apiError } from '../utils/response.ts';

const uploadRoutes = new Hono();

const uploadDir = path.resolve(process.env.UPLOAD_DIR ?? './data/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 文件魔数 → 扩展名映射
const MAGIC_BYTES: { sig: number[]; ext: string }[] = [
  { sig: [0xFF, 0xD8, 0xFF], ext: 'jpg' },
  { sig: [0x89, 0x50, 0x4E, 0x47], ext: 'png' },
  { sig: [0x47, 0x49, 0x46, 0x38], ext: 'gif' },
  { sig: [0x52, 0x49, 0x46, 0x46], ext: 'webp' },  // RIFF + WEBP 二次校验
];

function detectImageExt(buffer: Uint8Array): string | null {
  for (const entry of MAGIC_BYTES) {
    const matches = entry.sig.every((b, i) => buffer[i] === b);
    if (!matches) continue;
    // WebP 需要在 RIFF 之后第 8 字节校验 "WEBP"
    if (entry.ext === 'webp') {
      const webpSig = String.fromCharCode(...buffer.slice(8, 12));
      if (webpSig !== 'WEBP') continue;
    }
    return entry.ext;
  }
  return null;
}

// 限制 10MB
const MAX_SIZE = 10 * 1024 * 1024;

// ===== POST /api/v1/upload - 上传图片 =====
uploadRoutes.post('/', async (c) => {
  const formData = await c.req.formData();
  const file = formData.get('file');

  if (!file || !(file instanceof File)) {
    return c.json(apiError('请选择文件'), 400);
  }

  if (file.size > MAX_SIZE) {
    return c.json(apiError('文件大小不能超过 10MB'), 400);
  }

  // 读取文件头部检测真实类型（不信任 file.type）
  const buffer = new Uint8Array(await file.arrayBuffer());
  const ext = detectImageExt(buffer);
  if (!ext) {
    return c.json(apiError('不支持的文件格式，仅接受 jpg/png/gif/webp 图片'), 400);
  }

  const filename = `${nanoid()}.${ext}`;
  const filepath = path.join(uploadDir, filename);

  fs.writeFileSync(filepath, Buffer.from(buffer));

  // 返回可访问的 URL
  const protocol = c.req.header('x-forwarded-proto') ?? 'http';
  const host = c.req.header('host') ?? `localhost:${process.env.PORT ?? 8642}`;
  const url = `${protocol}://${host}/uploads/${filename}`;

  return c.json({ url, filename }, 201);
});

export default uploadRoutes;
