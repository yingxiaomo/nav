import { useState, ChangeEvent } from "react";
import { DataSchema, Category, LinkItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Wand2, Plus, FolderPlus, Upload } from "lucide-react";
import { toast } from "sonner";
import { IconRender, PRESET_ICONS } from "./shared";

interface AddLinkTabProps {
  localData: DataSchema;
  setLocalData: React.Dispatch<React.SetStateAction<DataSchema>>;
}

export function AddLinkTab({ localData, setLocalData }: AddLinkTabProps) {
  const [newUrl, setNewUrl] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newIcon, setNewIcon] = useState("Link");
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const existingCategories = Array.from(new Set(localData.categories.map(c => c.title)));
  const handleSmartIdentify = (rawUrl: string, isAuto: boolean = false) => {
    if (!rawUrl) {
      if (!isAuto) toast.error("请先输入 URL");
      return;
    }

    let processedUrl = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`;
    
    if (!isAuto) {
        setNewUrl(processedUrl);
    }
    
    try {
      const urlObj = new URL(processedUrl);
      const hostname = urlObj.hostname;
      
      const iconUrl = `https://www.google.com/s2/favicons?domain=${hostname}&sz=128`;
      setNewIcon(iconUrl);

      let name = hostname.replace(/^www\./, "").split(".")[0];
      if (name) {
          name = name.charAt(0).toUpperCase() + name.slice(1);
          setNewTitle(name);
      }
      
      if (!isAuto) toast.success("已刷新标题和图标");

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
    newData.categories.push({ id: `c-${Date.now()}`, title: newFolderName, icon: "FolderOpen", links: [] });
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
    const finalUrl = newUrl.startsWith("http") ? newUrl : `https://${newUrl}`;
    
    newData.categories[categoryIndex].links.push({ id: `l-${Date.now()}`, title: newTitle, url: finalUrl, icon: newIcon });
    setLocalData(newData);
    setNewUrl(""); setNewTitle(""); setNewIcon("Link");
    toast.success("链接添加成功");
  };

  const handleBookmarkImport = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const content = e.target?.result as string;
        if (!content) {
            toast.error("无法读取文件内容");
            return;
        }
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(content, "text/html");
            const newCategories: Category[] = [];
            let totalLinks = 0;

            const parseDl = (dl: HTMLDListElement, parentTitle?: string) => {
                const categories: Category[] = [];
                let currentLinks: LinkItem[] = [];
                let currentCategoryTitle = parentTitle || "导入的书签";
                
                for (const child of Array.from(dl.children)) {
                    if (child.tagName === 'DT') {
                        const h3 = child.querySelector('h3');
                        const a = child.querySelector('a');
                        if (h3) { 
                            const nextDl = child.nextElementSibling;
                            if (nextDl && nextDl.tagName === 'DL') {
                                categories.push(...parseDl(nextDl as HTMLDListElement, h3.innerText));
                            }
                        } else if (a) { 
                            currentLinks.push({
                                id: `l-${Date.now()}-${Math.random()}`,
                                title: a.innerText,
                                url: a.href,
                                icon: `https://www.google.com/s2/favicons?domain=${new URL(a.href).hostname}&sz=128`,
                            });
                            totalLinks++;
                        }
                    }
                }
                if (currentLinks.length > 0) {
                    categories.push({
                        id: `c-${Date.now()}-${Math.random()}`,
                        title: currentCategoryTitle,
                        icon: "FolderDown",
                        links: currentLinks,
                    });
                }
                return categories;
            };

            const bodyDl = doc.querySelector('body > dl');
            if (bodyDl instanceof HTMLDListElement) {
                newCategories.push(...parseDl(bodyDl));
            }

            if (newCategories.length > 0) {
                setLocalData(prevData => ({
                    ...prevData,
                    categories: [...prevData.categories, ...newCategories],
                }));
                toast.success(`成功导入 ${newCategories.length} 个分类和 ${totalLinks} 个链接！`);
            } else {
                toast.warning("没有找到可以导入的书签或文件夹。");
            }
        } catch (error) {
            console.error(error);
            toast.error("解析书签文件失败，请确保是正确的 HTML 文件。");
        }
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 gap-6 py-4 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-muted-foreground/20 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/40">
      <div className="space-y-4">
        <div className="flex items-center gap-2 px-1">
            <div className="h-1 w-1 rounded-full bg-primary/50" />
            <h3 className="text-sm font-medium text-muted-foreground">添加新链接</h3>
        </div>
        <div className="p-5 border rounded-xl bg-muted/30 shadow-sm">
            <div className="flex flex-col gap-5">
                <div className="space-y-2">
                    <Label className="text-xs font-medium">URL (支持自动识别)</Label>
                    <div className="flex gap-2">
                        <Input 
                            placeholder="example.com" 
                            value={newUrl} 
                            onChange={e => {
                                const val = e.target.value;
                                setNewUrl(val);
                                handleSmartIdentify(val, true);
                            }} 
                            onBlur={() => handleSmartIdentify(newUrl, true)}
                            className="h-10 bg-background"
                        />
                        <Button variant="outline" size="icon" className="h-10 w-10 shrink-0" onClick={() => handleSmartIdentify(newUrl, false)} title="强制识别标题和图标">
                            <Wand2 className="h-4 w-4 text-purple-500" />
                        </Button>
                    </div>
                </div>

                <div className="space-y-2">
                    <Label className="text-xs font-medium">标题 & 图标</Label>
                    <div className="flex gap-2">
                        <Input placeholder="输入标题" value={newTitle} onChange={e => setNewTitle(e.target.value)} className="h-10 flex-1 bg-background"/>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="icon" className="h-10 w-10 shrink-0 overflow-hidden bg-background" title="选择图标">
                                <IconRender name={newIcon} className="h-5 w-5" />
                            </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-[300px] h-[300px] overflow-y-auto">
                                <div className="grid grid-cols-6 gap-1 p-2">
                                {PRESET_ICONS.map(iconName => (
                                    <Button key={iconName} variant="ghost" size="icon" className="h-9 w-9" onClick={() => setNewIcon(iconName)}>
                                    <IconRender name={iconName} className="h-5 w-5" />
                                    </Button>
                                ))}
                                </div>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                <div className="space-y-2">
                    <Label className="text-xs font-medium">选择分类</Label>
                    <div className="flex gap-2">
                        <Input 
                            list="cats" 
                            placeholder="选择或输入分类名称" 
                            value={newCategory} 
                            onChange={e => setNewCategory(e.target.value)} 
                            className="h-10 flex-1 min-w-0 bg-background"
                        />
                        <datalist id="cats">{existingCategories.map(c => <option key={c} value={c} />)}</datalist>
                        <Button onClick={handleAddLink} className="h-10 px-6 shrink-0 bg-primary text-primary-foreground hover:bg-primary/90">
                            <Plus className="h-4 w-4 mr-1.5" /> 添加链接
                        </Button>
                    </div>
                </div>
                
                <div className="space-y-2 pt-2 border-t border-border/40">
                    <Label className="text-xs font-medium text-muted-foreground">或者创建新文件夹</Label>
                    {!isCreatingFolder ? (
                        <Button 
                            variant="outline" 
                            onClick={() => setIsCreatingFolder(true)} 
                            className="w-full h-10 border-dashed border-muted-foreground/30 hover:border-primary/50 hover:text-primary hover:bg-primary/5 transition-all"
                        >
                            <FolderPlus className="h-4 w-4 mr-2" /> 新建文件夹
                        </Button>
                    ) : (
                        <div className="flex gap-2 animate-in fade-in slide-in-from-left-1 duration-200">
                            <Input 
                                value={newFolderName}
                                onChange={e => setNewFolderName(e.target.value)}
                                placeholder="输入文件夹名称"
                                className="h-10 flex-1 min-w-0 bg-background"
                                autoFocus
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleConfirmCreateFolder();
                                    if (e.key === 'Escape') setIsCreatingFolder(false);
                                }}
                            />
                            <Button className="h-10 px-4 shrink-0" onClick={handleConfirmCreateFolder}>确认</Button>
                            <Button variant="ghost" className="h-10 px-4 shrink-0" onClick={() => setIsCreatingFolder(false)}>取消</Button>
                        </div>
                    )}
                </div>
            </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2 px-1">
            <div className="h-1 w-1 rounded-full bg-primary/50" />
            <h3 className="text-sm font-medium text-muted-foreground">导入书签</h3>
        </div>
        <div className="p-6 border rounded-xl bg-muted/30 border-dashed hover:border-primary/30 transition-colors">
            <Label htmlFor="bookmark-import" className="flex flex-col items-center justify-center gap-3 cursor-pointer py-4 group">
                <div className="p-3 rounded-full bg-background shadow-sm group-hover:scale-110 transition-transform">
                    <Upload className="h-6 w-6 text-primary" />
                </div>
                <div className="text-center space-y-1">
                    <span className="text-sm font-medium">点击导入浏览器书签</span>
                    <p className="text-xs text-muted-foreground">支持 Chrome, Edge, Firefox 导出的 HTML 文件</p>
                </div>
            </Label>
            <Input id="bookmark-import" type="file" accept=".html" onChange={handleBookmarkImport} className="hidden" />
        </div>
      </div>

    </div>
  );
}