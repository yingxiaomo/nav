import { useState, useEffect, useCallback, useRef } from "react";
import { DataSchema, DEFAULT_DATA, Category, Todo, Note } from "./types";
import { GITHUB_CONFIG_KEY } from "./github";
import { StorageAdapter, GithubRepoAdapter, S3Adapter, WebDavAdapter, GistAdapter, STORAGE_CONFIG_KEY, StorageConfig } from "./storage";
import { toast } from "sonner";

export function useLocalStorage<T>(key: string, initialValue: T | (() => T)) {
  // 1. Initialize with default value (SSR safe)
  const [storedValue, setStoredValue] = useState<T>(() => {
    return initialValue instanceof Function ? initialValue() : initialValue;
  });

  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    try {
      const item = window.localStorage.getItem(key);
      if (item) {
        setStoredValue(JSON.parse(item));
      } else {
        // If nothing in storage, re-evaluate initialValue logic in client context
        // This allows migration logic (checking other keys) to run correctly on client
        if (initialValue instanceof Function) {
            const clientValue = initialValue();
            // Only update if it's different (basic check, object ref might be different but that's ok)
            setStoredValue(clientValue);
        }
      }
    } catch (error) {
      console.error(error);
    }
    setInitialized(true);
  }, [key]);

  const setValue = useCallback((value: T | ((val: T) => T)) => {
    try {
      setStoredValue((prev) => {
         const valueToStore = value instanceof Function ? value(prev) : value;
         if (typeof window !== "undefined") {
            window.localStorage.setItem(key, JSON.stringify(valueToStore));
         }
         return valueToStore;
      });
    } catch (error) {
      console.error(error);
    }
  }, [key]);

  return [storedValue, setValue, initialized] as const;
}

export function useWallpaper(initialWallpapers: string[], initialData: DataSchema) {
  const getInitialWallpaper = useCallback((data: DataSchema): string => {
    if (data.settings.wallpaperType === 'local' && initialWallpapers.length > 0) {
      return initialWallpapers[0];
    }
    if (data.settings.wallpaperType !== 'local' && data.settings.wallpaper) {
        return data.settings.wallpaper;
    }
    return "";
  }, [initialWallpapers]);

  const [currentWallpaper, setCurrentWallpaper] = useState(() => getInitialWallpaper(initialData));
  const [imgLoaded, setImgLoaded] = useState(true);

  const initWallpaper = useCallback(async (cfg: DataSchema) => {
    const { wallpaperType, wallpaper, wallpaperList } = cfg.settings;
    if (wallpaperType === 'local') {
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
  }, [initialWallpapers]);

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

  return { currentWallpaper, imgLoaded, initWallpaper, setCurrentWallpaper };
}

const LOCAL_DATA_KEY = "clean-nav-local-data";

export function useNavData(initialWallpapers: string[]) {
  const [isReady, setIsReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [syncError, setSyncError] = useState(false);
  const [data, setData] = useState<DataSchema>(() => {
    const dataCopy = JSON.parse(JSON.stringify(DEFAULT_DATA));
    if (initialWallpapers.length > 0) {
      dataCopy.settings.wallpaperList = [...initialWallpapers];
    }
    return dataCopy;
  });

  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const updateLocalAndState = useCallback((newData: DataSchema) => {
    setData(newData);
    setHasUnsavedChanges(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem(LOCAL_DATA_KEY, JSON.stringify(newData));
    }
  }, []);

  const getAdapter = useCallback((config: StorageConfig): StorageAdapter | null => {
    if (config.type === 'github') {
        // Support both new structure (config.github) and legacy (config.settings)
        const settings = config.github || config.settings;
        return settings ? new GithubRepoAdapter(settings) : null;
    }
    if (config.type === 's3') {
        const settings = config.s3 || config.settings;
        return settings ? new S3Adapter(settings) : null;
    }
    if (config.type === 'webdav') {
        const settings = config.webdav || config.settings;
        return settings ? new WebDavAdapter(settings) : null;
    }
    if (config.type === 'gist') {
        const settings = config.gist || config.settings;
        return settings ? new GistAdapter(settings) : null;
    }
    return null;
  }, []);

  const getEffectiveConfig = useCallback((): StorageConfig | null => {
    if (typeof window === 'undefined') return null;
    
    const storageConfigStr = localStorage.getItem(STORAGE_CONFIG_KEY);
    if (storageConfigStr) {
        try {
            const config = JSON.parse(storageConfigStr) as StorageConfig;
            // Auto migrate legacy structure
            let hasChanges = false;
            
            // Migrate generic 'settings' to specific fields if they are missing
            if (config.settings && Object.keys(config.settings).length > 0) {
                if (config.type === 'github' && !config.github) {
                    config.github = config.settings;
                    delete config.settings;
                    hasChanges = true;
                } else if (config.type === 's3' && !config.s3) {
                    config.s3 = config.settings;
                    delete config.settings;
                    hasChanges = true;
                }
            }
            
            if (hasChanges) {
                localStorage.setItem(STORAGE_CONFIG_KEY, JSON.stringify(config));
            }
            return config;
        } catch (e) {
            console.error("Error parsing storage config", e);
        }
    }

    const githubConfigStr = localStorage.getItem(GITHUB_CONFIG_KEY);
    if (githubConfigStr) {
      const githubSettings = JSON.parse(githubConfigStr);
      const migrated: StorageConfig = {
        type: 'github',
        github: githubSettings
      };
      // Auto migrate for next time
      localStorage.setItem(STORAGE_CONFIG_KEY, JSON.stringify(migrated));
      return migrated;
    }

    return null;
  }, []);

  useEffect(() => {
    async function initData() {
      try {
        let currentData = dataRef.current;
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

        setIsReady(true);

        const config = getEffectiveConfig();
        if (config) {
          const adapter = getAdapter(config);
          if (adapter) {
            adapter.load().then(remoteData => {
              if (remoteData) {
                const localTodos = currentData.todos || [];
                const localNotes = currentData.notes || [];
                const localCategories = currentData.categories || [];

                // Smart Merge Logic
                const mergeItems = <T extends { id: string, updatedAt?: number }>(remoteItems: T[] = [], localItems: T[] = []): T[] => {
                    const merged = [...remoteItems];
                    const remoteMap = new Map(remoteItems.map(i => [i.id, i]));
                    
                    for (const localItem of localItems) {
                        const remoteItem = remoteMap.get(localItem.id);
                        if (!remoteItem) {
                            // New local item -> Add
                            merged.push(localItem);
                        } else {
                            // Conflict -> Check timestamps
                            const localTime = localItem.updatedAt || 0;
                            const remoteTime = remoteItem.updatedAt || 0;
                            if (localTime > remoteTime) {
                                // Local is newer -> Replace
                                const index = merged.findIndex(i => i.id === localItem.id);
                                if (index !== -1) {
                                    merged[index] = localItem;
                                }
                            }
                        }
                    }
                    return merged;
                };

                const mergeLinks = (remoteLinks: any[], localLinks: any[]): any[] => {
                    const merged = [...remoteLinks];
                    const remoteMap = new Map(remoteLinks.map(l => [l.id, l]));

                    for (const localLink of localLinks) {
                        const remoteLink = remoteMap.get(localLink.id);
                        if (!remoteLink) {
                            // New local link -> Add
                            merged.push(localLink);
                        } else {
                            // Existing link -> Merge recursively or replace based on time
                            const localTime = localLink.updatedAt || 0;
                            const remoteTime = remoteLink.updatedAt || 0;
                            
                            // If it's a folder, we might need to merge children regardless of folder timestamp
                            // But usually folder timestamp updates when content updates if we implemented it right.
                            // Let's do a mix: if local is newer, take local props. Then merge children.
                            
                            let baseLink = (localTime > remoteTime) ? localLink : remoteLink;
                            
                            // If both have children, merge them
                            if (localLink.children || remoteLink.children) {
                                const mergedChildren = mergeLinks(remoteLink.children || [], localLink.children || []);
                                baseLink = { ...baseLink, children: mergedChildren };
                            }
                            
                            const index = merged.findIndex(l => l.id === localLink.id);
                            if (index !== -1) {
                                merged[index] = baseLink;
                            }
                        }
                    }
                    return merged;
                };

                const mergeCategories = (remoteCats: Category[], localCats: Category[]): Category[] => {
                    const merged = [...remoteCats];
                    const remoteCatMap = new Map(remoteCats.map(c => [c.id, c]));
                    
                    for (const localCat of localCats) {
                        const remoteCat = remoteCatMap.get(localCat.id);
                        if (!remoteCat) {
                            // New local category -> Add
                            merged.push(localCat);
                        } else {
                            // Existing category -> Merge
                            const localTime = localCat.updatedAt || 0;
                            const remoteTime = remoteCat.updatedAt || 0;
                            
                            let baseCat = (localTime > remoteTime) ? localCat : remoteCat;
                            
                            // Always merge links
                            const mergedLinks = mergeLinks(remoteCat.links, localCat.links);
                            
                            const index = merged.findIndex(c => c.id === localCat.id);
                            if (index !== -1) {
                                merged[index] = {
                                    ...baseCat,
                                    links: mergedLinks
                                };
                            }
                        }
                    }
                    return merged;
                };

                const mergedCategories = mergeCategories(remoteData.categories || [], localCategories);
                const mergedTodos = mergeItems(remoteData.todos, localTodos);
                const mergedNotes = mergeItems(remoteData.notes, localNotes);
                
                const finalData = { 
                  ...remoteData, 
                  categories: mergedCategories,
                  todos: mergedTodos, 
                  notes: mergedNotes 
                };

                if (JSON.stringify(finalData) !== JSON.stringify(currentData)) {
                  if (initialWallpapers.length > 0) {
                    finalData.settings.wallpaperList = [...initialWallpapers];
                  }
                  setData(finalData);
                  if (typeof window !== 'undefined') {
                    localStorage.setItem(LOCAL_DATA_KEY, JSON.stringify(finalData));
                  }

                  // Check if effective data is different from remote (meaning we have unsaved local additions)
                  const isEffectiveDifferent =
                    JSON.stringify(mergedCategories) !== JSON.stringify(remoteData.categories) ||
                    JSON.stringify(mergedTodos) !== JSON.stringify(remoteData.todos) ||
                    JSON.stringify(mergedNotes) !== JSON.stringify(remoteData.notes);

                  if (isEffectiveDifferent) {
                    setHasUnsavedChanges(true);
                    toast.info("已合并云端数据，本地新增内容已保留 (请点击保存以同步到云端)");
                  } else {
                    toast.success("已从云端同步最新数据");
                  }
                }
              }
            });
          }
        }

        if (!loadedFromStorage && !config) {
          try {
            const res = await fetch("/data.json");
            if (res.ok) {
              const fetchedData = await res.json();
              const finalData = { ...fetchedData, todos: [], notes: [] };
              if (initialWallpapers.length > 0) finalData.settings.wallpaperList = [...initialWallpapers];
              setData(finalData);
            }
          } catch (e) {
            console.log("No deployed data.json found.");
          }
        }
      } catch (err) {
        console.error("Initialization error", err);
        setSyncError(true);
        toast.error("初始化同步失败，请检查网络或配置");
        setIsReady(true);
      }
    }

    initData();
  }, [initialWallpapers, getAdapter, getEffectiveConfig]);

  const handleSave = async (newData: DataSchema, onWallpaperUpdate?: (cfg: DataSchema) => void) => {
    setSaving(true);
    setSyncError(false);
    try {
      const oldData = data;
      setData(newData);
      if (typeof window !== 'undefined') {
        localStorage.setItem(LOCAL_DATA_KEY, JSON.stringify(newData));
        setHasUnsavedChanges(true);
      }
      
      if (onWallpaperUpdate && (newData.settings.wallpaperType !== oldData.settings.wallpaperType || newData.settings.wallpaper !== oldData.settings.wallpaper)) {
        onWallpaperUpdate(newData);
      }

      const config = getEffectiveConfig();
      if (!config) {
        toast.success("本地已更新 (未配置云端)");
        setSaving(false);
        return;
      }

      const adapter = getAdapter(config);
      if (!adapter) {
        toast.success("本地已更新 (不支持的存储类型)");
        setSaving(false);
        return;
      }

      const success = await adapter.save(newData);
      
      if (success) {
        toast.success("同步成功！", {
          description: "云端更新可能受 CDN 缓存影响有 1-5 分钟延迟，请勿频繁刷新或重复保存。",
          duration: 5000,
        });
        setHasUnsavedChanges(false);
      } else {
        setSyncError(true);
        toast.error("同步失败 (已暂存到本地)");
      }
    } catch (error) {
      console.error(error);
      setSyncError(true);
      toast.error("保存时发生错误");
    } finally {
      setSaving(false);
    }
  };

  const handleReorder = (newCategories: Category[]) => {
    updateLocalAndState({ ...data, categories: newCategories });
  };
  const handleTodosUpdate = (newTodos: Todo[]) => {
    updateLocalAndState({ ...data, todos: newTodos });
  };
  const handleNotesUpdate = (newNotes: Note[]) => {
    updateLocalAndState({ ...data, notes: newNotes });
  };

  return {
    data,
    isReady,
    saving,
    hasUnsavedChanges,
    syncError,
    handleSave,
    handleReorder,
    handleTodosUpdate,
    handleNotesUpdate,
    setData
  };
}