'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { req, API, SystemInfo, CheckResult, MonitorData, ConfirmState, ProgressBar, fm, ft } from '../admin-tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Plus, Trash2, Check, X, Search, Upload, ExternalLink,
  Cpu, Monitor, HardDrive, Clock, Wifi, Loader2, Zap,
} from 'lucide-react';
import { toast } from 'sonner';

export default function MonitorTab({ showConfirm }: { showConfirm: (opts: Omit<ConfirmState, 'open'>) => void }) {
  const [sys, setSys] = useState<SystemInfo | null>(null);
  const [checks, setChecks] = useState<CheckResult[]>([]);
  const [targets, setTargets] = useState<{ id: string; name: string; url: string; icon?: string; mac?: string }[]>([]);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newIcon, setNewIcon] = useState('');
  const [newMac, setNewMac] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [waking, setWaking] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const urlRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const getIcon = (targetId: string): string | undefined => targets.find(t => t.id === targetId)?.icon;
  const getMac = (targetId: string): string | undefined => targets.find(t => t.id === targetId)?.mac;

  const load = useCallback(async () => {
    const [sr, cr] = await Promise.all([
      req<SystemInfo>('GET', `${API}/admin/monitor/system`),
      req<MonitorData>('GET', `${API}/admin/monitor/checks`),
    ]);
    if (cr.status === 403) { setError('监控功能已禁用'); return; }
    if (sr.ok) setSys(sr.data);
    if (cr.ok) { setChecks(cr.data.results || []); setTargets(cr.data.targets || []); }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const handleDetectIcon = async () => {
    if (!newUrl.trim()) return;
    setDetecting(true);
    const { ok, data } = await req<{ icon: string | null }>('POST', `${API}/admin/monitor/fetch-icon`, { url: newUrl.trim() });
    if (ok && data.icon) setNewIcon(data.icon);
    setDetecting(false);
  };

  const handleUploadIcon = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch(`${API}/upload`, { method: 'POST', body: formData });
      if (res.ok) {
        const data = await res.json();
        if (data.url) setNewIcon(data.url);
      }
    } catch { /* silent */ }
  };

  const doAdd = async () => {
    if (!newName.trim() || !newUrl.trim()) return;
    setIsAdding(true);
    let finalUrl = newUrl.trim();
    if (!/^https?:\/\//i.test(finalUrl)) finalUrl = `http://${finalUrl}`;
    const body: Record<string, unknown> = { name: newName.trim(), url: finalUrl };
    if (newIcon) body.icon = newIcon;
    if (newMac.trim()) body.mac = newMac.trim();
    const { ok } = await req('POST', `${API}/admin/monitor/checks`, body);
    setIsAdding(false);
    if (ok) { setShowForm(false); setNewName(''); setNewUrl(''); setNewIcon(''); setNewMac(''); load(); }
  };

  const handleWake = async (id: string) => {
    setWaking(id);
    const { ok, data } = await req('POST', `${API}/admin/monitor/wol/${id}`);
    if (!ok) toast.error((data as { error?: string }).error || '唤醒失败');
    else toast.success('魔法包已发送');
    setWaking(null);
  };

  const delMonitor = (id: string) => {
    showConfirm({
      title: '删除巡检目标',
      description: '确定删除此巡检目标？',
      variant: 'destructive',
      onConfirm: async () => {
        await req('DELETE', `${API}/admin/monitor/checks/${id}`);
        load();
      },
    });
  };

  if (error) {
    return <div className="rounded-md bg-destructive/10 border border-destructive/25 p-2.5 text-sm text-destructive" role="alert">{error}</div>;
  }

  return (
    <div>
      {/* ── 系统状态卡片 ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <Card>
          <CardContent className="p-4">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold">
              <Cpu className="size-4 text-muted-foreground shrink-0" />
              <span>CPU</span>
            </h3>
            <div className="mt-2">
              <span className="text-primary text-3xl font-bold">{sys?.cpu?.usage || 0}%</span>
              <span className="text-muted-foreground ml-2 text-xs">{sys?.cpu?.cores || '-'} 核</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold">
              <Monitor className="size-4 text-muted-foreground shrink-0" />
              <span>内存</span>
            </h3>
            <div className="mt-2">
              <span className="text-xl font-semibold">{sys?.memory?.usedPercent || 0}%</span>
              <ProgressBar percent={sys?.memory?.usedPercent || 0} />
              <span className="text-muted-foreground text-xs whitespace-nowrap">{fm(sys?.memory?.used)} / {fm(sys?.memory?.total)}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold">
              <HardDrive className="size-4 text-muted-foreground shrink-0" />
              <span>磁盘</span>
            </h3>
            <div className="mt-2">
              <span className="text-xl font-semibold">{sys?.disk?.usedPercent || 0}%</span>
              <ProgressBar percent={sys?.disk?.usedPercent || 0} />
              <span className="text-muted-foreground text-xs whitespace-nowrap">{fm(sys?.disk?.used)} / {fm(sys?.disk?.total)}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold">
              <Clock className="size-4 text-muted-foreground shrink-0" />
              <span>运行时间</span>
            </h3>
            <div className="mt-2">
              <span className="text-xl font-semibold">{ft(sys?.uptime || 0)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── 添加表单 ── */}
      {showForm && (
        <div className="border border-border rounded-lg p-4 mb-2.5 bg-background/30">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold mb-3">
            <Plus className="size-4 text-muted-foreground shrink-0" />
            <span>添加巡检目标</span>
          </h3>
          <div className="space-y-3">
            <div className="flex gap-2 flex-wrap">
              <input ref={nameRef} value={newName} onChange={e => setNewName(e.target.value)}
                placeholder="名称"
                className="flex-1 min-w-[120px] h-9 px-3 rounded-md border border-input bg-background text-sm"
                onKeyDown={e => { if (e.key === 'Enter') urlRef.current?.focus(); }} />
              <input ref={urlRef} value={newUrl} onChange={e => setNewUrl(e.target.value)}
                placeholder="http://192.168.1.xxx:8080"
                className="flex-[2] min-w-[200px] h-9 px-3 rounded-md border border-input bg-background text-sm"
                onKeyDown={e => { if (e.key === 'Enter') doAdd(); }} />
            </div>
            <div className="flex gap-2 items-center flex-wrap">
              <input value={newIcon} onChange={e => setNewIcon(e.target.value)}
                placeholder="图标 URL（可选）"
                className="flex-1 min-w-[120px] h-9 px-3 rounded-md border border-input bg-background text-xs" />
              <Button variant="outline" size="sm" disabled={detecting || !newUrl.trim()} onClick={handleDetectIcon}>
                {detecting ? <><Loader2 className="size-3.5 animate-spin" /> 识别中</> : <Search className="size-3.5" />} 自动识别
              </Button>
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}><Upload className="size-3.5" /> 上传图标</Button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={e => { if (e.target.files?.[0]) handleUploadIcon(e.target.files[0]); }} />
              {newIcon && (
                <span className="flex items-center gap-1">
                  {newIcon.startsWith('http') || newIcon.startsWith('/uploads')
                    ? <img src={newIcon} alt="" className="w-5 h-5 rounded" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    : <span className="text-lg">{newIcon}</span>}
                  <Button variant="outline" size="sm" className="px-1.5 py-0 text-[10px]" onClick={() => setNewIcon('')}><X className="size-3" /></Button>
                </span>
              )}
            </div>
            <div className="flex gap-2 items-center flex-wrap">
              <input value={newMac} onChange={e => setNewMac(e.target.value)}
                placeholder="MAC 地址（可选，用于 WOL 唤醒）"
                className="flex-1 min-w-[200px] h-9 px-3 rounded-md border border-input bg-background text-xs font-mono"
                onKeyDown={e => { if (e.key === 'Enter') doAdd(); }} />
            </div>
            <div className="flex gap-2">
              <Button variant="default" size="sm" disabled={isAdding} onClick={doAdd}>
                {isAdding ? <><Loader2 className="size-3.5 animate-spin" /> 添加中...</> : <><Check className="size-3.5" /> 确认添加</>}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)}><X className="size-3.5" /> 取消</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── 服务巡检列表 ── */}
      <div className="flex justify-between items-center mb-2 mt-3">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          <Search className="size-4 text-muted-foreground shrink-0" />
          <span>服务巡检</span>
        </h3>
        <Button variant="default" size="sm" onClick={() => { setShowForm(true); setNewIcon(''); setTimeout(() => nameRef.current?.focus(), 100); }}>
          <Plus className="size-3.5" /> 添加目标
        </Button>
      </div>

      {checks.length === 0 ? (
        <div className="text-muted-foreground/60 text-xs text-center py-4">暂无巡检目标 · 点击上方添加</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead>名称</TableHead>
              <TableHead>URL</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>延迟</TableHead>
              <TableHead className="w-24">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {checks.map(c => {
              const icon = getIcon(c.id);
              return (
                <TableRow key={c.id}>
                  <TableCell className="text-center">
                    {icon ? (
                      icon.startsWith('http') || icon.startsWith('/uploads')
                        ? <img src={icon} alt="" className="w-[18px] h-[18px] rounded mx-auto" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        : <span className="text-base">{icon}</span>
                    ) : (
                      <Wifi className="size-4 mx-auto text-muted-foreground/40" />
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="max-w-[250px] overflow-hidden text-ellipsis whitespace-nowrap">
                    <a href={c.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary no-underline text-xs hover:underline">
                      <ExternalLink className="size-3 shrink-0" />
                      <span className="truncate max-w-[200px]">{c.url}</span>
                    </a>
                  </TableCell>
                  <TableCell>
                    {c.status === 'ok'
                      ? <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400 text-sm"><Check className="size-3.5 shrink-0" /><span>正常</span></span>
                      : <span className="text-destructive text-sm">○ 离线</span>}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{c.latency !== null ? `${c.latency}ms` : '-'}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" onClick={() => delMonitor(c.id)} aria-label="删除巡检目标"><Trash2 className="size-3.5" /></Button>
                      {c.status !== 'ok' && getMac(c.id) && (
                        <Button variant="outline" size="sm" disabled={waking === c.id} onClick={() => handleWake(c.id)} aria-label="WOL 网络唤醒">
                          {waking === c.id ? <Loader2 className="size-3.5 animate-spin" /> : <Zap className="size-3.5" />}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
