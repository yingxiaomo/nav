"use client";

import { Button } from "@/components/ui/button";
import { Wand2 } from "lucide-react";
import { IconRender } from "@/components/nav/settings/shared";
import { IconUploader } from "@/components/ui/icon-uploader";
import { StorageConfig } from "@/lib/adapters/storage";

interface IconEditorProps {
  currentIcon: string;
  onIconChange: (icon: string) => void;
  storageConfig?: StorageConfig;
  onSmartDetect?: () => void;
}

const QUICK_ICONS = ["Link", "Globe", "Github", "Twitter", "Youtube", "Mail", "Music", "Video", "Book", "Star", "Heart", "Settings", "User", "Cloud", "Server", "Database", "Shield", "Lock", "Bell", "Clock"];

export function IconEditor({ currentIcon, onIconChange, storageConfig, onSmartDetect }: IconEditorProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <IconUploader
          storageConfig={storageConfig}
          onIconReady={onIconChange}
          className="flex-1"
        />
        {onSmartDetect && (
          <Button variant="outline" size="icon" onClick={onSmartDetect} title="自动检测图标">
            <Wand2 className="h-4 w-4 text-purple-500" />
          </Button>
        )}
      </div>
      <div className="flex gap-1 flex-wrap">
        {QUICK_ICONS.map((name) => (
          <Button
            key={name}
            variant={currentIcon === name ? "default" : "ghost"}
            size="icon"
            className="h-8 w-8"
            onClick={() => onIconChange(name)}
          >
            <IconRender name={name} className="h-4 w-4" />
          </Button>
        ))}
      </div>
    </div>
  );
}
