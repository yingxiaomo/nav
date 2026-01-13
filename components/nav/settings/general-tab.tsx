import { DataSchema } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch" 
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImageIcon, Shuffle, Layers, Upload, Loader2, Sun, Moon, Monitor } from "lucide-react"; 
import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";

interface GeneralTabProps {
  localData: DataSchema;
  setLocalData: React.Dispatch<React.SetStateAction<DataSchema>>;
  onRefreshWallpaper?: () => void;
  onSave?: (data: DataSchema) => Promise<void>; 
  uploadWallpaper?: (file: File, onProgress?: (progress: number) => void) => Promise<string>;
}

export function GeneralTab({ localData, setLocalData, onRefreshWallpaper, onSave, uploadWallpaper }: GeneralTabProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!uploadWallpaper) {
      toast.error("当前存储配置不支持上传", {
        description: "请先配置支持上传的存储方式",
        duration: 4000
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setUploadStatus("正在准备上传...");
    
    try {
      const url = await uploadWallpaper(file, (progress) => {
        setUploadProgress(progress);
        if (progress < 5) {
          setUploadStatus("正在初始化连接...");
        } else if (progress < 95) {
          setUploadStatus(`正在上传文件... ${Math.round(progress)}%`);
        } else {
          setUploadStatus("正在处理文件...");
        }
      });
      
      setUploadProgress(100);
      setUploadStatus("上传成功！");
      
      const newData = {
        ...localData,
        settings: {
          ...localData.settings,
          wallpaperType: 'url' as const,
          wallpaper: url
        }
      };
      setLocalData(newData);
      
      if (onSave) {
        setUploadStatus("正在同步配置...");
        await onSave(newData);
        setUploadStatus("配置同步完成！");
      }
      
      toast.success("壁纸上传成功！");
    } catch (error: unknown) {
      console.error(error);
      const errorMessage = typeof error === 'object' && error !== null && 'message' in error ? (error.message as string) : "未知错误";
      setUploadStatus(`上传失败: ${errorMessage}`);
      toast.error("上传失败", { description: errorMessage });
    } finally {
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
        setUploadStatus("");
      }, 1000);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6 py-4 overflow-y-auto h-full [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-muted-foreground/20 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/40">
      
      <div className="space-y-2">
        <Label>网站标题</Label>
        <Input value={localData.settings.title} onChange={e => setLocalData({...localData, settings: {...localData.settings, title: e.target.value}})} className="h-9" />
      </div>

      <div className="space-y-2">
        <Label>首页布局</Label>
        <div className="flex gap-2">
          <Button 
            variant={localData.settings.homeLayout === 'list' ? "outline" : "default"} 
            size="sm" 
            onClick={() => {
              const newData = {
                ...localData,
                settings: { ...localData.settings, homeLayout: 'folder' as const },
              };
              setLocalData(newData);
              if (onSave) onSave(newData);
            }} 
            className="flex-1 h-9"
          >
            文件夹模式
          </Button>
          <Button 
            variant={localData.settings.homeLayout === 'list' ? "default" : "outline"} 
            size="sm" 
            onClick={() => {
              const newData = {
                ...localData,
                settings: { ...localData.settings, homeLayout: 'list' as const },
              };
              setLocalData(newData);
              if (onSave) onSave(newData);
            }} 
            className="flex-1 h-9"
          >
            直显模式
          </Button>
        </div>
        <p className="text-xs text-muted-foreground px-1">
          {localData.settings.homeLayout === 'list' 
            ? "直接在首页显示所有收藏内容，隐藏时钟" 
            : "使用经典的文件夹图标布局"}
        </p>
      </div>

      <div className="flex items-center justify-between border border-border/50 p-4 rounded-xl bg-muted/30">
        <div className="space-y-0.5 flex flex-col">
          <Label className="flex items-center gap-2">
            <Layers className="w-4 h-4" />
            功能组件
          </Label>
          <span className="text-xs text-muted-foreground">在主页显示待办事项和笔记入口</span>
        </div>
        <Switch
          checked={localData.settings.showFeatures !== false} 
          onCheckedChange={(checked) => {
            const newData = {
              ...localData,
              settings: { ...localData.settings, showFeatures: checked },
            };
            
            setLocalData(newData);

            if (onSave) {
              onSave(newData);
            }
          }}
        />
      </div>

      <div className="space-y-3 border border-border/50 p-4 rounded-xl bg-muted/30">
        <Label>主题模式</Label>
        <Select
          value={localData.settings.theme || "system"}
          onValueChange={(value) => {
            const newData = {
              ...localData,
              settings: { ...localData.settings, theme: value as "light" | "dark" | "system" },
            };
            setLocalData(newData);
            if (onSave) onSave(newData);
          }}
        >
          <SelectTrigger className="h-9">
            <SelectValue placeholder="选择主题" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="light">
              <div className="flex items-center gap-2">
                <Sun className="h-4 w-4" />
                <span>浅色模式</span>
              </div>
            </SelectItem>
            <SelectItem value="dark">
              <div className="flex items-center gap-2">
                <Moon className="h-4 w-4" />
                <span>深色模式</span>
              </div>
            </SelectItem>
            <SelectItem value="system">
              <div className="flex items-center gap-2">
                <Monitor className="h-4 w-4" />
                <span>跟随系统</span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3 border border-border/50 p-4 rounded-xl bg-muted/30">
        <Label>壁纸模式</Label>
        <div className="flex gap-2">
          {(['local', 'custom', 'url', 'bing'] as const).map(mode => (
            <Button 
              key={mode} 
              variant={localData.settings.wallpaperType === mode ? "default" : "outline"} 
              size="sm" 
              onClick={() => setLocalData({...localData, settings: {...localData.settings, wallpaperType: mode}})} 
              className="flex-1 capitalize h-9"
            >
              {mode === 'local' ? '本地' : mode === 'custom' ? 'API' : mode === 'url' ? '网络图片' : 'Bing'}
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
                  className="h-9"
              />
          </div>
        )}

        {localData.settings.wallpaperType === 'url' && (
          <div className="space-y-2 animate-in fade-in">
              <div className="flex items-center justify-between">
                <Label>图片链接</Label>
                {}
                <div className="flex flex-col gap-2 w-full">
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept="image/*"
                        onChange={handleFileChange}
                    />
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 text-xs gap-1 px-2 w-full justify-start"
                        onClick={handleUploadClick}
                        disabled={isUploading}
                    >
                        {isUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                        {isUploading ? "上传中..." : "上传到 S3"}
                    </Button>
                    
                    {isUploading && (
                        <div className="w-full space-y-1">
                            <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                                <span>{uploadStatus}</span>
                                <span>{Math.round(uploadProgress)}%</span>
                            </div>
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                <motion.div 
                                    className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${uploadProgress}%` }}
                                />
                            </div>
                        </div>
                    )}
                </div>
              </div>
              <Input 
                  value={localData.settings.wallpaper} 
                  onChange={e => setLocalData({...localData, settings: {...localData.settings, wallpaper: e.target.value}})} 
                  placeholder="请输入图片直链 (例如: https://example.com/bg.jpg)"
                  className="h-9"
              />
              <p className="text-[10px] text-muted-foreground">
                支持上传图片到配置的 S3/R2 存储桶，并自动填入链接。需先在“云同步”中配置 S3。
              </p>
          </div>
        )}

        {localData.settings.wallpaperType === 'local' && (
          <div className="space-y-4 animate-in fade-in pt-1">
            <div className="space-y-2">
               <div className="flex items-center justify-between">
                 <Label className="text-xs text-muted-foreground">随机打包数量</Label>
                 <span className="text-xs font-mono bg-background px-2 py-0.5 rounded border">
                    当前: {localData.settings.maxPackedWallpapers || 10} 张
                 </span>
               </div>
               <div className="flex gap-2 items-center">
                 <Input 
                    type="number"
                    min={1}
                    max={50}
                    value={localData.settings.maxPackedWallpapers || 10}
                    onChange={e => {
                      const val = parseInt(e.target.value);
                      if (!isNaN(val) && val > 0) {
                        setLocalData({...localData, settings: {...localData.settings, maxPackedWallpapers: val}})
                      }
                    }}
                    className="h-8 text-sm"
                 />
               </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-background/50">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-muted text-muted-foreground"><ImageIcon className="h-4 w-4" /></div>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">当前缓存</span>
                  <span className="text-xs text-muted-foreground">内存中已有 {localData.settings.wallpaperList?.length || 0} 张壁纸</span>
                </div>
              </div>
              <Button size="sm" variant="secondary" onClick={onRefreshWallpaper} title="随机切换一张本地壁纸" className="h-9">
                <Shuffle className="h-4 w-4 mr-2" /> 换一张
              </Button>
            </div>
            
          </div>
        )}
      </div>
    </div>
  );
}