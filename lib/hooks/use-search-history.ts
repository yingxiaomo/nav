"use client";

import { useState, useCallback } from "react";

const STORAGE_KEY = "nav-search-history";
const MAX_ITEMS = 10;

function loadHistory(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_ITEMS) : [];
  } catch {
    return [];
  }
}

function persistHistory(history: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, MAX_ITEMS)));
  } catch {
    // localStorage quota exceeded — silently ignore
  }
}

/**
 * 管理搜索历史记录的 Hook
 * - 最多保留 10 条，自动去重（新记录移到顶部）
 * - 持久化到 localStorage，跨会话保留
 */
export function useSearchHistory() {
  const [history, setHistory] = useState<string[]>(loadHistory);

  const addSearch = useCallback((query: string) => {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) return;
    setHistory((prev) => {
      const deduped = prev.filter((h) => h !== trimmed);
      const next = [trimmed, ...deduped].slice(0, MAX_ITEMS);
      persistHistory(next);
      return next;
    });
  }, []);

  const removeSearch = useCallback((query: string) => {
    setHistory((prev) => {
      const next = prev.filter((h) => h !== query);
      persistHistory(next);
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    persistHistory([]);
  }, []);

  return { history, addSearch, removeSearch, clearHistory };
}
