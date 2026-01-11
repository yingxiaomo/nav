"use client";

import { StorageConfig, GithubRepoSettings, S3Settings, GithubRepoAdapter, S3Adapter } from "@/lib/storage";
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

export function StorageTab({ config, setConfig }: StorageTabProps) {
  const [isTesting, setIsTesting] = useState(false);
  
  // Ensure we have a valid type
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

  const handleTestConnection = async () => {
    setIsTesting(true);
    try {
      if (config.type === 'github') {
        const settings = config.github || DEFAULT_GITHUB;
        const adapter = new GithubRepoAdapter(settings);
        if (adapter.testConnection) {
            await adapter.testConnection();
            toast.success("GitHub 连接成功！", { description: "配置正确，有权访问该仓库。" });
        }
      } else if (config.type === 's3') {
        const settings = config.s3 || DEFAULT_S3;
        const adapter = new S3Adapter(settings);
        if (adapter.testConnection) {
            await adapter.testConnection();
            toast.success("S3/R2 连接成功！", { description: "Bucket 可访问且配置正确。" });
        }
      } else {
        toast.info("当前存储类型暂不支持连接测试");
      }
    } catch (error: any) {
      console.error("Test connection failed:", error);
      toast.error("连接失败", { description: error.message || "请检查配置信息" });
    } finally {
      setIsTesting(false);
    }
  };

  // Safe accessors with fallback to legacy settings if necessary (though migration usually handles it)
  // But for UI rendering, we rely on the specific fields + defaults
  const githubCfg = config.github || (config.type === 'github' ? config.settings : undefined) || DEFAULT_GITHUB;
  const s3Cfg = config.s3 || (config.type === 's3' ? config.settings : undefined) || DEFAULT_S3;

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
          </SelectContent>
        </Select>
      </div>

      <div className="pt-2 border-t border-white/5 space-y-4">
        {config.type === 'github' && (
          <>
            <div className="space-y-2">
              <Label>Token</Label>
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
                  placeholder="GitHub Username" 
                  className="h-9" 
                />
              </div>
              <div className="space-y-2">
                <Label>仓库名</Label>
                <Input 
                  value={githubCfg.repo || ""} 
                  onChange={e => updateGithub({ repo: e.target.value })} 
                  placeholder="Repository Name" 
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
              <Label>Endpoint (服务地址/端点)</Label>
              <Input 
                value={s3Cfg.endpoint || ""} 
                onChange={e => updateS3({ endpoint: e.target.value })} 
                placeholder="例如: https://...r2.cloudflarestorage.com" 
                className="h-9" 
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Access Key ID (访问密钥 ID)</Label>
                <Input 
                  value={s3Cfg.accessKeyId || ""} 
                  onChange={e => updateS3({ accessKeyId: e.target.value })} 
                  placeholder="Access Key" 
                  className="h-9" 
                />
              </div>
              <div className="space-y-2">
                <Label>Secret Access Key (私有访问密钥)</Label>
                <Input 
                  type="password"
                  value={s3Cfg.secretAccessKey || ""} 
                  onChange={e => updateS3({ secretAccessKey: e.target.value })} 
                  placeholder="Secret Key" 
                  className="h-9" 
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Bucket (桶名称)</Label>
                <Input 
                  value={s3Cfg.bucket || ""} 
                  onChange={e => updateS3({ bucket: e.target.value })} 
                  placeholder="例如: my-nav-data" 
                  className="h-9" 
                />
              </div>
              <div className="space-y-2">
                <Label>Region (区域)</Label>
                <Input 
                  value={s3Cfg.region || ""} 
                  onChange={e => updateS3({ region: e.target.value })} 
                  placeholder="默认 auto" 
                  className="h-9" 
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>File Path (存储文件路径)</Label>
              <Input 
                value={s3Cfg.key || ""} 
                onChange={e => updateS3({ key: e.target.value })} 
                placeholder="例如: data.json" 
                className="h-9" 
              />
            </div>
            
            <div className="rounded-md bg-yellow-500/10 p-3 mt-4 border border-yellow-500/20">
              <div className="flex items-start gap-2 text-yellow-500 mb-2">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span className="text-xs font-medium">必须配置 CORS 策略</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                由于浏览器安全限制，你必须在 S3/R2 后台配置 CORS 规则，允许本站域名访问。具体配置请参考 docs/storage-guide.md 文档。
              </p>
            </div>
          </>
        )}
      </div>

      <div className="rounded-md bg-red-500/10 p-3 border border-red-500/20 space-y-1">
          <div className="flex items-center gap-2 text-red-500 mb-1">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="text-xs font-bold">同步机制与延迟警告</span>
          </div>
          <ul className="text-[11px] text-red-400/90 space-y-1 list-disc pl-4 leading-relaxed">
            <li><strong>刷新页面</strong>：从云端拉取数据（智能合并本地新增内容）。</li>
            <li><strong>点击保存</strong>：将本地数据推送到云端（覆盖云端旧数据）。</li>
            <li><strong>CDN 延迟</strong>：保存后云端生效可能需要 <strong>1-5 分钟</strong>，在此期间刷新可能会拉取到旧数据，请耐心等待，切勿频繁操作！</li>
          </ul>
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