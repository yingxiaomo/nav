// 通用工具函数模块
// 业务代码应直接从子模块按需导入（url.ts / format.ts / tree.ts），
// common.ts 保留最核心的通用函数 + 向后兼容的重新导出

import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ── 向后兼容重新导出 ──
// 确保 import { X } from "@/lib/utils/common" 不断引用
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

export {
  arrayToTree,
  treeToArray,
  traverseTree,
  findInTree,
  updateInTree,
  deleteInTree,
} from './tree';

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
