'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { req, API } from '../admin-tabs';
import { Lock, Eye, EyeOff, Loader2, Bot, Brain, Bell, MessageCircle, RefreshCw } from 'lucide-react';

export default function SettingsTab() {
  // 密码
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwMsg, setPwMsg] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwSuccess, setPwSuccess] = useState(false);
  const [showPw, setShowPw] = useState(false);

  // TG Bot 配置
  const [botToken, setBotToken] = useState('');
  const [botChatId, setBotChatId] = useState('');
  const [botProxy, setBotProxy] = useState('');
  const [botBusy, setBotBusy] = useState(false);
  const [botMsg, setBotMsg] = useState('');
  const [botLoaded, setBotLoaded] = useState(false);

  // AI 配置
  const [aiKey, setAiKey] = useState('');
  const [aiUrl, setAiUrl] = useState('https://api.openai.com/v1');
  const [aiModel, setAiModel] = useState('gpt-4o-mini');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMsg, setAiMsg] = useState('');
  const [aiLoaded, setAiLoaded] = useState(false);

  // 通知配置
  const [notifyEnabled, setNotifyEnabled] = useState(false);
  const [appriseUrl, setAppriseUrl] = useState('');
  const [cooldown, setCooldown] = useState(30);
  const [notifyBusy, setNotifyBusy] = useState(false);
  const [notifyMsg, setNotifyMsg] = useState('');

  // 读取配置
  useEffect(() => {
    if (!botLoaded) {
      req('GET', `${API}/settings/bot_config`).then(({ ok, data }) => {
        if (ok && data?.value) { try { const v = JSON.parse(data.value as string); setBotToken(v.token || ''); setBotChatId(v.chat_id || ''); } catch {} }
        setBotLoaded(true);
      });
    }
    if (!aiLoaded) {
      req('GET', `${API}/settings/ai_config`).then(({ ok, data }) => {
        if (ok && data?.value) { try { const v = JSON.parse(data.value as string); setAiKey(v.api_key || ''); setAiUrl(v.base_url || 'https://api.openai.com/v1'); setAiModel(v.model || 'gpt-4o-mini'); } catch {} }
        setAiLoaded(true);
      });
    }
    req('GET', `${API}/settings/monitor_notify`).then(({ ok, data }) => {
      if (ok && data?.value) { try { const v = JSON.parse(data.value as string); setNotifyEnabled(v.enabled || false); setAppriseUrl(v.apprise_url || ''); setCooldown(v.cooldown_minutes || 30); } catch {} }
    });
  }, [botLoaded, aiLoaded]);

  const saveBot = async () => {
    setBotBusy(true); setBotMsg('');
    const { ok } = await req('PUT', `${API}/settings`, { bot_config: JSON.stringify({ token: botToken, chat_id: botChatId, proxy_url: botProxy }) });
    setBotBusy(false);
    setBotMsg(ok ? '✅ 已保存' : '❌ 保存失败');
  };

  const saveAi = async () => {
    setAiBusy(true); setAiMsg('');
    const { ok } = await req('PUT', `${API}/settings`, { ai_config: JSON.stringify({ api_key: aiKey, base_url: aiUrl, model: aiModel }) });
    setAiBusy(false);
    setAiMsg(ok ? '✅ 已保存' : '❌ 保存失败');
  };

  const saveNotify = async () => {
    setNotifyBusy(true); setNotifyMsg('');
    const { ok } = await req('PUT', `${API}/settings`, { monitor_notify: JSON.stringify({ enabled: notifyEnabled, apprise_url: appriseUrl, cooldown_minutes: cooldown }) });
    setNotifyBusy(false);
    setNotifyMsg(ok ? '✅ 已保存' : '❌ 保存失败');
  };

  const inputCls = "w-full px-3 py-2 rounded-md text-sm bg-background border border-border outline-none focus:border-primary/50 transition-colors";

  return (
    <div className="space-y-6">
      {/* ── 管理员密码 ── */}
      <section>
        <h3 className="flex items-center gap-1.5 text-sm font-semibold mb-3"><Lock className="size-4 shrink-0" /><span>管理员密码</span></h3>
        {pwSuccess ? (
          <div className="p-3 rounded-md bg-green-500/10 border border-green-500/25 text-sm text-green-600">密码已修改，<a href="/admin" className="underline font-medium">请重新登录</a></div>
        ) : (
          <div className="space-y-2 max-w-sm">
            <div className="relative">
              <input type={showPw ? "text" : "password"} value={pwCurrent} onChange={e => setPwCurrent(e.target.value)} placeholder="当前密码" className={inputCls} />
              <button className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowPw(!showPw)}>{showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>
            </div>
            <input type="password" value={pwNew} onChange={e => setPwNew(e.target.value)} placeholder="新密码（至少6位）" className={inputCls} />
            <Button variant="default" size="sm" disabled={pwBusy || !pwCurrent || pwNew.length < 6} onClick={async () => {
              setPwBusy(true); setPwMsg('');
              const { ok, data } = await req('POST', `${API}/auth/change-password`, { currentPassword: pwCurrent, newPassword: pwNew });
              setPwBusy(false);
              if (ok) setPwSuccess(true);
              else setPwMsg((data as { error?: string }).error || '修改失败');
            }}>{pwBusy ? <><Loader2 className="size-3.5 animate-spin" /> 修改中...</> : '修改密码'}</Button>
            {pwMsg && <div className="p-2 rounded text-xs bg-destructive/10 border border-destructive/25 text-destructive">{pwMsg}</div>}
          </div>
        )}
      </section>

      {/* ── Telegram Bot ── */}
      <section className="border-t border-border/40 pt-4">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold mb-1"><MessageCircle className="size-4 shrink-0" /><span>Telegram Bot</span></h3>
        <p className="text-[11px] text-muted-foreground mb-3">配置 Bot Token 后可通过 TG 命令控制服务器</p>
        <div className="space-y-2 max-w-sm">
          <input value={botToken} onChange={e => setBotToken(e.target.value)} placeholder="Bot Token（例如 123456:ABC-DEF）" className={inputCls} />
          <input value={botChatId} onChange={e => setBotChatId(e.target.value)} placeholder="Chat ID（可选，用于主动推送）" className={inputCls} />
          <input value={botProxy} onChange={e => setBotProxy(e.target.value)} placeholder="代理地址（可选，如 http://192.168.0.1:7890）" className={inputCls} />
          <Button variant="outline" size="sm" onClick={saveBot} disabled={botBusy}>{botBusy ? <Loader2 className="size-3.5 animate-spin" /> : null} 保存 Bot 配置</Button>
          {botMsg && <span className="text-xs text-muted-foreground ml-2">{botMsg}</span>}
        </div>
      </section>

      {/* ── AI ── */}
      <section className="border-t border-border/40 pt-4">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold mb-1"><Brain className="size-4 shrink-0" /><span>AI 配置</span></h3>
        <p className="text-[11px] text-muted-foreground mb-3">填写 OpenAI 兼容 API 配置，Bot 可理解自然语言指令</p>
        <div className="space-y-2 max-w-sm">
          <input value={aiKey} onChange={e => setAiKey(e.target.value)} type="password" placeholder="API Key" className={inputCls} />
          <input value={aiUrl} onChange={e => setAiUrl(e.target.value)} placeholder="API 地址（默认 https://api.openai.com/v1）" className={inputCls} />
          <input value={aiModel} onChange={e => setAiModel(e.target.value)} placeholder="模型（默认 gpt-4o-mini）" className={inputCls} />
          <Button variant="outline" size="sm" onClick={saveAi} disabled={aiBusy}>{aiBusy ? <Loader2 className="size-3.5 animate-spin" /> : null} 保存 AI 配置</Button>
          {aiMsg && <span className="text-xs text-muted-foreground ml-2">{aiMsg}</span>}
        </div>
      </section>

      {/* ── 监控通知 ── */}
      <section className="border-t border-border/40 pt-4">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold mb-1"><Bell className="size-4 shrink-0" /><span>监控通知</span></h3>
        <p className="text-[11px] text-muted-foreground mb-3">服务离线时推送到 Apprise，支持 Telegram / Discord / Slack 等</p>
        <div className="space-y-2 max-w-sm">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={notifyEnabled} onChange={e => setNotifyEnabled(e.target.checked)} /> 启用通知</label>
          <input value={appriseUrl} onChange={e => setAppriseUrl(e.target.value)} placeholder="Apprise API 地址（可选）" className={inputCls} />
          <input value={cooldown} onChange={e => setCooldown(Number(e.target.value))} type="number" min={1} placeholder="冷却时间（分钟，默认 30）" className={inputCls} />
          <Button variant="outline" size="sm" onClick={saveNotify} disabled={notifyBusy}>{notifyBusy ? <Loader2 className="size-3.5 animate-spin" /> : null} 保存通知配置</Button>
          {notifyMsg && <span className="text-xs text-muted-foreground ml-2">{notifyMsg}</span>}
        </div>
      </section>
    </div>
  );
}
