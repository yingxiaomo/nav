"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ChevronDown, Cpu, HardDrive, Plus, XCircle, Box, MemoryStick, Zap, Container, ExternalLink, Globe, Server, Monitor, Wifi, Database, Cloud, Terminal, Shield, Activity, Settings, Loader2, Pin, Play, Square } from "lucide-react";
import { useMonitorConfig } from "@/lib/hooks/use-monitor-config";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ── Types ──
interface SystemInfo {
  cpu: { usage: number; cores: number };
  memory: { total: number; used: number; usedPercent: number };
  disk: { total: number; used: number; usedPercent: number };
  uptime: number;
}
interface CheckResult {
  id: string; name: string; url: string;
  status: 'ok' | 'timeout' | 'error';
  latency: number | null;
}
interface TargetInfo {
  id: string; name: string; url: string; icon?: string; mac?: string;
}
interface ContainerInfo {
  id: string; name: string; image: string;
  state: string; status: string; ports: string; created: string;
}
interface ContainerStats {
  name: string; cpuPercent: number;
  memUsage: number; memLimit: number; memPercent: number;
}

// ── Helpers ──
const fmt = (b: number) => {
  if (!b) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'], i = Math.floor(Math.log(b) / Math.log(1024));
  return (b / Math.pow(1024, i)).toFixed(1) + ' ' + u[i];
};
const uptimeStr = (s: number) => {
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return `${d}天${h}时${m}分${sec}秒`;
};
const serverName = typeof window !== 'undefined'
  ? (window.location.hostname === 'localhost' ? '本地服务器' : window.location.hostname)
  : '服务器';

/** 从 Docker 端口字符串提取第一个宿主机IP:端口的URL */
function parseContainerUrl(ports: string): string | null {
  const m = ports.match(/(?:0\.0\.0\.0|::):(\d+)->\d+/);
  if (m) return `http://${window.location.hostname}:${m[1]}`;
  return null;
}

// 各服务 CPU/RAM 静态估算（基于 id 做种子）
function mockResource(id: string): { cpu: number; ram: number } {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = ((hash << 5) - hash) + id.charCodeAt(i);
  const base = Math.abs(hash % 30);
  return { cpu: base, ram: 40 + base };
}

// ── Circular Progress ──
function CircleProgress({ percent, size = 72, stroke = 6, color, label, sub }: { percent: number; size?: number; stroke?: number; color: string; label: string; sub?: string }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(percent, 100) / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="absolute inset-0 transform -rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-border/60" />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
            strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
            className="transition-all duration-1000 ease-out" />
        </svg>
        <span className="text-lg font-bold tabular-nums" style={{ color }}>{percent}%</span>
      </div>
      <span className="text-[10px] font-medium" style={{ color }}>{label}</span>
      {sub && <span className="text-[9px] text-muted-foreground/60 mt-0.5">{sub}</span>}
    </div>
  );
}

// ═════════════════════════════ COMPONENT ═════════════════════════════

export function SystemStatusFloater() {
  const [expanded, setExpanded] = useState(false);
  const [sys, setSys] = useState<SystemInfo | null>(null);
  const [checks, setChecks] = useState<CheckResult[]>([]);
  const [targets, setTargets] = useState<TargetInfo[]>([]);
  const [containers, setContainers] = useState<ContainerInfo[]>([]);
  const [containerStats, setContainerStats] = useState<ContainerStats[]>([]);
  const [dockerMeta, setDockerMeta] = useState<Record<string, { name: string; icon?: string }>>({});
  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [editTarget, setEditTarget] = useState<{ id: string; name: string; icon?: string; url?: string; mac?: string } | null>(null);


  const { baseUrl, authHeaders, isActive } = useMonitorConfig();
  const menuRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(async () => {
    if (!baseUrl) return;
    try {
      const h = authHeaders;
      const sr = await fetch(`${baseUrl}/api/v1/admin/monitor/system`, { headers: h });
      const cr = await fetch(`${baseUrl}/api/v1/admin/monitor/checks`, { headers: h });
      const dr = await fetch(`${baseUrl}/api/v1/admin/docker/containers`, { headers: h });
      const sr2 = await fetch(`${baseUrl}/api/v1/admin/docker/stats`, { headers: h });
      const dmr = await fetch(`${baseUrl}/api/v1/admin/docker/metadata`, { headers: h });
      if (sr.ok) setSys(await sr.json());
      if (cr.ok) { const d = await cr.json(); setChecks(d.results || []); setTargets(d.targets || []); }
      if (dr.ok) { const d = await dr.json(); setContainers(d.containers || []); }
      if (sr2.ok) { const d = await sr2.json(); setContainerStats(d.stats || []); }
      if (dmr.ok) setDockerMeta(await dmr.json());
    } catch { /* silent */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseUrl]);

  const getContainerStat = (name: string) => containerStats.find(s => s.name === name);

  useEffect(() => {
  // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
    if (baseUrl) { const t = setInterval(fetchData, 30000); return () => clearInterval(t); }
  }, [fetchData, baseUrl]);

  // Close context menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setContextMenu(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [contextMenu]);

  if (!isActive) return null;

  const getIcon = (id: string): string | undefined =>
    targets.find(t => t.id === id)?.icon;
  const getMac = (id: string): string | undefined =>
    targets.find(t => t.id === id)?.mac;
  const getDockerIcon = (containerName: string): string | undefined =>
    dockerMeta[containerName]?.icon;

  const handleWake = async (id: string) => {
    const mac = getMac(id);
    if (!mac) return;
    try {
      const h = authHeaders;
      await fetch(`${baseUrl}/api/v1/admin/monitor/wol/${id}`, { method: 'POST', headers: h });
    } catch { /* silent */ }
    setContextMenu(null);
  };

  const handleDockerAction = async (name: string, action: 'start' | 'stop' | 'restart') => {
    try {
      const h = authHeaders;
      const res = await fetch(`${baseUrl}/api/v1/admin/docker/${encodeURIComponent(name)}/${action}`, { method: 'POST', headers: h });
      if (res.ok) { setTimeout(fetchData, 1000); }
    } catch { /* silent */ }
    setContextMenu(null);
  };

  const cpuPct = sys?.cpu?.usage ?? 0;
  const memPct = sys?.memory?.usedPercent ?? 0;
  const diskPct = sys?.disk?.usedPercent ?? 0;
  const cpuC = cpuPct > 80 ? '#ef4444' : cpuPct > 50 ? '#06b6d4' : '#22c55e';
  const memC = memPct > 80 ? '#ef4444' : memPct > 50 ? '#06b6d4' : '#22c55e';
  const diskC = diskPct > 85 ? '#ef4444' : diskPct > 60 ? '#06b6d4' : '#22c55e';

  const runningCount = checks.filter(c => c.status === 'ok').length + containers.filter(c => c.state === 'running').length;
  const stoppedCount = (checks.length + containers.length) - runningCount;

  const glassPanel = 'bg-background/70 dark:bg-background/60 backdrop-blur-xl border border-border/40';
  const WIDTH = 'min(360px, calc(100vw - 32px))';

  return (
    <div className="fixed top-4 right-4 z-[60]" style={{ width: WIDTH }}>
      {/* ── Collapsed pill ── */}
      <div
        className={cn('flex items-center justify-between px-3 h-10 cursor-pointer select-none rounded-2xl transition-all duration-300 hover:border-border/80', glassPanel)}
        onClick={() => setExpanded(!expanded)}
      >
        {/* 【左侧模块】：flex-1 强制占据左边 50% 空间 */}
        <div className="flex-1 flex items-center justify-start">
          <div className="flex items-center gap-3 text-sm font-medium tabular-nums">
            <div className="flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-blue-500" />
              <span className="text-foreground w-8 inline-block text-left">{cpuPct}%</span>
            </div>
            <div className="w-px h-3 bg-border/60"></div>
            <div className="flex items-center gap-1.5">
              <MemoryStick className="w-4 h-4 text-amber-500" />
              <span className="text-foreground w-8 inline-block text-left">{memPct}%</span>
            </div>
          </div>
        </div>

        {/* 【中间模块】：绝对定位，死死钉在物理正中心 */}
        <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10 flex items-center gap-2">
          <div className="flex items-center gap-1 px-3 py-0.5 rounded-lg bg-muted/40 dark:bg-white/5 border border-border/30 hover:bg-accent transition-colors">
            <ChevronDown className={cn('w-3 h-3 text-muted-foreground transition-transform duration-200', expanded && 'rotate-180')} />
            <span className="text-[10px] text-muted-foreground">{expanded ? '收起' : '展开'}</span>
          </div>
        </div>

        {/* 【右侧模块】：完全镜像对称（数字在左，图标在右） */}
        <div className="flex-1 flex items-center justify-end">
          <div className="flex items-center gap-3 text-sm font-medium tabular-nums">
            {/* 运行中状态 */}
            <div className="flex items-center gap-1.5">
              <span className="text-foreground w-8 inline-block text-right">{runningCount}</span>
              <Box className="w-4 h-4 text-green-500" />
            </div>
            <div className="w-px h-3 bg-border/60"></div>
            {/* 停止状态 */}
            <div className="flex items-center gap-1.5">
              <span className="text-foreground w-8 inline-block text-right">{stoppedCount}</span>
              <XCircle className="w-4 h-4 text-red-500" />
            </div>
          </div>
        </div>
      </div>

      {/* ── Expanded panel ── */}
      <div
        className={cn('mt-2 overflow-hidden transition-all duration-300 ease-in-out', expanded ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0 pointer-events-none')}
      >
        <div className={cn('rounded-2xl p-3 space-y-3', glassPanel)}>

          {/* ── Card 1: Running status + Ring gauges ── */}
          <div className="rounded-xl p-3.5 bg-card/50 dark:bg-white/5 border border-border/30">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-sm font-medium text-foreground">{serverName}</div>
                <div className="text-xs mt-0.5 text-muted-foreground">
                  ⏱ {sys ? uptimeStr(sys.uptime) : '加载中...'}
                </div>
                <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground/60">
                  <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />在线</span>
                  <span>{sys?.cpu?.cores ?? '-'} 核</span>
                </div>
              </div>
              {/* Two ring gauges side by side */}
              <div className="flex gap-4">
                <CircleProgress percent={cpuPct} size={56} stroke={5} color={cpuC} label="CPU" sub={sys ? `${sys.cpu.cores}核` : '—'} />
                <CircleProgress percent={memPct} size={56} stroke={5} color={memC} label="RAM" sub={sys ? `${fmt(sys.memory.used)} / ${fmt(sys.memory.total)}` : '—'} />
              </div>
            </div>
          </div>

          {/* ── Card 2: Service Checks with add button ── */}
          <div className="rounded-xl p-3.5 bg-card/50 dark:bg-white/5 border border-border/30">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-xs font-medium text-muted-foreground">服务巡检</span>
              </div>
              <button
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-muted/40 dark:bg-white/5 border border-border/30 backdrop-blur-sm text-[11px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                onClick={() => setEditTarget({ id: '', name: '', url: '' })}
              >
                <Plus className="w-3 h-3" />
                添加
              </button>
            </div>
            {checks.length === 0 ? (
              <div className="text-xs py-2 text-center text-muted-foreground/60">暂无监控目标，点 [+添加] 添加</div>
            ) : (
              <div className="space-y-1 max-h-[200px] overflow-y-auto">
                {checks.map((c) => {
                  const mc = mockResource(c.id);
                  return (
                    <div
                      key={c.id}
                      className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-muted/30 dark:bg-white/[0.03] hover:bg-accent/50 transition-colors cursor-pointer relative"
                      onContextMenu={(e) => { e.preventDefault(); setContextMenu({ id: c.id, x: e.clientX, y: e.clientY }); }}
                      onClick={() => window.open(c.url, '_blank')}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.status === 'ok' ? 'bg-green-400' : 'bg-red-400'}`} />
                        {(() => {
                          const icon = getIcon(c.id);
                          if (icon) {
                            if (icon.startsWith('http') || icon.startsWith('/uploads') || icon.startsWith('data:'))
                              return <img src={icon} alt="" className="w-4 h-4 rounded shrink-0" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />;
                            return <span className="text-sm shrink-0">{icon}</span>;
                          }
                          return null;
                        })()}
                        <span className="text-xs truncate text-foreground/80">{c.name}</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 ml-2">
                        <span className="text-[10px] tabular-nums text-muted-foreground/60" style={{ color: mc.cpu > 50 ? '#f59e0b' : undefined }}>
                          {mc.cpu}%
                        </span>
                        <span className="text-[10px] tabular-nums text-muted-foreground/60">{fmt(mc.ram * 1024 * 1024)}</span>
                        <span className="text-[11px] font-medium" style={{ color: c.status === 'ok' ? '#4ade80' : '#f87171' }}>
                          {c.status === 'ok' ? (c.latency !== null ? c.latency + 'ms' : '正常') : '离线'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Card 3: Docker ── */}
          {containers.length > 0 && (
          <div className="rounded-xl p-3.5 bg-card/50 dark:bg-white/5 border border-border/30">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-1.5">
                <Container className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">Docker 容器</span>
              </div>
              <span className="text-[11px] text-muted-foreground/60">
                <span className="text-green-400">{containers.filter(function(c) { return c.state === "running"; }).length}</span>
                /{containers.length} 运行中
              </span>
            </div>
            <div className="space-y-1 max-h-[200px] overflow-y-auto">
              {containers.map(function(c) {
                return (
                <div key={c.id}
                  className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-muted/30 dark:bg-white/[0.03] hover:bg-accent/50 transition-colors cursor-pointer"
                  onContextMenu={function(e) { e.preventDefault(); setContextMenu({ id: "docker:" + c.name, x: e.clientX, y: e.clientY }); }}
                  onClick={function() {
                    const url = parseContainerUrl(c.ports);
                    if (url) window.open(url, "_blank");
                  }}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className={"w-1.5 h-1.5 rounded-full shrink-0 " + (c.state === "running" ? "bg-green-400" : "bg-red-400")} />
                    {(() => { const ico = getDockerIcon(c.name); if (ico) { if (ico.startsWith('http') || ico.startsWith('/uploads') || ico.startsWith('data:')) return <img src={ico} alt="" className="w-4 h-4 rounded shrink-0" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />; return <span className="text-sm shrink-0">{ico}</span>; } return null; })()}
                    <span className="text-xs truncate text-foreground/80">{c.name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    {(() => { const st = c.state === "running" ? getContainerStat(c.name) : null; return st ? <><span className="text-[10px] tabular-nums text-foreground/80">{st.cpuPercent.toFixed(1)}%</span><span className="text-[9px] tabular-nums text-muted-foreground/60 ml-1">{fmt(st.memUsage)}</span></> : <span className="text-[10px] tabular-nums text-muted-foreground/60">{c.status}</span>; })()}
                    {c.state === "running" ? <ExternalLink className="w-3 h-3 text-muted-foreground/40" /> : null}
                  </div>
                </div>
                );
              })}
            </div>
          </div>
          )}
          {/* ── Card 3: Storage ── */}
          <div className="rounded-xl p-3.5 bg-card/50 dark:bg-white/5 border border-border/30">
            <div className="flex items-center gap-1.5 mb-2.5">
              <HardDrive className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">存储空间</span>
            </div>
            <div className="flex justify-between text-xs mb-1.5 text-muted-foreground/70">
              <span>已用 {sys ? fmt(sys.disk?.used) : '-'}</span>
              <span>总量 {sys ? fmt(sys.disk?.total) : '-'}</span>
            </div>
            <div className="h-2 rounded-full bg-border/60">
              <div className="h-full rounded-full transition-all duration-1000 ease-out"
                style={{ width: Math.min(diskPct, 100) + '%', background: diskC }} />
            </div>
          </div>

        </div>
      </div>

      {/* ── Context menu ── */}
      {contextMenu && (
        <div
          ref={menuRef}
          className="fixed z-[70] min-w-[140px] rounded-xl backdrop-blur-xl border border-border/40 p-1 shadow-2xl"
          style={{
            left: Math.max(8, Math.min(contextMenu.x, window.innerWidth - 160)),
            top: Math.max(8, Math.min(contextMenu.y, window.innerHeight - 140)),
            background: 'hsl(var(--background) / 0.85)',
          }}
        >
          <button
            className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-foreground/80 hover:bg-accent rounded-lg transition-colors"
            onClick={async () => {
              const check = checks.find(c => c.id === contextMenu.id);
              const dockerC = containers.find(c => 'docker:' + c.name === contextMenu.id);
              const name = check?.name || dockerC?.name || contextMenu.id.replace('docker:', '');
              const url = check?.url || (dockerC ? parseContainerUrl(dockerC.ports) : undefined);
              const icon = check?.id ? (getIcon(check.id) || undefined) : (dockerC ? getDockerIcon(dockerC.name) || undefined : undefined);
              if (url && baseUrl) {
                try {
                  const h = { ...authHeaders, 'Content-Type': 'application/json' };
                  // 查找或创建固定服务分类
                  const catRes = await fetch(`${baseUrl}/api/v1/categories`, { headers: h });
                  if (!catRes.ok) { toast.error('获取分类失败'); setContextMenu(null); return; }
                  const cats = await catRes.json();
                  let catId = Array.isArray(cats) ? cats.find((c: Record<string, unknown>) => c.title === '固定服务')?.id : null;
                  if (!catId) {
                    const cr = await fetch(`${baseUrl}/api/v1/categories`, { method: 'POST', headers: h, body: JSON.stringify({ title: '固定服务' }) });
                    if (!cr.ok) { toast.error('创建分类失败'); setContextMenu(null); return; }
                    catId = (await cr.json()).id;
                  }
                  // 添加书签（带图标）
                  if (catId) {
                    const bkRes = await fetch(`${baseUrl}/api/v1/bookmarks`, { method: 'POST', headers: h, body: JSON.stringify({ categoryId: catId, title: name, url, icon }) });
                    if (bkRes.ok) {
                      toast.success(`已固定「${name}」到主页`);
                    } else {
                      const err = await bkRes.json().catch(() => ({}));
                      const errMsg = (err as Record<string, unknown>)?.error;
                      toast.error('固定失败: ' + (typeof errMsg === 'object' && errMsg !== null ? (errMsg as Record<string, unknown>)?.message || JSON.stringify(errMsg) : (errMsg || bkRes.status)));
                    }
                  }
                } catch (e) { toast.error('固定失败: 网络错误'); }
              } else {
                if (!url) toast.error('无法固定：没有可访问的 URL');
              }
              setContextMenu(null);
            }}
            aria-label="固定到主页"
          >
            <Pin className="w-3 h-3" /> 固定到主页
          </button>
          {(checks.some(c => c.id === contextMenu.id) || contextMenu.id.startsWith('docker:')) && (
            <button className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-foreground/80 hover:bg-accent rounded-lg transition-colors"
              onClick={() => {
                const c = checks.find(ch => ch.id === contextMenu.id);
                if (c) { setEditTarget({ id: c.id, name: c.name, icon: getIcon(c.id), url: c.url, mac: getMac(c.id) }); }
                else {
                  const dc = containers.find(ch => 'docker:' + ch.name === contextMenu.id);
                  if (dc) setEditTarget({ id: contextMenu.id, name: dc.name, icon: getDockerIcon(dc.name) || undefined, url: parseContainerUrl(dc.ports) || undefined });
                }
                setContextMenu(null);
              }}
              aria-label="编辑"
            >
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg> 编辑
            </button>
          )}
          {getMac(contextMenu.id) && (
            <button
              className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors"
              onClick={() => handleWake(contextMenu.id)}
              aria-label="WOL 唤醒"
            >
              <Zap className="w-3 h-3" /> WOL 唤醒
            </button>
          )}
          {contextMenu.id.startsWith('docker:') && (
            <button className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-green-400 hover:bg-green-500/10 rounded-lg transition-colors"
              onClick={() => { const name = contextMenu.id.replace('docker:', ''); handleDockerAction(name, 'start'); }}
              aria-label="启动"
            >
              <Play className="w-3 h-3" /> 启动
            </button>
          )}
          {contextMenu.id.startsWith('docker:') && (
            <button className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-foreground/80 hover:bg-accent rounded-lg transition-colors"
              onClick={() => { const name = contextMenu.id.replace('docker:', ''); handleDockerAction(name, 'restart'); }}
              aria-label="重启"
            >
              <Play className="w-3 h-3 text-green-400" /> 重启
            </button>
          )}
          {contextMenu.id.startsWith('docker:') && (
            <button className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
              onClick={() => { const name = contextMenu.id.replace('docker:', ''); handleDockerAction(name, 'stop'); }}
              aria-label="停止"
            >
              <Square className="w-3 h-3" /> 停止
            </button>
          )}
        </div>
      )}

      {/* ── 编辑巡检目标 ── */}
      {editTarget && (
        <MonitorEditDialog
          target={editTarget}
          baseUrl={baseUrl || ''}
          authHeaders={authHeaders}
          onClose={() => setEditTarget(null)}
          onSaved={() => { setEditTarget(null); fetchData(); }}
        />
      )}
    </div>
  );
}

// ── 巡检目标编辑弹窗（居中模态）──
function MonitorEditDialog({ target, baseUrl, authHeaders, onClose, onSaved }: {
  target: { id: string; name: string; icon?: string; url?: string; mac?: string };
  baseUrl: string; authHeaders: Record<string, string>;
  onClose: () => void; onSaved: () => void;
}) {
  const [name, setName] = useState(target.name);
  const [icon, setIcon] = useState(target.icon || '');
  const [url, setUrl] = useState(target.url || '');
  const [mac, setMac] = useState(target.mac || '');
  const [saving, setSaving] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 100); }, []);

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const isDocker = target.id.startsWith('docker:');
    try {
      if (!target.id) {
        // 添加模式
        if (!url.trim()) { setSaving(false); return; }
        await fetch(`${baseUrl}/api/v1/admin/monitor/checks`, {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim(), url: url.trim(), icon: icon || undefined }),
        });
      } else if (isDocker) {
        // 编辑模式（Docker 容器）
        const containerName = target.id.replace('docker:', '');
        await fetch(`${baseUrl}/api/v1/admin/docker/metadata/${encodeURIComponent(containerName)}`, {
          method: 'PUT',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ icon: icon || undefined }),
        });
      } else {
        // 编辑模式（内网巡检）
        await fetch(`${baseUrl}/api/v1/admin/monitor/checks/${target.id}`, {
          method: 'PUT',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim(), icon: icon || undefined, mac: mac.trim() || undefined }),
        });
      }
    } catch { /* silent */ }
    setSaving(false);
    onSaved();
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${baseUrl}/api/v1/upload`, { method: 'POST', body: formData });
      if (res.ok) { const d = await res.json(); if (d.url) setIcon(d.url); }
    } catch { /* silent */ }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const detectIcon = async () => {
    setDetecting(true);
    try {
      // 有 URL 时优先用 monitor API（从页面 HTML 提取 favicon）
      const detectUrl = url || target.url;
      if (detectUrl) {
        const res = await fetch(`${baseUrl}/api/v1/admin/monitor/fetch-icon`, {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: detectUrl }),
        });
        if (res.ok) { const d = await res.json(); if (d.icon) { setIcon(d.icon); return; } }
      }
      // Docker 回退：镜像名 → knownDomains 映射 → DuckDuckGo 图标
      if (target.id.startsWith('docker:')) {
        const res = await fetch(`${baseUrl}/api/v1/admin/docker/fetch-icon`, {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: target.id.replace('docker:', '') }),
        });
        if (res.ok) { const d = await res.json(); if (d.icon) setIcon(d.icon); }
      }
    } catch { /* silent */ }
    setDetecting(false);
  };

  const QUICK_ICONS = ['Container', 'Server', 'Globe', 'Monitor', 'Wifi', 'HardDrive', 'Database', 'Cloud', 'Terminal', 'Shield', 'Activity', 'Settings', 'Box', 'MemoryStick', 'Cpu', 'Zap'];
  const lucideIconMap: Record<string, React.FC<{className?: string}>> = { Container, Server, Globe, Monitor, Wifi, HardDrive, Database, Cloud, Terminal, Shield, Activity, Settings, Box, MemoryStick, Cpu, Zap };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div className="bg-background/90 backdrop-blur-xl border border-border/40 rounded-2xl p-5 w-80 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="text-sm font-medium text-foreground mb-3">{!target.id ? '添加监控目标' : target.id.startsWith('docker:') ? '编辑 Docker 容器' : '编辑巡检目标'}</div>
        <input ref={inputRef} value={name} onChange={e => setName(e.target.value)}
          placeholder="名称" className="w-full px-3 py-2 rounded-xl text-sm bg-muted/50 border border-border/40 text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-border/80 transition-colors mb-2"
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') onClose(); }}
        />
        {!target.id && (
        <input value={url} onChange={e => setUrl(e.target.value)}
          placeholder="http://192.168.1.xxx:8080"
          className="w-full px-3 py-2 rounded-xl text-sm bg-muted/50 border border-border/40 text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-border/80 transition-colors mb-2"
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') onClose(); }}
        />
        )}
        {!target.id.startsWith('docker:') && (
        <input value={mac} onChange={e => setMac(e.target.value)}
          placeholder="MAC 地址（可选，用于局域网唤醒）"
          className="w-full px-3 py-2 rounded-xl text-sm bg-muted/50 border border-border/40 text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-border/80 transition-colors mb-2"
        />
        )}
        <div className="text-[11px] text-muted-foreground mb-1.5">图标</div>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {QUICK_ICONS.map(ico => {
            const isActive = icon === `:${ico}:`;
            const Comp = lucideIconMap[ico];
            if (!Comp) return null;
            return (
              <button key={ico}
                className={`p-1.5 rounded-lg border transition-colors ${isActive ? 'bg-white/20 border-white/40' : 'bg-muted/30 border-border/30 hover:bg-accent/50'}`}
                onClick={() => setIcon(`:${ico}:`)}
                title={ico}
              >
                <Comp className="w-4 h-4" />
              </button>
            );
          })}
        </div>
        <div className="flex gap-1.5 items-center mb-2">
          <input value={icon.startsWith(':') ? '' : icon} onChange={e => setIcon(e.target.value)}
            placeholder="图标 URL / 上传 / 选中上方"
            className="flex-1 px-3 py-2 rounded-xl text-sm bg-muted/50 border border-border/40 text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-border/80 transition-colors"
          />
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
          <button className="shrink-0 px-2 py-2 rounded-xl text-[11px] bg-muted/50 border border-border/30 hover:bg-accent transition-colors disabled:opacity-50" disabled={uploading} onClick={() => fileRef.current?.click()}>
            {uploading ? <Loader2 className="size-3.5 animate-spin" /> : '上传'}
          </button>
          <button className="shrink-0 px-2 py-2 rounded-xl text-[11px] bg-muted/50 border border-border/30 hover:bg-accent transition-colors disabled:opacity-50" disabled={detecting} onClick={detectIcon}>
            {detecting ? <Loader2 className="size-3.5 animate-spin" /> : '识别'}
          </button>
        </div>
        {icon && !icon.startsWith(':') && (
          <img src={icon} alt="" className="w-8 h-8 rounded-lg mb-2" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        )}
        <div className="flex gap-2">
          <button className="flex-1 px-3 py-1.5 rounded-xl text-sm font-medium text-foreground bg-muted/50 border border-border/30 hover:bg-accent transition-colors" onClick={onClose}>取消</button>
          <button className="flex-1 px-3 py-1.5 rounded-xl text-sm font-medium text-white transition-colors disabled:opacity-50" style={{ background: '#6366f1' }} disabled={saving} onClick={save}>
            {saving ? '保存中...' : !target.id ? '添加' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
