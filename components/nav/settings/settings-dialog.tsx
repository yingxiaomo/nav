"use client";

import { useState } from "react";
import { Settings, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataSchema } from "@/lib/types";
import { STORAGE_CONFIG_KEY, StorageConfig } from "@/lib/adapters/storage";
import { GITHUB_CONFIG_KEY } from "@/lib/adapters/github";
import { useLocalStorage } from "@/lib/hooks";

import { AddLinkTab } from "./add-link-tab";
import { ManageLinksTab } from "./manage-links-tab";
import { GeneralTab } from "./general-tab";
import { StorageTab } from "./storage-tab";

interface SettingsDialogProps {
  data: DataSchema;
  onSave: (newData: DataSchema) => Promise<void>;
  isSaving: boolean;
  hasUnsavedChanges?: boolean;
  onRefreshWallpaper?: () => void;
  syncError?: boolean;
  uploadWallpaper: (file: File) => Promise<string>;
}

export function SettingsDialog({ data, onSave, isSaving, hasUnsavedChanges, onRefreshWallpaper, syncError, uploadWallpaper }: SettingsDialogProps) {
  const [open, setOpen] = useState(false);
  const [localData, setLocalData] = useState<DataSchema>(data);
  const [storageConfig, setStorageConfig] = useLocalStorage<StorageConfig>(STORAGE_CONFIG_KEY, () => {
    if (typeof window !== 'undefined') {
        const oldGithub = localStorage.getItem(GITHUB_CONFIG_KEY);
        if (oldGithub) {
            return {
                type: 'github',
                github: JSON.parse(oldGithub),
                settings: undefined
            };
        }
    }
    return {
        type: 'github',
        settings: undefined
    };
  });

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      setLocalData(data);
    }
  };

  const handleSave = async () => {
    const finalData = {
      ...localData,
      settings: {
        ...localData.settings,
        wallpaperList: localData.settings.wallpaperList || []
      }
    };
    await onSave(finalData);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="fixed bottom-4 right-4 z-50 rounded-full text-white/80 hover:text-white hover:bg-white/10 shadow-lg backdrop-blur-sm">
          <Settings className="h-5 w-5" />
          {hasUnsavedChanges && !syncError && (
            <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-black/20" />
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px] h-[85vh] max-h-[800px] flex flex-col backdrop-blur-xl overflow-hidden">
        <DialogHeader>
          <DialogTitle>设置</DialogTitle>
          <DialogDescription>管理导航内容与偏好。</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="add" className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-4 shrink-0">
            <TabsTrigger value="add">添加链接</TabsTrigger>
            <TabsTrigger value="manage">链接管理</TabsTrigger>
            <TabsTrigger value="general">外观设置</TabsTrigger>
            <TabsTrigger value="storage">云同步</TabsTrigger>
          </TabsList>

          <TabsContent value="add" className="flex-1 flex flex-col min-h-0 data-[state=active]:flex">
             <AddLinkTab localData={localData} setLocalData={setLocalData} />
          </TabsContent>

          <TabsContent value="manage" className="flex-1 flex flex-col min-h-0 data-[state=active]:flex">
             <ManageLinksTab localData={localData} setLocalData={setLocalData} />
          </TabsContent>

          <TabsContent value="general" className="flex-1 flex flex-col min-h-0 data-[state=active]:flex">
             <GeneralTab 
                localData={localData} 
                setLocalData={setLocalData} 
                onRefreshWallpaper={onRefreshWallpaper} 
                onSave={onSave}
                uploadWallpaper={uploadWallpaper}
             />
          </TabsContent>

          <TabsContent value="storage" className="flex-1 flex flex-col min-h-0 data-[state=active]:flex">
             <StorageTab config={storageConfig} setConfig={setStorageConfig} />
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-2 shrink-0 flex-col sm:flex-row gap-2 sm:gap-0">
          {hasUnsavedChanges && !syncError && (
            <div className="flex items-center justify-center sm:justify-start text-xs text-yellow-500 font-medium px-2">
              有设置未同步到云端
            </div>
          )}
          {syncError && (
            <div className="flex items-center justify-center sm:justify-start text-xs text-red-500 font-medium px-2">
              同步遇到错误，请检查网络
            </div>
          )}
          <Button onClick={handleSave} disabled={isSaving || syncError} className="w-full sm:w-auto">
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {syncError ? '同步失败' : (hasUnsavedChanges ? '保存并同步' : '保存')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
