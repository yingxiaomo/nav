"use client";

import { useState, useEffect, useCallback } from "react";
import { Activity, Cpu, HardDrive, Wifi } from "lucide-react";
import { STORAGE_CONFIG_KEY } from "@/lib/adapters/storage";

interface SystemInfo {
  cpu: { usage: number; cores: number };
  memory: { total: number; used: number; usedPercent: number };
  disk: { total: number; used: number; usedPercent: number };
  uptime: number;
}

interface CheckResult {
  name: string;
  url: string;
  status: 'ok' | 'timeout' | 'error';
  latency: number | null;
}

function getBaseUrl(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_CONFIG_KEY);
    if (!raw) return null;
    const config = JSON.parse(raw);
    if (config.type === 'api-server' && config.apiServer?.baseUrl) {
      return config.apiServer.baseUrl.replace(/\/+$/, '');
    }
    return null;
  } catch {
    return null;
  }
}

function formatSize(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i];
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  let s = '';
  if (d > 0) s += d + '天';
  if (h > 0) s += h + '小时';
  s += m + '分';
  return s;
}

function Bar({ percent }: { percent: number }) {
  const color = percent > 80 ? '#dc2626' : percent > 50 ? '#fbbf24' : '#4ade80';
  return (
    <div className="h-2 bg-white/10 rounded-full overflow-hidden flex-1">
      <div className="h-full rounded-full transition-all duration-500" style={{ width: Math.min(percent, 100) + '%', background: color }} />
    </div>
  );
}

export function MonitorWidget() {
  const [sys, setSys] = useState<SystemInfo | null>(null);
  const [checks, setChecks] = useState<CheckResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const baseUrl = getBaseUrl();

  const fetchData = useCallback(async () => {
    if (!baseUrl) { setLoading(false); setError('未配置后端'); return; }
    try {
      const headers: Record<string, string> = {};
      const raw = localStorage.getItem(STORAGE_CONFIG_KEY);
      if (raw) {
        const config = JSON.parse(raw);
        if (config.apiServer?.token) headers['Authorization'] = `Bearer ${config.apiServer.token}`;
      }
      const [sysRes, checkRes] = await Promise.all([
        fetch(`${baseUrl}/api/v1/admin/monitor/system`, { headers }),
        fetch(`${baseUrl}/api/v1/admin/monitor/checks`, { headers }),
      ]);
      if (sysRes.ok) setSys(await sysRes.json());
      if (checkRes.ok) {
        const d = await checkRes.json();
        setChecks(d.results || []);
      }
    } catch {
      setError('无法连接后端');
    } finally { setLoading(false); }
  }, [baseUrl]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- periodic fetch for live data
    fetchData();
    const t = setInterval(fetchData, 10000);
    return () => clearInterval(t);
  }, [fetchData]);

  if (!baseUrl) return null;
  if (loading) return <div className="text-sm text-white/40 text-center py-4">加载监控数据...</div>;

  return (
    <div className="space-y-4 p-4">
      {error && <div className="text-sm text-red-400 text-center">{error}</div>}

      {sys && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/5 rounded-xl p-3">
              <div className="flex items-center gap-2 text-xs text-white/50 mb-2"><Cpu className="w-3.5 h-3.5" />CPU</div>
              <div className="text-2xl font-bold text-indigo-400">{sys.cpu?.usage || 0}%</div>
              <div className="text-xs text-white/30">{sys.cpu?.cores || '-'} 核</div>
            </div>
            <div className="bg-white/5 rounded-xl p-3">
              <div className="flex items-center gap-2 text-xs text-white/50 mb-2"><Activity className="w-3.5 h-3.5" />内存</div>
              <div className="text-xl font-bold">{sys.memory?.usedPercent || 0}%</div>
              <div className="flex items-center gap-2 mt-1"><Bar percent={sys.memory?.usedPercent || 0} /><span className="text-xs text-white/30">{formatSize(sys.memory?.used)} / {formatSize(sys.memory?.total)}</span></div>
            </div>
            <div className="bg-white/5 rounded-xl p-3">
              <div className="flex items-center gap-2 text-xs text-white/50 mb-2"><HardDrive className="w-3.5 h-3.5" />磁盘</div>
              <div className="text-xl font-bold">{sys.disk?.usedPercent || 0}%</div>
              <div className="flex items-center gap-2 mt-1"><Bar percent={sys.disk?.usedPercent || 0} /><span className="text-xs text-white/30">{formatSize(sys.disk?.used)} / {formatSize(sys.disk?.total)}</span></div>
            </div>
            <div className="bg-white/5 rounded-xl p-3">
              <div className="flex items-center gap-2 text-xs text-white/50 mb-2"><Activity className="w-3.5 h-3.5" />运行</div>
              <div className="text-lg font-bold">{formatUptime(sys.uptime || 0)}</div>
              <div className="text-xs text-white/30">服务正常运行</div>
            </div>
          </div>

          {checks.length > 0 && (
            <div>
              <div className="flex items-center gap-2 text-xs text-white/50 mb-2"><Wifi className="w-3.5 h-3.5" />服务巡检</div>
              <div className="space-y-1">
                {checks.map((c, i) => (
                  <div key={i} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2 text-sm">
                    <span>{c.name}</span>
                    <span className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${c.status === 'ok' ? 'bg-green-400' : 'bg-red-400'}`} />
                      <span className="text-xs text-white/40">{c.latency !== null ? c.latency + 'ms' : '-'}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
