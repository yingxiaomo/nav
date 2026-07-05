import { DataSchema } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch" 
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImageIcon, Shuffle, Layers, Upload, Loader2, Sun, Moon, Monitor, RotateCcw, AlertTriangle, Check } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useThemeStore } from "@/lib/stores";

const BLUR_OPTIONS = [
  { value: 'low' as const, label: '低', px: '4px' },
  { value: 'medium' as const, label: '中', px: '12px' },
  { value: 'high' as const, label: '高', px: '24px' },
];

const ACCENT_COLORS = [
  { key: 'blue',   label: '蓝', color: '#3b82f6' },
  { key: 'purple', label: '紫', color: '#8b5cf6' },
  { key: 'green',  label: '绿', color: '#10b981' },
  { key: 'orange', label: '橙', color: '#f59e0b' },
  { key: 'amber',  label: '琥珀', color: '#f97316' },
];

/** 简单对比度计算（用于实时预览警告） */
function hexToRgb(hex: string) {
  const h = hex.replace('#', '');
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}
function getLuminance(r: number, g: number, b: number) {
  const [rl, gl, bl] = [r, g, b].map(c => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); });
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
}
function getContrastRatio(hex: string): number {
  try {
    const { r, g, b } = hexToRgb(hex);
    const lum = getLuminance(r, g, b);
    const lighter = Math.max(lum, 0.05), darker = Math.min(lum, 0.05);
    return Math.round((lighter + 0.05) / (darker + 0.05) * 100) / 100;
  } catch { return 21; }
}

const FONT_OPTIONS = [
  { value: 'system' as const, label: '系统字体' },
  { value: 'mono' as const, label: '等宽字体' },
];

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
  const themeStore = useThemeStore();

  // 防抖保存：避免快速切换时频繁触发云同步
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingDataRef = useRef<DataSchema | null>(null);

  const debouncedSave = useCallback((data: DataSchema) => {
    pendingDataRef.current = data;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      if (pendingDataRef.current && onSave) {
        onSave(pendingDataRef.current);
        pendingDataRef.current = null;
      }
    }, 500);
  }, [onSave]);

  // 组件卸载时清除定时器
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

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
            variant={localData.settings.homeLayout === 'folder' ? "default" : "outline"} 
            size="sm" 
            onClick={() => {
              const newData = {
                ...localData,
                settings: { ...localData.settings, homeLayout: 'folder' as const },
              };
              setLocalData(newData);
              debouncedSave(newData);
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
              debouncedSave(newData);
            }} 
            className="flex-1 h-9"
          >
            直显模式
          </Button>
          <Button 
            variant={localData.settings.homeLayout === 'sidebar' ? "default" : "outline"} 
            size="sm" 
            onClick={() => {
              const newData = {
                ...localData,
                settings: { ...localData.settings, homeLayout: 'sidebar' as const },
              };
              setLocalData(newData);
              debouncedSave(newData);
            }} 
            className="flex-1 h-9"
          >
            侧栏模式
          </Button>
        </div>
        <p className="text-xs text-muted-foreground px-1">
          {localData.settings.homeLayout === 'list'
            ? "直接在首页显示所有收藏内容，隐藏时钟"
            : localData.settings.homeLayout === 'sidebar'
              ? "在左侧显示文件夹侧边栏，主页固定标签不变"
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

            debouncedSave(newData);
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
            debouncedSave(newData);
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

      {/* ── 强调色 ── */}
      <div className="space-y-3 border border-border/50 p-4 rounded-xl bg-muted/30">
        <Label>强调色 — 预设</Label>
        <div className="flex gap-2 flex-wrap">
          {ACCENT_COLORS.map((c) => (
            <button
              key={c.key}
              onClick={() => themeStore.setAccentColor(c.key)}
              className={`w-8 h-8 rounded-full transition-all border-2 ${
                themeStore.accentColor === c.key && !themeStore.customAccentColor
                  ? 'border-foreground scale-110 shadow-md ring-2 ring-offset-2 ring-foreground/20'
                  : 'border-transparent hover:scale-105'
              }`}
              style={{ backgroundColor: c.color }}
              aria-label={c.label}
              title={c.label}
            />
          ))}
        </div>

        <div className="border-t border-border/50 pt-3 mt-3">
          <Label>自定义颜色</Label>
          <ColorPickerWithPreview
            value={themeStore.customAccentColor || ACCENT_COLORS.find(c => c.key === themeStore.accentColor)?.color || '#3b82f6'}
            onChange={(color) => themeStore.setCustomAccentColor(color)}
          />
        </div>
      </div>

      {/* ── 毛玻璃模糊程度 ── */}
      <div className="space-y-3 border border-border/50 p-4 rounded-xl bg-muted/30">
        <Label>毛玻璃模糊</Label>
        <div className="flex gap-2">
          {BLUR_OPTIONS.map((b) => (
            <button
              key={b.value}
              onClick={() => themeStore.setBlurLevel(b.value)}
              className={`flex-1 h-9 text-sm rounded-md font-medium transition-all ${
                themeStore.blurLevel === b.value
                  ? 'bg-primary text-primary-foreground shadow'
                  : 'bg-background text-foreground/70 hover:bg-muted border border-border'
              }`}
            >
              {b.label} ({b.px})
            </button>
          ))}
        </div>
      </div>

      {/* ── 遮罩暗化 ── */}
      <div className="space-y-3 border border-border/50 p-4 rounded-xl bg-muted/30">
        <div className="flex items-center justify-between">
          <Label>遮罩暗化</Label>
          <span className="text-xs font-mono bg-background px-2 py-0.5 rounded border">
            {themeStore.overlayDarkness}%
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={themeStore.overlayDarkness}
          onChange={(e) => themeStore.setOverlayDarkness(Number(e.target.value))}
          className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-[var(--theme-accent)]"
        />
        <p className="text-xs text-muted-foreground">控制壁纸上方黑色遮罩的深度</p>
      </div>

      {/* ── 卡片透明度 ── */}
      <div className="space-y-3 border border-border/50 p-4 rounded-xl bg-muted/30">
        <div className="flex items-center justify-between">
          <Label>卡片透明度</Label>
          <span className="text-xs font-mono bg-background px-2 py-0.5 rounded border">
            {themeStore.cardOpacity}%
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={themeStore.cardOpacity}
          onChange={(e) => themeStore.setCardOpacity(Number(e.target.value))}
          className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-[var(--theme-accent)]"
        />
        <p className="text-xs text-muted-foreground">控制卡片背景的透明度（越低越透）</p>
      </div>

      {/* ── 字体 ── */}
      <div className="space-y-3 border border-border/50 p-4 rounded-xl bg-muted/30">
        <Label>字体</Label>
        <div className="flex gap-2">
          {FONT_OPTIONS.map((f) => (
            <button
              key={f.value}
              onClick={() => themeStore.setFontFamily(f.value)}
              className={`flex-1 h-9 text-sm rounded-md font-medium transition-all ${
                themeStore.fontFamily === f.value
                  ? 'bg-primary text-primary-foreground shadow'
                  : 'bg-background text-foreground/70 hover:bg-muted border border-border'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
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
          <div className="space-y-3 animate-in fade-in">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <Label>图片链接</Label>
                </div>
                
                {/* 上传按钮区域 - 移到输入框上方，更显眼 */}
                <div className="bg-accent/10 border border-accent/20 rounded-lg p-3">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-accent">上传图片</span>
                      <span className="text-xs text-muted-foreground">支持 S3/R2、GitHub、WebDAV</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      上传图片后，系统会自动生成链接并填充到下方输入框
                    </p>
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept="image/*"
                        onChange={handleFileChange}
                    />
                    <Button 
                        variant="default" 
                        size="sm" 
                        className="w-full gap-2"
                        onClick={handleUploadClick}
                        disabled={isUploading}
                    >
                        {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                        {isUploading ? "上传中..." : "选择图片上传"}
                    </Button>
                    
                    {isUploading && (
                        <div className="w-full space-y-1">
                            <div className="flex justify-between items-center text-xs text-muted-foreground">
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
                
                {/* 图片链接输入框 */}
                <div className="space-y-1">
                  <Label className="text-sm">图片直链</Label>
                  <Input 
                      value={localData.settings.wallpaper} 
                      onChange={e => setLocalData({...localData, settings: {...localData.settings, wallpaper: e.target.value}})} 
                      placeholder="请输入图片直链 (例如: https://example.com/bg.jpg)"
                      className="h-9"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    支持直接输入图片链接，或使用上方上传功能自动生成
                  </p>
                </div>
              </div>
          </div>
        )}

        {localData.settings.wallpaperType === 'local' && (
          <div className="space-y-4 animate-in fade-in pt-1">
            <div className="space-y-2">
               <div className="flex items-center justify-between">
                 <Label className="text-xs text-muted-foreground">随机打包数量</Label>
                 <span className="text-xs font-mono bg-background px-2 py-0.5 rounded border">
                 </span>
               </div>
               <div className="flex gap-2 items-center">
                 <Input 
                    type="number"
                    min={1}
                    max={50}
                    onChange={e => {
                      const val = parseInt(e.target.value);
                      if (!isNaN(val) && val > 0) {
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

      {/* ── 恢复默认 ── */}
      <div className="pt-2 border-t border-border/30">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            themeStore.resetTheme();
            toast.success("视觉设置已恢复默认");
          }}
          className="w-full gap-2 h-9 text-xs"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          恢复视觉设置为默认值
        </Button>
      </div>
    </div>
  );
}

// ══════ Color Picker with Contrast Validation ══════

function ColorPickerWithPreview({ value, onChange }: { value: string; onChange: (color: string | null) => void }) {
  const [inputValue, setInputValue] = useState(value);

  const ratio = getContrastRatio(value);
  const passes = ratio >= 4.5;
  const isValidHex = /^#[0-9a-fA-F]{6}$/.test(value);

  const handleColorPicker = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setInputValue(v);
    onChange(v);
  };

  const handleTextInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setInputValue(v);
    if (/^#[0-9a-fA-F]{6}$/.test(v)) {
      onChange(v);
    }
  };

  const handleBlur = () => {
    if (/^#[0-9a-fA-F]{6}$/.test(inputValue)) {
      onChange(inputValue);
    } else {
      setInputValue(value);
    }
  };

  return (
    <div className="space-y-3 mt-2">
      {/* 拾色器 + 输入框 */}
      <div className="flex gap-2 items-center">
        <div className="relative">
          <input
            type="color"
            value={isValidHex ? value : '#3b82f6'}
            onChange={handleColorPicker}
            className="w-10 h-10 rounded-md cursor-pointer border border-border p-0.5 bg-transparent"
          />
        </div>
        <input
          value={inputValue}
          onChange={handleTextInput}
          onBlur={handleBlur}
          placeholder="#HEX 颜色值"
          className={`flex-1 h-9 px-3 rounded-md border text-sm font-mono bg-background ${
            isValidHex ? 'border-input' : 'border-destructive/50'
          }`}
        />
      </div>

      {/* 预览色块 */}
      <div className="grid grid-cols-2 gap-2">
        <div className="p-2 rounded text-xs bg-white border" style={{ color: value }}>
          {value} 浅色背景
        </div>
        <div className="p-2 rounded text-xs bg-gray-900 border border-gray-700" style={{ color: value }}>
          {value} 深色背景
        </div>
      </div>

      {/* 对比度状态 */}
      {isValidHex && (
        <div className={`flex items-center gap-1.5 text-xs ${passes ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}>
          {passes ? (
            <><Check className="size-3.5" /> 对比度 {ratio}:1 — 符合 WCAG AA 标准</>
          ) : (
            <><AlertTriangle className="size-3.5" /> 对比度 {ratio}:1 — 低于 WCAG AA 标准 4.5:1，建议选择更深的颜色</>
          )}
        </div>
      )}
    </div>
  );
}