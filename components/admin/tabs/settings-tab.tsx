'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { req, API, ConfirmState } from '../admin-tabs';
import { Key, Copy, Check, RefreshCw, Loader2 } from 'lucide-react';

export default function SettingsTab({ showConfirm }: { showConfirm: (opts: Omit<ConfirmState, 'open'>) => void }) {
  const [token, setToken] = useState('');
  const [msg, setMsg] = useState('');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    req<{ token: string }>('GET', `${API}/auth/api-token`).then(({ data }) => {
      if (data.token) setToken(data.token);
    });
  }, []);

  const copyToken = async () => {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const el = document.createElement('textarea');
      el.value = token;
      el.style.position = 'fixed';
      el.style.left = '-9999px';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleTokenAction = async (action: 'generate' | 'reset') => {
    setBusyKey(action);
    setMsg('');
    const { ok, data } = await req<{ token: string }>('POST', `${API}/auth/api-token`);
    setBusyKey(null);
    if (ok) {
      setToken(data.token);
      if (action === 'reset') {
        await navigator.clipboard.writeText(data.token);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } else {
      setMsg((data as { error?: string }).error || '操作失败');
    }
  };

  return (
    <div>
      <h3 className="flex items-center gap-1.5 text-sm font-semibold mb-3">
        <Key className="size-4 text-muted-foreground shrink-0" />
        <span>API 令牌</span>
      </h3>
      {token ? (
        <>
          <div className="bg-background border border-border rounded-md p-2.5 font-mono text-sm text-primary break-all mb-2.5">
            {token}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={copyToken}>
              {copied ? <><Check className="size-3.5" /> 已复制</> : <><Copy className="size-3.5" /> 复制</>}
            </Button>
            <Button variant="destructive" size="sm" disabled={busyKey === 'reset'} onClick={() => {
              showConfirm({ title: '重置 API 令牌', description: '重置后旧令牌立即失效，确定？', variant: 'destructive', confirmText: '重置', onConfirm: () => handleTokenAction('reset') });
            }}>
              {busyKey === 'reset' ? <><Loader2 className="size-3.5 animate-spin" /> 重置中...</> : <><RefreshCw className="size-3.5" /> 重置</>}
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-muted-foreground text-xs mb-3">尚未生成 API 令牌</p>
          <Button variant="default" size="sm" disabled={busyKey === 'generate'} onClick={() => handleTokenAction('generate')}>
            {busyKey === 'generate' ? <><Loader2 className="size-3.5 animate-spin" /> 生成中...</> : <><Key className="size-3.5" /> 生成令牌</>}
          </Button>
        </>
      )}
      {msg && <div className="mt-2 p-2 rounded text-xs bg-destructive/10 border border-destructive/25 text-destructive">{msg}</div>}
    </div>
  );
}
