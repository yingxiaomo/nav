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

/**
 * 列出所有 Docker 容器（通过 docker ps）
 * 需要 Docker socket 挂载（-v /var/run/docker.sock:/var/run/docker.sock）
 */
export function listContainers(): Promise<ContainerInfo[]> {
  return new Promise((resolve, reject) => {
    const proc = spawn('docker', ['ps', '-a', '--format', '{{.ID}}\t{{.Names}}\t{{.Image}}\t{{.State}}\t{{.Status}}\t{{.Ports}}\t{{.CreatedAt}}'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 10_000,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `docker ps 退出码 ${code}`));
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

    proc.on('error', (err) => {
      reject(new Error(`Docker 不可用: ${err.message}`));
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
      emitter.emit('error', `Docker 日志错误: ${err.message}`);
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
