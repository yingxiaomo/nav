"use client";

import { useState, useCallback, useEffect } from "react";
import { safeLocalStorageGet, safeLocalStorageSet } from "../utils/encryption";

export function useLocalStorage<T>(
  key: string, 
  initialValue: T | (() => T),
  sensitiveFields: string[] = []
) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue instanceof Function ? initialValue() : initialValue;
    }
    // 初始同步加载（可能是未加密的数据）
    try {
      const item = window.localStorage.getItem(key);
      if (item) {
        return JSON.parse(item);
      }
    } catch (error) {
      console.error(error);
    }
    return initialValue instanceof Function ? initialValue() : initialValue;
  });

  const [initialized, setInitialized] = useState(false);

  // 异步解密敏感数据
  useEffect(() => {
    if (typeof window === 'undefined' || !sensitiveFields.length) {
      setInitialized(true);
      return;
    }

    const loadEncryptedData = async () => {
      try {
        const decryptedData = await safeLocalStorageGet<T>(key, sensitiveFields);
        if (decryptedData !== null) {
          setStoredValue(decryptedData);
        }
      } catch (error) {
        console.error('Failed to load encrypted data:', error);
      } finally {
        setInitialized(true);
      }
    };

    loadEncryptedData();
  }, [key, sensitiveFields]);

  const setValue = useCallback((value: T | ((val: T) => T)) => {
    try {
      setStoredValue((prev) => {
         const valueToStore = value instanceof Function ? value(prev) : value;
         if (typeof window !== "undefined") {
           if (sensitiveFields.length) {
             // 使用安全存储（加密敏感字段）
             safeLocalStorageSet(key, valueToStore, sensitiveFields);
           } else {
             // 普通存储
             window.localStorage.setItem(key, JSON.stringify(valueToStore));
           }
         }
         return valueToStore;
      });
    } catch (error) {
      console.error(error);
    }
  }, [key, sensitiveFields]);

  return [storedValue, setValue, initialized] as const;
}
