import { GithubConfig } from "@/lib/github";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface GithubTabProps {
  config: GithubConfig;
  setConfig: (config: GithubConfig) => void;
}

export function GithubTab({ config, setConfig }: GithubTabProps) {
  return (
    <div className="space-y-4 py-4 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-muted-foreground/20 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/40">
      <div className="space-y-2"><Label>Token</Label><Input type="password" value={config.token} onChange={e => setConfig({...config, token: e.target.value})} placeholder="ghp_..." className="h-9" /></div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2"><Label>用户名</Label><Input value={config.owner} onChange={e => setConfig({...config, owner: e.target.value})} placeholder="GitHub Username" className="h-9" /></div>
        <div className="space-y-2"><Label>仓库名</Label><Input value={config.repo} onChange={e => setConfig({...config, repo: e.target.value})} placeholder="Repository Name" className="h-9" /></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2"><Label>分支</Label><Input value={config.branch || ""} onChange={e => setConfig({...config, branch: e.target.value})} placeholder="main" className="h-9" /></div>
        <div className="space-y-2"><Label>文件路径</Label><Input value={config.path} onChange={e => setConfig({...config, path: e.target.value})} placeholder="public/data.json" className="h-9" /></div>
      </div>
    </div>
  );
}