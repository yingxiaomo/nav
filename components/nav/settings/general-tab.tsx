import { DataSchema } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImageIcon, Shuffle } from "lucide-react";

interface GeneralTabProps {
  localData: DataSchema;
  setLocalData: React.Dispatch<React.SetStateAction<DataSchema>>;
  onRefreshWallpaper?: () => void;
}

export function GeneralTab({ localData, setLocalData, onRefreshWallpaper }: GeneralTabProps) {
  return (
    <div className="space-y-6 py-4 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-muted-foreground/20 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/40">
      <div className="space-y-2">
        <Label>网站标题</Label>
        <Input value={localData.settings.title} onChange={e => setLocalData({...localData, settings: {...localData.settings, title: e.target.value}})} className="h-9" />
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
              className="flex-1 capitalize h-9"
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
                  className="h-9"
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
              <Button size="sm" variant="secondary" onClick={onRefreshWallpaper} title="随机切换一张本地壁纸" className="h-9">
                <Shuffle className="h-4 w-4 mr-2" /> 随机切换
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground px-1">
              * 将图片放入 <code className="bg-muted px-1 py-0.5 rounded">public/wallpapers</code> 目录并重启服务即可自动加载。
            </p>
          </div>
        )}
      </div>
    </div>
  );
}