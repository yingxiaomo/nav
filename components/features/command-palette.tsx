"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useUIStore } from "@/lib/stores";
import { DataSchema, LinkItem } from "@/lib/types";
import { getFrequentBookmarks, recordClick } from "@/lib/utils/bookmark-stats";
import { toast } from "sonner";
import { getAllCommands, getMatching, getCommand } from "./commands/registry";
import "./commands/index"; // 触发命令注册

interface CommandPaletteProps {
  data: DataSchema;
  onOpenLink: (url: string) => void;
  allBookmarks: LinkItem[];
  onToggleAI: () => void;
  onToggleSSH: () => void;
}

export function CommandPalette({ data, allBookmarks, onOpenLink, onToggleAI, onToggleSSH }: CommandPaletteProps) {
  const { isCommandPaletteOpen, setCommandPaletteOpen } = useUIStore();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [groups, setGroups] = useState<{ label: string; items: any[] }[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const COMMANDS = useMemo(() => getAllCommands(), []);

  const setLoadingWrap = (v: boolean) => setLoading(v);
  const closePalette = () => setCommandPaletteOpen(false);

  const executeCommand = async (cmd: string, args: string[]) => {
    const entry = getCommand(cmd);
    if (!entry) {
      toast.error(`未知命令: ${cmd}`);
      return;
    }
    setLoading(true);
    try {
      await entry.handler(args, {
        setGroups, setLoading: setLoadingWrap, closePalette,
      });
    } catch {
      toast.error("命令执行失败");
      setLoading(false);
    }
  };

  // 搜索逻辑
  const searchGroups = useMemo(() => {
    if (!isCommandPaletteOpen) return [];
    if (!query) {
      const frequent = getFrequentBookmarks(allBookmarks, 8);
      const result: { label: string; items: any[] }[] = [];
      if (frequent.length > 0) {
        result.push({ label: "🔥 常用书签", items: frequent.map(b => ({ id: b.id, title: b.title, description: b.url, url: b.url })) });
      }
      result.push({ label: "可用命令", items: COMMANDS.map(c => ({ id: c.prefix, title: c.label, description: c.description, prefix: c.prefix })) });
      return result;
    }
    if (query.startsWith("/")) {
      const parts = query.slice(1).split(/\s+/);
      const cmd = parts[0]?.toLowerCase() || "";
      const matched = getMatching(cmd);
      return [{ label: `命令匹配 (${matched.length})`, items: matched.map(c => ({ id: c.prefix, title: c.label, description: c.description, prefix: c.prefix })) }];
    }
    const q = query.toLowerCase();
    const hits = allBookmarks.filter(b => b.title.toLowerCase().includes(q) || b.url?.toLowerCase().includes(q)).slice(0, 15);
    return hits.length > 0
      ? [{ label: `书签 (${hits.length})`, items: hits.map(b => ({ id: b.id, title: b.title, description: b.url, url: b.url })) }]
      : [{ label: "没有找到", items: [{ id: "empty", title: "尝试 /search 进行全局搜索", description: "", prefix: "search" }] }];
  }, [isCommandPaletteOpen, query, allBookmarks, COMMANDS]);

  // 同步搜索结果显示
  const prevSearchKey = useRef("");
  useEffect(() => {
    const key = JSON.stringify(searchGroups);
    if (key === prevSearchKey.current) return;
    prevSearchKey.current = key;
    setGroups(searchGroups);
  }, [searchGroups]);

  // 输入触发命令自动执行
  useEffect(() => {
    if (!isCommandPaletteOpen || !query.startsWith("/")) return;
    const parts = query.slice(1).split(/\s+/);
    const cmd = parts[0]?.toLowerCase() || "";
    const args = parts.slice(1);
    const matched = getMatching(cmd);
    if (matched.length === 1 && cmd && args.length > 0) {
      executeCommand(matched[0].prefix, args);
    }
  }, [query]);

  useEffect(() => { setActiveIndex(0); }, [searchGroups]);

  const flatItems = useMemo(() => groups.flatMap(g => g.items), [groups]);

  const selectItem = (item: any) => {
    if (item.url) { recordClick(item.id); onOpenLink(item.url); setCommandPaletteOpen(false); }
    else if (item.prefix) { setQuery("/" + item.prefix + " "); }
    else if (item.title && !item.prefix) {
      if (item.dockerName) {
        setQuery("/docker " + item.dockerName + " ");
        return;
      }
      if (item.alias) {
        if (item.alias.user && item.alias.pass) {
          const name = item.alias.name;
          let host = item.alias.host || "";
          try { host = new URL(host).hostname; } catch {}
          useUIStore.getState().openSSHConnection({
            name, host, user: item.alias.user || "root", pass: item.alias.pass || "",
          });
          return;
        }
        setQuery("/ssh " + item.alias.name + " ");
        return;
      }
      setQuery("/docker " + item.title + " ");
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { setCommandPaletteOpen(false); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, flatItems.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)); }
    if (e.key === "Enter" && flatItems[activeIndex]) { selectItem(flatItems[activeIndex]); }
  };

  if (!isCommandPaletteOpen) return null;

  return (
    <div className="fixed inset-0 z-[9998] flex items-start justify-center pt-[20vh]">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setCommandPaletteOpen(false)} />
      <div className="relative w-full max-w-2xl bg-background border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150" onKeyDown={handleKeyDown}>
        <div className="flex items-center gap-3 px-4 py-3 border-b">
          <span className="text-muted-foreground/50 text-sm shrink-0">⌘K</span>
          <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)} placeholder="搜索书签或输入 / 执行命令..." className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground/40" autoFocus />
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2 custom-scrollbar" role="listbox">
          {groups.map((group, gi) => (
            <div key={gi} className="mb-2">
              <div className="px-2 py-1 text-[11px] font-medium text-muted-foreground/50 uppercase tracking-wider">{group.label}</div>
              <div className="space-y-0.5">
                {group.items.map((item, ii) => {
                  const idx = groups.slice(0, gi).reduce((s, g) => s + g.items.length, 0) + ii;
                  return (
                    <button key={item.id || ii} role="option" aria-selected={idx === activeIndex}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${idx === activeIndex ? "bg-muted/60" : "hover:bg-muted/30"}`}
                      onClick={() => selectItem(item)}
                    >
                      <span className="w-7 h-7 flex items-center justify-center rounded-md bg-muted text-muted-foreground text-xs shrink-0">
                        {item.url ? "🔗" : item.prefix === "docker" ? "📦" : item.prefix === "ssh" ? "🔌" : item.prefix === "ai" ? "🤖" : ">"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{item.title}</div>
                        {item.description && <div className="text-xs text-muted-foreground/60 truncate">{item.description}</div>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {loading && <div className="py-8 text-center text-sm text-muted-foreground/50">执行中...</div>}
          {!loading && groups.length === 0 && <div className="py-8 text-center text-sm text-muted-foreground/50">没有结果</div>}
        </div>
        <div className="px-4 py-2 border-t text-[11px] text-muted-foreground/30 flex gap-4">
          <span>↵ 选中</span><span>↑↓ 导航</span><span>Esc 关闭</span>
          <span className="ml-auto">输入 / 执行命令</span>
        </div>
      </div>
    </div>
  );
}
