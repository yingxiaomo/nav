"use client";

import { useState, useEffect } from "react";
import { Loader2, Lock, Eye, EyeOff, KeyRound } from "lucide-react";

interface Props {
  baseUrl: string;
}

export function AuthSetupDialog({ baseUrl }: Props) {
  const [state, setState] = useState<'loading' | 'uninitialized' | 'ready'>('loading');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);

  useEffect(() => {
    fetch(`${baseUrl}/api/v1/auth/status`)
      .then(r => r.json())
      .then(d => setState(d.setupRequired ? 'uninitialized' : 'ready'))
      .catch(() => setState('ready'));
  }, [baseUrl]);

  const handleSetup = async () => {
    if (password.length < 6) { setError('密码至少 6 位'); return; }
    if (password !== confirm) { setError('两次密码不一致'); return; }
    setBusy(true);
    setError('');
    try {
      // 1. 设置密码
      const sr = await fetch(`${baseUrl}/api/v1/auth/setup`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!sr.ok) {
        const sd = await sr.json().catch(() => ({}));
        setError((sd as { error?: string })?.error || '设置失败');
        setBusy(false);
        return;
      }
      // 2. 自动登录
      const lr = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!lr.ok) {
        setError('密码已设置，但自动登录失败，请手动登录');
        setBusy(false);
        return;
      }
      // 3. 把前端数据同步到后端（避免刷新后红点）
      try {
        const localRaw = localStorage.getItem('clean-nav-local-data');
        if (localRaw) {
          await fetch(`${baseUrl}/api/v1/data`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: localRaw,
          });
        }
      } catch {
        // 静默忽略 — 刷新后合并逻辑会兜底
      }

      // 4. 刷新页面
      window.location.reload();
    } catch {
      setError('网络错误，请检查后端是否已启动');
      setBusy(false);
    }
  };

  if (state !== 'uninitialized') return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-background/95 backdrop-blur-xl border border-border/40 rounded-2xl p-6 w-80 shadow-2xl">
        <div className="flex flex-col items-center mb-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
            <KeyRound className="size-6 text-primary" />
          </div>
          <h2 className="text-base font-semibold text-foreground">初始化管理员密码</h2>
          <p className="text-xs text-muted-foreground/70 mt-1 text-center">
            首次使用需要设置管理员密码
          </p>
        </div>

        <div className="space-y-2.5">
          <div className="relative">
            <input
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="设置密码（至少 6 位）"
              className="w-full px-3 py-2 rounded-xl text-sm bg-muted/50 border border-border/40 text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-border/80 transition-colors pr-9"
              onKeyDown={e => e.key === 'Enter' && handleSetup()}
            />
            <button
              type="button"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground"
              onClick={() => setShowPw(!showPw)}
            >
              {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          <input
            type={showPw ? 'text' : 'password'}
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            placeholder="确认密码"
            className="w-full px-3 py-2 rounded-xl text-sm bg-muted/50 border border-border/40 text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-border/80 transition-colors"
            onKeyDown={e => e.key === 'Enter' && handleSetup()}
          />
          {error && (
            <div className="p-2 rounded-lg text-xs bg-destructive/10 border border-destructive/25 text-destructive">
              {error}
            </div>
          )}
          <button
            className="w-full py-2 rounded-xl text-sm font-medium text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
            style={{ background: '#6366f1' }}
            disabled={busy || !password || !confirm}
            onClick={handleSetup}
          >
            {busy ? <><Loader2 className="size-4 animate-spin" /> 初始化中...</> : <><Lock className="size-4" /> 初始化并登录</>}
          </button>
        </div>
      </div>
    </div>
  );
}
