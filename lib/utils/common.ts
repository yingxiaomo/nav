// 通用工具函数模块
// common.ts 保留最核心的通用函数 + 向后兼容的重新导出

import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ── 向后兼容重新导出 ──
export {
  normalizeUrl,
  extractHostname,
  extractSiteName,
  generateFaviconUrl,
  getFileExtension,
  isImageFile,
} from './url';

export {
  formatDateTime,
  formatDate,
  formatTime,
  formatFileSize,
} from './format';

// ── 核心工具（被业务代码直接引用）──

/**
 * 将 Uint8Array 转换为 Base64 字符串
 * 使用循环而非 spread operator，避免大文件（>65KB）时的 RangeError
 */
export const uint8ArrayToBase64 = (arr: Uint8Array): string => {
  let binary = '';
  for (let i = 0; i < arr.length; i++) {
    binary += String.fromCharCode(arr[i]);
  }
  return btoa(binary);
};

/**
 * 生成随机ID（UUID v4）
 */
export const generateId = (): string => crypto.randomUUID();

/**
 * 深度比较两个对象是否相等
 */
export const deepEqual = <T>(a: T, b: T): boolean => {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return false;

  const keysA = Object.keys(a as Record<string, unknown>);
  const keysB = Object.keys(b as Record<string, unknown>);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    if (!deepEqual(
      (a as Record<string, unknown>)[key],
      (b as Record<string, unknown>)[key]
    )) return false;
  }

  return true;
};

/**
 * 将字符串首字母大写
 */
export const capitalize = (str: string): string => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
};

/**
 * 检查目标主机是否为内网/私有地址
 */
export function isPrivateHost(hostname: string): boolean {
  const privateHosts = ['localhost', '127.0.0.1', '0.0.0.0', '[::1]', '[::]'];
  if (privateHosts.includes(hostname.toLowerCase())) return true;
  if (hostname.endsWith('.local') || hostname.endsWith('.internal') || hostname.endsWith('.lan')) return true;

  // IPv4 私有段
  const ipMatch = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipMatch) {
    const [a, b] = [parseInt(ipMatch[1]), parseInt(ipMatch[2])];
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 127) return true;
  }

  return false;
}
