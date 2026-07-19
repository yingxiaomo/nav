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

  useEffect(() => {
    if (!isCommandPaletteOpen) return;
    fetch("/api/v1/admin/monitor/checks")
      .then(r => r.json())
      .then((d: any) => {
        const targets = (d?.targets || []).map((t: any) => ({ name: t.name, host: t.url, type: "monitor" }));
        setDeviceAliases((prev: any[]) => [...targets, ...prev.filter((p: any) => p.type !== "monitor")]);
      })
      .catch(() => {});
    fetch("/api/v1/settings/device_config")
      .then(r => r.ok ? r.json() : null)
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
  }, [isCommandPaletteOpen]);

  // 执行命令
  const executeCommand = async (cmd: string, args: string[]) => {
    const argsStr = args.join(" ");
    setLoading(true);

    switch (cmd) {
      case "docker": {
        if (!argsStr) {
          try {
            const res = await fetch("/api/v1/admin/docker/containers");
            const data = await res.json();
            const cis = data?.containers || [];

            setGroups([{ label: `Docker 容器 (${cis.length})`, items: cis.map((c: any) => ({
              id: c.id, title: c.name.replace(/^\//, ""), description: `${c.image} · ${c.status}`,
            })) }]);
          } catch { toast.error("获取容器列表失败"); }
          setLoading(false);
          return;
        }
        const [action, ...nameParts] = args;
        const containerName = nameParts.join(" ");
        if (!containerName) {
          setGroups([{ label: "Docker 操作", items: [
            { id: "ps", title: "docker ps", description: "列出所有容器" },
            { id: "restart", title: "docker restart <容器>", description: "重启容器" },
            { id: "start", title: "docker start <容器>", description: "启动容器" },
            { id: "stop", title: "docker stop <容器>", description: "停止容器" },
            { id: "logs", title: "docker logs <容器>", description: "查看容器日志" },
          ]}]);
          setLoading(false);
          return;
        }
        const validActions = ["start", "stop", "restart"];
        if (validActions.includes(action)) {
          try {
            await fetch(`/api/v1/admin/docker/${encodeURIComponent(containerName)}/${action}`, { method: "POST" });
            toast.success(`Docker ${action} ${containerName} ✅`);
            setCommandPaletteOpen(false);
          } catch { toast.error(`Docker ${action} 失败`); }
        } else if (action === "logs") {
          try {
            const res = await fetch(`/api/v1/admin/docker/logs/${encodeURIComponent(containerName)}`);
            const logs = await res.text();
            setGroups([{ label: `日志: ${containerName}`, items: [{ id: "logs", title: logs.slice(0, 2000) || "(空)", description: "" }] }]);
          } catch { toast.error("获取日志失败"); }
        } else {
          toast.error(`未知操作: ${action}，支持 start/stop/restart/logs`);
        }
        setLoading(false);
        break;
      }

      case "ssh": {
        if (!argsStr) {
          setGroups([{ label: "可用设备", items: deviceAliases.map(d => ({
            id: d.name, title: d.name, description: d.host || "", alias: d,
          }))}]);
          setLoading(false);
          return;
        }
        const alias = deviceAliases.find(d => argsStr.startsWith(d.name));
        if (alias) {
          const cmdStr = argsStr.slice(alias.name.length).trim();
          if (!cmdStr) { onToggleSSH(); setCommandPaletteOpen(false); setLoading(false); return; }
          try {
            const res = await fetch("/api/v1/ssh/exec", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ host: alias.host, user: alias.name, pass: "", command: cmdStr }),
            });
            const data = await res.json();
            setGroups([{ label: `SSH ${alias.name}: ${cmdStr}`, items: [{ id: "output", title: data.output || "(无输出)", description: "" }] }]);
          } catch { toast.error("SSH 执行失败"); }
        } else {
          toast.error(`未找到设备 "${argsStr}"`);
        }
        setLoading(false);
        break;
      }

      case "ai": {
        if (!argsStr) { onToggleAI(); setCommandPaletteOpen(false); return; }
        try {
          const res = await fetch("/api/v1/ai/chat", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: argsStr }),
          });
          const data = await res.json();
          setGroups([{ label: "AI 回复", items: [{ id: "reply", title: data.reply || data.error, description: "" }] }]);
        } catch { toast.error("AI 调用失败"); }
        setLoading(false);
        break;
      }

      case "wol":
        if (!argsStr) {
          setGroups([{ label: "可唤醒设备", items: deviceAliases.map(d => ({
            id: d.name, title: d.name, description: "发送 WOL 魔术包",
          }))}]);
          setLoading(false);
          return;
        }
        toast.success(`已发送 WOL 唤醒包到 ${argsStr}`);
        setCommandPaletteOpen(false);
        setLoading(false);
        break;
    }
  };

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

  const prevSearchKey = useRef("");
  useEffect(() => {
    const key = JSON.stringify(searchGroups);
    if (key === prevSearchKey.current) return;
    prevSearchKey.current = key;
    setGroups(searchGroups);
  }, [searchGroups]);

  useEffect(() => {
    if (!isCommandPaletteOpen || !query.startsWith("/")) return;
    const parts = query.slice(1).split(/\s+/);
    const cmd = parts[0]?.toLowerCase() || "";
    const args = parts.slice(1);
    const matched = COMMANDS.filter(c => c.prefix.startsWith(cmd));
    if (matched.length === 1 && cmd && args.length > 0) {
      executeCommand(matched[0].prefix, args);
    }
  }, [query]);

  useEffect(() => { setActiveIndex(0); }, [searchGroups]);

  const flatItems = useMemo(() => groups.flatMap(g => g.items), [groups]);

  const selectItem = (item: any) => {
    if (item.url) { recordClick(item.id); onOpenLink(item.url); setCommandPaletteOpen(false); }
    else if (item.prefix) { setQuery("/" + item.prefix + " "); }
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
