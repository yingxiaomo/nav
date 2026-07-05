'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Settings, LogOut, Lock, Key, ShieldAlert, Eye, EyeOff,
  Loader2, AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { req, API, StatusInfo, ConfirmState, TABS, TabId, Spinner } from './admin-tabs';

// ── Lazy-loaded tab components ──
import OverviewTab from './tabs/overview-tab';
import CategoriesTab from './tabs/categories-tab';
import BookmarksTab from './tabs/bookmarks-tab';
import TodosTab from './tabs/todos-tab';
import NotesTab from './tabs/notes-tab';
import MonitorTab from './tabs/monitor-tab';
import DockerTab from './tabs/docker-tab';
import BackupTab from './tabs/backup-tab';
import SettingsTab from './tabs/settings-tab';
import LogsTab from './tabs/logs-tab';

// ═══════════════════════════════════════════════════
//   MAIN COMPONENT
// ═══════════════════════════════════════════════════

export default function AdminPanel() {
  const [status, setStatus] = useState<StatusInfo | null>(null);
  const [tab, setTab] = useState<TabId>('overview');
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState<ConfirmState>({
    open: false, title: '', description: '', onConfirm: () => {},
  });

  const showConfirm = (opts: Omit<ConfirmState, 'open'>) => {
    setConfirm({ ...opts, open: true });
  };
  const closeConfirm = () => setConfirm((prev) => ({ ...prev, open: false }));

  useEffect(() => {
    (async () => {
      const { data } = await req<StatusInfo>('GET', `${API}/auth/status`);
      setStatus(data);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="bg-card border border-border rounded-xl p-6 w-[420px] max-w-[94vw] mx-auto mt-20 shadow-xl"><Spinner /></div>;
  if (status?.setupRequired) return <SetupScreen />;
  if (!status?.loggedIn) return <LoginScreen />;

  return (
    <div className="bg-card border border-border rounded-xl p-6 w-[960px] max-w-[100vw] sm:max-w-[94vw] mx-auto my-10 shadow-xl">
      <div className="flex justify-between items-center mb-3">
        <h1 className="flex items-center gap-1.5 m-0 text-[1.375rem] font-bold text-card-foreground tracking-tight">
          <Settings className="size-5" />
          <span>Nav Server</span>
          <a href="/" className="ml-3 text-xs text-muted-foreground hover:text-foreground transition-colors no-underline inline-flex items-center gap-1">
            ← 返回主页
          </a>
        </h1>
        <Button variant="outline" size="sm" onClick={doLogout}>
          <LogOut className="size-3.5" />
          退出
        </Button>
      </div>

      <div className="flex gap-1.5 bg-muted rounded-lg p-1.5 mb-6 overflow-x-auto [&::-webkit-scrollbar]:hidden snap-x snap-mandatory">
        {TABS.map((t) => (
          <Button
            key={t.id}
            variant={t.id === tab ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setTab(t.id)}
            className="snap-start shrink-0 whitespace-nowrap"
          >
            {t.icon}
            {t.label}
          </Button>
        ))}
      </div>

      <div>
        <TabContent tab={tab} showConfirm={showConfirm} />
      </div>

      <ConfirmDialog
        open={confirm.open}
        onOpenChange={() => closeConfirm()}
        title={confirm.title}
        description={confirm.description}
        confirmText={confirm.confirmText}
        variant={confirm.variant}
        loading={confirm.loading}
        onConfirm={() => { confirm.onConfirm(); closeConfirm(); }}
      />
    </div>
  );
}

// ══════ Tab Content Router ══════

function TabContent({ tab, showConfirm }: { tab: TabId; showConfirm: (opts: Omit<ConfirmState, 'open'>) => void }) {
  switch (tab) {
    case 'overview': return <OverviewTab />;
    case 'cats': return <CategoriesTab showConfirm={showConfirm} />;
    case 'bms': return <BookmarksTab showConfirm={showConfirm} />;
    case 'todos': return <TodosTab />;
    case 'notes': return <NotesTab showConfirm={showConfirm} />;
    case 'monitor': return <MonitorTab showConfirm={showConfirm} />;
    case 'docker': return <DockerTab />;
    case 'backup': return <BackupTab showConfirm={showConfirm} />;
    case 'settings': return <SettingsTab showConfirm={showConfirm} />;
    case 'logs': return <LogsTab />;
  }
}

// ══════ Auth Screens ══════

function SetupScreen() {
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const pw2Ref = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (pw1.length < 6) { setMsg('密码至少需要 6 位字符'); return; }
    if (pw1 !== pw2) { setMsg('两次输入的密码不一致'); return; }
    setBusy(true); setMsg('');
    const { ok, data } = await req('POST', `${API}/auth/setup`, { password: pw1 });
    if (ok) location.reload();
    else { setBusy(false); setMsg((data as { error?: string }).error || '配置失败'); }
  };

  return (
    <div className="setup-wrapper">
      <div className="card card-narrow auth-card">
        <div className="auth-header">
          <div className="auth-icon"><Lock className="icon-lg" /></div>
          <h1>设置管理员密码</h1>
          <p className="auth-subtitle">首次使用，请创建管理员密码以保护你的数据。</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="setup-field">
            <label htmlFor="setup-pw1" className="setup-label">
              <Lock className="icon-xs" /> 管理员密码
            </label>
            <div className="pw-input-wrap">
              <input id="setup-pw1" type={showPw ? 'text' : 'password'} value={pw1}
                onChange={e => setPw1(e.target.value)} placeholder="至少 6 位字符"
                autoComplete="new-password" className="pw-input"
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) pw2Ref.current?.focus(); }} />
              <button type="button" className="pw-toggle" onClick={() => setShowPw(!showPw)} tabIndex={-1} aria-label={showPw ? '隐藏密码' : '显示密码'}>
                {showPw ? <EyeOff className="icon-xs" /> : <Eye className="icon-xs" />}
              </button>
            </div>
          </div>

          <div className="setup-field">
            <label htmlFor="setup-pw2" className="setup-label">
              <ShieldAlert className="icon-xs" /> 确认密码
            </label>
            <div className="pw-input-wrap">
              <input id="setup-pw2" ref={pw2Ref} type={showPw ? 'text' : 'password'} value={pw2}
                onChange={e => setPw2(e.target.value)} placeholder="再次输入密码"
                autoComplete="new-password" className="pw-input" />
            </div>
          </div>

          {pw1 && (
            <div className="pw-strength">
              <div className="pw-strength-bar">
                <div className={`pw-strength-fill ${pw1.length < 6 ? 'weak' : pw1.length < 10 ? 'medium' : 'strong'}`}
                  style={{ width: `${Math.min(pw1.length * 10, 100)}%` }} />
              </div>
              <span className="pw-strength-label">{pw1.length < 6 ? '太短' : pw1.length < 10 ? '一般' : '良好'}</span>
            </div>
          )}

          <Button variant="default" className="w-full auth-btn" disabled={busy}>
            {busy ? <><Loader2 className="icon-sm spin" /> 配置中...</> : <><Key className="icon-sm" /> 创建管理员密码</>}
          </Button>
        </form>

        {msg && <div className="mt-4 p-2.5 rounded-md text-sm bg-destructive/10 border border-destructive/25 text-destructive" role="alert"><AlertTriangle className="icon-xs" /> {msg}</div>}
      </div>
    </div>
  );
}

function LoginScreen() {
  const [pw, setPw] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const doLogin = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!pw) { setMsg('请输入密码'); return; }
    setBusy(true); setMsg('');
    const { ok, data } = await req('POST', `${API}/auth/login`, { password: pw });
    if (ok) location.reload();
    else { setBusy(false); setMsg((data as { error?: string }).error || '登录失败'); }
  };

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 100); }, []);

  return (
    <div className="setup-wrapper">
      <div className="card card-narrow auth-card">
        <div className="auth-header">
          <div className="auth-icon"><Key className="icon-lg" /></div>
          <h1>管理员登录</h1>
          <p className="auth-subtitle">请输入管理员密码以访问控制面板。</p>
        </div>

        <form onSubmit={doLogin}>
          <div className="setup-field">
            <label htmlFor="login-pw" className="setup-label">
              <Lock className="icon-xs" /> 管理员密码
            </label>
            <div className="pw-input-wrap">
              <input id="login-pw" ref={inputRef} type={showPw ? 'text' : 'password'} value={pw}
                onChange={e => setPw(e.target.value)} placeholder="输入管理员密码"
                autoComplete="current-password" className="pw-input" />
              <button type="button" className="pw-toggle" onClick={() => setShowPw(!showPw)} tabIndex={-1} aria-label={showPw ? '隐藏密码' : '显示密码'}>
                {showPw ? <EyeOff className="icon-xs" /> : <Eye className="icon-xs" />}
              </button>
            </div>
          </div>

          <Button variant="default" className="w-full auth-btn" disabled={busy}>
            {busy ? <><Loader2 className="icon-sm spin" /> 登录中...</> : <><LogOut className="icon-sm" /> 登录</>}
          </Button>
        </form>

        {msg && <div className="mt-4 p-2.5 rounded-md text-sm bg-destructive/10 border border-destructive/25 text-destructive" role="alert"><AlertTriangle className="icon-xs" /> {msg}</div>}
      </div>
    </div>
  );
}

async function doLogout() {
  await req('POST', `${API}/auth/logout`);
  location.reload();
}
