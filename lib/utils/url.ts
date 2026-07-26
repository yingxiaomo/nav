/**
 * URL 工具函数
 */

/**
 * 处理URL，确保其包含协议
 */
export const normalizeUrl = (url: string): string => {
  if (!url) return '';
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(url)) {
    return url;
  }
  return `https://${url}`;
};

// 可执行脚本的伪协议：在 window.open / <a href> 导航时会造成 XSS。
// 导入的书签文件、云端同步数据都可能携带此类 URL，必须在存储与导航前过滤。
const DANGEROUS_SCHEME = /^\s*(?:javascript|data|vbscript):/i;

/**
 * 过滤危险协议：命中 javascript:/data:/vbscript: 时返回空串（视为不可导航），
 * 其余原样返回（trim 后）。http/https/mailto/magnet/ftp 等正常协议不受影响。
 */
export const sanitizeUrl = (url: string): string => {
  if (!url) return '';
  if (DANGEROUS_SCHEME.test(url)) return '';
  return url.trim();
};

/**
 * 在新标签页安全打开外部链接：自动补协议并过滤危险伪协议。
 * 危险 URL 直接忽略，不发起导航。
 */
export const openExternalUrl = (rawUrl: string): void => {
  if (typeof window === 'undefined') return;
  const safe = sanitizeUrl(rawUrl);
  if (!safe) return;
  window.open(normalizeUrl(safe), '_blank', 'noopener,noreferrer');
};

/**
 * 从URL中提取主机名
 */
export const extractHostname = (url: string): string => {
  if (!url) return '';
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
};

/**
 * 从URL中提取网站名称
 */
export const extractSiteName = (url: string): string => {
  if (!url) return '';
  const hostname = extractHostname(url);
  return hostname.replace(/^www\./, '').split('.')[0] || '';
};

/**
 * 生成 favicon URL（使用自部署的多源聚合 API）
 */
export const generateFaviconUrl = (domain: string): string => {
  if (!domain) return '';
  return `https://iconapi.396638.xyz/api/icon?url=${domain}`;
};

/**
 * 获取文件扩展名
 */
export const getFileExtension = (filename: string): string => {
  if (!filename) return '';
  const lastDotIndex = filename.lastIndexOf('.');
  if (lastDotIndex === -1 || lastDotIndex === filename.length - 1) {
    return '';
  }
  return filename.substring(lastDotIndex + 1).toLowerCase();
};

/**
 * 检查文件是否为图片类型
 */
export const isImageFile = (filename: string): boolean => {
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'];
  const extension = getFileExtension(filename);
  return imageExtensions.includes(extension);
};
