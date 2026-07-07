'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { req, API } from '../admin-tabs';
import { Lock, Eye, EyeOff, Loader2 } from 'lucide-react';

export default function SettingsTab() {
  // 修改密码状态
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwMsg, setPwMsg] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwSuccess, setPwSuccess] = useState(false);
  const [showPw, setShowPw] = useState(false);

  return (
    <div>
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
