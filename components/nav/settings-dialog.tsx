"use client";

import { useState, useEffect } from "react";
import { Settings, Loader2, Plus, Trash2, FolderOpen, FolderPlus, Link as LinkIcon, ChevronDown, ChevronRight, Wand2, Shuffle, Image as ImageIcon, Check, X as XIcon } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { DataSchema, Category } from "@/lib/types";
import { GithubConfig, GITHUB_CONFIG_KEY } from "@/lib/github";
import { useLocalStorage } from "@/lib/hooks";

interface SettingsDialogProps {
  data: DataSchema;
  onSave: (newData: DataSchema) => Promise<void>;
  isSaving: boolean;
  onRefreshWallpaper?: () => void;
}

const PRESET_ICONS = [
  "Bot", "Brain", "Sparkles", "Cpu", "Microchip", "CircuitBoard", "Binary", "Network", "Workflow", "Radio", "Radar", "Rocket", "Telescope", "Atom",
  "Folder", "FolderOpen", "FolderHeart", "FolderKanban", "FolderGit2", "File", "FileText", "FileCode", "FileJson", "Archive", "Inbox", "Briefcase", "Clipboard", "ClipboardList", "Notebook", "StickyNote", "Paperclip", "Printer", "Projector",
  "Terminal", "Code", "Code2", "Braces", "Database", "Server", "HardDrive", "Cloud", "CloudCog", "Laptop", "Monitor", "Smartphone", "Tablet", "Keyboard", "Mouse", "Bug", "GitBranch", "Command", "Box", "Container", "Blocks",
  "Palette", "PenTool", "Brush", "Eraser", "Image", "ImageIcon", "Camera", "Aperture", "Video", "Film", "Clapperboard", "Music", "Headphones", "Mic", "Speaker", "Play", "Layers", "Component", "Contrast", "Feather",
  "Book", "BookOpen", "Library", "Bookmark", "GraduationCap", "School", "Pencil", "Pen", "Highlighter", "Languages", "Quote", "History",
  "Home", "Building", "Tent", "ShoppingBag", "ShoppingCart", "CreditCard", "Wallet", "PiggyBank", "Gift", "Coffee", "Utensils", "UtensilsCrossed", "Wine", "Beer", "Pizza", "Cookie", "PartyPopper", "Gamepad", "Gamepad2", "Ghost", "Skull", "Dice5", "Ticket",
  "Map", "MapPin", "Navigation", "Compass", "Globe", "Globe2", "Plane", "Car", "Bus", "Train", "Bike", "Ship", "Anchor", "Sun", "Moon", "CloudRain", "Umbrella", "Flame", "Snowflake", "Leaf", "Flower2",
  "Settings", "Wrench", "Hammer", "Construction", "Wifi", "Signal", "Bluetooth", "Battery", "BatteryCharging", "Zap", "Flashlight", "Lock", "Unlock", "Key", "Shield", "Eye", "Bell", "Trash2", "Download", "Upload", "Share2", "Flag", "Star", "Heart", "Trophy", "Crown", "Medal", "Target"
];

const IconRender = ({ name, className }: { name: string; className?: string }) => {
  if (name?.startsWith("http") || name?.startsWith("/")) {
    /* eslint-disable-next-line @next/next/no-img-element */
    return <img src={name} alt="icon" className={`${className} object-contain rounded-sm`} />;
  }
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
  
  // 新建文件夹相关状态
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set());

  const [ghConfig, setGhConfig] = useLocalStorage<GithubConfig>(GITHUB_CONFIG_KEY, {
    token: "", owner: "", repo: "", branch: "main", path: "public/data.json"
  });

  useEffect(() => {
    if (open) {
      setLocalData(data);
      setIsCreatingFolder(false); 
      setNewFolderName("");
    }
  }, [open, data]);

  const toggleCollapse = (catId: string) => {
    const newSet = new Set(collapsedCats);
    if (newSet.has(catId)) newSet.delete(catId);
    else newSet.add(catId);
    setCollapsedCats(newSet);
  };

  const handleSmartIdentify = (isAuto: boolean = false) => {
    if (!newUrl) {
      if (!isAuto) toast.error("请先输入 URL");
      return;
    }

    let processedUrl = newUrl.startsWith("http") ? newUrl : `https://${newUrl}`;
    setNewUrl(processedUrl);
    
    try {
      const urlObj = new URL(processedUrl);
      const hostname = urlObj.hostname;
      
      const iconUrl = `https://www.google.com/s2/favicons?domain=${hostname}&sz=128`;
      setNewIcon(iconUrl);

      if (!newTitle || !isAuto) {
        let name = hostname.replace(/^www\./, "").split(".")[0];
        if (name) {
            name = name.charAt(0).toUpperCase() + name.slice(1);
            setNewTitle(name);
        }
        toast.success(isAuto ? "已自动识别信息" : "已刷新标题和图标");
      }
    } catch (e) { 
        if (!isAuto) toast.error("URL 格式不正确"); 
    }
  };

  const handleConfirmCreateFolder = () => {
    if (!newFolderName.trim()) return toast.error("请输入文件夹名称");
    
    const newData = { ...localData };
    if (newData.categories.some(c => c.title === newFolderName)) {
        return toast.error("该文件夹已存在");
    }

    newData.categories.push({ 
        id: `c-${Date.now()}`, 
        title: newFolderName, 
        icon: "FolderOpen", 
        links: [] 
    });
    
    setLocalData(newData);
    setNewCategory(newFolderName); 
    
    setIsCreatingFolder(false);
    setNewFolderName("");
    toast.success("文件夹创建成功");
  };

  const handleAddLink = () => {
    if (!newUrl || !newTitle || !newCategory) return toast.error("请填写完整信息");
    const newData = { ...localData };
    let categoryIndex = newData.categories.findIndex(c => c.title === newCategory);
    
    if (categoryIndex === -1) {
      newData.categories.push({ id: `c-${Date.now()}`, title: newCategory, icon: "FolderOpen", links: [] });
      categoryIndex = newData.categories.length - 1;
    }
    
    newData.categories[categoryIndex].links.push({ id: `l-${Date.now()}`, title: newTitle, url: newUrl, icon: newIcon });
    setLocalData(newData);
    setNewUrl(""); setNewTitle(""); setNewIcon("Link");
    toast.success("链接添加成功");
  };

  const handleDeleteLink = (catId: string, linkId: string) => {
    const newData = { ...localData };
    const catIndex = newData.categories.findIndex(c => c.id === catId);
    if (catIndex === -1) return;
    newData.categories[catIndex].links = newData.categories[catIndex].links.filter(l => l.id !== linkId);
    setLocalData(newData);
  };

  const handleCategoryIconChange = (catId: string, icon: string) => {
    const newData = { ...localData };
    const catIndex = newData.categories.findIndex(c => c.id === catId);
    if (catIndex === -1) return;
    newData.categories[catIndex].icon = icon;
    setLocalData(newData);
  };

  const handleDeleteCategory = (catId: string) => {
    const newData = { ...localData };
    const catIndex = newData.categories.findIndex(c => c.id === catId);
    if (catIndex === -1) return;
    if (newData.categories[catIndex].links.length > 0) {
        if (!confirm("该分类下还有链接，确定要删除吗？")) return;
    }
    newData.categories.splice(catIndex, 1);
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
            <div className="grid gap-4 p-4 border rounded-xl bg-muted/30 shrink-0">
              <div className="grid grid-cols-12 gap-3 items-end">
                {/* 1. URL Row */}
                <div className="col-span-12 sm:col-span-6 space-y-1.5">
                  <Label className="text-xs">URL (自动识别)</Label>
                  <div className="flex gap-2">
                    <Input 
                      placeholder="example.com" 
                      value={newUrl} 
                      onChange={e => setNewUrl(e.target.value)} 
                      onBlur={() => handleSmartIdentify(true)} 
                      className="h-9" 
                    />
                    <Button 
                      variant="outline" 
                      size="icon" 
                      className="h-9 w-9 shrink-0" 
                      onClick={() => handleSmartIdentify(false)} 
                      title="强制识别标题和图标"
                    >
                      <Wand2 className="h-4 w-4 text-purple-500" />
                    </Button>
                  </div>
                </div>

                {/* 2. Title & Icon Row */}
                <div className="col-span-12 sm:col-span-6 space-y-1.5">
                  <Label className="text-xs">标题 & 图标</Label>
                  <div className="flex gap-2">
                    <Input 
                      placeholder="标题" 
                      value={newTitle} 
                      onChange={e => setNewTitle(e.target.value)} 
                      className="h-9 flex-1" 
                    />
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 overflow-hidden" title="选择图标">
                          <IconRender name={newIcon} className="h-5 w-5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-[540px] h-[400px] overflow-y-auto">
                           <div className="grid grid-cols-10 gap-1 p-2">
                             {PRESET_ICONS.map(iconName => (
                               <Button
                                 key={iconName}
                                 variant="ghost"
                                 size="icon"
                                 className="h-10 w-10 hover:bg-muted"
                                 onClick={() => setNewIcon(iconName)}
                                 title={iconName}
                               >
                                 <IconRender name={iconName} className="h-5 w-5" />
                               </Button>
                             ))}
                           </div>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* 3. Category & Add Row - Modified Layout (6+6) */}
                
                {/* 左侧：选择分类 + 添加链接 (占一半) */}
                <div className="col-span-12 sm:col-span-6 space-y-1.5">
                  <Label className="text-xs">添加到分类</Label>
                  <div className="flex gap-2">
                    <Input 
                      list="cats" 
                      placeholder="选择或输入分类" 
                      value={newCategory} 
                      onChange={e => setNewCategory(e.target.value)} 
                      className="h-9 flex-1 min-w-0" // min-w-0 防止被挤压
                    />
                    <datalist id="cats">{existingCategories.map(c => <option key={c} value={c} />)}</datalist>
                    
                    <Button onClick={handleAddLink} className="h-9 px-4 shrink-0 whitespace-nowrap">
                      <Plus className="h-4 w-4 mr-1" /> 添加链接
                    </Button>
                  </div>
                </div>

                {/* 右侧：新建文件夹 (占一半，与上方对齐) */}
                <div className="col-span-12 sm:col-span-6 space-y-1.5">
                   <Label className="text-xs">新建分类</Label>
                   
                   {!isCreatingFolder ? (
                       <Button 
                           variant="outline" 
                           onClick={() => setIsCreatingFolder(true)}
                           className="w-full h-9 border-dashed hover:border-solid hover:bg-muted/50"
                       >
                           <FolderPlus className="h-4 w-4 mr-2" /> 新建文件夹
                       </Button>
                   ) : (
                       <div className="flex gap-1 animate-in fade-in slide-in-from-right-2 duration-200">
                           <Input 
                               value={newFolderName}
                               onChange={e => setNewFolderName(e.target.value)}
                               placeholder="文件夹名"
                               className="h-9 flex-1 min-w-0"
                               autoFocus
                               onKeyDown={(e) => {
                                   if (e.key === 'Enter') handleConfirmCreateFolder();
                                   if (e.key === 'Escape') setIsCreatingFolder(false);
                               }}
                           />
                           <Button size="icon" className="h-9 w-9 shrink-0" onClick={handleConfirmCreateFolder}>
                               <Check className="h-4 w-4" />
                           </Button>
                           <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0" onClick={() => setIsCreatingFolder(false)}>
                               <XIcon className="h-4 w-4" />
                           </Button>
                       </div>
                   )}
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
                      <div 
                        className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/50 cursor-pointer select-none group sticky top-0 bg-background/50 backdrop-blur-sm z-10"
                        onClick={() => toggleCollapse(cat.id)}
                      >
                        <div className="text-muted-foreground transition-transform duration-200">
                          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </div>
                        
                        <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider flex-1">
                          <div onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-6 w-6 p-0 hover:bg-muted-foreground/20">
                                  <IconRender name={cat.icon || "FolderOpen"} className="h-3.5 w-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start" className="w-[540px] h-[400px] overflow-y-auto">
                                <div className="grid grid-cols-10 gap-1 p-2">
                                  {PRESET_ICONS.map(iconName => (
                                    <Button key={iconName} variant="ghost" size="icon" className="h-10 w-10 hover:bg-muted" onClick={() => handleCategoryIconChange(cat.id, iconName)} title={iconName}>
                                      <IconRender name={iconName} className="h-5 w-5" />
                                    </Button>
                                  ))}
                                </div>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                          
                          <span>{cat.title}</span>
                          <span className="text-[10px] opacity-60 font-normal ml-1">({cat.links.length})</span>
                        </div>

                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteCategory(cat.id);
                            }}
                            title="删除分类"
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>

                      {!isCollapsed && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pl-6 animate-in fade-in slide-in-from-top-1 duration-200">
                          {cat.links.map((link) => (
                            <div key={link.id} className="flex items-center justify-between p-2 rounded-lg bg-card border border-border/40 hover:border-border hover:shadow-sm transition-all group">
                              <div className="flex items-center gap-3 overflow-hidden">
                                <div className="p-1.5 rounded-md bg-muted/50 text-foreground/70 shrink-0 flex items-center justify-center">
                                  <IconRender name={link.icon || "Link"} className="h-4 w-4" />
                                </div>
                                <div className="flex flex-col min-w-0"><span className="text-sm font-medium truncate">{link.title}</span><span className="text-[10px] text-muted-foreground truncate opacity-70">{new URL(link.url).hostname}</span></div>
                              </div>
                              <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => handleDeleteLink(cat.id, link.id)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ))}
                          {cat.links.length === 0 && (
                              <div className="col-span-full py-4 text-center text-xs text-muted-foreground italic border border-dashed rounded-lg">
                                  暂无链接，请添加
                              </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </TabsContent>

          {/* ... General and Github Tabs same as before ... */}
          <TabsContent value="general" className="space-y-6 py-4 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-muted-foreground/20 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/40">
            <div className="space-y-2">
              <Label>网站标题</Label>
              <Input value={localData.settings.title} onChange={e => setLocalData({...localData, settings: {...localData.settings, title: e.target.value}})} />
            </div>
            <div className="space-y-3 border border-border/50 p-4 rounded-xl bg-muted/30">
              <Label>壁纸模式</Label>
              <div className="flex gap-2">
                {(['local', 'custom', 'bing'] as const).map(mode => (
                  <Button 
                    key={mode} 
                    variant={localData.settings.wallpaperType === mode ? "default" : "outline"} 
                    size="sm" 
                    onClick={() => setLocalData({...localData, settings: {...localData.settings, wallpaperType: mode}})} 
                    className="flex-1 capitalize"
                  >
                    {mode === 'local' ? '本地' : mode === 'custom' ? '自定义 API' : 'Bing'}
                  </Button>
                ))}
              </div>

              {localData.settings.wallpaperType === 'custom' && (
                <div className="space-y-2 animate-in fade-in">
                    <Label>API 地址</Label>
                    <Input 
                        value={localData.settings.wallpaper} 
                        onChange={e => setLocalData({...localData, settings: {...localData.settings, wallpaper: e.target.value}})} 
                        placeholder="例如: https://source.unsplash.com/random/1920x1080"
                    />
                </div>
              )}

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