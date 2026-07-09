"use client";

import { useState, useEffect, useRef } from "react";
import { Container, Server, Globe, Monitor, Wifi, HardDrive, Database, Cloud, Terminal, Shield, Activity, Settings, Box, MemoryStick, Cpu, Zap, Loader2 } from "lucide-react";
import type { MonitorEditTarget } from "./monitor-types";

const QUICK_ICONS = ['Container', 'Server', 'Globe', 'Monitor', 'Wifi', 'HardDrive', 'Database', 'Cloud', 'Terminal', 'Shield', 'Activity', 'Settings', 'Box', 'MemoryStick', 'Cpu', 'Zap'];
const lucideIconMap: Record<string, React.FC<{className?: string}>> = { Container, Server, Globe, Monitor, Wifi, HardDrive, Database, Cloud, Terminal, Shield, Activity, Settings, Box, MemoryStick, Cpu, Zap };

interface MonitorEditDialogProps {
  target: MonitorEditTarget;
  baseUrl: string;
  authHeaders: Record<string, string>;
  onClose: () => void;
  onSaved: () => void;
}

// ── 巡检目标编辑弹窗（居中模态）──
export function MonitorEditDialog({ target, baseUrl, authHeaders, onClose, onSaved }: MonitorEditDialogProps) {
  const [name, setName] = useState(target.name);
  const [icon, setIcon] = useState(target.icon || '');
  const [url, setUrl] = useState(target.url || '');
  const [mac, setMac] = useState(target.mac || '');
  const [saving, setSaving] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 100); }, []);

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const isDocker = target.id.startsWith('docker:');
    try {
      if (!target.id) {
        // 添加模式
        if (!url.trim()) { setSaving(false); return; }
        await fetch(`${baseUrl}/api/v1/admin/monitor/checks`, {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim(), url: url.trim(), icon: icon || undefined }),
        });
      } else if (isDocker) {
        // 编辑模式（Docker 容器）— 只存备注名和图标
        const containerName = target.id.replace('docker:', '');
        await fetch(`${baseUrl}/api/v1/admin/docker/metadata/${encodeURIComponent(containerName)}`, {
          method: 'PUT',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ icon: icon || undefined, label: name.trim() !== containerName ? name.trim() : undefined }),
        });
      } else {
        // 编辑模式（内网巡检）
        await fetch(`${baseUrl}/api/v1/admin/monitor/checks/${target.id}`, {
          method: 'PUT',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim(), url: url.trim() || undefined, icon: icon || undefined, mac: mac.trim() || undefined }),
        });
      }
    } catch (err) { console.warn('[Monitor] save target failed:', err); }
    setSaving(false);
    onSaved();
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${baseUrl}/api/v1/upload`, { method: 'POST', body: formData });
      if (res.ok) { const d = await res.json(); if (d.url) setIcon(d.url); }
    } catch (err) { console.warn('[Monitor] upload failed:', err); }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const detectIcon = async () => {
    setDetecting(true);
    try {
      const detectUrl = url || target.url;
      if (detectUrl) {
        const res = await fetch(`${baseUrl}/api/v1/admin/monitor/fetch-icon`, {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: detectUrl }),
        });
        if (res.ok) { const d = await res.json(); if (d.icon) { setIcon(d.icon); setDetecting(false); return; } }
      }
      if (target.id.startsWith('docker:')) {
        const res = await fetch(`${baseUrl}/api/v1/admin/docker/fetch-icon`, {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: target.id.replace('docker:', '') }),
        });
        if (res.ok) { const d = await res.json(); if (d.icon) { setIcon(d.icon); } }
      }
    } catch (err) { console.warn('[Monitor] icon detection failed:', err); }
    setDetecting(false);
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}
      onPointerDown={e => { if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) onClose(); }}>
      <div ref={dialogRef} className="bg-background/90 backdrop-blur-xl border border-border/40 rounded-2xl p-5 w-80 shadow-2xl">
        <div className="text-sm font-medium text-foreground mb-3">{!target.id ? '添加监控目标' : target.id.startsWith('docker:') ? '编辑 Docker 容器' : '编辑巡检目标'}</div>
        <input ref={inputRef} value={name} onChange={e => setName(e.target.value)}
          placeholder="名称" className="w-full px-3 py-2 rounded-xl text-sm bg-muted/50 border border-border/40 text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-border/80 transition-colors mb-2"
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') onClose(); }}
        />
        {!target.id.startsWith("docker:") && (
        <input value={url} onChange={e => setUrl(e.target.value)}
          placeholder="http://192.168.1.xxx:8080"
          className="w-full px-3 py-2 rounded-xl text-sm bg-muted/50 border border-border/40 text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-border/80 transition-colors mb-2"
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') onClose(); }}
        />
        )}
        {!target.id.startsWith('docker:') && (
        <input value={mac} onChange={e => setMac(e.target.value)}
          placeholder="MAC 地址（可选，用于局域网唤醒）"
          className="w-full px-3 py-2 rounded-xl text-sm bg-muted/50 border border-border/40 text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-border/80 transition-colors mb-2"
        />
        )}
        <div className="text-[11px] text-muted-foreground mb-1.5">图标</div>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {QUICK_ICONS.map(ico => {
            const isActive = icon === `:${ico}:`;
            const Comp = lucideIconMap[ico];
            if (!Comp) return null;
            return (
              <button key={ico}
                className={`p-1.5 rounded-lg border transition-colors ${isActive ? 'bg-white/20 border-white/40' : 'bg-muted/30 border-border/30 hover:bg-accent/50'}`}
                onClick={() => setIcon(`:${ico}:`)}
                title={ico}
              >
                <Comp className="w-4 h-4" />
              </button>
            );
          })}
        </div>
        <div className="flex gap-1.5 items-center mb-2">
          <input value={icon.startsWith(':') ? '' : icon} onChange={e => setIcon(e.target.value)}
            placeholder="图标 URL / 上传 / 选中上方"
            className="flex-1 px-3 py-2 rounded-xl text-sm bg-muted/50 border border-border/40 text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-border/80 transition-colors"
          />
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
          <button className="shrink-0 px-2 py-2 rounded-xl text-[11px] bg-muted/50 border border-border/30 hover:bg-accent transition-colors disabled:opacity-50" disabled={uploading} onClick={() => fileRef.current?.click()}>
            {uploading ? <Loader2 className="size-3.5 animate-spin" /> : '上传'}
          </button>
          <button className="shrink-0 px-2 py-2 rounded-xl text-[11px] bg-muted/50 border border-border/30 hover:bg-accent transition-colors disabled:opacity-50" disabled={detecting} onClick={detectIcon}>
            {detecting ? <Loader2 className="size-3.5 animate-spin" /> : '识别'}
          </button>
        </div>
        {icon && !icon.startsWith(':') && (
          <img src={icon} alt="" className="w-8 h-8 rounded-lg mb-2" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        )}
        <div className="flex gap-2">
          <button className="flex-1 px-3 py-1.5 rounded-xl text-sm font-medium text-foreground bg-muted/50 border border-border/30 hover:bg-accent transition-colors" onClick={onClose}>取消</button>
          <button className="flex-1 px-3 py-1.5 rounded-xl text-sm font-medium text-white transition-colors disabled:opacity-50" style={{ background: '#6366f1' }} disabled={saving} onClick={save}>
            {saving ? '保存中...' : !target.id ? '添加' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
