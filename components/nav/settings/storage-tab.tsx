"use client";

import { StorageConfig, GithubRepoSettings, S3Settings, WebDavSettings, GistSettings, GithubRepoAdapter, S3Adapter, WebDavAdapter, GistAdapter } from "@/lib/storage";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, Wifi, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface StorageTabProps {
  config: StorageConfig;
  setConfig: (config: StorageConfig) => void;
}

const DEFAULT_GITHUB: GithubRepoSettings = { token: "", owner: "", repo: "", branch: "main", path: "public/data.json" };
const DEFAULT_S3: S3Settings = { endpoint: "", region: "auto", accessKeyId: "", secretAccessKey: "", bucket: "", key: "data.json" };
const DEFAULT_WEBDAV: WebDavSettings = { url: "", username: "", password: "", path: "/data.json" };
const DEFAULT_GIST: GistSettings = { token: "", gistId: "", filename: "nav-data.json" };

export function StorageTab({ config, setConfig }: StorageTabProps) {
  const [isTesting, setIsTesting] = useState(false);
  
  useEffect(() => {
    if (!config.type) {
      setConfig({ ...config, type: 'github' });
    }
  }, [config, setConfig]);

  const handleTypeChange = (type: string) => {
    const newType = type as StorageConfig['type'];
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

  const handleTestConnection = async () => {
    setIsTesting(true);
    try {
      if (config.type === 'github') {
        const settings = config.github || DEFAULT_GITHUB;
        const adapter = new GithubRepoAdapter(settings);
        if (adapter.testConnection) await adapter.testConnection();
        toast.success("GitHub 连接成功！");
      } else if (config.type === 's3') {
        const settings = config.s3 || DEFAULT_S3;
        const adapter = new S3Adapter(settings);
        if (adapter.testConnection) await adapter.testConnection();
        toast.success("S3/R2 连接成功！");
      } else if (config.type === 'webdav') {
        const settings = config.webdav || DEFAULT_WEBDAV;
        const adapter = new WebDavAdapter(settings);
        if (adapter.testConnection) await adapter.testConnection();
        toast.success("WebDAV 连接成功！");
      } else if (config.type === 'gist') {
        const settings = config.gist || DEFAULT_GIST;
        const adapter = new GistAdapter(settings);
        if (adapter.testConnection) await adapter.testConnection();
        toast.success("Gist 连接成功！");
      }
    } catch (error: any) {
      console.error("Test connection failed:", error);
      toast.error("连接失败", { description: error.message || "请检查配置信息" });
    } finally {
      setIsTesting(false);
    }
  };

  const githubCfg = config.github || DEFAULT_GITHUB;
  const s3Cfg = config.s3 || DEFAULT_S3;
  const webdavCfg = config.webdav || DEFAULT_WEBDAV;
  const gistCfg = config.gist || DEFAULT_GIST;

  return (
    <div className="space-y-4 py-4 overflow-y-auto h-full px-1 custom-scrollbar">
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
      </div>
    </div>
  );
}