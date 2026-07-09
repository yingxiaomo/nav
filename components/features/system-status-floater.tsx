"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ChevronDown, Cpu, HardDrive, Plus, XCircle, Box, MemoryStick, Container, ExternalLink, FileText, Trash2, X as XIcon } from "lucide-react";
import { useMonitorConfig } from "@/lib/hooks/use-monitor-config";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { SystemInfo, CheckResult, TargetInfo, ContainerInfo, ContainerStats, fmt, uptimeStr, serverName, parseContainerUrl, mockResource } from "./monitor-types";
import { CircleProgress } from "./circle-progress";
import { MonitorEditDialog } from "./monitor-edit-dialog";
import type { MonitorEditTarget } from "./monitor-types";

export function SystemStatusFloater() {
  const [expanded, setExpanded] = useState(false);
  const [sys, setSys] = useState<SystemInfo | null>(null);
  const [checks, setChecks] = useState<CheckResult[]>([]);
  const [targets, setTargets] = useState<TargetInfo[]>([]);
  const [containers, setContainers] = useState<ContainerInfo[]>([]);
  const [containerStats, setContainerStats] = useState<ContainerStats[]>([]);
  const [dockerMeta, setDockerMeta] = useState<Record<string, { name: string; icon?: string; label?: string }>>({});
  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [editTarget, setEditTarget] = useState<MonitorEditTarget | null>(null);
  const [logContainer, setLogContainer] = useState<string | null>(null);
  const [logLines, setLogLines] = useState<string[]>([]);

  const { baseUrl, authHeaders, isActive } = useMonitorConfig();
  const menuRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(async () => {
    if (!baseUrl) return;
    try {
      const res = await fetch(`${baseUrl}/api/v1/admin/monitor/all`, { headers: authHeaders });
      if (res.ok) {
        const d = await res.json();
        setSys(d.system);
        setChecks(d.results || []);
        setTargets(d.targets || []);
        setContainers(d.containers || []);
        setContainerStats(d.stats || []);
        setDockerMeta(d.metadata || {});
        // initializing 字段在 Docker stats 首次就绪前为 true，前端可据此显示骨架屏
      }
    } catch (err) { console.warn('[Monitor] fetch data failed:', err); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseUrl]);

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
  const getDockerLabel = (containerName: string): string =>
    dockerMeta[containerName]?.label || containerName;

  const handleWake = async (id: string) => {
    const mac = getMac(id);
    if (!mac) return;
    try {
      const h = authHeaders;
      await fetch(`${baseUrl}/api/v1/admin/monitor/wol/${id}`, { method: 'POST', headers: h });
    } catch (err) { console.warn('[Monitor] WOL failed:', err); }
    setContextMenu(null);
  };

  const handleDelete = async (id: string) => {
    try {
      const h = authHeaders;
      await fetch(`${baseUrl}/api/v1/admin/monitor/checks/${id}`, { method: 'DELETE', headers: h });
      setContextMenu(null);
      setTimeout(fetchData, 500);
    } catch (err) { console.warn('[Monitor] delete failed:', err); }
  };

  const handleDockerAction = async (name: string, action: 'start' | 'stop' | 'restart') => {
    try {
      const h = authHeaders;
      const res = await fetch(`${baseUrl}/api/v1/admin/docker/${encodeURIComponent(name)}/${action}`, { method: 'POST', headers: h });
      if (res.ok) { setTimeout(fetchData, 1000); }
    } catch (err) { console.warn('[Monitor] Docker action failed:', err); }
    setContextMenu(null);
  };

  const handleViewLogs = (name: string) => {
    setLogContainer(name);
    setLogLines([]);
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

  return (
    <div className="fixed top-4 right-4 z-[60]" style={{ width: 'min(360px, calc(100vw - 32px))' }}>
      {/* ── Collapsed pill ── */}
      <div
        className={cn('flex items-center justify-between px-3 h-10 cursor-pointer select-none rounded-2xl transition-all duration-300 hover:border-border/80', glassPanel)}
        onClick={() => setExpanded(!expanded)}
      >
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

        <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10 flex items-center gap-2">
          <div className="flex items-center gap-1 px-3 py-0.5 rounded-lg bg-muted/40 dark:bg-white/5 border border-border/30 hover:bg-accent transition-colors">
            <ChevronDown className={cn('w-3 h-3 text-muted-foreground transition-transform duration-200', expanded && 'rotate-180')} />
            <span className="text-[10px] text-muted-foreground">{expanded ? '收起' : '展开'}</span>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-end">
          <div className="flex items-center gap-3 text-sm font-medium tabular-nums">
            <div className="flex items-center gap-1.5">
              <span className="text-foreground w-8 inline-block text-right">{runningCount}</span>
              <Box className="w-4 h-4 text-green-500" />
            </div>
            <div className="w-px h-3 bg-border/60"></div>
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
              <div className="flex gap-4">
                <CircleProgress percent={cpuPct} size={56} stroke={5} color={cpuC} label="CPU" sub={sys ? `${sys.cpu.cores}核` : '—'} />
                <CircleProgress percent={memPct} size={56} stroke={5} color={memC} label="RAM" sub={sys ? `${fmt(sys.memory.used)} / ${fmt(sys.memory.total)}` : '—'} />
              </div>
            </div>
          </div>

          {/* ── Card 2: Service Checks ── */}
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
                        <span className="text-xs truncate text-foreground/80">{getDockerLabel(c.name)}</span>
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
                <span className="text-green-400">{containers.filter(c => c.state === "running").length}</span>
                /{containers.length} 运行中
              </span>
            </div>
            <div className="space-y-1 max-h-[200px] overflow-y-auto">
              {containers.map(c => (
                <div key={c.id}
                  className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-muted/30 dark:bg-white/[0.03] hover:bg-accent/50 transition-colors cursor-pointer"
                  onContextMenu={e => { e.preventDefault(); setContextMenu({ id: "docker:" + c.name, x: e.clientX, y: e.clientY }); }}
                  onClick={() => {
                    const url = parseContainerUrl(c.ports);
                    if (url) window.open(url, "_blank");
                  }}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className={"w-1.5 h-1.5 rounded-full shrink-0 " + (c.state === "running" ? "bg-green-400" : "bg-red-400")} />
                    {(renderIcon => {
                      if (!renderIcon) return null;
                      if (renderIcon.startsWith('http') || renderIcon.startsWith('/uploads') || renderIcon.startsWith('data:'))
                        return <img src={renderIcon} alt="" className="w-4 h-4 rounded shrink-0" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />;
                      return <span className="text-sm shrink-0">{renderIcon}</span>;
                    })(getDockerIcon(c.name))}
                    <span className="text-xs truncate text-foreground/80">{getDockerLabel(c.name)}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    {(st => st
                      ? <><span className="text-[10px] tabular-nums text-foreground/80">{st.cpuPercent.toFixed(1)}%</span><span className="text-[9px] tabular-nums text-muted-foreground/60 ml-1">{fmt(st.memUsage)}</span></>
                      : <span className="text-[10px] tabular-nums text-muted-foreground/60">{c.status}</span>
                    )(c.state === "running" ? containerStats.find(s => s.name === c.name) : null)}
                    {c.state === "running" ? <ExternalLink className="w-3 h-3 text-muted-foreground/40" /> : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
          )}

          {/* ── Card 4: Storage ── */}
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
                  const catRes = await fetch(`${baseUrl}/api/v1/categories`, { headers: h });
                  if (!catRes.ok) { toast.error('获取分类失败'); setContextMenu(null); return; }
                  const cats = await catRes.json();
                  let catId = Array.isArray(cats) ? cats.find((c: Record<string, unknown>) => c.title === '固定服务')?.id : null;
                  if (!catId) {
                    const cr = await fetch(`${baseUrl}/api/v1/categories`, { method: 'POST', headers: h, body: JSON.stringify({ title: '固定服务' }) });
                    if (!cr.ok) { toast.error('创建分类失败'); setContextMenu(null); return; }
                    catId = (await cr.json()).id;
                  }
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
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg> 固定到主页
          </button>
          {(checks.some(c => c.id === contextMenu.id) || contextMenu.id.startsWith('docker:')) && (
            <button className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-foreground/80 hover:bg-accent rounded-lg transition-colors"
              onClick={() => {
                const c = checks.find(ch => ch.id === contextMenu.id);
                if (c) { setEditTarget({ id: c.id, name: c.name, icon: getIcon(c.id), url: c.url, mac: getMac(c.id) }); }
                else {
                  const dc = containers.find(ch => 'docker:' + ch.name === contextMenu.id);
                  if (dc) setEditTarget({ id: contextMenu.id, name: getDockerLabel(dc.name), icon: getDockerIcon(dc.name) || undefined, url: parseContainerUrl(dc.ports) || undefined });
                }
                setContextMenu(null);
              }}
              aria-label="编辑"
            >
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg> 编辑
            </button>
          )}
          {checks.some(c => c.id === contextMenu.id) && (
            <button className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
              onClick={() => handleDelete(contextMenu.id)}
              aria-label="删除"
            >
              <Trash2 className="w-3 h-3" /> 删除
            </button>
          )}
          {getMac(contextMenu.id) && (
            <button
              className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors"
              onClick={() => handleWake(contextMenu.id)}
              aria-label="WOL 唤醒"
            >
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg> WOL 唤醒
            </button>
          )}
          {contextMenu.id.startsWith('docker:') && (
            <button className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-green-400 hover:bg-green-500/10 rounded-lg transition-colors"
              onClick={() => handleDockerAction(contextMenu.id.replace('docker:', ''), 'start')}
              aria-label="启动"
            >
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg> 启动
            </button>
          )}
          {contextMenu.id.startsWith('docker:') && (
            <button className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-foreground/80 hover:bg-accent rounded-lg transition-colors"
              onClick={() => handleDockerAction(contextMenu.id.replace('docker:', ''), 'restart')}
              aria-label="重启"
            >
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg> 重启
            </button>
          )}
          {contextMenu.id.startsWith('docker:') && (
            <button className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition-colors"
              onClick={() => handleViewLogs(contextMenu.id.replace('docker:', ''))}
            >
              <FileText className="w-3 h-3" /> 日志
            </button>
          )}
          {contextMenu.id.startsWith('docker:') && (
            <button className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
              onClick={() => handleDockerAction(contextMenu.id.replace('docker:', ''), 'stop')}
              aria-label="停止"
            >
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> 停止
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

      {/* ── Docker 日志查看器 ── */}
      {logContainer && (
        <LogViewer
          containerName={logContainer}
          baseUrl={baseUrl || ''}
          onClose={() => setLogContainer(null)}
        />
      )}
    </div>
  );
}

/** 迷你 Docker 日志查看器 */
function LogViewer({ containerName, baseUrl, onClose }: { containerName: string; baseUrl: string; onClose: () => void }) {
  const logDialogRef = useRef<HTMLDivElement>(null);
  const [lines, setLines] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const evRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource(`${baseUrl}/api/v1/admin/docker/logs/${encodeURIComponent(containerName)}`);
    evRef.current = es;
    es.onmessage = (e) => {
      setLines(prev => {
        const next = [...prev, e.data];
        return next.length > 500 ? next.slice(-500) : next;
      });
    };
    es.onerror = () => { es.close(); };
    return () => { es.close(); };
  }, [containerName, baseUrl]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines]);

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}
      onPointerDown={e => { if (logDialogRef.current && !logDialogRef.current.contains(e.target as Node)) onClose(); }}>
      <div ref={logDialogRef} className="bg-black/90 backdrop-blur-xl border border-white/20 rounded-2xl w-[90vw] max-w-3xl h-[70vh] shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
          <span className="text-sm font-medium text-white/90">容器日志 — {containerName}</span>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10 transition-colors">
            <XIcon className="w-4 h-4 text-white/70" />
          </button>
        </div>
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 font-mono text-[12px] leading-relaxed text-green-400/90 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded">
          {lines.length === 0 ? (
            <span className="text-white/40">等待日志...</span>
          ) : (
            lines.map((line, i) => <div key={i}>{line}</div>)
          )}
        </div>
      </div>
    </div>
  );
}
