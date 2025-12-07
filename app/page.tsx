"use client";

import { useEffect, useState } from "react";
import { ClockWidget } from "@/components/nav/clock";
import { WeatherWidget } from "@/components/nav/weather";
import { SearchBar } from "@/components/nav/search-bar";
import { LinkGrid } from "@/components/nav/link-grid";
import { SettingsDialog } from "@/components/nav/settings-dialog";
import { DataSchema, DEFAULT_DATA, Category } from "@/lib/types";
import { loadDataFromGithub, saveDataToGithub, GITHUB_CONFIG_KEY, GithubConfig } from "@/lib/github";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function Home() {
  const [data, setData] = useState<DataSchema>(DEFAULT_DATA);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentWallpaper, setCurrentWallpaper] = useState("");
  const [isFocusMode, setIsFocusMode] = useState(false);

  useEffect(() => {
    async function initData() {
      try {
        let loadedData = DEFAULT_DATA;
        const storedConfig = localStorage.getItem(GITHUB_CONFIG_KEY);
        let loadedFromGithub = false;
        
        if (storedConfig) {
          const config: GithubConfig = JSON.parse(storedConfig);
          if (config.token) {
            const ghData = await loadDataFromGithub(config);
            if (ghData) {
              loadedData = ghData;
              loadedFromGithub = true;
            }
          }
        }

        if (!loadedFromGithub) {
          try {
            const res = await fetch("/data.json");
            if (res.ok) {
              loadedData = await res.json();
            }
          } catch (e) {
            console.log("No local data.json found.");
          }
        }

        setData(loadedData);
        initWallpaper(loadedData);

      } catch (err) {
        console.error("Initialization error", err);
      } finally {
        setLoading(false);
      }
    }
    initData();
  }, []);

  const initWallpaper = async (cfg: DataSchema) => {
    const { wallpaperType, wallpaper, wallpaperList } = cfg.settings;

    if (wallpaperType === 'local' && wallpaperList && wallpaperList.length > 0) {
      const randomImg = wallpaperList[Math.floor(Math.random() * wallpaperList.length)];
      setCurrentWallpaper(randomImg);
    } else if (wallpaperType === 'bing') {
      // 加个时间戳强制刷新
      setCurrentWallpaper(`https://bing.img.run/1920x1080.php?t=${new Date().getTime()}`); 
    } else {
      setCurrentWallpaper(wallpaper);
    }
  };

  const handleSave = async (newData: DataSchema) => {
    setSaving(true);
    try {
      setData(newData);
      initWallpaper(newData);

      const storedConfig = localStorage.getItem(GITHUB_CONFIG_KEY);
      if (!storedConfig) {
        toast.success("本地已更新 (未同步 GitHub)");
        setSaving(false);
        return;
      }
      const config: GithubConfig = JSON.parse(storedConfig);
      if (!config.token) {
        setSaving(false);
        return;
      }
      const success = await saveDataToGithub(config, newData);
      if (success) {
        toast.success("同步成功！");
      } else {
        toast.error("同步失败");
      }
    } catch (error) {
      console.error(error);
      toast.error("保存时发生错误");
    } finally {
      setSaving(false);
    }
  };

  const handleReorder = (newCategories: Category[]) => {
    const newData = { ...data, categories: newCategories };
    handleSave(newData);
  };

  const bgStyle = {
    backgroundImage: `url(${currentWallpaper})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <Loader2 className="animate-spin h-8 w-8" />
      </div>
    );
  }

  return (
    <main 
      className="relative min-h-screen w-full overflow-hidden flex flex-col items-center p-6 md:p-12"
      style={bgStyle}
    >
      <div className="relative z-10 w-full max-w-5xl flex flex-col items-center mt-10 md:mt-20">
          
          <div className={`flex flex-col items-center w-full transition-opacity duration-300 ease-out will-change-opacity ${
            isFocusMode ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}>
            <ClockWidget />
            <WeatherWidget />
            <div className="h-8" />
            <SearchBar />
          </div>
          
          <LinkGrid 
            categories={data.categories} 
            onReorder={handleReorder}
            onOpenChange={setIsFocusMode}
          />
          
      </div>

      <div className={`transition-opacity duration-300 ${isFocusMode ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        <SettingsDialog 
          data={data} 
          onSave={handleSave} 
          isSaving={saving}
          onRefreshWallpaper={() => initWallpaper(data)}
        />
      </div>
      
      <Toaster position="top-center" />
    </main>
  );
}