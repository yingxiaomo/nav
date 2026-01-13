// 数据验证模块
// 提供统一的验证函数，防止XSS和其他安全漏洞

/**
 * 验证字符串是否为空
 * @param str 要验证的字符串
 * @returns 布尔值，表示字符串是否为空
 */
export const isEmptyString = (str: string | undefined | null): boolean => {
  return !str || str.trim() === '';
};

/**
 * 验证URL格式是否正确
 * @param url 要验证的URL字符串
 * @returns 布尔值，表示URL格式是否正确
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
 * 验证文件夹名称是否合法
 * @param name 文件夹名称
 * @returns 布尔值，表示名称是否合法
 */
export const isValidFolderName = (name: string): boolean => {
  if (isEmptyString(name)) return false;
  // 检查长度（1-50字符）
  if (name.length < 1 || name.length > 50) return false;
  // 检查是否包含特殊字符
  const invalidChars = /[<>:"/\\|?*]/;
  return !invalidChars.test(name);
};

/**
 * 验证链接标题是否合法
 * @param title 链接标题
 * @returns 布尔值，表示标题是否合法
 */
export const isValidLinkTitle = (title: string): boolean => {
  if (isEmptyString(title)) return false;
  // 检查长度（1-100字符）
  return title.length >= 1 && title.length <= 100;
};

/**
 * 验证链接URL是否合法
 * @param url 链接URL
 * @returns 布尔值，表示URL是否合法
 */
export const isValidLinkUrl = (url: string): boolean => {
  if (isEmptyString(url)) return false;
  return isValidUrl(url);
};

/**
 * 验证图标名称是否合法
 * @param icon 图标名称
 * @returns 布尔值，表示图标是否合法
 */
export const isValidIconName = (icon: string): boolean => {
  if (isEmptyString(icon)) return false;
  // 图标名称长度限制（1-50字符）
  return icon.length >= 1 && icon.length <= 50;
};

/**
 * 净化HTML内容，防止XSS攻击
 * @param html 要净化的HTML字符串
 * @returns 净化后的HTML字符串
 */
export const sanitizeHtml = (html: string): string => {
  if (!html) return '';
  // 移除所有脚本标签
  return html.replace(/<script[^>]*>.*?<\/script>/gi, '')
    // 移除所有事件属性
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    // 移除所有style属性（防止CSS注入）
    .replace(/style\s*=\s*["'][^"']*["']/gi, '')
    // 移除危险的HTML标签
    .replace(/<(iframe|object|embed|form|input|button)[^>]*>.*?<\/\1>/gi, '');
};

/**
 * 净化用户输入的文本，防止XSS攻击
 * @param text 要净化的文本
 * @returns 净化后的文本
 */
export const sanitizeText = (text: string): string => {
  if (!text) return '';
  const temp = document.createElement('div');
  temp.textContent = text;
  return temp.innerHTML;
};

/**
 * 验证文件是否为有效的图片类型
 * @param file 文件对象
 * @returns 布尔值，表示文件是否为有效图片
 */
export const isValidImageFile = (file: File): boolean => {
  const allowedTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/svg+xml'];
  return allowedTypes.includes(file.type);
};

/**
 * 验证文件大小是否在限制范围内
 * @param file 文件对象
 * @param maxSizeMB 最大允许大小（MB）
 * @returns 布尔值，表示文件大小是否合法
 */
export const isValidFileSize = (file: File, maxSizeMB: number = 2): boolean => {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  return file.size <= maxSizeBytes;
};

/**
 * 验证存储配置是否有效
 * @param config 存储配置对象
 * @returns 布尔值，表示配置是否有效
 */
export const isValidStorageConfig = (config: Record<string, unknown>): boolean => {
  if (!config || typeof config !== 'object') return false;
  // 检查必要的配置字段
  const requiredFields = ['type'];
  for (const field of requiredFields) {
    if (!config[field]) return false;
  }
  return true;
};

/**
 * 验证GitHub Token格式是否正确
 * @param token GitHub Token
 * @returns 布尔值，表示Token格式是否正确
 */
export const isValidGithubToken = (token: string): boolean => {
  if (!token) return false;
  // GitHub Token通常以ghp_开头，长度约为40字符
  return /^ghp_[a-zA-Z0-9]{36,}$/.test(token);
};

/**
 * 验证Gist ID格式是否正确
 * @param gistId Gist ID
 * @returns 布尔值，表示Gist ID格式是否正确
 */
export const isValidGistId = (gistId: string): boolean => {
  if (!gistId) return false;
  // Gist ID通常是32字符的十六进制字符串
  return /^[a-f0-9]{32,}$/i.test(gistId);
};

/**
 * 验证WebDAV URL格式是否正确
 * @param url WebDAV URL
 * @returns 布尔值，表示URL格式是否正确
 */
export const isValidWebdavUrl = (url: string): boolean => {
  if (!url) return false;
  try {
    const urlObj = new URL(url);
    // WebDAV通常使用http或https协议
    return ['http:', 'https:'].includes(urlObj.protocol);
  } catch {
    return false;
  }
};