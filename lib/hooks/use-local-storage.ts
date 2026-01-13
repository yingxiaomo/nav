"use client";

import { useState, useCallback } from "react";

export function useLocalStorage<T>(key: string, initialValue: T | (() => T)) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue instanceof Function ? initialValue() : initialValue;
    }
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

  const initialized = true;

  const setValue = useCallback((value: T | ((val: T) => T)) => {
    try {
      setStoredValue((prev) => {
         const valueToStore = value instanceof Function ? value(prev) : value;
         if (typeof window !== "undefined") {
            window.localStorage.setItem(key, JSON.stringify(valueToStore));
         }
         return valueToStore;
      });
    } catch (error) {
      console.error(error);
    }
  }, [key]);

  return [storedValue, setValue, initialized] as const;
}
