"use client";

import { useRef, useEffect, useState } from "react";
import { StorageConfig, GithubRepoSettings, S3Settings, WebDavSettings, GistSettings, DropboxSettings, GoogleDriveSettings, ApiServerSettings, GithubRepoAdapter, S3Adapter, WebDavAdapter, GistAdapter, DropboxAdapter, GoogleDriveAdapter, ApiServerAdapter } from "@/lib/adapters/storage";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, Wifi, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { isPrivateHost } from "@/lib/utils";
import { useUIStore } from "@/lib/stores";
import type { DataSchema } from "@/lib/types";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface StorageTabProps {
  config: StorageConfig;
  setConfig: (config: StorageConfig) => void;
  localData: DataSchema;
  setLocalData: (data: DataSchema) => void;
  onSave: (newData: DataSchema) => Promise<void>;
}

const DEFAULT_GITHUB: GithubRepoSettings = { token: "", owner: "", repo: "", branch: "main", path: "public/data.json" };
const DEFAULT_S3: S3Settings = { endpoint: "", region: "auto", accessKeyId: "", secretAccessKey: "", bucket: "", key: "data.json" };
const DEFAULT_WEBDAV: WebDavSettings = { url: "", username: "", password: "", path: "/data.json" };
const DEFAULT_GIST: GistSettings = { token: "", gistId: "", filename: "nav-data.json" };
const DEFAULT_DROPBOX: DropboxSettings = { token: "", path: "/nav-data.json" };
const DEFAULT_GOOGLE_DRIVE: GoogleDriveSettings = { token: "", fileId: "", filename: "nav-data.json" };
const DEFAULT_APISERVER: ApiServerSettings = { baseUrl: "", token: "" };

export function StorageTab({ config, setConfig, localData, setLocalData, onSave }: StorageTabProps) {
  const [isTesting, setIsTesting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    phase: 'first' | 'second';
    action: 'reset' | 'clear';
  } | null>(null);
  const configRef = useRef(config);
  useEffect(() => { configRef.current = config; }, [config]);
  const backendAvailable = useUIStore(s => s.backendAvailable);

  useEffect(() => {
    if (!configRef.current.type) {
      setConfig({ ...configRef.current, type: 'github' });
    }
  }, [setConfig]);

  const handleTypeChange = (type: string) => {
    const newType = type as StorageConfig['type'];
    if (newType === 'api-server' && !backendAvailable) {
      toast.error('仅在 Docker 部署版中可用', { description: '本地服务器模式需要后端服务支持' });
      return;
    }
    setConfig({ ...config, type: newType });
  };

  const updateGithub = (fields: Partial<GithubRepoSettings>) => {
    const current = config.github || DEFAULT_GITHUB;
    setConfig({ ...config, github: { ...current, ...fields } });
  };

  const updateS3 = (fields: Partial<S3Settings>) => {
    const current = config.s3 || DEFAULT_S3;
    setConfig({ ...config, s3: { ...current, ...fields } });
  };

  const updateWebDav = (fields: Partial<WebDavSettings>) => {
    const current = config.webdav || DEFAULT_WEBDAV;
    setConfig({ ...config, webdav: { ...current, ...fields } });
  };

  const updateGist = (fields: Partial<GistSettings>) => {
    const current = config.gist || DEFAULT_GIST;
    setConfig({ ...config, gist: { ...current, ...fields } });
  };

  const updateDropbox = (fields: Partial<DropboxSettings>) => {
    const current = config.dropbox || DEFAULT_DROPBOX;
    setConfig({ ...config, dropbox: { ...current, ...fields } });
  };

  const updateGoogleDrive = (fields: Partial<GoogleDriveSettings>) => {
    const current = config.googledrive || DEFAULT_GOOGLE_DRIVE;
    setConfig({ ...config, googledrive: { ...current, ...fields } });
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    try {
      if (config.type === 'github') {
        const settings = config.github || DEFAULT_GITHUB;
        const adapter = new GithubRepoAdapter(settings);
        if (adapter.testConnection) await adapter.testConnection();
        toast.success("GitHub 连接成功！", {
          description: "已成功连接到 GitHub 仓库",
          duration: 3000
        });
      } else if (config.type === 's3') {
        const settings = config.s3 || DEFAULT_S3;
        const adapter = new S3Adapter(settings);
        if (adapter.testConnection) await adapter.testConnection();
        toast.success("S3/R2 连接成功！", {
          description: "已成功连接到 S3/R2 存储",
          duration: 3000
        });
      } else if (config.type === 'webdav') {
        const settings = config.webdav || DEFAULT_WEBDAV;
        const adapter = new WebDavAdapter(settings);
        if (adapter.testConnection) await adapter.testConnection();
        toast.success("WebDAV 连接成功！", {
          description: "已成功连接到 WebDAV 服务器",
          duration: 3000
        });
      } else if (config.type === 'gist') {
        const settings = config.gist || DEFAULT_GIST;
        const adapter = new GistAdapter(settings);
        if (adapter.testConnection) await adapter.testConnection();
        toast.success("Gist 连接成功！", {
          description: "已成功连接到 GitHub Gist",
          duration: 3000
        });
      } else if (config.type === 'dropbox') {
        const settings = config.dropbox || DEFAULT_DROPBOX;
        const adapter = new DropboxAdapter(settings);
        if (adapter.testConnection) await adapter.testConnection();
        toast.success("Dropbox 连接成功！", {
          description: "已成功连接到 Dropbox",
          duration: 3000
        });
      } else if (config.type === 'googledrive') {
        const settings = config.googledrive || DEFAULT_GOOGLE_DRIVE;
        const adapter = new GoogleDriveAdapter(settings);
        if (adapter.testConnection) await adapter.testConnection();
        toast.success("Google Drive 连接成功！", {
          description: "已成功连接到 Google Drive",
          duration: 3000
        });
      } else if (config.type === 'api-server') {
        const settings = config.apiServer || DEFAULT_APISERVER;
        const adapter = new ApiServerAdapter(settings);
        if (adapter.testConnection) await adapter.testConnection();
        toast.success("后端连接成功！", {
          description: `已成功连接到 ${settings.baseUrl}`,
          duration: 3000
        });
      }
    } catch (error: unknown) {
      console.error("Test connection failed:", error);
      const errorMessage = typeof error === 'object' && error !== null && 'message' in error ? (error.message as string) : "请检查配置信息";
      toast.error("连接失败", { description: errorMessage });
    } finally {
      setIsTesting(false);
    }
  };

  const runResetDefault = async () => {
    setIsResetting(true);
    setConfirmDialog(null);
    try {
      const res = await fetch("/data.json");
      if (!res.ok) { toast.error("无法加载默认模板"); setIsResetting(false); return; }
      const template = await res.json();
      const merged: DataSchema = {
        ...template,
        settings: { ...localData.settings, ...template.settings, wallpaperList: localData.settings.wallpaperList || template.settings.wallpaperList },
        todos: [],
        notes: [],
      };
      setLocalData(merged);
      localStorage.setItem("clean-nav-local-data", JSON.stringify(merged));
      await onSave(merged);
      toast.success("已恢复默认模板并同步到云端");
      window.location.reload();
    } catch {
      toast.error("恢复失败，请稍后重试");
      setIsResetting(false);
    }
  };
  const runClearAll = async () => {
    setIsClearing(true);
    setConfirmDialog(null);
    try {
      const cleared: DataSchema = {
        ...localData,
        categories: [],
        todos: [],
        notes: [],
      };
      cleared.settings = { ...cleared.settings, wallpaperList: localData.settings.wallpaperList || [] };
      setLocalData(cleared);
      localStorage.setItem("clean-nav-local-data", JSON.stringify(cleared));
      await onSave(cleared);
      toast.success("已清空所有书签并同步到云端");
      window.location.reload();
    } catch {
      toast.error("清空失败，请稍后重试");
      setIsClearing(false);
    }
  };

  const confirmLabels = !confirmDialog ? { title: '', description: '', confirmText: '' } : {
    title: confirmDialog.action === 'reset'
      ? (confirmDialog.phase === 'first' ? '恢复默认模板' : '再次确认')
      : (confirmDialog.phase === 'first' ? '清空所有书签' : '再次确认'),
    description: confirmDialog.phase === 'first'
      ? (confirmDialog.action === 'reset'
        ? '所有当前书签将被默认模板覆盖。'
        : '所有书签、待办和笔记将被清空。')
      : '此操作不可撤销，确定要继续吗？',
    confirmText: confirmDialog.action === 'reset' ? '恢复' : '清空',
  };

  const handleConfirm = () => {
    if (!confirmDialog) return;
    if (confirmDialog.phase === 'first') {
      setConfirmDialog({ ...confirmDialog, phase: 'second' });
    } else {
      if (confirmDialog.action === 'reset') runResetDefault();
      else runClearAll();
    }
  };

  const githubCfg = config.github || DEFAULT_GITHUB;
  const s3Cfg = config.s3 || DEFAULT_S3;
  const webdavCfg = config.webdav || DEFAULT_WEBDAV;
  const gistCfg = config.gist || DEFAULT_GIST;
  const dropboxCfg = config.dropbox || DEFAULT_DROPBOX;
  const googleDriveCfg = config.googledrive || DEFAULT_GOOGLE_DRIVE;

  return (
      <div className="space-y-4 py-4 overflow-y-auto h-full px-1">
      <div className="space-y-2">
        <Label>存储类型</Label>
        <Select value={config.type} onValueChange={handleTypeChange}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="选择存储方式" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="github">GitHub 仓库</SelectItem>
            <SelectItem value="s3">S3 / Cloudflare R2</SelectItem>
            <SelectItem value="webdav">WebDAV</SelectItem>
            <SelectItem value="gist">GitHub Gist</SelectItem>
            <SelectItem value="dropbox">Dropbox</SelectItem>
            <SelectItem value="googledrive">Google Drive</SelectItem>
            <SelectItem value="api-server">本地服务器</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="pt-2 border-t border-white/5 space-y-4">
        {config.type === 'github' && (
          <>
            <div className="space-y-2">
              <Label>Token (需要 repo 权限)</Label>
              <Input 
                type="password" 
                value={githubCfg.token || ""} 
                onChange={e => updateGithub({ token: e.target.value })} 
                placeholder="ghp_..." 
                className="h-9" 
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>用户名</Label>
                <Input 
                  value={githubCfg.owner || ""} 
                  onChange={e => updateGithub({ owner: e.target.value })} 
                  placeholder="Username" 
                  className="h-9" 
                />
              </div>
              <div className="space-y-2">
                <Label>仓库名</Label>
                <Input 
                  value={githubCfg.repo || ""} 
                  onChange={e => updateGithub({ repo: e.target.value })} 
                  placeholder="Repo Name" 
                  className="h-9" 
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>分支</Label>
                <Input 
                  value={githubCfg.branch || ""} 
                  onChange={e => updateGithub({ branch: e.target.value })} 
                  placeholder="main" 
                  className="h-9" 
                />
              </div>
              <div className="space-y-2">
                <Label>文件路径</Label>
                <Input 
                  value={githubCfg.path || ""} 
                  onChange={e => updateGithub({ path: e.target.value })} 
                  placeholder="public/data.json" 
                  className="h-9" 
                />
              </div>
            </div>
          </>
        )}

        {config.type === 's3' && (
          <>
            <div className="space-y-2">
              <Label>Endpoint (服务地址)</Label>
              <Input 
                value={s3Cfg.endpoint || ""} 
                onChange={e => updateS3({ endpoint: e.target.value })} 
                placeholder="https://..." 
                className="h-9" 
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Access Key ID</Label>
                <Input 
                  value={s3Cfg.accessKeyId || ""} 
                  onChange={e => updateS3({ accessKeyId: e.target.value })} 
                  className="h-9" 
                />
              </div>
              <div className="space-y-2">
                <Label>Secret Access Key</Label>
                <Input 
                  type="password"
                  value={s3Cfg.secretAccessKey || ""} 
                  onChange={e => updateS3({ secretAccessKey: e.target.value })} 
                  className="h-9" 
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Bucket</Label>
                <Input 
                  value={s3Cfg.bucket || ""} 
                  onChange={e => updateS3({ bucket: e.target.value })} 
                  className="h-9" 
                />
              </div>
              <div className="space-y-2">
                <Label>Public URL (公开访问域名)</Label>
                <Input 
                  value={s3Cfg.publicUrl || ""} 
                  onChange={e => updateS3({ publicUrl: e.target.value })} 
                  placeholder="可选: https://pub-xxx.r2.dev (用于壁纸直链)" 
                  className="h-9" 
                />
              </div>
              <div className="space-y-2">
                <Label>文件路径</Label>
                <Input 
                  value={s3Cfg.key || ""} 
                  onChange={e => updateS3({ key: e.target.value })} 
                  placeholder="data.json" 
                  className="h-9" 
                />
              </div>
            </div>
            <div className="rounded-md bg-yellow-500/10 p-3 mt-4 border border-yellow-500/20">
              <div className="flex items-start gap-2 text-yellow-500 mb-2">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span className="text-xs font-medium">必须配置 CORS 策略</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                由于浏览器安全限制，你必须在 S3/R2 后台配置 CORS 规则，允许你自己的域名访问。具体配置请参考 docs/storage-guide.md 文档。
              </p>
            </div>
          </>
        )}

        {config.type === 'webdav' && (
          <>
            <div className="space-y-2">
              <Label>WebDAV URL</Label>
              <Input 
                value={webdavCfg.url || ""} 
                onChange={e => updateWebDav({ url: e.target.value })} 
                placeholder="https://dav.jianguoyun.com/dav/" 
                className="h-9" 
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>用户名</Label>
                <Input 
                  value={webdavCfg.username || ""} 
                  onChange={e => updateWebDav({ username: e.target.value })} 
                  className="h-9" 
                />
              </div>
              <div className="space-y-2">
                <Label>密码</Label>
                <Input 
                  type="password"
                  value={webdavCfg.password || ""} 
                  onChange={e => updateWebDav({ password: e.target.value })} 
                  className="h-9" 
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>文件路径</Label>
              <Input 
                value={webdavCfg.path || ""} 
                onChange={e => updateWebDav({ path: e.target.value })} 
                placeholder="/nav/data.json" 
                className="h-9" 
              />
            </div>
            <div className="rounded-md bg-yellow-500/10 p-3 mt-4 border border-yellow-500/20">
              <div className="flex items-start gap-2 text-yellow-500 mb-2">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span className="text-xs font-medium">WebDAV CORS 警告</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                浏览器安全策略要求 WebDAV 服务器允许跨域访问（CORS）。很多私有云盘或 NAS 默认未开启 CORS，可能导致连接失败。
              </p>
            </div>
          </>
        )}

        {config.type === 'gist' && (
          <>
            <div className="space-y-2">
              <Label>Token (需要 gist 权限)</Label>
              <Input 
                type="password" 
                value={gistCfg.token || ""} 
                onChange={e => updateGist({ token: e.target.value })} 
                placeholder="ghp_..." 
                className="h-9" 
              />
            </div>
            <div className="space-y-2">
              <Label>Gist ID</Label>
              <Input 
                value={gistCfg.gistId || ""} 
                onChange={e => updateGist({ gistId: e.target.value })} 
                placeholder="32位 Gist ID" 
                className="h-9" 
              />
            </div>
            <div className="space-y-2">
              <Label>文件名</Label>
              <Input 
                value={gistCfg.filename || ""} 
                onChange={e => updateGist({ filename: e.target.value })} 
                placeholder="nav-data.json" 
                className="h-9" 
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              请创建一个私有或公开的 Gist，并填入其 ID 和文件名。
            </p>
          </>
        )}

        {config.type === 'dropbox' && (
          <>
            <div className="space-y-2">
              <Label>Token (需要 files.content.read 和 files.content.write 权限)</Label>
              <Input 
                type="password" 
                value={dropboxCfg.token || ""} 
                onChange={e => updateDropbox({ token: e.target.value })} 
                placeholder="sl.xxx..." 
                className="h-9" 
              />
            </div>
            <div className="space-y-2">
              <Label>文件路径</Label>
              <Input 
                value={dropboxCfg.path || ""} 
                onChange={e => updateDropbox({ path: e.target.value })} 
                placeholder="/nav-data.json" 
                className="h-9" 
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              请确保文件路径以斜杠开头，例如：/nav-data.json
            </p>
          </>
        )}

        {config.type === 'googledrive' && (
          <>
            <div className="space-y-2">
              <Label>Token (需要 drive.file 权限)</Label>
              <Input
                type="password"
                value={googleDriveCfg.token || ""}
                onChange={e => updateGoogleDrive({ token: e.target.value })}
                placeholder="ya29.xxx..."
                className="h-9"
              />
            </div>
            <div className="space-y-2">
              <Label>文件 ID</Label>
              <Input
                value={googleDriveCfg.fileId || ""}
                onChange={e => updateGoogleDrive({ fileId: e.target.value })}
                placeholder="Google Drive 文件 ID"
                className="h-9"
              />
            </div>
            <div className="space-y-2">
              <Label>文件名</Label>
              <Input
                value={googleDriveCfg.filename || ""}
                onChange={e => updateGoogleDrive({ filename: e.target.value })}
                placeholder="nav-data.json"
                className="h-9"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              请创建一个 Google Drive 文件，并填入其文件 ID 和文件名。
            </p>
          </>
        )}

        {config.type === 'api-server' && (
          <>
            {!backendAvailable && (
              <div className="rounded-md bg-amber-500/10 p-3 border border-amber-500/20 mb-3">
                <div className="flex items-center gap-2 text-amber-500 mb-1">
                  <AlertCircle className="size-4 shrink-0" />
                  <span className="text-xs font-medium">当前为静态部署，本地服务器不可用</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  本地服务器模式需要后端服务支持，仅在 Docker 部署版中可用。
                </p>
              </div>
            )}
            <div className="rounded-md bg-green-500/10 p-3 border border-green-500/20">
              <div className="flex items-center gap-2 text-green-500 mb-1">
                <Wifi className="w-4 h-4 shrink-0" />
                <span className="text-xs font-medium">本地后端已连接</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                前端与后端同源运行，无需额外配置。刷新页面后数据自动从本地后端加载。
              </p>
            </div>
          </>
        )}
      </div>

      <div className="rounded-md bg-red-500/10 p-3 border border-red-500/20 mt-4">
          <div className="flex items-center gap-2 text-red-500 mb-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="text-xs font-bold">同步机制与延迟警告</span>
          </div>
          <div className="text-[11px] text-red-400/90 space-y-1.5 leading-relaxed">
            <p><span className="font-bold text-red-400">刷新页面：</span>从云端拉取数据（智能合并本地新增）。</p>
            <p><span className="font-bold text-red-400">点击保存：</span>将本地数据推送到云端（覆盖云端旧数据）。</p>
            <p><span className="font-bold text-red-400">CDN 延迟：</span>保存后可能需 <strong>1-5 分钟</strong>生效，请勿频繁操作！</p>
          </div>
      </div>

      <div className="pt-2">
        <Button 
            variant="outline" 
            className="w-full gap-2 text-muted-foreground hover:text-foreground"
            onClick={handleTestConnection}
            disabled={isTesting}
        >
            {isTesting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
                <Wifi className="w-4 h-4" />
            )}
            {isTesting ? "正在测试连接..." : "测试连接配置"}
        </Button>

        <div className="pt-2">
            <Button
                variant="outline"
                className="w-full gap-2 text-red-500 hover:text-red-400 border-red-500/30 hover:border-red-500/50"
                onClick={() => setConfirmDialog({ phase: 'first', action: 'reset' })}
                disabled={isResetting || isClearing}
            >
                {isResetting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                    <AlertCircle className="w-4 h-4" />
                )}
                {isResetting ? "正在恢复..." : "恢复默认模板"}
            </Button>
        </div>
        <div className="pt-2">
            <Button
                variant="outline"
                className="w-full gap-2 text-destructive hover:text-destructive border-destructive/30"
                onClick={() => setConfirmDialog({ phase: 'first', action: 'clear' })}
                disabled={isClearing || isResetting}
            >
                {isClearing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                    <AlertCircle className="w-4 h-4" />
                )}
                {isClearing ? "正在清空..." : "清空所有书签"}
            </Button>
        </div>

        <ConfirmDialog
          open={confirmDialog !== null}
          onOpenChange={(open) => { if (!open) setConfirmDialog(null); }}
          title={confirmLabels.title}
          description={confirmLabels.description}
          confirmText={confirmLabels.confirmText}
          cancelText="取消"
          variant="destructive"
          loading={isResetting || isClearing}
          onConfirm={handleConfirm}
        />
      </div>
    </div>
  );
}
