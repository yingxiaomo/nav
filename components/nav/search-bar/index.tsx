"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Search, Clock, X, Trash2, Link as LinkIcon, Globe, Wifi } from "lucide-react";
import { motion } from "framer-motion";
import { Input, Button } from "@/components/ui";
import { useSearchHistory } from "@/lib";
import { LinkItem } from "@/lib/types/types";
import Fuse, { type IFuseOptions } from "fuse.js";
import { STORAGE_CONFIG_KEY } from "@/lib/adapters/storage";

const ENGINES = [
  { name: "Google", url: "https://www.google.com/search?q=" },
  { name: "Baidu", url: "https://www.baidu.com/s?wd=" },
  { name: "Bing", url: "https://www.bing.com/search?q=" },
  { name: "Bilibili", url: "https://search.bilibili.com/all?keyword=" },
  { name: "GitHub", url: "https://github.com/search?q=" },
  { name: "DuckDuckGo", url: "https://duckduckgo.com/?q=" },
  { name: "Sogou", url: "https://www.sogou.com/web?query=" },
  { name: "360", url: "https://www.so.com/s?q=" },
  { name: "Yahoo", url: "https://search.yahoo.com/search?p=" },
  { name: "本地", url: "local" },
];

interface SearchBarProps {
  onLocalSearch?: (query: string) => void;
  ref?: React.RefObject<HTMLInputElement>;
  /** 所有书签的扁平数组（用于 Fuse.js 模糊搜索） */
  bookmarks?: LinkItem[];
  /** 选中书签时打开链接 */
  onOpenLink?: (url: string) => void;
}

/** 下拉面板中的一条候选 */
type SuggestionItem =
  | { kind: "history"; query: string }
  | { kind: "bookmark"; item: LinkItem }
  | { kind: "web"; text: string };

const FUSE_OPTIONS: IFuseOptions<LinkItem> = {
  keys: [
    { name: "title", weight: 2 },
    { name: "url", weight: 0.5 },
  ],
  threshold: 0.4,
  includeScore: true,
  minMatchCharLength: 1,
};

export const SearchBar = React.forwardRef<HTMLInputElement, SearchBarProps>(
  ({ onLocalSearch, bookmarks = [], onOpenLink }, ref) => {
    const [query, setQuery] = useState("");
    const [engine, setEngine] = useState(ENGINES[0]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [selectedIdx, setSelectedIdx] = useState(-1);
    const [webSuggestions, setWebSuggestions] = useState<string[]>([]);
    const { history, addSearch, removeSearch, clearHistory } = useSearchHistory();
    const containerRef = useRef<HTMLDivElement>(null);
    const blurTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    // ── Fuse.js 模糊搜索实例 ──────────────────────────────
    const fuse = useMemo(
      () => new Fuse(bookmarks, FUSE_OPTIONS),
      [bookmarks],
    );

    // ── 过滤历史 + Fuse 书签匹配 → 合并候选列表 ──────────
    const trimmedQuery = query.trim();
    const filteredHistory = useMemo(
      () => trimmedQuery
        ? history.filter((h) => h.toLowerCase().includes(trimmedQuery.toLowerCase()))
        : history,
      [history, trimmedQuery]
    );

    const bookmarkMatches = useMemo(
      () => trimmedQuery.length >= 1
        ? fuse.search(trimmedQuery).slice(0, 5)
        : [],
      [fuse, trimmedQuery]
    );

    const suggestions = useMemo<SuggestionItem[]>(() => {
      const list: SuggestionItem[] = [];
      for (const h of filteredHistory) list.push({ kind: "history", query: h });
      for (const r of bookmarkMatches) list.push({ kind: "bookmark", item: r.item });
      for (const w of webSuggestions) list.push({ kind: "web", text: w });
      return list;
    }, [filteredHistory, bookmarkMatches, webSuggestions]);

    // 输入框内的灰色联想预览（仅在首条为历史且前缀匹配时）
    const completionText =
      suggestions.length > 0 &&
      selectedIdx === 0 &&
      suggestions[0].kind === "history" &&
      suggestions[0].query.toLowerCase().startsWith(query.trim().toLowerCase())
        ? suggestions[0].query.slice(query.trim().length)
        : "";

    const hasHistoryItems = suggestions.some((s) => s.kind === "history");
    const hasBookmarkItems = suggestions.some((s) => s.kind === "bookmark");
    const hasWebItems = suggestions.some((s) => s.kind === "web");

    // ── 点击外部关闭 ──────────────────────────────────────
    useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
          setShowDropdown(false);
        }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
      };
    }, []);

    const closeDropdown = () => {
      setShowDropdown(false);
      setSelectedIdx(-1);
    };

    // ── 键盘导航 ──────────────────────────────────────────
    const handleInputKeyDown = (e: React.KeyboardEvent) => {
      if (!showDropdown || suggestions.length === 0) {
        if (e.key === "Escape") closeDropdown();
        return;
      }
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIdx((p) => (p < suggestions.length - 1 ? p + 1 : p));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIdx((p) => (p > 0 ? p - 1 : -1));
          break;
        case "Escape":
          e.preventDefault();
          closeDropdown();
          break;
      }
    };

    // ── 输入变化 ──────────────────────────────────────────
    const handleInputChange = async (val: string) => {
      setQuery(val);
      if (engine.url === "local") onLocalSearch?.(val);

      // 获取网络搜索建议（后端已配置时）
      if (val.trim().length >= 2) {
        try {
          const configRaw = localStorage.getItem(STORAGE_CONFIG_KEY);
          if (configRaw) {
            const sc = JSON.parse(configRaw);
            if (sc.type === 'api-server' && sc.apiServer?.baseUrl) {
              const baseUrl = sc.apiServer.baseUrl.replace(/\/$/, '');
              const token = sc.apiServer.token;
              const headers: Record<string, string> = {};
              if (token) headers['Authorization'] = `Bearer ${token}`;
              const res = await fetch(`${baseUrl}/api/v1/suggest?q=${encodeURIComponent(val.trim())}&source=duckduckgo`, { headers });
              if (res.ok) {
                const data = await res.json();
                setWebSuggestions(data.suggestions || []);
              } else {
                setWebSuggestions([]);
              }
            } else {
              setWebSuggestions([]);
            }
          } else {
            setWebSuggestions([]);
          }
        } catch {
          setWebSuggestions([]);
        }
      } else {
        setWebSuggestions([]);
      }

      if (val.trim()) {
        const matches = history.filter((h) =>
          h.toLowerCase().includes(val.toLowerCase()),
        );
        // 只要有历史或书签匹配就显示下拉
        if (matches.length > 0 || fuse.search(val.trim()).length > 0) {
          setShowDropdown(true);
          setSelectedIdx(0);
        } else {
          setShowDropdown(false);
        }
      } else {
        setShowDropdown(history.length > 0);
        if (history.length > 0) setSelectedIdx(0);
      }
    };

    const handleFocus = () => {
      const matches = query.trim()
        ? history.filter((h) => h.toLowerCase().includes(query.toLowerCase()))
        : history;
      if (matches.length > 0 || (query.trim() && bookmarkMatches.length > 0)) {
        setShowDropdown(true);
        setSelectedIdx(0);
      }
    };

    const handleBlur = () => {
      blurTimerRef.current = setTimeout(() => setShowDropdown(false), 160);
    };

    // ── 提交 ──────────────────────────────────────────────
    const handleFormSubmit = (e: React.FormEvent) => {
      e.preventDefault();

      // 选中了书签 → 直接打开
      if (selectedIdx >= 0 && suggestions[selectedIdx]?.kind === "bookmark") {
        const item = (suggestions[selectedIdx] as Extract<SuggestionItem, { kind: "bookmark" }>).item;
        closeDropdown();
        if (item.url) onOpenLink?.(item.url);
        return;
      }

      // 选中了网络建议 → 用当前搜索引擎搜索
      if (selectedIdx >= 0 && suggestions[selectedIdx]?.kind === "web") {
        const text = (suggestions[selectedIdx] as Extract<SuggestionItem, { kind: "web" }>).text;
        closeDropdown();
        addSearch(text);
        if (engine.url !== "local") {
          window.open(`${engine.url}${encodeURIComponent(text)}`, "_blank");
        }
        return;
      }

      // 选中了历史 → 填入 + 搜索
      const searchQuery =
        selectedIdx >= 0
          ? (suggestions[selectedIdx] as Extract<SuggestionItem, { kind: "history" }>).query
          : query.trim();
      if (!searchQuery) return;

      addSearch(searchQuery);

      if (engine.url === "local") {
        setQuery(searchQuery);
        onLocalSearch?.(searchQuery);
      } else {
        setQuery(searchQuery);
        window.open(`${engine.url}${encodeURIComponent(searchQuery)}`, "_blank");
      }
      closeDropdown();
    };

    // ── 选中候选条目 ➡ 渲染 ───────────────────────────────
    const selectSuggestion = (item: SuggestionItem) => {
      closeDropdown();
      if (item.kind === "bookmark") {
        if (item.item.url) onOpenLink?.(item.item.url);
      } else if (item.kind === "web") {
        addSearch(item.text);
        if (engine.url !== "local") {
          window.open(`${engine.url}${encodeURIComponent(item.text)}`, "_blank");
        }
      } else {
        setQuery(item.query);
        if (engine.url === "local") onLocalSearch?.(item.query);
        addSearch(item.query);
      }
    };

    const suggestionClass = (idx: number) =>
      idx === selectedIdx
        ? "bg-white/15 text-white"
        : "text-white/70 hover:bg-white/10 hover:text-white";

    return (
      <motion.div
        className="relative w-full max-w-2xl mx-auto mb-12 z-40"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        {/* 搜索引擎标签 */}
        <div className="flex flex-wrap justify-center gap-1.5 mb-3">
          {ENGINES.map((e) => (
            <button
              key={e.name}
              onClick={() => {
                setEngine(e);
                if (e.url === "local") onLocalSearch?.(query);
                else onLocalSearch?.("");
                closeDropdown();
              }}
              aria-label={`切换搜索引擎为 ${e.name}`}
              aria-pressed={engine.name === e.name}
              className={[
                "px-3 py-1 rounded-full text-xs font-medium transition-all duration-200",
                "cursor-pointer hover:scale-105 active:scale-95",
                engine.name === e.name
                  ? "bg-white/25 text-white shadow-md"
                  : "bg-white/10 text-white/60 hover:bg-white/15 hover:text-white/80",
              ].join(" ")}
            >
              {e.name}
            </button>
          ))}
        </div>

        <div ref={containerRef} className="relative">
          <form onSubmit={handleFormSubmit} className="relative flex items-center group">
            <motion.div
              whileHover={{ scale: 1.01 }}
              transition={{ duration: 0.2 }}
              className="flex-1 relative"
            >
              {/* 内联联想预览 */}
              {completionText && (
                <div
                  className="absolute inset-y-0 left-6 flex items-center pointer-events-none z-10"
                  aria-hidden
                >
                  <span className="text-lg font-sans select-none tracking-normal text-white/20">
                    {query}
                    <span className="text-white/[0.07]">{completionText}</span>
                  </span>
                </div>
              )}
              <Input
                ref={ref}
                type="text"
                value={query}
                onChange={(e) => handleInputChange(e.target.value)}
                onFocus={handleFocus}
                onBlur={handleBlur}
                onKeyDown={handleInputKeyDown}
                placeholder={
                  engine.url === "local"
                    ? "筛选我的链接..."
                    : `在 ${engine.name} 中搜索...`
                }
                aria-label={engine.url === "local" ? "本地链接搜索" : "搜索引擎搜索"}
                className={`h-14 pl-6 pr-14 rounded-2xl border-white/20 bg-white/10 dark:bg-black/20 backdrop-blur-xl placeholder:text-white/50 focus-visible:ring-2 focus-visible:ring-white/30 shadow-xl transition-all hover:bg-white/15 text-lg caret-white ${
                  completionText ? "text-transparent" : "text-white"
                }`}
              />
            </motion.div>

            <Button
              type="submit"
              size="icon"
              variant="ghost"
              className="absolute right-2 top-2 h-10 w-10 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-all duration-200 hover:scale-110 hover:rotate-15 active:scale-95 active:rotate-0"
            >
              <Search className="h-5 w-5" />
            </Button>
          </form>

          {/* ── 下拉候选面板 ──────────────────────────────── */}
          {showDropdown && suggestions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.12 }}
              className="absolute top-full left-0 right-0 mt-1.5 overflow-hidden
                         bg-white/10 dark:bg-black/30 backdrop-blur-2xl
                         border border-white/20 rounded-xl shadow-2xl"
            >
              <div className="py-1 max-h-72 overflow-y-auto">
                {suggestions.map((s, idx) => (
                  <React.Fragment key={`${s.kind}-${s.kind === "history" ? s.query : s.kind === "web" ? s.text : s.item.id}`}>
                    {/* 分段头 */}
                    {idx === 0 && hasHistoryItems && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] text-white/40 font-medium tracking-wider border-b border-white/5">
                        <Clock className="h-3 w-3" />
                        搜索历史
                        <button
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => { e.stopPropagation(); clearHistory(); closeDropdown(); }}
                          className="ml-auto text-white/30 hover:text-white/60 transition-colors flex items-center gap-0.5"
                        >
                          <Trash2 className="h-3 w-3" />
                          清除全部
                        </button>
                      </div>
                    )}
                    {idx > 0 && suggestions[idx - 1].kind === "history" && s.kind === "bookmark" && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] text-white/40 font-medium tracking-wider border-t border-white/5">
                        <LinkIcon className="h-3 w-3" />
                        书签
                      </div>
                    )}
                    {idx > 0 && suggestions[idx - 1].kind === "bookmark" && s.kind === "web" && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] text-white/40 font-medium tracking-wider border-t border-white/5">
                        <Wifi className="h-3 w-3" />
                        网络搜索
                      </div>
                    )}

                    {/* 候选行 */}
                    <div
                      className={`group flex items-center justify-between px-3 py-2 cursor-pointer transition-colors ${suggestionClass(idx)}`}
                      onMouseDown={(e) => { e.preventDefault(); selectSuggestion(s); }}
                      onMouseEnter={() => setSelectedIdx(idx)}
                    >
                      <span className="flex items-center gap-2 min-w-0 flex-1">
                        {s.kind === "bookmark" ? (
                          <Globe className="h-3.5 w-3.5 shrink-0 text-blue-400/70" />
                        ) : s.kind === "web" ? (
                          <Wifi className="h-3.5 w-3.5 shrink-0 text-green-400/70" />
                        ) : (
                          <Clock className="h-3.5 w-3.5 shrink-0 text-white/30" />
                        )}
                        <span className="text-sm truncate">
                          {s.kind === "history" ? s.query : s.kind === "web" ? s.text : s.item.title}
                        </span>
                        {s.kind === "bookmark" && (
                          <span className="text-[11px] text-white/30 truncate hidden sm:inline max-w-[40%] ml-auto">
                            {(s.item as LinkItem).url}
                          </span>
                        )}
                      </span>
                      {s.kind === "history" && (
                        <button
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            removeSearch(s.query);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-white/10 transition-all shrink-0"
                          aria-label={`删除「${s.query}」`}
                        >
                          <X className="h-3.5 w-3.5 text-white/40 hover:text-white/70" />
                        </button>
                      )}
                    </div>
                  </React.Fragment>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    );
  },
);

SearchBar.displayName = "SearchBar";
