"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useUIStore } from "@/lib/stores";
import { DataSchema, LinkItem } from "@/lib/types";
import { getFrequentBookmarks, recordClick } from "@/lib/utils/bookmark-stats";
import { toast } from "sonner";

interface Command {
  prefix: string;
  label: string;
  description: string;
  action: string;
}

const COMMANDS: Command[] = [
  { prefix: "docker", label: "/docker", description: "管理 Docker 容器", action: "docker" },
  { prefix: "ssh", label: "/ssh <别名>", description: "远程连接设备（可选加命令）", action: "ssh" },
  { prefix: "ai", label: "/ai <问题>", description: "AI 快速问答", action: "ai" },
  { prefix: "wol", label: "/wol <别名>", description: "Wake-on-LAN 唤醒设备", action: "wol" },
  { prefix: "search", label: "/search <关键词>", description: "全局搜索", action: "search" },
];

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

  // 设备别名缓存
  const [deviceAliases, setDeviceAliases] = useState<{ name: string; host?: string; type: string }[]>([]);

  // 面板打开/关闭时的副作用
  useEffect(() => {
    if (isCommandPaletteOpen) {
      inputRef.current?.focus();
      // 加载监控目标和远程设备列表
      fetch("/api/v1/admin/monitor/checks")
        .then(r => r.json())
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .then((d: any) => {
          const targets = (d?.targets || []).map((t: any) => ({ name: t.name, host: t.url, type: "monitor" }));
          setDeviceAliases((prev: any[]) => [...targets, ...prev.filter((p: any) => p.type !== "monitor")]);
        })
        .catch(() => {});
      fetch("/api/v1/settings/device_config")
        .then(r => r.json())
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .then((d: any) => {
          if (d?.value) {
            try {
              const devices = JSON.parse(d.value);
              const aliases = (devices.devices || []).map((dv: any) => ({ name: dv.name, host: dv.host, type: "device" }));
              setDeviceAliases((prev: any[]) => [...prev.filter((p: any) => p.type !== "device"), ...aliases]);
            } catch {}
          }
        })
        .catch(() => {});
    } else {
      setQuery(""); // eslint-disable-next-line react-hooks/exhaustive-deps
    }
  }, [isCommandPaletteOpen]);

  // 执行命令
  const executeCommand = async (cmd: string, args: string[]) => {
    const argsStr = args.join(" ");
    switch (cmd) {
      case "docker":
        if (!argsStr) {
          setGroups([{ label: "Docker 操作", items: [
            { id: "ls", title: "列出所有容器", description: "docker ps" },
            { id: "logs", title: "查看容器日志", description: "/docker logs <容器名>" },
          ]}]);
          return;
        }
        toast.info(`执行 docker ${argsStr}...`);
        break;
      case "ssh": {
        if (!argsStr) {
          setGroups([{ label: "可用设备", items: deviceAliases.map(d => ({
            id: d.name, title: d.name, description: d.host || "",
          }))}]);
          return;
        }
        const alias = deviceAliases.find(d => argsStr.startsWith(d.name));
        if (alias) {
          const cmdStr = argsStr.slice(alias.name.length).trim();
          if (!cmdStr) { onToggleSSH(); setCommandPaletteOpen(false); return; }
          toast.info(`SSH ${alias.name}: ${cmdStr}...`);
          setCommandPaletteOpen(false);
        } else {
          toast.error("未找到设备");
        }
        break;
      }
      case "ai": {
        if (!argsStr) { onToggleAI(); setCommandPaletteOpen(false); return; }
        setLoading(true);
        try {
          const res = await fetch("/api/v1/ai/chat", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: argsStr }),
          });
          const data = await res.json();
          setGroups([{ label: "AI 回复", items: [{ id: "reply", title: data.reply || data.error, description: "" }] }]);
        } catch (err) {
          toast.error("AI 调用失败");
        }
        setLoading(false);
        break;
      }
      case "wol":
        if (!argsStr) {
          setGroups([{ label: "可唤醒设备", items: deviceAliases.map(d => ({
            id: d.name, title: d.name, description: "发送 WOL 魔术包",
          }))}]);
          return;
        }
        toast.success(`已发送 WOL 唤醒包到 ${argsStr}`);
        setCommandPaletteOpen(false);
        break;
    }
  };

  // 搜索同步数据（书签 + 命令），用 useMemo
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
      const matched = COMMANDS.filter(c => c.prefix.startsWith(cmd));
      return [{ label: `命令匹配 (${matched.length})`, items: matched.map(c => ({ id: c.prefix, title: c.label, description: c.description, prefix: c.prefix })) }];
    }
    const q = query.toLowerCase();
    const hits = allBookmarks.filter(b => b.title.toLowerCase().includes(q) || b.url?.toLowerCase().includes(q)).slice(0, 15);
    return hits.length > 0
      ? [{ label: `书签 (${hits.length})`, items: hits.map(b => ({ id: b.id, title: b.title, description: b.url, url: b.url })) }]
      : [{ label: "没有找到", items: [{ id: "empty", title: "尝试 /search 进行全局搜索", description: "", prefix: "search" }] }];
  }, [isCommandPaletteOpen, query, allBookmarks]);

  // 同步搜索计算 → setGroups
  const prevSearchKey = useRef("");
  useEffect(() => {
    const key = JSON.stringify(searchGroups);
    if (key === prevSearchKey.current) return;
    prevSearchKey.current = key;
    setGroups(searchGroups);
  }, [searchGroups]); // eslint-disable-line react-hooks/exhaustive-deps

  // 命令模式：执行命令
  useEffect(() => {
    if (!isCommandPaletteOpen || !query.startsWith("/")) return;
    const parts = query.slice(1).split(/\s+/);
    const cmd = parts[0]?.toLowerCase() || "";
    const args = parts.slice(1);
    const matched = COMMANDS.filter(c => c.prefix.startsWith(cmd));
    if (matched.length === 1 && cmd && args.length > 0) {
      executeCommand(matched[0].prefix, args);
    }
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  // 重置 activeIndex 当搜索组变化时
  useEffect(() => {
    setActiveIndex(0);
  }, [searchGroups]); // eslint-disable-line react-hooks/exhaustive-deps

  const flatItems = useMemo(() => groups.flatMap(g => g.items), [groups]);

  const selectItem = (item: any) => {
    if (item.url) {
      recordClick(item.id);
      onOpenLink(item.url);
      setCommandPaletteOpen(false);
    } else if (item.prefix) {
      setQuery("/" + item.prefix + " ");
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
                        {item.url ? "🔗" : ">"}
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
          {loading && <div className="py-8 text-center text-sm text-muted-foreground/50">搜索中...</div>}
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
