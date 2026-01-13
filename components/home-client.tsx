"use client";

import { useEffect, useState, useRef } from "react";
import { ClockWidget } from "@/components/nav/clock";
import { SearchBar } from "@/components/nav/search-bar";
import { LinkGrid } from "@/components/nav/link-grid";
import { SettingsDialog } from "@/components/nav/settings-dialog";
import { FeaturesLauncher } from "@/components/features/features-launcher";
import { ThemeProvider } from "@/components/ui/theme-provider";

import { useWallpaper, useNavData } from "@/lib/hooks";
import { useKeyboardShortcuts } from "@/lib/hooks/use-keyboard-shortcuts";
import { Toaster } from "@/components/ui/sonner";

interface HomeClientProps {
  initialWallpapers: string[]; 
}

export default function HomeClient({ initialWallpapers }: HomeClientProps) {
  const {
    data,
    isReady,
    saving,
    hasUnsavedChanges,
    syncError,
    handleSave,
    handleReorder,
    handleTodosUpdate,
    handleNotesUpdate,
    uploadWallpaper
  } = useNavData(initialWallpapers);

  const {
    currentWallpaper,
    imgLoaded,
    initWallpaper,
  } = useWallpaper(initialWallpapers, data);

  const [searchQuery, setSearchQuery] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // 使用键盘快捷键 Hook
  useKeyboardShortcuts({
    onSave: () => handleSave(data, initWallpaper),
    onSearch: () => {
      searchInputRef.current?.focus();
    },
    onAddLink: () => {
      // 可以用于打开添加链接的弹窗
    },
    onToggleSettings: () => {
      setSettingsOpen(!settingsOpen);
    }
  });

  useEffect(() => {
    console.log("%c Clean Nav ", "background: #3b82f6; color: #fff; border-radius: 4px; font-weight: bold;");
    console.log("%c✨ 欢迎来到我的导航页 | 项目已开源", "color: #3b82f6;");
    console.log("%cGithub: https://github.com/yingxiaomo/nav", "color: #aaa; font-size: 12px; font-family: monospace;");
    console.log("%c主页: https://ovoxo.cc", "color: #aaa; font-size: 12px; font-family: monospace;");
  }, []);

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

  if (!isReady) {
    return (
        <div className="min-h-screen w-full bg-black/90 flex items-center justify-center">
            <div className="animate-pulse flex flex-col items-center gap-2">
                <div className="h-12 w-12 rounded-full bg-white/10"></div>
            </div>
        </div>
    );
  }

  return (
    <ThemeProvider initialTheme={data.settings.theme || "system"}>
      <main className="relative min-h-screen w-full overflow-hidden flex flex-col items-center p-6 md:p-12 animate-in fade-in duration-500">
        <div 
          className="fixed inset-0 z-0 transition-opacity duration-700 ease-in-out bg-cover bg-center bg-no-repeat bg-gray-900"
          style={{
              backgroundImage: currentWallpaper ? `url(${currentWallpaper})` : undefined,
              opacity: imgLoaded ? 1 : 0 
          }}
        />
        <div className="fixed inset-0 z-0 bg-black/20 pointer-events-none" />
        <div className="fixed top-4 right-4 z-50 flex gap-2">
          <SettingsDialog 
            data={data} 
            onSave={(newData) => handleSave(newData, initWallpaper)} 
            isSaving={saving}
            hasUnsavedChanges={hasUnsavedChanges}
            syncError={syncError}
            onRefreshWallpaper={() => initWallpaper(data)}
            uploadWallpaper={uploadWallpaper}
          />
        </div>

        <div className="relative z-10 w-full flex flex-col items-center flex-grow">
            <div className={`w-full max-w-5xl flex flex-col items-center shrink-0 ${data.settings.homeLayout === 'list' ? 'mt-8' : 'mt-10 md:mt-20'}`}>
                <div className="flex flex-col items-center w-full">
                  {data.settings.homeLayout !== 'list' && <ClockWidget />}
                  
                  {data.settings.homeLayout === 'list' && !searchQuery && data.settings.showFeatures !== false && (
                    <FeaturesLauncher 
                      todos={data.todos || []}
                      notes={data.notes || []}
                      onTodosUpdate={handleTodosUpdate}
                      onNotesUpdate={handleNotesUpdate}
                    />
                  )}
                  
                  <div className={data.settings.homeLayout === 'list' ? "mt-8 w-full" : "w-full"}>
                  <SearchBar ref={searchInputRef} onLocalSearch={setSearchQuery} />
                </div>
                  
                  {data.settings.homeLayout !== 'list' && !searchQuery && data.settings.showFeatures !== false && (
                    <FeaturesLauncher 
                      todos={data.todos || []}
                      notes={data.notes || []}
                      onTodosUpdate={handleTodosUpdate}
                      onNotesUpdate={handleNotesUpdate}
                    />
                  )}
                </div>
            </div>
            
            {data.settings.homeLayout !== 'list' && <div className="flex-grow" />}

            <div className={`w-full max-w-5xl flex flex-col items-center ${data.settings.homeLayout === 'list' ? 'mt-8 mb-20' : 'mb-10'}`}> 
               <LinkGrid 
                  categories={displayCategories} 
                  onReorder={searchQuery ? undefined : handleReorder}
                  displayMode={data.settings.homeLayout}
               />
            </div>

            <footer className="absolute bottom-2 left-0 w-full text-center z-0">
              <p className="text-[10px] text-white/30 font-light tracking-widest font-mono select-none">
                © 2025 Clean Nav · Designed by{' '}
                <a href="https://github.com/YingXiaoMo/clean-nav" target="_blank" rel="noopener noreferrer" className="hover:text-white/80 transition-colors cursor-pointer hover:underline underline-offset-4 decoration-white/30">
                  YingXiaoMo
                </a>
              </p>
            </footer>
        </div>
        
        <Toaster position="top-center" />
      </main>
    </ThemeProvider>
  );
}
