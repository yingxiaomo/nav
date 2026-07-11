// 监控面板共享类型和工具函数

export interface SystemInfo {
  cpu: { usage: number; cores: number };
  memory: { total: number; used: number; usedPercent: number };
  disk: { total: number; used: number; usedPercent: number };
  uptime: number;
}
export interface CheckResult {
  id: string; name: string; url: string;
  status: 'ok' | 'timeout' | 'error';
  latency: number | null;
}
export interface TargetInfo {
  id: string; name: string; url: string; icon?: string; mac?: string; ssh_user?: string; ssh_pass?: string;
}
export interface ContainerInfo {
  id: string; name: string; image: string;
  state: string; status: string; ports: string; created: string;
}
export interface ContainerStats {
  name: string; cpuPercent: number;
  memUsage: number; memLimit: number; memPercent: number;
}

export interface MonitorEditTarget {
  id: string; name: string; icon?: string; url?: string; mac?: string;
  ssh_user?: string; ssh_pass?: string;
}

/** 格式化字节数为人类可读字符串 */
export const fmt = (b: number) => {
  if (!b) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'], i = Math.floor(Math.log(b) / Math.log(1024));
  return (b / Math.pow(1024, i)).toFixed(1) + ' ' + u[i];
};

/** 格式化秒数为中文时长字符串 */
export const uptimeStr = (s: number) => {
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return `${d}天${h}时${m}分${sec}秒`;
};

export const serverName = typeof window !== 'undefined'
  ? (window.location.hostname === 'localhost' ? '本地服务器' : window.location.hostname)
  : '服务器';

/** 从 Docker 端口字符串提取第一个宿主机 IP:端口的 URL */
export function parseContainerUrl(ports: string): string | null {
  // 格式：8080:80（Go 后端 formatPorts）
  const m = ports.match(/(\d+):\d+/);
  if (m) return `http://${window.location.hostname}:${m[1]}`;
  return null;
}

/** 各服务 CPU/RAM 静态估算（基于 id 做种子） */
export function mockResource(id: string): { cpu: number; ram: number } {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = ((hash << 5) - hash) + id.charCodeAt(i);
  const base = Math.abs(hash % 30);
  return { cpu: base, ram: 40 + base };
}
