import React, { useState, useRef, useEffect } from "react";
import { DataSchema, Category } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Wand2, Plus, FolderPlus } from "lucide-react";
import { toast } from "sonner";
import { IconRender, PRESET_ICONS } from "./shared";
import { generateFaviconUrl, generateId } from "@/lib/utils/common";
import { extractTitleFromUrl } from "@/lib/utils/favicon";
import {
  isValidUrl,
  isValidFolderName,
  sanitizeText
} from "@/lib/utils/validation";
import { STORAGE_CONFIG_KEY, StorageConfig } from "@/lib/adapters/storage";
import { BookmarkImport } from "./bookmark-import";
import { IconUploader } from "@/components/ui/icon-uploader";

interface AddLinkTabProps {
  localData: DataSchema;
  setLocalData: React.Dispatch<React.SetStateAction<DataSchema>>;
  storageConfig?: StorageConfig;
}

export function AddLinkTab({ localData, setLocalData, storageConfig }: AddLinkTabProps) {
  const [newUrl, setNewUrl] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newIcon, setNewIcon] = useState("Link");
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const existingCategories = Array.from(new Set(localData.categories.map(c => c.title)));
  const identifyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleEditedManually = useRef(false);
  
  useEffect(() => {
    return () => {
      if (identifyTimerRef.current) clearTimeout(identifyTimerRef.current);
    };
  }, []);
  
 const handleSmartIdentify = async (rawUrl: string, isAuto: boolean = false) => {
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

    // 如果配置了本地后端，优先使用元数据解析接口
    if (!(isAuto && titleEditedManually.current)) {
      try {
        const configRaw = localStorage.getItem(STORAGE_CONFIG_KEY);
        if (configRaw) {
          const storageConfig = JSON.parse(configRaw);
          if (storageConfig.type === 'api-server' && storageConfig.apiServer?.baseUrl) {
            const baseUrl = storageConfig.apiServer.baseUrl.replace(/\/$/, '');
            const token = storageConfig.apiServer.token;
            const headers: Record<string, string> = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch(`${baseUrl}/api/v1/parse?url=${encodeURIComponent(processedUrl)}`, { headers });
            if (res.ok) {
              const meta = await res.json();
              if (meta.title) setNewTitle(meta.title);
              if (meta.icon) setNewIcon(meta.icon);
              if (!isAuto) toast.success("已从网页获取标题和图标", { description: meta.title || processedUrl });
              if (meta.title) return; // 有标题才跳过客户端降级
            }
          }
        }
      } catch {
        // 后端不可用，降级到客户端识别
      }
    }

    // 降级：客户端 URL 解析（后端未返回标题时也执行）
    try {
      const urlObj = new URL(processedUrl);
      const hostname = urlObj.hostname;

      const iconUrl = generateFaviconUrl(hostname);
      if (!(isAuto && titleEditedManually.current)) {
        setNewIcon(iconUrl);
      }

      if (!(isAuto && titleEditedManually.current)) {
          setNewTitle(extractTitleFromUrl(processedUrl));
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
    const newData = { ...localData, categories: [...localData.categories] };
    if (newData.categories.some(c => c.title === sanitizedFolderName)) {
        return toast.error("该文件夹已存在", { description: "请使用不同的文件夹名称" });
    }
    newData.categories.push({ id: `c-${generateId()}`, title: sanitizedFolderName, icon: "FolderOpen", links: [] });
    setLocalData(newData);
    setNewCategory(sanitizedFolderName); 
    setIsCreatingFolder(false);
    setNewFolderName("");
    toast.success("文件夹创建成功", { description: `已创建文件夹: ${sanitizedFolderName}` });
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
      newData.categories.push({ id: `c-${generateId()}`, title: sanitizedCategory, icon: "FolderOpen", links: [] });
      categoryIndex = newData.categories.length - 1;
    }
    newData.categories[categoryIndex] = {
      ...newData.categories[categoryIndex],
      links: [...newData.categories[categoryIndex].links],
    };
    
      newData.categories[categoryIndex].links.push({ 
        id: `l-${generateId()}`, 
        title: sanitizedTitle, 
        url: finalUrl, 
        icon: newIcon, 
        updatedAt: Date.now() 
      });
    
    setLocalData(newData);
    setNewUrl(""); 
    setNewTitle(""); 
    setNewIcon("Link");
    toast.success("链接添加成功", { description: `已将 "${sanitizedTitle}" 添加到 "${sanitizedCategory}" 分类` });
  };

  const handleImportResult = (categories: Category[]) => {
    setLocalData(prev => ({
      ...prev,
      categories: [...prev.categories, ...categories],
    }));
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 gap-6 py-4 overflow-y-auto custom-scrollbar">
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
                                if (identifyTimerRef.current) clearTimeout(identifyTimerRef.current);
                                identifyTimerRef.current = setTimeout(() => handleSmartIdentify(val, true), 300);
                           }} 
                            onBlur={() => { handleSmartIdentify(newUrl, true); titleEditedManually.current = false; }}
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
                        <Input placeholder="输入标题" value={newTitle} onChange={e => { setNewTitle(e.target.value); titleEditedManually.current = true; }} className="h-10 flex-1 bg-background"/>
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
                                        <IconUploader storageConfig={storageConfig} onIconReady={setNewIcon} />
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

      <BookmarkImport existingCategories={localData.categories} onImport={handleImportResult} />

    </div>
  );
}
