// 验证与安全工具函数
// 提供表单输入验证、XSS 防护等通用工具函数

/**
 * 检查字符串是否为空
 * @param str 要检查的字符串
 * @returns 如果字符串为空或仅含空白符则返回 true
 */
export const isEmptyString = (str: string | undefined | null): boolean => {
  return !str || str.trim() === '';
};

/**
 * 验证 URL 格式是否有效
 * @param url 要验证的 URL 字符串
 * @returns 如果 URL 格式有效则返回 true
 */
export const isValidUrl = (url: string): boolean => {
  if (!url) return false;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * 验证分类名称是否有效
 * @param name 分类名称
 * @returns 如果名称长度在 1-50 字符且不含特殊字符则返回 true
 */
export const isValidFolderName = (name: string): boolean => {
  if (isEmptyString(name)) return false;
  if (name.length < 1 || name.length > 50) return false;
  const invalidChars = /[<>:"\\/|?*]/;
  return !invalidChars.test(name);
};

/**
 * 验证链接标题是否有效
 * @param title 链接标题
 * @returns 如果标题长度在 1-100 字符则返回 true
 */
export const isValidLinkTitle = (title: string): boolean => {
  if (isEmptyString(title)) return false;
  return title.length >= 1 && title.length <= 100;
};

/**
 * 验证链接 URL 是否有效
 * @param url 链接 URL
 * @returns 如果 URL 有效则返回 true
 */
export const isValidLinkUrl = (url: string): boolean => {
  if (isEmptyString(url)) return false;
  return isValidUrl(url);
};

/**
 * 验证图标名称是否有效
 * @param icon 图标名称
 * @returns 如果图标名称长度在 1-50 字符则返回 true
 */
export const isValidIconName = (icon: string): boolean => {
  if (isEmptyString(icon)) return false;
  return icon.length >= 1 && icon.length <= 50;
};

/**
 * 对输入文本进行 XSS 安全过滤
 * @param text 需要过滤的文本
 * @returns 过滤后的安全文本
 */
export const sanitizeText = (text: string): string => {
  if (!text) return '';
  // SSR 环境下 document 不存在，直接返回原文本
  if (typeof document === 'undefined') return text;
  const temp = document.createElement('div');
  temp.textContent = text;
  return temp.innerHTML;
};

/**
 * 验证上传文件是否为支持的图片格式
 * @param file 上传的文件
 * @returns 如果文件类型为支持的图片格式则返回 true
 */
export const isValidImageFile = (file: File): boolean => {
  const allowedTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/svg+xml', 'image/webp'];
  return allowedTypes.includes(file.type);
};

/**
 * 验证上传文件大小是否在限制范围内
 * @param file 上传的文件
 * @param maxSizeMB 最大文件大小（MB），默认 2MB
 * @returns 如果文件大小未超过限制则返回 true
 */
export const isValidFileSize = (file: File, maxSizeMB: number = 2): boolean => {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  return file.size <= maxSizeBytes;
};

/**
 * 验证存储配置是否有效
 * @param config 存储配置对象
 * @returns 如果配置包含必要字段则返回 true
 */
export const isValidStorageConfig = (config: Record<string, unknown>): boolean => {
  if (!config || typeof config !== 'object') return false;
  const requiredFields = ['type'];
  for (const field of requiredFields) {
    if (!config[field]) return false;
  }
  return true;
};

/**
 * 验证 GitHub Token 格式是否有效
 * @param token GitHub Token
 * @returns 如果 Token 格式有效则返回 true
 */
export const isValidGithubToken = (token: string): boolean => {
  if (!token) return false;
  // 支持多种 GitHub Token 格式: ghp_(经典 PAT)、github_pat_(细粒度 PAT)、gho_(OAuth)、ghu_(用户)、ghs_(SSH)、ghr_(刷新)
  return /^gh[psuor]_[a-zA-Z0-9]{36,}$/.test(token) || /^github_pat_[a-zA-Z0-9_]{36,}$/.test(token);
};

/**
 * 验证 Gist ID 格式是否有效
 * @param gistId Gist ID
 * @returns 如果 Gist ID 格式有效则返回 true
 */
export const isValidGistId = (gistId: string): boolean => {
  if (!gistId) return false;
  // Gist ID 通常为 32 位以上的十六进制字符串
  return /^[a-f0-9]{32,}$/i.test(gistId);
};

/**
 * 验证 WebDAV URL 格式是否有效
 * @param url WebDAV URL
 * @returns 如果 URL 格式有效则返回 true
 */
export const isValidWebdavUrl = (url: string): boolean => {
  if (!url) return false;
  try {
    const urlObj = new URL(url);
    // WebDAV 仅支持 http 和 https 协议
    return ['http:', 'https:'].includes(urlObj.protocol);
  } catch {
    return false;
  }
};
