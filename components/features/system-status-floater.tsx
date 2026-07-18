"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { ChevronDown, Cpu, HardDrive, XCircle, Box, MemoryStick, Container, ExternalLink, FileText, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { SystemInfo, CheckResult, ContainerInfo, ContainerStats, uptimeStr, serverName, parseContainerUrl, mockResource } from "@/components/features/monitor-types";
import { formatFileSize } from "@/lib/utils/format";
import { CircleProgress } from "@/components/features/circle-progress";
import { MonitorEditDialog } from "@/components/features/monitor-edit-dialog";
import { LogViewer } from "@/components/features/log-viewer";
import { useMonitorData } from "@/lib/hooks/use-monitor-data";
import type { MonitorEditTarget } from "@/components/features/monitor-types";
import { useMonitorConfig } from "@/lib/hooks/use-monitor-config";

export function SystemStatusFloater() {
  const [expanded, setExpanded] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [editTarget, setEditTarget] = useState<MonitorEditTarget | null>(null);
  const [logContainer, setLogContainer] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const dragSrc = useRef<string | null>(null);

  const { sys, checks, targets, containers, containerStats, dockerMeta, uptime, refresh } = useMonitorData();
  const { baseUrl, authHeaders, isActive } = useMonitorConfig();

  // Close context menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setContextMenu(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [contextMenu]);

  if (!isActive) return null;

  const getIcon = (id: string): string | undefined => targets.find((t) => t.id === id)?.icon;
  const getMac = (id: string): string | undefined => targets.find((t) => t.id === id)?.mac;
  const getDockerIcon = (name: string): string | undefined => dockerMeta[name]?.icon;
  const getDockerLabel = (name: string): string => dockerMeta[name]?.label || name;
  const getDockerUrl = (name: string): string | undefined => dockerMeta[name]?.url;

  const handleWake = async (id: string) => {
    const mac = getMac(id);
    if (!mac) return;
    try { await fetch(`${baseUrl}/api/v1/admin/monitor/wol/${id}`, { method: "POST", headers: authHeaders }); } catch {}
    setContextMenu(null);
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`${baseUrl}/api/v1/admin/monitor/checks/${id}`, { method: "DELETE", headers: authHeaders });
      setContextMenu(null);
      setTimeout(refresh, 500);
    } catch {}
  };

  const handleDockerReorder = async (names: string[]) => {
    try {
      await fetch(`${baseUrl}/api/v1/admin/docker/reorder`, {
        method: "PUT", headers: { ...authHeaders, "Content-Type": "application/json" }, body: JSON.stringify({ order: names }),
      });
    } catch {}
  };

  const handleDockerAction = async (name: string, action: "start" | "stop" | "restart") => {
    try {
      await fetch(`${baseUrl}/api/v1/admin/docker/${encodeURIComponent(name)}/${action}`, { method: "POST", headers: authHeaders });
      setTimeout(refresh, 1000);
    } catch {}
    setContextMenu(null);
  };

  const cpuPct = sys?.cpu?.usage ?? 0;
  const memPct = sys?.memory?.usedPercent ?? 0;
  const diskPct = sys?.disk?.usedPercent ?? 0;
  const cpuC = cpuPct > 80 ? "#ef4444" : cpuPct > 50 ? "#06b6d4" : "#22c55e";
  const memC = memPct > 80 ? "#ef4444" : memPct > 50 ? "#06b6d4" : "#22c55e";
  const diskC = diskPct > 85 ? "#ef4444" : diskPct > 60 ? "#06b6d4" : "#22c55e";

  const runningCount =
    checks.filter((c) => c.status === "ok").length +
    containers.filter((c) => c.state === "running").length;
  const totalCount = checks.length + containers.length;
  const offlineCount = totalCount - runningCount;
  const glassPanel = "bg-background/70 dark:bg-background/60 backdrop-blur-xl border border-border/40";

  return (
    <div className="fixed top-4 right-4 z-[60]" style={{ width: "min(360px, calc(100vw - 32px))" }}>

      {/* Collapsed pill — grid 5 columns, equal spacing */}
      <div className={cn("flex items-center justify-between px-3 h-10 cursor-pointer select-none rounded-2xl transition-all duration-300 hover:border-border/80 grid grid-cols-5", glassPanel)} onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-1.5 justify-center text-sm font-medium tabular-nums">
          <Cpu className="w-4 h-4 text-blue-400 shrink-0" /><span>{cpuPct}%</span>
        </div>
        <div className="flex items-center gap-1.5 justify-center text-sm font-medium tabular-nums">
          <MemoryStick className="w-4 h-4 text-amber-400 shrink-0" /><span>{memPct}%</span>
        </div>
        <div className="flex items-center justify-center w-8 h-8 mx-auto rounded-full bg-muted/30 hover:bg-muted/50 transition-colors shrink-0">
          <ChevronDown className={cn("w-5 h-5 text-muted-foreground/70 transition-transform", expanded && "rotate-180")} />
        </div>
        <div className="flex items-center gap-1.5 justify-center text-sm font-medium tabular-nums">
          <span>{runningCount}</span><Box className="w-4 h-4 text-green-400 shrink-0" />
        </div>
        <div className="flex items-center gap-1.5 justify-center text-sm font-medium tabular-nums">
          <span>{offlineCount}</span><XCircle className="w-4 h-4 text-red-400 shrink-0" />
        </div>
      </div>
      {/* Expanded panel */}
      <div className={cn("mt-2 overflow-hidden transition-all duration-300", expanded ? "max-h-[800px] opacity-100" : "max-h-0 opacity-0 pointer-events-none")}>
        <div className={cn("rounded-2xl p-3 space-y-3", glassPanel)}>
          {/* System status */}
          <div className="rounded-xl p-3.5 bg-card/50 dark:bg-white/5 border border-border/30">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-sm font-medium">{serverName}</div>
                <div className="text-xs mt-0.5 text-muted-foreground">⏱ {sys ? uptimeStr(sys.uptime) : "加载中..."}</div>
              </div>
              <div className="flex gap-4">
                <CircleProgress percent={cpuPct} size={56} stroke={5} color={cpuC} label="CPU" sub={sys ? `${sys.cpu.cores}核` : "—"} />
                <CircleProgress percent={memPct} size={56} stroke={5} color={memC} label="RAM" sub={sys ? `${formatFileSize(sys.memory.used)} / ${formatFileSize(sys.memory.total)}` : "—"} />
              </div>
            </div>
          </div>

          {/* Service checks */}
          <div className="rounded-xl p-3.5 bg-card/50 dark:bg-white/5 border border-border/30">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-medium text-muted-foreground">服务巡检</span>
              <button className="flex items-center gap-1 px-2 py-1 rounded-lg bg-muted/40 text-[11px] text-muted-foreground hover:bg-accent transition-colors" onClick={() => setEditTarget({ id: "", name: "", url: "" })}>
                <Plus className="w-3 h-3" />添加
              </button>
            </div>
            {checks.length === 0 ? (
              <div className="text-xs py-2 text-center text-muted-foreground/60">暂无监控目标</div>
            ) : (
              <div className="space-y-1 max-h-[200px] overflow-y-auto">
                {checks.map((c) => (
                  <div key={c.id} className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-muted/30 hover:bg-accent/50 transition-colors cursor-pointer" onContextMenu={(e) => { e.preventDefault(); setContextMenu({ id: c.id, x: e.clientX, y: e.clientY }); }} onClick={() => window.open(c.url, "_blank")}>
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.status === "ok" ? "bg-green-400" : "bg-red-400"}`} />
                      <span className="text-xs truncate text-foreground/80">{c.name}</span>
                    </div>
                    <span className="text-[10px] tabular-nums text-muted-foreground/60">{c.latency != null ? `${c.latency}ms` : "-"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Docker containers */}
          {containers.length > 0 && (
            <div className="rounded-xl p-3.5 bg-card/50 dark:bg-white/5 border border-border/30">
              <div className="flex items-center gap-1.5 mb-2.5">
                <Container className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">Docker 容器</span>
              </div>
              <div className="space-y-1 max-h-[240px] overflow-y-auto">
                {[...containers].sort((a, b) => (dockerMeta[a.name]?.order ?? 999) - (dockerMeta[b.name]?.order ?? 999)).map((c) => (
                  <div key={c.id} data-container-name={c.name} draggable={containers.length > 1}
                    className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-muted/30 hover:bg-accent/50 transition-colors cursor-pointer"
                    onDragStart={() => { dragSrc.current = c.name; }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      const src = dragSrc.current; dragSrc.current = null;
                      if (!src) return;
                      const dst = (e.currentTarget as HTMLElement).closest("[data-container-name]")?.getAttribute("data-container-name");
                      if (!dst || src === dst) return;
                      const cur = [...containers].sort((a, b) => (dockerMeta[a.name]?.order ?? 999) - (dockerMeta[b.name]?.order ?? 999)).map((c) => c.name);
                      const si = cur.indexOf(src), di = cur.indexOf(dst);
                      [cur[si], cur[di]] = [cur[di], cur[si]];
                      handleDockerReorder(cur);
                    }}
                    onContextMenu={(e) => { e.preventDefault(); setContextMenu({ id: "docker:" + c.name, x: e.clientX, y: e.clientY }); }}
                    onClick={() => { const url = getDockerUrl(c.name) || parseContainerUrl(c.ports); if (url) window.open(url, "_blank"); }}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.state === "running" ? "bg-green-400" : "bg-red-400"}`} />
                      <span className="text-xs truncate text-foreground/80">{getDockerLabel(c.name)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Storage */}
          <div className="rounded-xl p-3.5 bg-card/50 dark:bg-white/5 border border-border/30">
            <div className="flex items-center gap-1.5 mb-2.5">
              <HardDrive className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">存储空间</span>
            </div>
            <div className="flex justify-between text-xs mb-1.5 text-muted-foreground/70">
              <span>已用 {sys ? formatFileSize(sys.disk?.used) : "-"}</span>
              <span>总量 {sys ? formatFileSize(sys.disk?.total) : "-"}</span>
            </div>
            <div className="h-2 rounded-full bg-border/60">
              <div className="h-full rounded-full transition-all duration-1000" style={{ width: Math.min(diskPct, 100) + "%", background: diskC }} />
            </div>
          </div>
        </div>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div ref={menuRef} className="fixed z-[70] min-w-[140px] rounded-xl backdrop-blur-xl border border-border/40 p-1 shadow-2xl"
          style={{ left: Math.max(8, Math.min(contextMenu.x, window.innerWidth - 160)), top: Math.max(8, Math.min(contextMenu.y, window.innerHeight - 140)), background: "hsl(var(--background) / 0.85)" }}
        >
          {!contextMenu.id.startsWith("docker:") && (
            <button className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 rounded-lg transition-colors" onClick={() => handleDelete(contextMenu.id)}>
              <Trash2 className="w-3 h-3" /> 删除
            </button>
          )}
          {getMac(contextMenu.id) && (
            <button className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors" onClick={() => handleWake(contextMenu.id)}>
              WOL 唤醒
            </button>
          )}
          {contextMenu.id.startsWith("docker:") && (
            <>
              <button className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-foreground/80 hover:bg-accent rounded-lg transition-colors" onClick={() => handleDockerAction(contextMenu.id.replace("docker:", ""), "start")}>
                启动
              </button>
              <button className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-foreground/80 hover:bg-accent rounded-lg transition-colors" onClick={() => handleDockerAction(contextMenu.id.replace("docker:", ""), "restart")}>
                重启
              </button>
              <button className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition-colors" onClick={() => { setLogContainer(contextMenu.id.replace("docker:", "")); setContextMenu(null); }}>
                <FileText className="w-3 h-3" /> 日志
              </button>
              <button className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 rounded-lg transition-colors" onClick={() => handleDockerAction(contextMenu.id.replace("docker:", ""), "stop")}>
                停止
              </button>
            </>
          )}
        </div>
      )}

      {/* Edit monitor target dialog */}
      {editTarget && (
        <MonitorEditDialog
          target={editTarget}
          baseUrl={baseUrl || ""}
          authHeaders={authHeaders}
          onClose={() => setEditTarget(null)}
          onSaved={() => { setEditTarget(null); refresh(); }}
        />
      )}

      {/* Docker log viewer */}
      {logContainer && <LogViewer containerName={logContainer} baseUrl={baseUrl || ""} onClose={() => setLogContainer(null)} />}
    </div>
  );
}
