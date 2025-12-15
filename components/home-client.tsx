"use client";

import { useEffect, useState } from "react";
import { ClockWidget } from "@/components/nav/clock";
import { SearchBar } from "@/components/nav/search-bar";
import { LinkGrid } from "@/components/nav/link-grid";
import { SettingsDialog } from "@/components/nav/settings-dialog";
import { FeaturesLauncher } from "@/components/features/features-launcher";

import { DataSchema, DEFAULT_DATA, Category, Todo, Note } from "@/lib/types";
import { loadDataFromGithub, saveDataToGithub, GITHUB_CONFIG_KEY, GithubConfig } from "@/lib/github";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HomeClientProps {
  initialWallpapers: string[]; 
}

const LOCAL_DATA_KEY = "clean-nav-local-data";

export default function HomeClient({ initialWallpapers }: HomeClientProps) {
  
  const [isReady, setIsReady] = useState(false);
  const [data, setData] = useState<DataSchema>(() => {
      const dataCopy = JSON.parse(JSON.stringify(DEFAULT_DATA));
      if (initialWallpapers.length > 0) {
          dataCopy.settings.wallpaperList = [...initialWallpapers];
      }
      return dataCopy;
  });

  const getInitialWallpaper = (initialData: DataSchema): string => {
    if (initialData.settings.wallpaperType === 'local' && initialWallpapers.length > 0) {
      return initialWallpapers[0];
    }
    if (initialData.settings.wallpaperType !== 'local' && initialData.settings.wallpaper) {
        return initialData.settings.wallpaper;
    }
    return "";
  };

  const [currentWallpaper, setCurrentWallpaper] = useState(() => getInitialWallpaper(data));
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [imgLoaded, setImgLoaded] = useState(true);

  useEffect(() => {
    if (!currentWallpaper) return;
    if (initialWallpapers.includes(currentWallpaper)) {
        setImgLoaded(true);
        return;
    }
    setImgLoaded(false); 
    const img = new Image();
    img.src = currentWallpaper;
    img.onload = () => setImgLoaded(true);
  }, [currentWallpaper, initialWallpapers]);

  useEffect(() => {
    console.log(`%c
    __  __ _                              
    \\ \\/ /(_) __ _  ___  _ __ ___   ___ 
     \\  / | |/ _\` |/ _ \\| '_ \` _ \\ / _ \\
     /  \\ | | (_| | (_) | | | | | | (_) |
    /_/\\_\\|_|\\__,_|\\___/|_| |_| |_|\\___/ 
                                         
    `, "color: #3b82f6; font-weight: bold;");
    console.log("%c Clean Nav ", "background: #3b82f6; color: #fff; border-radius: 4px; font-weight: bold;");
    console.log("%c✨ 欢迎来到我的导航页 | 项目已开源", "color: #3b82f6;");
    console.log("%cGithub: https://github.com/yingxiaomo/nav", "color: #aaa; font-size: 12px; font-family: monospace;");
    console.log("%c主页: https://ovoxo.cc", "color: #aaa; font-size: 12px; font-family: monospace;");

    async function initData() {
      try {
        let currentData = data;
        let loadedFromStorage = false;

        if (typeof window !== 'undefined') {
          const localDataString = localStorage.getItem(LOCAL_DATA_KEY);
          if (localDataString) {
            try {
              const localData = JSON.parse(localDataString) as DataSchema;
              if (initialWallpapers.length > 0) {
                if (!localData.settings.wallpaperList || localData.settings.wallpaperList.length === 0) {
                    localData.settings.wallpaperList = [...initialWallpapers];
                }
              }
              currentData = localData;
              setData(localData);
              loadedFromStorage = true;
            } catch (e) {
              console.error("Failed to parse local data", e);
            }
          }
        }

        if (currentData.settings.wallpaperType !== 'local') {
             await initWallpaper(currentData);
        } else if (loadedFromStorage && currentData.settings.wallpaperType === 'local') {

        }

        setIsReady(true);

        const storedConfig = localStorage.getItem(GITHUB_CONFIG_KEY);
        if (storedConfig) {
          const config: GithubConfig = JSON.parse(storedConfig);
          if (config.token) {
            loadDataFromGithub(config).then(ghData => {
                if (ghData) {
                    const localTodos = currentData.todos || [];
                    const localNotes = currentData.notes || [];
                    const mergedTodos = (ghData.todos && ghData.todos.length > 0) ? ghData.todos : localTodos;
                    const mergedNotes = (ghData.notes && ghData.notes.length > 0) ? ghData.notes : localNotes;
                    const finalData = { ...ghData, todos: mergedTodos, notes: mergedNotes };
                    
                    if (JSON.stringify(finalData) !== JSON.stringify(currentData)) {
                        if (initialWallpapers.length > 0) {
                            finalData.settings.wallpaperList = [...initialWallpapers];
                        }
                        setData(finalData);
                        if (typeof window !== 'undefined') {
                            localStorage.setItem(LOCAL_DATA_KEY, JSON.stringify(finalData));
                        }
                        
                        const isDifferent = 
                            JSON.stringify(mergedTodos) !== JSON.stringify(ghData.todos) || 
                            JSON.stringify(mergedNotes) !== JSON.stringify(ghData.notes);
                        
                        if (isDifferent) {
                            setHasUnsavedChanges(true);
                            toast.info("有设置未同步，点击提交到github");
                        }
                    }
                }
            });
          }
        }

        if (!loadedFromStorage && !storedConfig) {
          try {
            const res = await fetch("/data.json");
            if (res.ok) {
              const fetchedData = await res.json();
              const finalData = { ...fetchedData, todos: [], notes: [] };
              if(initialWallpapers.length > 0) finalData.settings.wallpaperList = [...initialWallpapers];
              setData(finalData);
            }
          } catch (e) {
            console.log("No deployed data.json found.");
          }
        }

      } catch (err) {
        console.error("Initialization error", err);
        setIsReady(true); 
      } 
    }
    
    initData();
  }, [initialWallpapers]); 

  const initWallpaper = async (cfg: DataSchema) => {
    const { wallpaperType, wallpaper, wallpaperList } = cfg.settings;
    if (wallpaperType === 'local') {
      if (currentWallpaper === initialWallpapers[0]) return; 
      const list = (initialWallpapers.length > 0) ? initialWallpapers : wallpaperList;
      if (list && list.length > 0) {
        const randomImg = list[Math.floor(Math.random() * list.length)];
        setCurrentWallpaper(randomImg);
      }
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
      if (typeof window !== 'undefined') {
          localStorage.setItem(LOCAL_DATA_KEY, JSON.stringify(newData));
          setHasUnsavedChanges(true);
      }
      if(newData.settings.wallpaperType !== data.settings.wallpaperType || newData.settings.wallpaper !== data.settings.wallpaper) {
          initWallpaper(newData);
      }
      const storedConfig = localStorage.getItem(GITHUB_CONFIG_KEY);
      if (!storedConfig) {
        toast.success("本地已更新 (未同步 GitHub)");
        setSaving(false);
        return;
      }
      const config: GithubConfig = JSON.parse(storedConfig);
      if (!config.token) {
        toast.success("本地已更新 (未同步 GitHub)");
        setSaving(false);
        return;
      }
      const success = await saveDataToGithub(config, newData);
      if (success) {
        toast.success("同步成功！");
        setHasUnsavedChanges(false);
      } else {
        toast.error("同步失败 (已暂存到本地)");
      }
    } catch (error) {
      console.error(error);
      toast.error("保存时发生错误");
    } finally {
      setSaving(false);
    }
  };

  const updateLocalAndState = (newData: DataSchema) => {
    setData(newData);
    setHasUnsavedChanges(true);
    if (typeof window !== 'undefined') {
        localStorage.setItem(LOCAL_DATA_KEY, JSON.stringify(newData));
    }
  };

  const handleReorder = (newCategories: Category[]) => {
    const newData = { ...data, categories: newCategories };
    updateLocalAndState(newData);
  };
  const handleTodosUpdate = (newTodos: Todo[]) => {
    const newData = { ...data, todos: newTodos };
    updateLocalAndState(newData);
  };
  const handleNotesUpdate = (newNotes: Note[]) => {
    const newData = { ...data, notes: newNotes };
    updateLocalAndState(newData);
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
          onSave={handleSave} 
          isSaving={saving}
          hasUnsavedChanges={hasUnsavedChanges}
          onRefreshWallpaper={() => initWallpaper(data)}
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
                  <SearchBar onLocalSearch={setSearchQuery} />
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
  );
}