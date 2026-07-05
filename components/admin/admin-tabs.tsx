// ══════ 管理后台共享常量 & 工具函数 ══════

export type TabId = 'overview' | 'cats' | 'bms' | 'todos' | 'notes' | 'monitor' | 'docker' | 'backup' | 'settings' | 'logs';

export interface StatusInfo {
  setupRequired: boolean;
  loggedIn: boolean;
}

export interface Category { id: string; title: string; icon?: string; links?: LinkItem[]; }
export interface LinkItem { id: string; title: string; url: string; }
export interface TodoItem { id: string; text: string; completed: boolean; }
export interface NoteItem { id: string; title: string; content?: string; updatedAt: number; }
export interface SystemInfo { cpu: { usage: number; cores: number }; memory: { total: number; used: number; usedPercent: number }; disk: { total: number; used: number; usedPercent: number }; uptime: number; }
export interface CheckResult { id: string; name: string; url: string; status: 'ok' | 'error' | 'timeout'; latency: number | null; lastCheck: number | null; }
export interface MonitorData { targets: { id: string; name: string; url: string }[]; results: CheckResult[]; }
export interface LogData { lines: string[]; }

export interface ConfirmState {
  open: boolean;
  title: string;
  description: string;
  confirmText?: string;
  variant?: 'default' | 'destructive';
  loading?: boolean;
  onConfirm: () => void;
}

// ── API ──

export const API = '/api/v1';

export async function req<T = Record<string, unknown>>(method: string, path: string, body?: unknown): Promise<{ ok: boolean; status: number; data: T }> {
  try {
    const opts: RequestInit = { method };
    if (body) {
      opts.headers = { 'Content-Type': 'application/json' };
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(path, opts);
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: '无法连接后端' } as T };
  }
}

export function es(text: string): string {
  const el = document.createElement('div');
  el.textContent = text;
  return el.innerHTML;
}

// ── Tab config ──

import type React from 'react';
import {
  LayoutDashboard, Folder, Link, CheckSquare, FileText,
  Monitor, Container, Save, Settings, ClipboardList, Loader2,
} from 'lucide-react';

export const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: '概览', icon: <LayoutDashboard className="icon-sm" /> },
  { id: 'cats', label: '分类', icon: <Folder className="icon-sm" /> },
  { id: 'bms', label: '书签', icon: <Link className="icon-sm" /> },
  { id: 'todos', label: '待办', icon: <CheckSquare className="icon-sm" /> },
  { id: 'notes', label: '笔记', icon: <FileText className="icon-sm" /> },
  { id: 'monitor', label: '监控', icon: <Monitor className="icon-sm" /> },
  { id: 'docker', label: 'Docker', icon: <Container className="icon-sm" /> },
  { id: 'backup', label: '备份', icon: <Save className="icon-sm" /> },
  { id: 'settings', label: '设置', icon: <Settings className="icon-sm" /> },
  { id: 'logs', label: '日志', icon: <ClipboardList className="icon-sm" /> },
];

// ── Shared sub-components ──

import { Card, CardContent } from '@/components/ui/card';

export function Spinner() {
  return <div className="flex justify-center py-8"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>;
}

export function StatCard({ value, label }: { value: number; label: string }) {
  return (
    <Card>
      <CardContent className="p-4 text-center">
        <div className="text-2xl font-extrabold text-foreground tracking-tight">{value}</div>
        <div className="text-xs text-muted-foreground mt-1">{label}</div>
      </CardContent>
    </Card>
  );
}

export function ProgressBar({ percent, color }: { percent: number; color?: string }) {
  return (
    <div className="flex items-center gap-2 flex-1">
      <div className="flex-1 h-2 rounded overflow-hidden bg-muted">
        <div className="h-full rounded transition-all duration-500" style={{ width: `${Math.min(percent, 100)}%`, background: color || (percent > 80 ? 'var(--destructive)' : percent > 50 ? 'var(--warning)' : 'var(--success, #4ade80)') }} />
      </div>
      <span className="text-xs shrink-0 text-muted-foreground">{percent}%</span>
    </div>
  );
}

// ── Format helpers ──

export function fm(b?: number): string {
  if (!b) return '0B';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'], i = Math.floor(Math.log(b) / Math.log(1024));
  return (b / Math.pow(1024, i)).toFixed(1) + u[i];
}

export function ft(s: number): string {
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return (d ? d + '天' : '') + h + '小时' + m + '分';
}

export function fmt(...args: Parameters<typeof Intl.NumberFormat.prototype.format>) {
  return new Intl.NumberFormat('zh-CN').format(args[0] as number);
}
