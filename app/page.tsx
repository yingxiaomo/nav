"use client";

import { useEffect, useState } from "react";
import { ClockWidget } from "@/components/nav/clock";
import { SearchBar } from "@/components/nav/search-bar";
import { LinkGrid } from "@/components/nav/link-grid";
import { SettingsDialog } from "@/components/nav/settings-dialog";
import { DataSchema, DEFAULT_DATA, Category } from "@/lib/types";
import { loadDataFromGithub, saveDataToGithub, GITHUB_CONFIG_KEY, GithubConfig } from "@/lib/github";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Home() {
  const [data, setData] = useState<DataSchema>(DEFAULT_DATA);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentWallpaper, setCurrentWallpaper] = useState("");
  const [isFocusMode, setIsFocusMode] = useState(false);
  
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    // 控制台彩蛋
    console.log(
      "%c Clean Nav %c https://github.com/YingXiaoMo/clean-nav",
      "background: #333; color: #fff; padding: 4px 8px; border-radius: 4px 0 0 4px; font-weight: bold;",
      "background: #3b82f6; color: #fff; padding: 4px 8px; border-radius: 0 4px 4px 0;"
    );
    console.log("%c Designed & Developed by YingXiaoMo", "color: #aaa; font-size: 12px; margin-top: 5px; font-family: monospace;");

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
        setHasUnsavedChanges(false);
        return;
      }
      const config: GithubConfig = JSON.parse(storedConfig);
      if (!config.token) {
        setSaving(false);
        setHasUnsavedChanges(false);
        return;
      }
      const success = await saveDataToGithub(config, newData);
      if (success) {
        toast.success("同步成功！");
        setHasUnsavedChanges(false);
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
    setData(newData);
    setHasUnsavedChanges(true);
  };

  const getFilteredCategories = () => {
    if (!searchQuery) return data.categories;
    
    return data.categories.map(cat => ({
        ...cat,
        links: cat.links.filter(l => 
            l.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
            l.url.toLowerCase().includes(searchQuery.toLowerCase())
        )
    })).filter(cat => cat.links.length > 0);
  };

  const displayCategories = getFilteredCategories();

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
      // 启用 flex-col 布局，用于垂直对齐
      className="relative min-h-screen w-full overflow-hidden flex flex-col items-center p-6 md:p-12"
      style={bgStyle}
    >
      
      {/* 1. 顶部内容 (Clock + SearchBar) */}
      <div className="relative z-10 w-full max-w-5xl flex flex-col items-center shrink-0 mt-10 md:mt-20">
          <div className={`flex flex-col items-center w-full transition-opacity duration-300 ease-out will-change-opacity ${
            isFocusMode ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}>
            <ClockWidget />
            <SearchBar onLocalSearch={setSearchQuery} />
          </div>
      </div>
      
      {/* 2. Spacer: 推动 LinkGrid 到底部 */}
      <div className="flex-grow" /> 

      {/* 3. LinkGrid: Aligned to the bottom (above footer) */}
      <div className="relative z-10 w-full max-w-5xl flex flex-col items-center mb-10"> {/* mb-10 确保距离页脚有足够空间 */}
          <LinkGrid 
            categories={displayCategories} 
            onReorder={searchQuery ? undefined : handleReorder}
            onOpenChange={setIsFocusMode}
          />
      </div>

      <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ${
        hasUnsavedChanges ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0 pointer-events-none'
      }`}>
        <Button 
          onClick={() => handleSave(data)} 
          disabled={saving}
          className="rounded-full shadow-2xl bg-primary/90 backdrop-blur text-primary-foreground px-8 py-6 h-auto text-base font-medium hover:scale-105 transition-transform border border-white/10"
        >
          {saving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
          保存更改
        </Button>
      </div>

      <div className={`transition-opacity duration-300 ${isFocusMode ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        <SettingsDialog 
          data={data} 
          onSave={handleSave} 
          isSaving={saving}
          onRefreshWallpaper={() => initWallpaper(data)}
        />
      </div>

      <footer className={`absolute bottom-2 left-0 w-full text-center z-0 transition-opacity duration-500 ${isFocusMode ? 'opacity-0' : 'opacity-100'}`}>
        <p className="text-[10px] text-white/30 font-light tracking-widest font-mono select-none">
          © 2025 Clean Nav · Designed by{' '}
          <a 
            href="https://github.com/YingXiaoMo/clean-nav" 
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white/80 transition-colors cursor-pointer hover:underline underline-offset-4 decoration-white/30"
          >
            YingXiaoMo
          </a>
        </p>
      </footer>
      
      <Toaster position="top-center" />
    </main>
  );
}