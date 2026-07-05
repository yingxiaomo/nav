/**
 * 监控图标服务 — 从内网服务页面自动提取 favicon
 * 独立于 parse-service.ts（后者有 SSRF 防护，用于用户提交的书签）
 * 此服务无 SSRF 检查，因为监控目标由管理员自行添加
 */

const FETCH_TIMEOUT = 5_000;
const MAX_RESPONSE_SIZE = 512_000; // 512KB — 只需要 HTML，够用

/** 从监控目标的 URL 提取 favicon 图标地址 */
export async function fetchMonitorIconUrl(targetUrl: string): Promise<string | null> {
  // 先试 /favicon.ico（不管 HTML 解析结果，作为兜底）
  const origin = extractOrigin(targetUrl);
  const fallbackIcon = origin ? `${origin}/favicon.ico` : null;

  try {
    const html = await fetchHtml(targetUrl);
    if (!html) return fallbackIcon;

    const iconUrl = extractFaviconFromHtml(html, origin || '');
    return iconUrl || fallbackIcon;
  } catch {
    return fallbackIcon;
  }
}

/** 提取 URL 的 origin（协议+主机+端口） */
function extractOrigin(url: string): string | null {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

/** 获取页面 HTML（有限大小，有时限） */
async function fetchHtml(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (NavServer Monitor; +https://github.com/yingxiaomo/nav)',
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    });

    if (!res.ok) return null;

    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_RESPONSE_SIZE) return null;

    const contentType = res.headers.get('content-type') || '';
    const charset = detectCharset(contentType);
    return new TextDecoder(charset).decode(buf);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** 从 Content-Type 头提取编码 */
function detectCharset(contentType: string): string {
  const m = contentType.match(/charset=([^;]+)/i);
  return m?.[1]?.trim() || 'utf-8';
}

/** 从 HTML 中提取 favicon URL */
function extractFaviconFromHtml(html: string, baseUrl: string): string | null {
  // 优先 apple-touch-icon（高清），再回退到 icon/shortcut icon
  const patterns = [
    /<link[^>]+rel=["'](?:apple-touch-icon|apple-touch-icon-precomposed)["'][^>]+href=["']([^"']*)["']/i,
    /<link[^>]+rel=["']icon["'][^>]+href=["']([^"']*)["']/i,
    /<link[^>]+rel=["']shortcut\s+icon["'][^>]+href=["']([^"']*)["']/i,
    /<link[^>]+href=["']([^"']*)["'][^>]+rel=["']icon["']/i,
    /<link[^>]+href=["']([^"']*)["'][^>]+rel=["']shortcut\s+icon["']/i,
  ];

  for (const pattern of patterns) {
    const m = html.match(pattern);
    if (m?.[1]) {
      const resolved = resolveUrl(m[1], baseUrl);
      if (resolved) return resolved;
    }
  }

  return null;
}

/** 解析相对 URL 为绝对地址 */
function resolveUrl(href: string, base: string): string {
  if (href.startsWith('http://') || href.startsWith('https://')) return href;
  try {
    base = base.replace(/\/+$/, '');
    if (href.startsWith('/')) return `${base}${href}`;
    return `${base}/${href}`;
  } catch {
    return href;
  }
}
