import { DataSchema } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch"; 
import { ImageIcon, Shuffle, Layers } from "lucide-react"; 

interface GeneralTabProps {
  localData: DataSchema;
  setLocalData: React.Dispatch<React.SetStateAction<DataSchema>>;
  onRefreshWallpaper?: () => void;
  onSave?: (data: DataSchema) => Promise<void>; 
}

export function GeneralTab({ localData, setLocalData, onRefreshWallpaper, onSave }: GeneralTabProps) {
  return (
    <div className="space-y-6 py-4 overflow-y-auto h-full [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-muted-foreground/20 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/40">
      
      <div className="space-y-2">
        <Label>网站标题</Label>
        <Input value={localData.settings.title} onChange={e => setLocalData({...localData, settings: {...localData.settings, title: e.target.value}})} className="h-9" />
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
              <Label>图片链接</Label>
              <Input 
                  value={localData.settings.wallpaper} 
                  onChange={e => setLocalData({...localData, settings: {...localData.settings, wallpaper: e.target.value}})} 
                  placeholder="请输入图片直链 (例如: https://example.com/bg.jpg)"
                  className="h-9"
              />
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