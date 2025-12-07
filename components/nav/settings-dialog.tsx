"use client";

import { useState, useEffect } from "react";
import { Settings, Save, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { DataSchema, SiteSettings } from "@/lib/types";
import { GithubConfig, GITHUB_CONFIG_KEY } from "@/lib/github";
import { useLocalStorage } from "@/lib/hooks";

interface SettingsDialogProps {
  data: DataSchema;
  onSave: (newData: DataSchema) => Promise<void>;
  isSaving: boolean;
}

export function SettingsDialog({ data, onSave, isSaving }: SettingsDialogProps) {
  const [open, setOpen] = useState(false);
  const [localData, setLocalData] = useState<DataSchema>(data);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [jsonString, setJsonString] = useState(JSON.stringify(data, null, 2));
  
  const [ghConfig, setGhConfig] = useLocalStorage<GithubConfig>(GITHUB_CONFIG_KEY, {
    token: "",
    owner: "",
    repo: "",
    path: "public/data.json"
  });

  // Sync prop data to local state when dialog opens or data changes externally
  useEffect(() => {
    if (open) {
      setLocalData(data);
      setJsonString(JSON.stringify(data, null, 2));
    }
  }, [open, data]);

  const handleJsonChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setJsonString(val);
    try {
      const parsed = JSON.parse(val);
      setLocalData(parsed);
      setJsonError(null);
    } catch (err) {
      setJsonError((err as Error).message);
    }
  };

  const handleSave = async () => {
    if (jsonError) {
      toast.error("JSON 格式错误，无法保存");
      return;
    }
    await onSave(localData);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="fixed bottom-4 right-4 z-50 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-md shadow-lg"
        >
          <Settings className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle>设置</DialogTitle>
          <DialogDescription>
            配置网站外观、数据与 GitHub 同步。
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="general">常规</TabsTrigger>
            <TabsTrigger value="data">数据编辑</TabsTrigger>
            <TabsTrigger value="github">GitHub 同步</TabsTrigger>
          </TabsList>

          {/* General Settings */}
          <TabsContent value="general" className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>网站标题</Label>
              <Input 
                value={localData.settings.title} 
                onChange={(e) => setLocalData({...localData, settings: {...localData.settings, title: e.target.value}})}
              />
            </div>
            <div className="space-y-2">
              <Label>壁纸 URL</Label>
              <Input 
                value={localData.settings.wallpaper} 
                onChange={(e) => setLocalData({...localData, settings: {...localData.settings, wallpaper: e.target.value}})}
              />
              <p className="text-xs text-muted-foreground">支持图片链接或 Bing 每日壁纸。</p>
            </div>
            <div className="flex items-center space-x-2">
               {/* Simplified for prototype: just URL input */}
            </div>
          </TabsContent>

          {/* Data JSON Editor */}
          <TabsContent value="data" className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>导航数据 (JSON)</Label>
              <Textarea 
                value={jsonString}
                onChange={handleJsonChange}
                className="font-mono text-xs h-[300px]"
              />
              {jsonError && (
                <p className="text-red-500 text-xs">JSON Error: {jsonError}</p>
              )}
            </div>
          </TabsContent>

          {/* GitHub Config */}
          <TabsContent value="github" className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>GitHub Token (PAT)</Label>
              <Input 
                type="password"
                value={ghConfig.token}
                onChange={(e) => setGhConfig({...ghConfig, token: e.target.value})}
                placeholder="ghp_xxxxxxxxxxxx"
              />
              <p className="text-xs text-muted-foreground">
                需要 `repo` 权限。仅保存在本地浏览器中。
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>用户名 (Owner)</Label>
                <Input 
                  value={ghConfig.owner}
                  onChange={(e) => setGhConfig({...ghConfig, owner: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>仓库名 (Repo)</Label>
                <Input 
                  value={ghConfig.repo}
                  onChange={(e) => setGhConfig({...ghConfig, repo: e.target.value})}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>文件路径</Label>
              <Input 
                value={ghConfig.path}
                onChange={(e) => setGhConfig({...ghConfig, path: e.target.value})}
                placeholder="public/data.json"
              />
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button onClick={handleSave} disabled={isSaving || !!jsonError}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            保存并更新
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
