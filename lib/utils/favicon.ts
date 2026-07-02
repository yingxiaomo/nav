import { generateFaviconUrl } from "./common";

/** 获取链接的图标值：返回 API 图片 URL 或 null */
export function getLinkIcon(
  icon: string | undefined,
  url: string,
  type?: string,
): string | null {
  // 自定义图片 URL（base64、http链接）→ 直接使用
  if (icon && (icon.startsWith('http') || icon.startsWith('/') || icon.startsWith('data:')))
    return icon;
  // 文件夹或无 URL → null，调用方显示 fallback
  if (type === 'folder' || !url) return null;
  try {
    return generateFaviconUrl(new URL(url).hostname);
  } catch {
    return null;
  }
}

/** 判断图标值是否为图片 URL */
export function isImageIcon(val: string | null): val is string {
  return !!val && (val.startsWith('http') || val.startsWith('/') || val.startsWith('data:'));
}
