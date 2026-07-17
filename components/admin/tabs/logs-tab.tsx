'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { req, API, LogData } from '../admin-tabs';
import { sanitizeText } from '@/lib/utils/validation';
import { RefreshCw } from 'lucide-react';

export default function LogsTab() {
  const [lines, setLines] = useState<string[]>([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const { ok, data } = await req<LogData>('GET', `${API}/admin/logs?lines=300`);
    if (ok) {
      setLines(data.lines || []);
      setError('');
    } else {
      setError('无法加载日志');
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  if (error) return <div className="rounded-md bg-destructive/10 border border-destructive/25 p-2.5 text-sm text-destructive" role="alert">{error}</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs text-muted-foreground">最近{lines.length}条</span>
        <Button variant="outline" size="sm" onClick={load} aria-label="刷新日志"><RefreshCw className="size-3.5" /></Button>
      </div>
      <div className="bg-background border border-border rounded-lg p-2.5 max-h-[500px] overflow-y-auto">
        {lines.length === 0 ? (
          <p className="text-muted-foreground/60 text-center text-sm">暂无日志 · 运行后自动生成</p>
        ) : (
          lines.map((x, i) => {
            const m = x.match(/\[(INFO|WARN|ERROR)\]/);
            return (
              <div key={i}
                className={`py-0.5 font-mono text-[11px] leading-relaxed border-b border-border/40 ${
                  m?.[1] === 'ERROR' ? 'text-destructive' : m?.[1] === 'WARN' ? 'text-warning' : m?.[1] === 'INFO' ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                {sanitizeText(x)}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
