import { generateFaviconUrl } from "./common";
import React from "react";
import { getCachedFavicon, setCachedFavicon } from "./icon-cache";

/** 常见域名 → 品牌名称映射 */
const DOMAIN_BRAND: Record<string, string> = {
  'github.com': 'GitHub',
  'gitlab.com': 'GitLab',
  'bitbucket.org': 'Bitbucket',
  'youtube.com': 'YouTube',
  'youtu.be': 'YouTube',
  'twitter.com': 'Twitter',
  'x.com': 'X',
  'facebook.com': 'Facebook',
  'instagram.com': 'Instagram',
  'linkedin.com': 'LinkedIn',
  'zhihu.com': '知乎',
  'bilibili.com': 'Bilibili',
  'weibo.com': '微博',
  'douyin.com': '抖音',
  'npmjs.com': 'npm',
  'pypi.org': 'PyPI',
  'crates.io': 'crates.io',
  'docker.com': 'Docker',
  'docker.io': 'Docker Hub',
  'kubernetes.io': 'Kubernetes',
  'vercel.com': 'Vercel',
  'netlify.com': 'Netlify',
  'cloudflare.com': 'Cloudflare',
  'aws.amazon.com': 'AWS',
  'console.cloud.google.com': 'Google Cloud',
  'react.dev': 'React',
  'nextjs.org': 'Next.js',
  'nuxt.com': 'Nuxt',
  'vuejs.org': 'Vue',
  'angular.io': 'Angular',
  'svelte.dev': 'Svelte',
  'tailwindcss.com': 'Tailwind CSS',
  'typescriptlang.org': 'TypeScript',
  'python.org': 'Python',
  'rust-lang.org': 'Rust',
  'golang.org': 'Go',
  'stackoverflow.com': 'Stack Overflow',
  'medium.com': 'Medium',
  'dev.to': 'dev.to',
  'juejin.cn': '掘金',
  'csdn.net': 'CSDN',
  'segmentfault.com': 'SegmentFault',
  'infoq.cn': 'InfoQ',
};

/** 从 URL 中提取可读标题（域名映射优先，其次取路径语义） */
export function extractTitleFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const hostname = u.hostname;

    if (DOMAIN_BRAND[hostname]) return DOMAIN_BRAND[hostname];
    const parts = hostname.split('.');
    if (parts.length >= 2) {
      const twoLevel = parts.slice(-2).join('.');
      if (DOMAIN_BRAND[twoLevel]) return DOMAIN_BRAND[twoLevel];
    }

    const segments = u.pathname.split('/').filter(Boolean);
    if (segments.length > 0) {
      const last = segments[segments.length - 1]
        .replace(/\.(html|htm|md|php|aspx?)$/i, '')
        .replace(/[-_]/g, ' ');
      if (last && last.length >= 2) {
        return last.charAt(0).toUpperCase() + last.slice(1);
      }
    }

    const name = hostname.replace(/^www\./, '').split('.')[0];
    return name.charAt(0).toUpperCase() + name.slice(1);
  } catch {
    return '';
  }
}

/**
 * 获取链接的首选图标 URL
 * 优先：自定义 icon → /favicon.ico → null（由 FaviconImage 组件处理回退）
 */
function getLinkIcon(
  icon: string | null | undefined,
  url: string,
  type?: string,
): string | null {
  if (icon && (icon.startsWith('http') || icon.startsWith('/') || icon.startsWith('data:')))
    return icon;
  if (type === 'folder' || !url) return null;
  try {
    const u = new URL(url);
    return `${u.origin}/favicon.ico`;
  } catch {
    return null;
  }
}

/** 获取 API 回退图标 URL */
function getApiFallbackIcon(url: string): string | null {
  try { return generateFaviconUrl(new URL(url).hostname); } catch { return null; }
}

/** 获取 DuckDuckGo 回退图标 URL */
function getDuckDuckGoFallbackIcon(url: string): string | null {
  try { return `https://icons.duckduckgo.com/ip3/${new URL(url).hostname}.ico`; } catch { return null; }
}

/** 判断图标值是否为图片 URL */
function isImageIcon(val: string | null): val is string {
  return !!val && (val.startsWith('http') || val.startsWith('/') || val.startsWith('data:'));
}

interface FaviconImageProps {
  icon?: string | null;
  url: string;
  type?: string;
  className?: string;
}

/**
 * 图标图片组件，自动处理回退链：
 *   1. /favicon.ico
 *   2. onError → iconapi.396638.xyz
 *   3. onError → DuckDuckGo icons
 *   4. 全部失败 → null，调用方显示 fallback
 */
export function FaviconImage({ icon, url, type, className }: FaviconImageProps) {
  const [currentSrc, setCurrentSrc] = React.useState<string | null>(null);
  const [failedApi, setFailedApi] = React.useState(false);
  const [failedDdg, setFailedDdg] = React.useState(false);
  const isAutoResolved = React.useRef(false);

  React.useEffect(() => {
    // 1. 自定义图标 → 直接使用，跳过缓存
    const customSrc = getLinkIcon(icon, url, type);
    if (customSrc) {
      setCurrentSrc(customSrc);
      setFailedApi(false);
      setFailedDdg(false);
      isAutoResolved.current = false;
      return;
    }

    // 2. 无自定义图标 → 检查 localStorage 缓存（仅当有 URL 可提取 domain）
    if (url) {
      try {
        const domain = new URL(url).hostname;
        const cached = getCachedFavicon(domain);
        if (cached) {
          setCurrentSrc(cached);
          setFailedApi(false);
          setFailedDdg(false);
          isAutoResolved.current = false; // 缓存命中也是最终结果，不再重复缓存
          return;
        }
      } catch { /* URL 解析失败，走常规 fallback */ }
    }

    // 3. 无缓存 → 从 /favicon.ico 开始试探
    try {
      const u = new URL(url);
      setCurrentSrc(`${u.origin}/favicon.ico`);
    } catch {
      setCurrentSrc(null);
    }
    setFailedApi(false);
    setFailedDdg(false);
    isAutoResolved.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [icon, url, type]);

  if (!currentSrc) return null;

  /** favicon 成功加载 → 写入缓存（仅缓存自动解析的，不缓存用户自定义图标） */
  const handleLoad = () => {
    if (isAutoResolved.current && currentSrc && url) {
      try {
        const domain = new URL(url).hostname;
        setCachedFavicon(domain, currentSrc);
      } catch { /* 静默降级 */ }
    }
  };

  const handleError = () => {
    // 当前加载失败的 URL 如果曾经是缓存中的，清除它
    if (!isAutoResolved.current && currentSrc && url) {
      try {
        const domain = new URL(url).hostname;
        const cached = getCachedFavicon(domain);
        if (cached === currentSrc) {
          localStorage.removeItem('favicon_cache_' + domain);
        }
      } catch { /* ignore */ }
    }

    isAutoResolved.current = true;

    if (!failedApi) {
      const fb = getApiFallbackIcon(url);
      if (fb) {
        setFailedApi(true);
        setCurrentSrc(fb);
        return;
      }
    }
    if (!failedDdg) {
      const fb = getDuckDuckGoFallbackIcon(url);
      if (fb) {
        setFailedDdg(true);
        setCurrentSrc(fb);
        return;
      }
    }
    setCurrentSrc(null);
  };

  return React.createElement("img", {
    src: currentSrc,
    alt: "",
    className: className,
    onError: handleError,
    onLoad: handleLoad,
    loading: "lazy",
  });
}
