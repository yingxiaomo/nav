"use client";

import { useState, useCallback } from "react";
import { safeLocalStorageGet, safeLocalStorageSet } from "../utils/encryption";

/**
 * useLocalStorage hook — 同步版本
 *
 * 旧版依赖加密模块的异步 AES-GCM 解密，导致组件初次渲染时先显示未解密值再闪烁到解密后数据。
 * 现加密模块已改为同步 base64 编码，解密步骤在 useState 初始化器中同步完成，无需 useEffect。
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T | (() => T),
  sensitiveFields: string[] = []
) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue instanceof Function ? initialValue() : initialValue;
    }
    // 同步解密读取
    const decrypted = safeLocalStorageGet<T>(key, sensitiveFields);
    if (decrypted !== null) return decrypted;
    // 降级：尝试直接 JSON 解析（旧版未加密数据）
    try {
      const item = localStorage.getItem(key);
      if (item) return JSON.parse(item) as T;
    } catch { /* ignore */ }
    return initialValue instanceof Function ? initialValue() : initialValue;
  });

  const setValue = useCallback((value: T | ((val: T) => T)) => {
    setStoredValue((prev) => {
      const next = value instanceof Function ? value(prev) : value;
      if (typeof window !== "undefined") {
        safeLocalStorageSet(key, next, sensitiveFields);
      }
      return next;
    });
  }, [key, sensitiveFields]);

  // 返回值向后兼容：第三个元素 initialized 现在恒为 true
  return [storedValue, setValue, true] as const;
}
