'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { req, API, ConfirmState } from '../admin-tabs';
import { Download, Upload, RefreshCw, Trash2, Server, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export default function BackupTab({ showConfirm }: { showConfirm: (opts: Omit<ConfirmState, 'open'>) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [importMsg, setImportMsg] = useState('');
  const [importing, setImporting] = useState(false);

  const svrFileRef = useRef<HTMLInputElement>(null);
  const [svrMsg, setSvrMsg] = useState('');
  const [svrImporting, setSvrImporting] = useState(false);

  const handleExport = async () => {
    const res = await fetch(`${API}/data`, {});
    if (!res.ok) return;
    const data = await res.json();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `nav-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const handleImport = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    showConfirm({
      title: '导入站点数据',
      description: '导入将覆盖现有数据和监控以外的配置，确定？',
      variant: 'destructive',
      confirmText: '导入',
      onConfirm: async () => {
        setImporting(true); setImportMsg('');
        const text = await file.text();
        const { ok, data } = await req('PUT', `${API}/data`, JSON.parse(text));
        setImportMsg(ok ? '✅ 已恢复' : `❌ ${(data as { error?: string }).error || '导入失败'}`);
        setImporting(false);
      },
    });
  };

  const handleReset = () => {
    showConfirm({
      title: '重置站点数据',
      description: '确定清空全部站点数据？此操作不可恢复！',
      variant: 'destructive',
      confirmText: '清空数据',
      onConfirm: () => {
        const empty = { settings: { title: 'Clean Nav', wallpaper: '', wallpaperType: 'local', wallpaperList: [], blurLevel: 'medium' }, categories: [], todos: [], notes: [] };
        (async () => {
          await req('PUT', `${API}/data`, empty);
          toast.success('站点数据已清空');
        })();
      },
    });
  };

  const handleServerExport = async () => {
    const res = await fetch(`${API}/admin/backup`, {});
    if (!res.ok) return;
    const data = await res.json();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `nav-server-full-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const handleServerImport = async () => {
    const file = svrFileRef.current?.files?.[0];
    if (!file) return;
    showConfirm({
      title: '恢复全量备份',
      description: '全量恢复将覆盖所有数据（包括监控目标和管理员配置），确定？',
      variant: 'destructive',
      confirmText: '恢复',
      onConfirm: async () => {
        setSvrImporting(true); setSvrMsg('');
        const text = await file.text();
        const { ok, data } = await req('POST', `${API}/admin/backup`, JSON.parse(text));
        setSvrMsg(ok ? '✅ 已恢复（管理员密码等内部密钥已保留）' : `❌ ${(data as { error?: string }).error || '恢复失败'}`);
        setSvrImporting(false);
      },
    });
  };

  return (
    <div>
      {/* ── 导出站点数据 ── */}
      <Card className="mb-2.5">
        <CardContent className="p-4">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold">
            <Download className="size-4 text-muted-foreground shrink-0" />
            <span>导出站点数据</span>
          </h3>
          <p className="text-xs text-muted-foreground mb-2">分类、书签、待办、笔记、设置 — 可用于跨设备数据迁移</p>
          <Button variant="default" size="sm" onClick={handleExport}><Download className="size-3.5" /> 导出站点数据</Button>
        </CardContent>
      </Card>

      {/* ── 导入站点数据 ── */}
      <div className="border border-border rounded-lg p-4 mb-2.5 bg-background/30">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold mb-1">
          <Upload className="size-4 text-muted-foreground shrink-0" />
          <span>导入站点数据</span>
        </h3>
        <p className="text-xs text-muted-foreground mb-2">
          从 JSON 文件恢复站点数据，<strong>不影响监控目标和管理员配置</strong>
        </p>
        <input ref={fileRef} type="file" accept=".json" className="text-xs mb-2 block" />
        <Button variant="destructive" size="sm" disabled={importing} onClick={handleImport}>
          {importing ? <><Loader2 className="size-3.5 animate-spin" /> 恢复中...</> : <><Upload className="size-3.5" /> 恢复数据</>}
        </Button>
        {importMsg && (
          <div className={`mt-2 p-2 rounded text-xs ${importMsg.startsWith('✅') ? 'bg-green-500/10 border border-green-500/25 text-green-700 dark:text-green-400' : 'bg-destructive/10 border border-destructive/25 text-destructive'}`}>
            {importMsg}
          </div>
        )}
      </div>

      {/* ── 重置站点数据 ── */}
      <Card className="mb-2.5">
        <CardContent className="p-4">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold">
            <RefreshCw className="size-4 text-muted-foreground shrink-0" />
            <span>重置站点数据</span>
          </h3>
          <p className="text-xs text-destructive mb-2">
            清空分类、书签、待办、笔记、设置，<strong>不影响监控目标和管理员登录</strong>
          </p>
          <Button variant="destructive" size="sm" onClick={handleReset}><Trash2 className="size-3.5" /> 清空站点数据</Button>
        </CardContent>
      </Card>

      {/* ── 服务端全量备份 ── */}
      <hr className="border-border my-4" />
      <h3 className="flex items-center gap-1.5 text-sm text-primary/80 font-semibold mb-2">
        <Server className="size-4 shrink-0" />
        <span>服务端全量备份</span>
      </h3>
      <p className="text-xs text-muted-foreground mb-3">
        包含<strong>所有数据</strong>（站点数据 + 监控目标），适用于服务器迁移/灾备恢复。
      </p>

      <Card className="mb-2.5">
        <CardContent className="p-4">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold">
            <Download className="size-4 text-muted-foreground shrink-0" />
            <span>导出全量备份</span>
          </h3>
          <p className="text-xs text-muted-foreground mb-2">包含站点数据 + 监控目标，不含内部密钥</p>
          <Button variant="default" size="sm" onClick={handleServerExport}><Download className="size-3.5" /> 导出全量备份</Button>
        </CardContent>
      </Card>

      <div className="border border-border rounded-lg p-4 mb-2.5 bg-background/30">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold mb-1">
          <Upload className="size-4 text-muted-foreground shrink-0" />
          <span>恢复全量备份</span>
        </h3>
        <p className="text-xs text-muted-foreground mb-2">
          覆盖所有数据，<strong>管理员密码和 API 令牌等内部密钥会保留</strong>
        </p>
        <input ref={svrFileRef} type="file" accept=".json" className="text-xs mb-2 block" />
        <Button variant="destructive" size="sm" disabled={svrImporting} onClick={handleServerImport}>
          {svrImporting ? <><Loader2 className="size-3.5 animate-spin" /> 恢复中...</> : <><Upload className="size-3.5" /> 恢复全量数据</>}
        </Button>
        {svrMsg && (
          <div className={`mt-2 p-2 rounded text-xs ${svrMsg.startsWith('✅') ? 'bg-green-500/10 border border-green-500/25 text-green-700 dark:text-green-400' : 'bg-destructive/10 border border-destructive/25 text-destructive'}`}>
            {svrMsg}
          </div>
        )}
      </div>
    </div>
  );
}
