'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { req, API } from '../admin-tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Container, RefreshCw, Check, X, ClipboardList, Loader2 } from 'lucide-react';

// Module-level store for EventSource references (avoids window property assignment)
const dockerLogSources = new Map<string, EventSource>();

interface ContainerItem {
  id: string; name: string; image: string; state: string;
  status: string; ports: string; created: string;
}

export default function DockerTab() {
  const [containers, setContainers] = useState<ContainerItem[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [logContainer, setLogContainer] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { ok, data } = await req<{ containers: ContainerItem[] }>('GET', `${API}/admin/docker/containers`);
    if (ok) { setContainers(data.containers || []); setError(''); }
    else { setError((data as { error?: string }).error || '无法连接 Docker'); }
    setLoading(false);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const openLogs = (name: string) => {
    setLogContainer(name);
    setLogs([]);

    const es = new EventSource(`${API}/admin/docker/logs/${encodeURIComponent(name)}`, { withCredentials: true });

    es.onmessage = (e) => {
      setLogs(prev => [...prev, e.data]);
    };

    es.addEventListener('end', () => { es.close(); });
    es.addEventListener('error', () => { es.close(); });

    dockerLogSources.set(name, es);
  };

  const closeLogs = () => {
    const es = dockerLogSources.get(logContainer || '');
    es?.close();
    dockerLogSources.delete(logContainer || '');
    setLogContainer(null);
    setLogs([]);
  };

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // 组件卸载时清理日志连接
  useEffect(() => {
    return () => {
      const es = dockerLogSources.get(logContainer || '');
      if (es) { es.close(); dockerLogSources.delete(logContainer || '');
      }
    };
  }, [logContainer]);

  if (error) {
    return (
      <div>
        <div className="rounded-md bg-destructive/10 border border-destructive/25 p-2.5 text-sm text-destructive">{error}</div>
        <p className="text-muted-foreground text-xs mt-2">需要将 Docker socket 挂载到容器内才能使用此功能。</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          <Container className="size-4 text-muted-foreground shrink-0" />
          <span>Docker 容器</span>
        </h3>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          {loading ? <><Loader2 className="size-3.5 animate-spin" /> 加载中...</> : <><RefreshCw className="size-3.5" /> 刷新</>}
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : containers.length === 0 ? (
        <p className="text-muted-foreground text-center py-6 text-sm">未发现容器</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">状态</TableHead>
              <TableHead>名称</TableHead>
              <TableHead>镜像</TableHead>
              <TableHead>端口</TableHead>
              <TableHead>运行时间</TableHead>
              <TableHead className="w-20">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {containers.map(c => (
              <TableRow key={c.id}>
                <TableCell>
                  {c.state === 'running'
                    ? <Check className="size-4 text-green-600 dark:text-green-400" />
                    : <X className="size-4 text-destructive" />}
                </TableCell>
                <TableCell className="text-muted-foreground text-xs font-mono">{c.name}</TableCell>
                <TableCell className="text-muted-foreground/70 text-xs">{c.image}</TableCell>
                <TableCell className="text-muted-foreground/70 text-xs">{c.ports || '-'}</TableCell>
                <TableCell className="text-muted-foreground/70 text-xs">{c.status}</TableCell>
                <TableCell>
                  {c.state === 'running' && (
                    <Button variant="outline" size="sm" onClick={() => openLogs(c.name)}>
                      <ClipboardList className="size-3.5" /> 日志
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* ── 日志终端窗口 ── */}
      {logContainer && (
        <div className="fixed inset-0 z-[1000] bg-black/60 flex items-center justify-center backdrop-blur-sm" onClick={closeLogs}>
          <div className="bg-background/85 backdrop-blur-2xl border border-border rounded-xl w-[80vw] max-w-[960px] h-[70vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center px-4 py-3 border-b border-border shrink-0">
              <span className="inline-flex items-center gap-1.5 font-mono text-sm text-primary/80">
                <Container className="size-4 shrink-0" />
                <span>{logContainer}</span>
              </span>
              <Button variant="outline" size="sm" onClick={closeLogs}><X className="size-3.5" /> 关闭</Button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 font-mono text-xs leading-relaxed text-muted-foreground">
              {logs.length === 0 ? (
                <div className="text-muted-foreground/60">等待日志...</div>
              ) : (
                logs.map((line, i) => (
                  <div key={i} className="py-px whitespace-pre-wrap break-all hover:bg-accent/30">{line}</div>
                ))
              )}
              <div ref={logEndRef} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
