import { z } from 'zod';

// ===== Types =====

export interface PageMetadata {
  title: string | null;
  description: string | null;
  icon: string | null;
  image: string | null;
}

// ===== Helpers =====

/** 检查目标主机是否为私有/内网地址 */
function isPrivateHost(hostname: string): boolean {
  // 常见私有域名
  const privateHosts = ['localhost', '127.0.0.1', '0.0.0.0', '[::1]', '[::]'];
  if (privateHosts.includes(hostname.toLowerCase())) return true;
  if (hostname.endsWith('.local') || hostname.endsWith('.internal') || hostname.endsWith('.lan')) return true;

  // IPv4 私有段：10.x.x.x, 172.16-31.x.x, 192.168.x.x, 127.x.x.x
  const ipMatch = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipMatch) {
    const [a, b] = [parseInt(ipMatch[1]), parseInt(ipMatch[2])];
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 127) return true;
  }

  // IPv6 私有地址
  // fc00::/7 (唯一本地地址), fe80::/10 (链路本地地址)
  // ::1 (回环), ::ffff:0:0/96 (IPv4 映射地址)
  if (hostname.startsWith('[') || hostname.includes(':')) {
    const ipv6 = hostname.replace(/^\[|\]$/g, '').toLowerCase();
    if (ipv6 === '::1' || ipv6 === '::') return true;
    if (ipv6.startsWith('fc') || ipv6.startsWith('fd')) return true;
    if (ipv6.startsWith('fe80')) return true;
    if (ipv6.startsWith('::ffff:127') || ipv6.startsWith('::ffff:10') ||
        ipv6.startsWith('::ffff:192.168') || ipv6.startsWith('::ffff:172.')) return true;
  }

  return false;
}

/** 从 Content-Type 头或 HTML 中提取编码 */
function detectCharset(contentType: string | null, html: string): string {
  const fromHeader = contentType?.match(/charset=([^;]+)/i)?.[1]?.trim().toLowerCase();
  if (fromHeader) return fromHeader;

  const fromMeta = html.match(/<meta[^>]+charset=["']?([^"'\s>]+)/i)?.[1]?.trim().toLowerCase();
  if (fromMeta) return fromMeta;

  return 'utf-8';
}

/** <title> 提取 */
function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match) return null;
  return match[1]
    .replace(/<[^>]+>/g, '')   // 去掉标题内的 HTML 标签
    .replace(/\s+/g, ' ')
    .trim();
}

/** <meta> 提取，支持 name 和 property 两种属性名 */
function extractMeta(html: string, attrName: string): string | null {
  // 匹配 <meta name="xxx" content="yyy"> 和 <meta property="xxx" content="yyy">
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:name|property)=["']${escapeRegex(attrName)}["'][^>]+content=["']([^"']*)["']`,
      'i',
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["']${escapeRegex(attrName)}["']`,
      'i',
    ),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      const value = match[1].trim();
      if (value) return value;
    }
  }
  return null;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 提取 favicon URL */
function extractIcon(html: string, baseUrl: string): string | null {
  // <link rel="icon" href="..."> 或 <link rel="shortcut icon" href="...">
  const iconMatch = html.match(
    /<link[^>]+rel=["'](?:shortcut\s+)?icon["'][^>]+href=["']([^"']*)["']/i,
  );
  if (iconMatch) {
    return resolveUrl(iconMatch[1], baseUrl);
  }

  // 第二种属性顺序
  const iconMatch2 = html.match(
    /<link[^>]+href=["']([^"']*)["'][^>]+rel=["'](?:shortcut\s+)?icon["']/i,
  );
  if (iconMatch2) {
    return resolveUrl(iconMatch2[1], baseUrl);
  }

  // 兜底
  return resolveUrl('/favicon.ico', baseUrl);
}

function resolveUrl(href: string, base: string): string {
  if (href.startsWith('http://') || href.startsWith('https://')) return href;
  try {
    return new URL(href, base).href;
  } catch {
    return href;
  }
}

// ===== Main =====

const VALID_PROTOCOLS = ['http:', 'https:'];
const REQUEST_TIMEOUT = 5_000;         // 5s
const MAX_RESPONSE_SIZE = 1_024_000;     // 1MB

const userAgents = [
  'Mozilla/5.0 (compatible; NavServer/1.0; +https://github.com/yingxiaomo/nav)',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
];

function pickUserAgent(): string {
  return userAgents[Math.floor(Math.random() * userAgents.length)];
}

export async function parseUrl(rawUrl: string): Promise<PageMetadata> {
  // 1. 校验 URL
  let url: URL;
  try {
    const normalized = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
    url = new URL(normalized);
    if (!VALID_PROTOCOLS.includes(url.protocol)) {
      throw new Error(`不支持的协议: ${url.protocol}`);
    }
  } catch (e) {
    throw e instanceof Error ? e : new Error('无效的 URL');
  }

  // 2. 阻止访问内网地址（SSRF 防护）
  if (isPrivateHost(url.hostname)) {
    throw new Error('不允许访问内网地址');
  }

  // 2. 拉取 HTML
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  let response: Response;
  try {
    response = await fetch(url.href, {
      signal: controller.signal,
      headers: {
        'User-Agent': pickUserAgent(),
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    });
  } catch (e: unknown) {
    clearTimeout(timer);
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error('请求超时');
    }
    throw new Error('无法访问目标网址');
  }

  // 重定向后重新校验目标地址（SSRF 绕过防护）
  const finalUrl = new URL(response.url);
  if (isPrivateHost(finalUrl.hostname)) {
    clearTimeout(timer);
    throw new Error('不允许访问内网地址');
  }

  if (!response.ok) {
    clearTimeout(timer);
    throw new Error(`目标网址返回 ${response.status}`);
  }

  // 3. 读取内容（受超时保护，限制大小）
  let arrayBuffer: ArrayBuffer;
  try {
    arrayBuffer = await response.arrayBuffer();
  } catch (e: unknown) {
    clearTimeout(timer);
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error('请求超时');
    }
    throw new Error('读取响应失败');
  } finally {
    clearTimeout(timer);
  }

  if (arrayBuffer.byteLength > MAX_RESPONSE_SIZE) {
    throw new Error('页面内容超出限制 (1MB)');
  }

  const contentType = response.headers.get('content-type');
  const html = new TextDecoder(detectCharset(contentType, '')).decode(arrayBuffer);

  // 4. 提取元数据
  const baseUrl = `${url.protocol}//${url.host}`;

  const title = extractTitle(html) || extractMeta(html, 'title');
  const description = extractMeta(html, 'description');
  const image = extractMeta(html, 'og:image') || extractMeta(html, 'twitter:image');
  const icon = extractIcon(html, baseUrl);

  return { title, description, icon, image };
}
