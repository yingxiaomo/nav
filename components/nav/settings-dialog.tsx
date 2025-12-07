"use client";

import { useState, useEffect } from "react";
import { Settings, Loader2, Plus, Trash2, FolderOpen, Link as LinkIcon, ChevronDown, ChevronRight, Wand2, Shuffle, Image as ImageIcon } from "lucide-react";
import * as Icons from "lucide-react";
import { LucideIcon } from "lucide-react";
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
import { toast } from "sonner";
import { DataSchema } from "@/lib/types";
import { GithubConfig, GITHUB_CONFIG_KEY } from "@/lib/github";
import { useLocalStorage } from "@/lib/hooks";

interface SettingsDialogProps {
  data: DataSchema;
  onSave: (newData: DataSchema) => Promise<void>;
  isSaving: boolean;
  onRefreshWallpaper?: () => void; // 新增属性
}

// ... ICON_MAP 和 IconRender 保持不变 ...
const ICON_MAP: Record<string, string> = {
  "github": "Github", "google": "Search", "twitter": "Twitter", "x.com": "Twitter",
  "youtube": "Youtube", "instagram": "Instagram", "facebook": "Facebook", "vercel": "Triangle",
  "react": "Atom", "vue": "Code", "tailwind": "Wind", "shadcn": "Component",
  "next": "Cpu", "dribbble": "Dribbble", "unsplash": "Image", "figma": "Figma",
  "notion": "FileText", "chatgpt": "Bot", "openai": "Bot", "claude": "MessageSquare",
  "deepseek": "Brain", "bilibili": "Tv", "zhihu": "BookOpen", "mail": "Mail",
  "gmail": "Mail", "outlook": "Mail", "docs": "FileText", "sheet": "Table",
  "steam": "Gamepad2", "discord": "Gamepad2", "twitch": "Twitch", "amazon": "ShoppingBag",
  "taobao": "ShoppingCart", "jd.com": "ShoppingBag", "music": "Music", "spotify": "Music",
  "netflix": "Clapperboard", "docker": "Container", "aws": "Cloud", "azure": "Cloud",
};

const IconRender = ({ name, className }: { name: string; className?: string }) => {
  // @ts-ignore
  const Icon = (Icons[name as keyof typeof Icons] as LucideIcon) || LinkIcon;
  return <Icon className={className} />;
};

export function SettingsDialog({ data, onSave, isSaving, onRefreshWallpaper }: SettingsDialogProps) {
  const [open, setOpen] = useState(false);
  const [localData, setLocalData] = useState<DataSchema>(data);
  
  const [newUrl, setNewUrl] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newIcon, setNewIcon] = useState("Link");
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set());

  const [ghConfig, setGhConfig] = useLocalStorage<GithubConfig>(GITHUB_CONFIG_KEY, {
    token: "", owner: "", repo: "", branch: "main", path: "public/data.json"
  });

  useEffect(() => {
    if (open) setLocalData(data);
  }, [open, data]);

  // ... (toggleCollapse, handleSmartIdentify, handleAddLink, handleDeleteLink, handleSave 逻辑保持不变) ...
  const toggleCollapse = (catId: string) => {
    const newSet = new Set(collapsedCats);
    if (newSet.has(catId)) newSet.delete(catId);
    else newSet.add(catId);
    setCollapsedCats(newSet);
  };

  const handleSmartIdentify = () => {
    if (!newUrl) return toast.error("请先输入 URL");
    let processedUrl = newUrl.startsWith("http") ? newUrl : `https://${newUrl}`;
    setNewUrl(processedUrl);
    try {
      const urlObj = new URL(processedUrl);
      const hostname = urlObj.hostname.toLowerCase();
      let matchedIcon = "Link";
      for (const key in ICON_MAP) {
        if (hostname.includes(key)) { matchedIcon = ICON_MAP[key]; break; }
      }
      setNewIcon(matchedIcon);
      if (!newTitle) {
        let name = hostname.replace(/^www\./, "");
        const parts = name.split(".");
        name = parts.length > 2 ? parts[parts.length - 2] : parts[0];
        setNewTitle(name.charAt(0).toUpperCase() + name.slice(1));
      }
      toast.success("已智能填充信息");
    } catch (e) { toast.error("URL 格式不正确"); }
  };

  const handleAddLink = () => {
    if (!newUrl || !newTitle || !newCategory) return toast.error("请填写完整信息");
    const newData = { ...localData };
    let categoryIndex = newData.categories.findIndex(c => c.title === newCategory);
    if (categoryIndex === -1) {
      newData.categories.push({ id: `c-${Date.now()}`, title: newCategory, links: [] });
      categoryIndex = newData.categories.length - 1;
    }
    newData.categories[categoryIndex].links.push({ id: `l-${Date.now()}`, title: newTitle, url: newUrl, icon: newIcon });
    setLocalData(newData);
    setNewUrl(""); setNewTitle(""); setNewIcon("Link");
    toast.success("添加成功");
  };

  const handleDeleteLink = (catId: string, linkId: string) => {
    const newData = { ...localData };
    const catIndex = newData.categories.findIndex(c => c.id === catId);
    if (catIndex === -1) return;
    newData.categories[catIndex].links = newData.categories[catIndex].links.filter(l => l.id !== linkId);
    if (newData.categories[catIndex].links.length === 0) newData.categories.splice(catIndex, 1);
    setLocalData(newData);
  };

  const handleSave = async () => {
    const finalData = {
      ...localData,
      settings: {
        ...localData.settings,
        wallpaperList: localData.settings.wallpaperList || []
      }
    };
    await onSave(finalData);
    setOpen(false);
  };

  const existingCategories = Array.from(new Set(localData.categories.map(c => c.title)));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="fixed bottom-4 right-4 z-50 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-md shadow-lg">
          <Settings className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] flex flex-col bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl overflow-hidden">
        <DialogHeader>
          <DialogTitle>设置</DialogTitle>
          <DialogDescription>管理导航、外观及同步。</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="links" className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-3 shrink-0">
            <TabsTrigger value="links">链接管理</TabsTrigger>
            <TabsTrigger value="general">外观设置</TabsTrigger>
            <TabsTrigger value="github">云同步</TabsTrigger>
          </TabsList>

          <TabsContent value="links" className="flex-1 flex flex-col min-h-0 gap-4 py-4">
            {/* Input Area */}
            <div className="grid gap-4 p-4 border rounded-xl bg-muted/30 shrink-0">
              <div className="grid grid-cols-12 gap-3 items-end">
                <div className="col-span-12 sm:col-span-6 space-y-1.5">
                  <Label className="text-xs">URL</Label>
                  <div className="flex gap-2">
                    <Input placeholder="example.com" value={newUrl} onChange={e => setNewUrl(e.target.value)} className="h-9" />
                    <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={handleSmartIdentify} title="智能识别标题和图标">
                      <Wand2 className="h-4 w-4 text-purple-500" />
                    </Button>
                  </div>
                </div>
                <div className="col-span-12 sm:col-span-6 space-y-1.5">
                  <Label className="text-xs">标题</Label>
                  <div className="relative">
                    <Input placeholder="标题" value={newTitle} onChange={e => setNewTitle(e.target.value)} className="h-9 pl-9" />
                    <div className="absolute left-2.5 top-2 opacity-70"><IconRender name={newIcon} className="h-5 w-5" /></div>
                  </div>
                </div>
                <div className="col-span-8 sm:col-span-9 space-y-1.5">
                  <Label className="text-xs">分类</Label>
                  <Input list="cats" placeholder="选择或输入" value={newCategory} onChange={e => setNewCategory(e.target.value)} className="h-9" />
                  <datalist id="cats">{existingCategories.map(c => <option key={c} value={c} />)}</datalist>
                </div>
                <div className="col-span-4 sm:col-span-3">
                  <Button onClick={handleAddLink} className="w-full h-9"><Plus className="h-4 w-4 mr-1" /> 添加</Button>
                </div>
              </div>
            </div>

            {/* List Area */}
            <div className="flex-1 border rounded-xl bg-muted/10 overflow-y-auto min-h-0 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-muted-foreground/20 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/40">
              <div className="space-y-4 p-4">
                {localData.categories.map((cat) => {
                  const isCollapsed = collapsedCats.has(cat.id);
                  return (
                    <div key={cat.id} className="space-y-1">
                      <div className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/50 cursor-pointer select-none group sticky top-0 bg-background/50 backdrop-blur-sm z-10" onClick={() => toggleCollapse(cat.id)}>
                        <div className="text-muted-foreground transition-transform duration-200">{isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</div>
                        <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                          <FolderOpen className="h-3.5 w-3.5" /> <span>{cat.title}</span><span className="text-[10px] opacity-60 font-normal ml-1">({cat.links.length})</span>
                        </div>
                        <div className="ml-auto opacity-0 group-hover:opacity-100 text-[10px] text-muted-foreground">{isCollapsed ? "展开" : "折叠"}</div>
                      </div>
                      {!isCollapsed && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pl-6 animate-in fade-in slide-in-from-top-1 duration-200">
                          {cat.links.map((link) => (
                            <div key={link.id} className="flex items-center justify-between p-2 rounded-lg bg-card border border-border/40 hover:border-border hover:shadow-sm transition-all group">
                              <div className="flex items-center gap-3 overflow-hidden">
                                <div className="p-1.5 rounded-md bg-muted/50 text-foreground/70 shrink-0"><IconRender name={link.icon || "Link"} className="h-4 w-4" /></div>
                                <div className="flex flex-col min-w-0"><span className="text-sm font-medium truncate">{link.title}</span><span className="text-[10px] text-muted-foreground truncate opacity-70">{new URL(link.url).hostname}</span></div>
                              </div>
                              <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => handleDeleteLink(cat.id, link.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="general" className="space-y-6 py-4 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-muted-foreground/20 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/40">
            <div className="space-y-2">
              <Label>网站标题</Label>
              <Input value={localData.settings.title} onChange={e => setLocalData({...localData, settings: {...localData.settings, title: e.target.value}})} />
            </div>
            <div className="space-y-3 border border-border/50 p-4 rounded-xl bg-muted/30">
              <Label>壁纸模式</Label>
              <div className="flex gap-2">
                {(['url', 'local', 'bing'] as const).map(mode => (
                  <Button key={mode} variant={localData.settings.wallpaperType === mode ? "default" : "outline"} size="sm" onClick={() => setLocalData({...localData, settings: {...localData.settings, wallpaperType: mode}})} className="flex-1 capitalize">
                    {mode === 'url' ? 'URL' : mode === 'local' ? '本地' : 'Bing'}
                  </Button>
                ))}
              </div>
              {localData.settings.wallpaperType === 'url' && (
                <div className="space-y-2 animate-in fade-in"><Label>链接</Label><Input value={localData.settings.wallpaper} onChange={e => setLocalData({...localData, settings: {...localData.settings, wallpaper: e.target.value}})} /></div>
              )}
              {/* Local Mode: Simplified UI */}
              {localData.settings.wallpaperType === 'local' && (
                <div className="space-y-3 animate-in fade-in pt-1">
                  <div className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-background/50">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-md bg-muted text-muted-foreground"><ImageIcon className="h-4 w-4" /></div>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">自动扫描</span>
                        <span className="text-xs text-muted-foreground">共加载 {localData.settings.wallpaperList?.length || 0} 张壁纸</span>
                      </div>
                    </div>
                    <Button size="sm" variant="secondary" onClick={onRefreshWallpaper} title="随机切换一张本地壁纸">
                      <Shuffle className="h-3.5 w-3.5 mr-1.5" /> 随机切换
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground px-1">
                    * 将图片放入 <code className="bg-muted px-1 py-0.5 rounded">public/wallpapers</code> 目录并重启服务即可自动加载。
                  </p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="github" className="space-y-4 py-4 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-muted-foreground/20 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/40">
            <div className="space-y-2"><Label>Token</Label><Input type="password" value={ghConfig.token} onChange={e => setGhConfig({...ghConfig, token: e.target.value})} placeholder="ghp_..." /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>用户名</Label><Input value={ghConfig.owner} onChange={e => setGhConfig({...ghConfig, owner: e.target.value})} placeholder="GitHub Username" /></div>
              <div className="space-y-2"><Label>仓库名</Label><Input value={ghConfig.repo} onChange={e => setGhConfig({...ghConfig, repo: e.target.value})} placeholder="Repository Name" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2"><Label>分支</Label><Input value={ghConfig.branch || ""} onChange={e => setGhConfig({...ghConfig, branch: e.target.value})} placeholder="main" /></div>
              <div className="space-y-2"><Label>文件路径</Label><Input value={ghConfig.path} onChange={e => setGhConfig({...ghConfig, path: e.target.value})} placeholder="public/data.json" /></div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button onClick={handleSave} disabled={isSaving}>{isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}保存并更新</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}