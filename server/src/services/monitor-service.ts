import os from 'node:os';
import fs from 'node:fs';

export interface SystemInfo {
  cpu: { usage: number; cores: number };
  memory: { total: number; used: number; usedPercent: number };
  disk: { total: number; used: number; usedPercent: number };
  uptime: number;
}

function calcCpuUsage(): number {
  const cpus = os.cpus();
  let idle = 0, total = 0;
  for (const cpu of cpus) {
    idle += cpu.times.idle;
    total += Object.values(cpu.times).reduce((a, b) => a + b, 0);
  }
  if (lastTotal === 0) { lastIdle = idle; lastTotal = total; return 0; }
  const diffIdle = idle - lastIdle;
  const diffTotal = total - lastTotal;
  lastIdle = idle; lastTotal = total;
  return diffTotal > 0 ? Math.round((1 - diffIdle / diffTotal) * 100) : 0;
}

let lastIdle = 0, lastTotal = 0;

function readMemory(): { total: number; free: number } {
  // 尝试读取宿主机内存（Docker 内 /proc/meminfo 仍包含宿主数据）
  try {
    const mem = fs.readFileSync('/proc/meminfo', 'utf-8');
    const get = (key: string): number => {
      const m = mem.match(new RegExp(`^${key}:\\s+(\\d+)`));
      return m ? parseInt(m[1]) * 1024 : 0;
    };
    const total = get('MemTotal');
    if (total > 0) {
      // MemAvailable 优先
      let free = get('MemAvailable');
      if (free > 0) return { total, free };
      // 回退：MemFree + Cached + Buffers
      free = get('MemFree') + get('Cached') + get('Buffers');
      if (free > 0) return { total, free };
    }
  } catch { /* fall through */ }

  // 最终兜底：Node.js API（Docker 内返回容器 cgroup 视图）
  const total = os.totalmem();
  const free = os.freemem();
  return { total, free };
}

function readDisk(): { total: number; free: number } {
  try {
    const stat = fs.statfsSync('/app/data');
    return { total: stat.blocks * stat.bsize, free: stat.bfree * stat.bsize };
  } catch {
    try {
      const stat = fs.statfsSync('/');
      return { total: stat.blocks * stat.bsize, free: stat.bfree * stat.bsize };
    } catch { return { total: 0, free: 0 }; }
  }
}

function readUptime(): number {
  try {
    const up = fs.readFileSync('/proc/uptime', 'utf-8');
    return Math.floor(parseFloat(up.split(' ')[0]));
  } catch { return Math.floor(os.uptime()); }
}

// 模块加载时预热 CPU 采样，确保首次请求返回真实值
calcCpuUsage();
setTimeout(() => calcCpuUsage(), 500);

export function getSystemInfo(): SystemInfo {
  const mem = readMemory();
  const disk = readDisk();
  const uptime = readUptime();

  return {
    cpu: { usage: calcCpuUsage(), cores: os.cpus().length },
    memory: {
      total: mem.total,
      used: mem.total - mem.free,
      usedPercent: mem.total > 0 ? Math.round(((mem.total - mem.free) / mem.total) * 100) : 0,
    },
    disk: {
      total: disk.total,
      used: disk.total - disk.free,
      usedPercent: disk.total > 0 ? Math.round(((disk.total - disk.free) / disk.total) * 100) : 0,
    },
    uptime,
  };
}
