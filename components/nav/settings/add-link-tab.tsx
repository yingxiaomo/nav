import React, { useState, ChangeEvent } from "react";
import { DataSchema, Category, LinkItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Wand2, Plus, FolderPlus, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { IconRender, PRESET_ICONS } from "./shared";
import {
  isValidUrl,
  isValidFolderName,
  isValidImageFile,
  isValidFileSize,
  sanitizeText
} from "@/lib/utils/validation";
import { convertToWebP } from "@/lib/utils/image-utils";

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
  const [isUploadingIcon, setIsUploadingIcon] = useState(false);
  const [iconUploadProgress, setIconUploadProgress] = useState(0);
  const existingCategories = Array.from(new Set(localData.categories.map(c => c.title)));
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const handleSmartIdentify = (rawUrl: string, isAuto: boolean = false) => {
    if (!rawUrl) {
      if (!isAuto) toast.error("请先输入 URL", { description: "请输入要添加的链接地址" });
      return;
    }

    const processedUrl = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`;
    
    if (!isAuto) {
        setNewUrl(processedUrl);
    }
    
    if (!isValidUrl(processedUrl)) {
        if (!isAuto) toast.error("URL 格式不正确", { description: "请输入有效的 URL 地址，如 https://example.com" });
        return;
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
      
      if (!isAuto) toast.success("已刷新标题和图标", { description: "已从 URL 中提取并更新标题和图标" });

    } catch { 
        if (!isAuto) toast.error("URL 格式不正确", { description: "请输入有效的 URL 地址，如 https://example.com" }); 
    }
  };

  const handleConfirmCreateFolder = () => {
    const sanitizedFolderName = sanitizeText(newFolderName.trim());
    if (!isValidFolderName(sanitizedFolderName)) {
      return toast.error("文件夹名称无效", { 
        description: "文件夹名称不能为空，长度限制1-50字符，且不能包含特殊字符（<>:\"/\\|?*）"
      });
    }
    const newData = { ...localData };
    if (newData.categories.some(c => c.title === sanitizedFolderName)) {
        return toast.error("该文件夹已存在", { description: "请使用不同的文件夹名称" });
    }
    newData.categories.push({ id: `c-${Date.now()}`, title: sanitizedFolderName, icon: "FolderOpen", links: [] });
    setLocalData(newData);
    setNewCategory(sanitizedFolderName); 
    setIsCreatingFolder(false);
    setNewFolderName("");
    toast.success("文件夹创建成功", { description: `已创建文件夹: ${sanitizedFolderName}` });
  };

  // 图标上传处理函数
  const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 检查文件类型
    if (!isValidImageFile(file)) {
      return toast.error("请选择图片文件", { description: "支持的图片格式：JPG、PNG、GIF、SVG等" });
    }

    // 检查文件大小（限制为2MB）
    if (!isValidFileSize(file, 2)) {
      return toast.error("文件大小超过限制", { description: "图片大小不能超过2MB" });
    }

    setIsUploadingIcon(true);
    setIconUploadProgress(0);

    try {
      // 先将图片转换为WebP格式，然后再转换为Base64
      setIconUploadProgress(10);
      
      // 转换为WebP格式
      const webpFile = await convertToWebP(file);
      setIconUploadProgress(50);
      
      // 使用 FileReader 将WebP图片转换为 Base64 格式
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64Data = event.target?.result as string;
        setNewIcon(base64Data);
        setIconUploadProgress(100);
        toast.success("图标上传成功", { description: "已转换为WebP格式并设置为当前链接的图标" });
      };

      // 模拟上传进度
      let progress = 50;
      const progressInterval = setInterval(() => {
        progress += 5;
        if (progress < 90) {
          setIconUploadProgress(progress);
        }
      }, 100);

      reader.onloadend = () => {
        clearInterval(progressInterval);
        setIsUploadingIcon(false);
      };

      reader.readAsDataURL(webpFile);
    } catch (error) {
      console.error("Icon upload error:", error);
      toast.error("图标上传失败", { description: "请重试或选择其他图标" });
      setIsUploadingIcon(false);
    }
  };

  const handleAddLink = () => {
    // 净化和验证输入
    const sanitizedTitle = sanitizeText(newTitle.trim());
    const sanitizedCategory = sanitizeText(newCategory.trim());
    const sanitizedUrl = newUrl.trim();
    
    if (!sanitizedUrl || !sanitizedTitle || !sanitizedCategory) {
      return toast.error("请填写完整信息", { description: "请填写URL、标题和选择分类" });
    }
    
    // 验证URL格式
    const finalUrl = sanitizedUrl.startsWith("http") ? sanitizedUrl : `https://${sanitizedUrl}`;
    if (!isValidUrl(finalUrl)) {
      return toast.error("URL格式不正确", { description: "请输入有效的URL地址，如 https://example.com" });
    }
    
    // 验证分类名称
    if (!isValidFolderName(sanitizedCategory)) {
      return toast.error("分类名称无效", { 
        description: "分类名称不能为空，长度限制1-50字符，且不能包含特殊字符（<>:\"/\\|?*）"
      });
    }
    
    const newData = { ...localData };
    let categoryIndex = newData.categories.findIndex(c => c.title === sanitizedCategory);
    if (categoryIndex === -1) {
      newData.categories.push({ id: `c-${Date.now()}`, title: sanitizedCategory, icon: "FolderOpen", links: [] });
      categoryIndex = newData.categories.length - 1;
    }
    
    newData.categories[categoryIndex].links.push({ 
      id: `l-${Date.now()}`, 
      title: sanitizedTitle, 
      url: finalUrl, 
      icon: newIcon 
    });
    
    setLocalData(newData);
    setNewUrl(""); 
    setNewTitle(""); 
    setNewIcon("Link");
    toast.success("链接添加成功", { description: `已将 "${sanitizedTitle}" 添加到 "${sanitizedCategory}" 分类` });
  };

  const handleBookmarkImport = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const content = e.target?.result as string;
        if (!content) {
            toast.error("无法读取文件内容", { description: "请确保文件格式正确且可以正常读取" });
            return;
        }
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(content, "text/html");
            const newCategories: Category[] = [];
            let totalLinks = 0;
            let totalFolders = 0;

            const parseBookmarks = (dl: Element): LinkItem[] => {
                const items: LinkItem[] = [];
                const children = Array.from(dl.children);
                
                for (let i = 0; i < children.length; i++) {
                    const node = children[i];
                    
                    if (node.tagName === 'DT') {
                        const h3 = node.querySelector('h3');
                        const a = node.querySelector('a');
                        
                        if (h3) {
                            const folderTitle = h3.innerText;
                            let childItems: LinkItem[] = [];
                            let itemsDl = node.querySelector('dl');

                            if (!itemsDl) {
                                let next = node.nextElementSibling;
                                while (next && next.tagName !== 'DT' && next.tagName !== 'DL') {
                                    next = next.nextElementSibling;
                                }
                                if (next && next.tagName === 'DL') {
                                    itemsDl = next as HTMLDListElement;
                                }
                            }
                            
                            if (itemsDl) {
                                childItems = parseBookmarks(itemsDl);
                            }

                            items.push({
                                id: `f-${Date.now()}-${Math.random()}`,
                                title: folderTitle,
                                url: "",
                                icon: "FolderOpen",
                                type: 'folder',
                                children: childItems
                            });
                            totalFolders++;
                        } else if (a) {
                            items.push({
                                id: `l-${Date.now()}-${Math.random()}`,
                                title: a.innerText,
                                url: a.href,
                                icon: `https://www.google.com/s2/favicons?domain=${new URL(a.href).hostname}&sz=128`,
                                type: 'link'
                            });
                            totalLinks++;
                        }
                    }
                }
                return items;
            };

            const bodyDl = doc.querySelector('body > dl') || doc.querySelector('dl');
            
            if (bodyDl) {
                const rootItems = parseBookmarks(bodyDl);
                
                const looseLinks: LinkItem[] = [];
                
                for (const item of rootItems) {
                    if (item.type === 'folder' && item.children) {
                        newCategories.push({
                            id: `c-${Date.now()}-${Math.random()}`,
                            title: item.title,
                            icon: "FolderOpen",
                            links: item.children
                        });
                    } else {
                        looseLinks.push(item);
                    }
                }

                if (looseLinks.length > 0) {
                    newCategories.push({
                        id: `c-${Date.now()}-${Math.random()}`,
                        title: "导入的书签",
                        icon: "FolderDown",
                        links: looseLinks
                    });
                }
            }

            if (newCategories.length > 0) {
                setLocalData(prevData => ({
                    ...prevData,
                    categories: [...prevData.categories, ...newCategories],
                }));
                toast.success(`成功导入 ${newCategories.length} 个顶级文件夹（共 ${totalFolders} 个文件夹）和 ${totalLinks} 个链接！`);
            } else {
                toast.warning("没有找到可以导入的书签或文件夹。请确认文件格式是否正确。");
            }
        } catch (error) {
            console.error(error);
            toast.error("解析书签文件失败", { description: "请确保是浏览器导出的 HTML 格式书签文件" });
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
                                <DropdownMenuContent align="end" className="w-[300px] h-[350px] overflow-y-auto">
                                    {/* 自定义图标上传区域 */}
                                    <div className="border-b border-border/50 p-2">
                                      <h4 className="text-xs font-medium mb-2">自定义图标</h4>
                                      <div className="flex flex-col gap-2">
                                        {/* 文件上传输入 */}
                                        <input
                                          type="file"
                                          ref={fileInputRef}
                                          className="hidden"
                                          accept="image/*"
                                          onChange={handleIconUpload}
                                        />
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="w-full gap-2 text-xs"
                                          onClick={() => fileInputRef.current?.click()}
                                          disabled={isUploadingIcon}
                                        >
                                          {isUploadingIcon ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                                          {isUploadingIcon ? "上传中..." : "上传自定义图标"}
                                        </Button>
                                        
                                        {/* 上传进度条 */}
                                        {isUploadingIcon && (
                                          <div className="w-full space-y-1">
                                            <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                                              <span>上传进度</span>
                                              <span>{iconUploadProgress}%</span>
                                            </div>
                                            <div className="h-1 bg-muted rounded-full overflow-hidden">
                                              <div
                                                className="h-full bg-primary rounded-full transition-all duration-200 ease-out"
                                                style={{ width: `${iconUploadProgress}%` }}
                                              />
                                            </div>
                                          </div>
                                        )}
                                        
                                        {/* 说明文字 */}
                                        <p className="text-[10px] text-muted-foreground">
                                          支持 JPG、PNG、WEBP 格式，大小不超过 2MB
                                        </p>
                                      </div>
                                    </div>
                                    
                                    {/* 预设图标列表 */}
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