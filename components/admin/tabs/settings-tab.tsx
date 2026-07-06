'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { req, API, ConfirmState } from '../admin-tabs';
import { Key, Copy, Check, RefreshCw, Loader2, Lock, Eye, EyeOff } from 'lucide-react';

export default function SettingsTab({ showConfirm }: { showConfirm: (opts: Omit<ConfirmState, 'open'>) => void }) {
  const [token, setToken] = useState('');
  const [msg, setMsg] = useState('');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // 修改密码状态
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwMsg, setPwMsg] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwSuccess, setPwSuccess] = useState(false);
  const [showPw, setShowPw] = useState(false);

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

      <hr className="my-5 border-border/50" />

      <h3 className="flex items-center gap-1.5 text-sm font-semibold mb-3">
        <Lock className="size-4 text-muted-foreground shrink-0" />
        <span>修改管理员密码</span>
      </h3>
      {pwSuccess ? (
        <div className="p-3 rounded-md bg-green-500/10 border border-green-500/25 text-sm text-green-600 dark:text-green-400">
          密码已修改，<a href="/admin" className="underline font-medium">请重新登录</a>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="relative">
            <input
              type={showPw ? 'text' : 'password'}
              value={pwCurrent}
              onChange={e => setPwCurrent(e.target.value)}
              placeholder="当前密码"
              className="w-full px-3 py-2 rounded-md text-sm bg-background border border-border outline-none focus:border-primary/50 transition-colors pr-9"
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setShowPw(!showPw)}
            >
              {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          <input
            type={showPw ? 'text' : 'password'}
            value={pwNew}
            onChange={e => setPwNew(e.target.value)}
            placeholder="新密码（至少 6 位）"
            className="w-full px-3 py-2 rounded-md text-sm bg-background border border-border outline-none focus:border-primary/50 transition-colors"
          />
          <div className="flex gap-2">
            <Button variant="default" size="sm" disabled={pwBusy || !pwCurrent || pwNew.length < 6} onClick={async () => {
              setPwBusy(true); setPwMsg('');
              const { ok, data } = await req('POST', `${API}/auth/change-password`, { currentPassword: pwCurrent, newPassword: pwNew });
              setPwBusy(false);
              if (ok) {
                setPwSuccess(true);
              } else {
                setPwMsg((data as { error?: string }).error || '修改失败');
              }
            }}>
              {pwBusy ? <><Loader2 className="size-3.5 animate-spin" /> 修改中...</> : '修改密码'}
            </Button>
          </div>
          {pwMsg && <div className="p-2 rounded text-xs bg-destructive/10 border border-destructive/25 text-destructive">{pwMsg}</div>}
        </div>
      )}
    </div>
  );
}
