// 图标工具模块
// 包含：URL 标题提取、图标回退链组件
//
// 回退逻辑：自定义图标 → /favicon.ico → DuckDuckGo → 首字母+背景色
// 不设 localStorage 缓存层——浏览器 HTTP 缓存足够胜任

import React from "react";

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
 * 构建图标 URL 回退链
 * 返回已过滤空值的数组，避免前端多发无效请求
 */
function buildFallbackList(
  icon: string | null | undefined,
  url: string,
  type?: string,
): string[] {
  if (type === 'folder' || !url) return [];

  const list: string[] = [];

  // 1. 自定义图标（仅有效协议）
  if (icon && (icon.startsWith('http') || icon.startsWith('/') || icon.startsWith('data:'))) {
    list.push(icon);
  }

  // 2. 源站 /favicon.ico
  try {
    list.push(`${new URL(url).origin}/favicon.ico`);
  } catch { /* URL 无效则跳过 */ }

  // 3. DuckDuckGo 图标服务（外网环境下有效）
  try {
    list.push(`https://icons.duckduckgo.com/ip3/${new URL(url).hostname}.ico`);
  } catch { /* URL 无效则跳过 */ }

  return list.filter(Boolean);
}

/**
 * 根据 URL 稳定生成回退图标的背景色
 * 同一域名始终获得相同颜色
 */
function generateFallbackColor(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    let hash = 0;
    for (let i = 0; i < hostname.length; i++) {
      hash = hostname.charCodeAt(i) + ((hash << 5) - hash);
    }
    return `hsl(${Math.abs(hash) % 360}, 50%, 42%)`;
  } catch {
    return 'hsl(210, 30%, 40%)';
  }
}

interface FaviconImageProps {
  icon?: string | null;
  url: string;
  type?: string;
  className?: string;
}

/**
 * 图标组件，自带三级回退 + 文字占位符终极兜底
 *
 * 回退链：自定义图标 → /favicon.ico → DuckDuckGo → 首字母+背景色
 * 使用 onError 事件驱动索引推进，无需外部状态机
 * 缓存依赖浏览器原生 HTTP 缓存，不额外写 localStorage 层
 */
export function FaviconImage({ icon, url, type, className }: FaviconImageProps) {
  const fallbackList = React.useMemo(
    () => buildFallbackList(icon, url, type),
    [icon, url, type]
  );
  const [index, setIndex] = React.useState(0);

  // 回退耗尽或列表为空 → 文字占位符终极兜底
  // 注意：props 变化时不主动重置 index——旧 index 超出 new fallbackList 时自然落入兜底，
  // 未超出也能正确展示对应位置的图标，无需额外 ref/effect
  if (index >= fallbackList.length) {
    const letter = extractTitleFromUrl(url).charAt(0).toUpperCase() || '?';
    return (
      <div
        className={className}
        style={{
          backgroundColor: generateFallbackColor(url),
          color: '#fff',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '4px',
          fontSize: '14px',
          fontWeight: 600,
          lineHeight: 1,
        }}
      >
        {letter}
      </div>
    );
  }

  return (
    <img
      src={fallbackList[index]}
      alt=""
      className={className}
      onError={() => setIndex(i => i + 1)}
      loading="lazy"
    />
  );
}
