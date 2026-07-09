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
