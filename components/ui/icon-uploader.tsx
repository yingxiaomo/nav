"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { convertToWebP } from "@/lib/utils/image-utils";
import { isValidImageFile, isValidFileSize } from "@/lib/utils/validation";
import { StorageConfig, createAdapter } from "@/lib/adapters/storage";

interface IconUploaderProps {
  storageConfig?: StorageConfig;
  onIconReady: (icon: string) => void;
  className?: string;
}

export function IconUploader({ storageConfig, onIconReady, className }: IconUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isValidImageFile(file)) {
      return toast.error("请选择图片文件", { description: "支持的图片格式：JPG、PNG、GIF、WEBP 等" });
    }
    if (!isValidFileSize(file, 2)) {
      return toast.error("文件大小超过限制", { description: "图片大小不能超过2MB" });
    }

    setIsUploading(true);
    setProgress(0);

    try {
      setProgress(10);
      const webpFile = await convertToWebP(file, 65, 128);
      setProgress(50);

      let iconUrl: string | null = null;

      if (storageConfig && storageConfig.type !== 'gist') {
        try {
          const adapter = createAdapter(storageConfig);
          if (adapter?.uploadFile) {
            const url = await adapter.uploadFile(webpFile, `icon-${Date.now()}.webp`);
            iconUrl = url;
          }
        } catch {
          // 上传失败 → 降级到 data URI
        }
      }

      if (iconUrl) {
        setProgress(100);
        onIconReady(iconUrl);
        toast.success("图标已上传到云端");
      } else {
        const reader = new FileReader();
        reader.onload = (event) => {
          const base64Data = event.target?.result as string;
          setProgress(100);
          onIconReady(base64Data);
          toast.success("图标已压缩并设置");
        };
        reader.readAsDataURL(webpFile);
      }
    } catch {
      toast.error("图标上传失败", { description: "请重试或选择其他图标" });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className={className}>
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*"
        onChange={handleFileChange}
      />
      <Button
        variant="outline"
        size="sm"
        className="w-full gap-2 text-xs"
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
      >
        {isUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
        {isUploading ? "上传中..." : "上传图标"}
      </Button>
      {isUploading && (
        <div className="w-full space-y-1 mt-1">
          <div className="flex justify-between items-center text-[10px] text-muted-foreground">
            <span>上传进度</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all duration-200 ease-out" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}
