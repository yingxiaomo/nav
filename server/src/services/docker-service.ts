import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';

export interface ContainerInfo {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
  ports: string;
  created: string;
}

export interface ContainerStats {
  name: string;
  cpuPercent: number;
  memUsage: number;
  memLimit: number;
  memPercent: number;
}

/** 获取所有容器的实时资源占用（通过 docker stats --no-stream） */
export function getContainerStats(): Promise<ContainerStats[]> {
  return new Promise((resolve) => {
    const proc = spawn('docker', ['stats', '--no-stream', '--format', '{{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 10_000,
    });

    let stdout = '';

    proc.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });

    proc.on('close', (code) => {
      if (code !== 0) { resolve([]); return; }
      const stats: ContainerStats[] = stdout.trim().split('\n').filter(Boolean).map(line => {
        const parts = line.split('\t');
        if (parts.length < 4) return null;
        const cpu = parseFloat(parts[1].replace('%', ''));
        const memMatch = parts[2].match(/([\d.]+)(\w+)\s*\/\s*([\d.]+)(\w+)/);
        const memPct = parseFloat(parts[3].replace('%', ''));
        let memUsage = 0, memLimit = 0;
        if (memMatch) {
          memUsage = parseMem(memMatch[1], memMatch[2]);
          memLimit = parseMem(memMatch[3], memMatch[4]);
        }
        return { name: parts[0], cpuPercent: cpu || 0, memUsage, memLimit, memPercent: memPct || 0 };
      }).filter((s): s is ContainerStats => s !== null);
      resolve(stats);
    });

    proc.on('error', () => resolve([]));
  });
}

function parseMem(val: string, unit: string): number {
  const u = { B: 1, KiB: 1024, MiB: 1024 ** 2, GiB: 1024 ** 3, TiB: 1024 ** 4 };
  const multiplier = u[unit as keyof typeof u] || 1;
  return parseFloat(val) * multiplier;
}

/**
 * 列出所有 Docker 容器（通过 docker ps）
 * 需要 Docker socket 挂载（-v /var/run/docker.sock:/var/run/docker.sock）
 */
export function listContainers(): Promise<ContainerInfo[]> {
  return new Promise((resolve) => {
    const proc = spawn('docker', ['ps', '-a', '--format', '{{.ID}}\t{{.Names}}\t{{.Image}}\t{{.State}}\t{{.Status}}\t{{.Ports}}\t{{.CreatedAt}}'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 10_000,
    });

    let stdout = '';

    proc.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });

    proc.on('close', (code) => {
      if (code !== 0) {
        resolve([]);
        return;
      }

      const containers: ContainerInfo[] = stdout.trim().split('\n')
        .filter(Boolean)
        .map(line => {
          const [id, name, image, state, status, ports, created] = line.split('\t');
          return { id, name, image, state, status, ports, created };
        });

      resolve(containers);
    });

    proc.on('error', () => {
      resolve([]);
    });
  });
}

/**
 * 流式推送容器日志，返回 EventEmitter
 * 调用方可通过 'data' 事件接收日志行，通过 'end' 事件接收结束信号
 */
export function streamContainerLogs(containerName: string): EventEmitter {
  const emitter = new EventEmitter();

  try {
    const proc = spawn('docker', ['logs', '-f', '--tail', '100', containerName], {
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 0, // 无超时 - 持续流式
    });

    const onData = (chunk: Buffer) => {
      emitter.emit('data', chunk.toString());
    };

    proc.stdout.on('data', onData);
    proc.stderr.on('data', onData);

    proc.on('close', (code) => {
      emitter.emit('end', code);
    });

    proc.on('error', (err) => {
      emitter.emit('error', `Docker 日志错误: ${(err as Error).message}`);
    });

    // 提供关闭方法
    emitter.on('close', () => {
      proc.kill();
    });

  } catch (err) {
    emitter.emit('error', `无法启动日志流: ${(err as Error).message}`);
  }

  return emitter;
}
