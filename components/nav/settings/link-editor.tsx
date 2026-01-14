import React, { useState } from 'react';
import { LinkItem } from '@/lib/types';
import { IconRender, PRESET_ICONS } from './shared';
import { Wand2, Upload, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import {
  isValidImageFile,
  isValidFileSize
} from '@/lib/utils/validation';
import { convertToWebP } from '@/lib/utils/image-utils';

interface LinkEditorProps {
  editingLink: LinkItem | null;
  onUpdate: (link: LinkItem) => void;
  onSmartIdentify: (url: string) => void;
}

export const LinkEditor: React.FC<LinkEditorProps> = ({
  editingLink,
  onUpdate,
  onSmartIdentify
}) => {
  const [isUploadingIcon, setIsUploadingIcon] = useState(false);
  const [iconUploadProgress, setIconUploadProgress] = useState(0);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  if (!editingLink) return null;

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
        onUpdate({ ...editingLink, icon: base64Data });
        setIconUploadProgress(100);
        toast.success("图标上传成功", { description: "已转换为WebP格式并更新链接的图标" });
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

  return (
    <div className="grid gap-4 py-4">
      {editingLink.type !== 'folder' && (
        <div className="grid gap-2">
          <Label>URL</Label>
          <div className="flex gap-2">
            <Input 
              value={editingLink.url} 
              onChange={(e) => onUpdate({ ...editingLink, url: e.target.value })} 
              placeholder="https://example.com"
            />
            <Button size="icon" variant="outline" onClick={() => onSmartIdentify(editingLink.url)} title="自动识别">
              <Wand2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
      <div className="grid gap-2">
        <Label>标题</Label>
        <Input 
          value={editingLink.title} 
          onChange={(e) => onUpdate({ ...editingLink, title: e.target.value })} 
          placeholder="输入标题"
        />
      </div>
      <div className="grid gap-2">
          <Label>图标</Label>
          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="shrink-0" title="选择内置图标">
                  <IconRender name={editingLink.icon || "Link"} className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-[300px] h-[350px] overflow-y-auto" align="start">
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
                  {PRESET_ICONS.map((iconName) => (
                    <Button
                      key={iconName}
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9"
                      onClick={() => onUpdate({ ...editingLink, icon: iconName })}
                    >
                      <IconRender name={iconName} className="h-5 w-5" />
                    </Button>
                  ))}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
            <Input 
              value={editingLink.icon} 
              onChange={(e) => onUpdate({ ...editingLink, icon: e.target.value })} 
              placeholder="输入图标 URL 或选择内置图标"
              className="flex-1"
            />
          </div>
        </div>
    </div>
  );
};
