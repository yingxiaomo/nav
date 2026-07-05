/**
 * Favicon 持久缓存工具
 *
 * 将解析成功的 favicon URL 缓存到 localStorage，24h 过期。
 * 无痕模式 / 存储受限时静默降级，不抛异常。
 */

const CACHE_PREFIX = 'favicon_cache_';
const TTL = 24 * 60 * 60 * 1000; // 24 小时

interface CacheEntry {
  url: string;
  expiresAt: number;
}

/** 从缓存中读取 favicon URL，过期或不存在则返回 null */
export function getCachedFavicon(domain: string): string | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + domain);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry;
    if (Date.now() > entry.expiresAt) {
      localStorage.removeItem(CACHE_PREFIX + domain);
      return null;
    }
    return entry.url;
  } catch {
    // 无痕模式 / 配额超限 → 静默降级
    return null;
  }
}

/** 将成功的 favicon URL 写入缓存 */
export function setCachedFavicon(domain: string, url: string): void {
  try {
    const entry: CacheEntry = { url, expiresAt: Date.now() + TTL };
    localStorage.setItem(CACHE_PREFIX + domain, JSON.stringify(entry));
  } catch {
    // 静默降级
  }
}
