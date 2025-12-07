"use client";

import { useEffect, useState } from "react";
import { ClockWidget } from "@/components/nav/clock";
import { SearchBar } from "@/components/nav/search-bar";
import { LinkGrid } from "@/components/nav/link-grid";
import { SettingsDialog } from "@/components/nav/settings-dialog";
import { DataSchema, DEFAULT_DATA } from "@/lib/types";
import { loadDataFromGithub, saveDataToGithub, GITHUB_CONFIG_KEY, GithubConfig } from "@/lib/github";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function Home() {
  const [data, setData] = useState<DataSchema>(DEFAULT_DATA);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Initialize Data
  useEffect(() => {
    async function initData() {
      try {
        // 1. Try local storage config for GitHub
        const storedConfig = localStorage.getItem(GITHUB_CONFIG_KEY);
        if (storedConfig) {
          const config: GithubConfig = JSON.parse(storedConfig);
          if (config.token) {
            const ghData = await loadDataFromGithub(config);
            if (ghData) {
              setData(ghData);
              setLoading(false);
              return;
            }
          }
        }

        // 2. Try fetching local static file (for public view without token)
        try {
          const res = await fetch("/data.json");
          if (res.ok) {
            const jsonData = await res.json();
            setData(jsonData);
          }
        } catch (e) {
          console.log("No local data.json found, using default.");
        }
      } catch (err) {
        console.error("Initialization error", err);
      } finally {
        setLoading(false);
      }
    }

    initData();
  }, []);

  const handleSave = async (newData: DataSchema) => {
    setSaving(true);
    try {
      // 1. Update local state immediately for UI feedback
      setData(newData);

      // 2. Check for GitHub config
      const storedConfig = localStorage.getItem(GITHUB_CONFIG_KEY);
      if (!storedConfig) {
        toast.warning("本地已更新，但未配置 GitHub 同步，刷新后可能会丢失。");
        setSaving(false);
        return;
      }

      const config: GithubConfig = JSON.parse(storedConfig);
      if (!config.token) {
        toast.warning("未填写 GitHub Token，无法同步到云端。");
        setSaving(false);
        return;
      }

      // 3. Push to GitHub
      const success = await saveDataToGithub(config, newData);
      if (success) {
        toast.success("配置已同步到 GitHub！");
      } else {
        toast.error("同步失败，请检查 GitHub 配置。");
      }
    } catch (error) {
      console.error(error);
      toast.error("保存时发生错误");
    } finally {
      setSaving(false);
    }
  };

  // Background Style
  const bgStyle = {
    backgroundImage: `url(${data.settings.wallpaper})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <Loader2 className="animate-spin h-8 w-8" />
      </div>
    );
  }

  return (
    <main className="relative min-h-screen w-full overflow-hidden transition-all duration-500">
      {/* Background Layer */}
      <div 
        className="fixed inset-0 z-0 transition-all duration-700 ease-in-out transform scale-105"
        style={bgStyle}
      />
      
      {/* Overlay Layer (Glass Effect) */}
      <div className={`fixed inset-0 z-10 bg-black/30 backdrop-blur-${data.settings.blurLevel || 'medium'}`} />

      {/* Content Layer */}
      <div className="relative z-20 flex flex-col items-center min-h-screen p-6 md:p-12 overflow-y-auto w-full">
        <div className="w-full max-w-5xl flex flex-col items-center mt-10 md:mt-20">
          
          <ClockWidget />
          
          <SearchBar />
          
          <LinkGrid categories={data.categories} />
          
        </div>
      </div>

      <SettingsDialog 
        data={data} 
        onSave={handleSave} 
        isSaving={saving}
      />
      
      <Toaster position="top-center" />
    </main>
  );
}