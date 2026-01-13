"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { DataSchema, DEFAULT_DATA, Category, Todo, Note } from "./types";
import { GITHUB_CONFIG_KEY } from "./github";
import { StorageAdapter, GithubRepoAdapter, S3Adapter, WebDavAdapter, GistAdapter, STORAGE_CONFIG_KEY, StorageConfig, GithubRepoSettings, S3Settings, WebDavSettings, GistSettings } from "./storage";
import { toast } from "sonner";

export function useLocalStorage<T>(key: string, initialValue: T | (() => T)) {

  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue instanceof Function ? initialValue() : initialValue;
    }
    try {
      const item = window.localStorage.getItem(key);
      if (item) {
        return JSON.parse(item);
      }
    } catch (error) {
      console.error(error);
    }
    return initialValue instanceof Function ? initialValue() : initialValue;
  });

  const initialized = true;

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
  const [isLoading, setIsLoading] = useState(false);

  // 预加载壁纸的函数
  const preloadWallpaper = useCallback((url: string) => {
    if (!url) return Promise.resolve();
    
    return new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.src = url;
      img.onload = () => resolve();
      img.onerror = reject;
    });
  }, []);

  // 初始化壁纸，添加懒加载和预加载
  const initWallpaper = useCallback((cfg: DataSchema) => {
    const { wallpaperType, wallpaper, wallpaperList } = cfg.settings;
    
    let newWallpaper: string = "";
    if (wallpaperType === 'local') {
      const list = (initialWallpapers.length > 0) ? initialWallpapers : wallpaperList;
      if (list && list.length > 0) {
        const randomImg = list[Math.floor(Math.random() * list.length)];
        newWallpaper = randomImg;
      }
    } else if (wallpaperType === 'bing') {
      const bingWallpaper = `https://bing.img.run/1920x1080.php?t=${new Date().getTime()}`;
      newWallpaper = bingWallpaper;
    } else {
      newWallpaper = wallpaper;
    }
    
    if (newWallpaper) {
      setIsLoading(true);
      setImgLoaded(false);
      
      // 预加载壁纸
      preloadWallpaper(newWallpaper)
        .then(() => {
          setCurrentWallpaper(newWallpaper);
          setImgLoaded(true);
        })
        .catch(() => {
          setCurrentWallpaper(newWallpaper);
          setImgLoaded(true);
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      setCurrentWallpaper("");
      setImgLoaded(true);
      setIsLoading(false);
    }
  }, [initialWallpapers, preloadWallpaper]);

  const handleWallpaperChange = useCallback((newWallpaper: string) => {
    if (!newWallpaper) {
      setCurrentWallpaper("");
      setImgLoaded(true);
      setIsLoading(false);
      return;
    }
    
    // 如果是本地壁纸，直接设置，否则预加载
    if (initialWallpapers.includes(newWallpaper)) {
      setCurrentWallpaper(newWallpaper);
      setImgLoaded(true);
      setIsLoading(false);
    } else {
      setIsLoading(true);
      setImgLoaded(false);
      
      preloadWallpaper(newWallpaper)
        .then(() => {
          setCurrentWallpaper(newWallpaper);
          setImgLoaded(true);
        })
        .catch(() => {
          setCurrentWallpaper(newWallpaper);
          setImgLoaded(true);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [initialWallpapers, preloadWallpaper]);

  // 预加载下一张壁纸，用于提升用户体验
  const preloadNextWallpaper = useCallback(() => {
    const list = initialWallpapers;
    if (list && list.length > 1) {
      const currentIndex = list.indexOf(currentWallpaper);
      const nextIndex = (currentIndex + 1) % list.length;
      preloadWallpaper(list[nextIndex]);
    }
  }, [currentWallpaper, initialWallpapers, preloadWallpaper]);
  
  // 当壁纸切换时，预加载下一张壁纸
  useEffect(() => {
    if (currentWallpaper && initialWallpapers.length > 1) {
      preloadNextWallpaper();
    }
  }, [currentWallpaper, preloadNextWallpaper, initialWallpapers.length]);

  return { 
    currentWallpaper, 
    imgLoaded, 
    isLoading,
    initWallpaper, 
    setCurrentWallpaper: handleWallpaperChange,
    preloadNextWallpaper 
  };
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
        const settings = config.github;
        return settings ? new GithubRepoAdapter(settings) : null;
    }
    if (config.type === 's3') {
        const settings = config.s3;
        return settings ? new S3Adapter(settings) : null;
    }
    if (config.type === 'webdav') {
        const settings = config.webdav;
        return settings ? new WebDavAdapter(settings) : null;
    }
    if (config.type === 'gist') {
        const settings = config.gist;
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

            let hasChanges = false;
            
            if (config.settings && Object.keys(config.settings).length > 0) {
                if (config.type === 'github' && !config.github) {
                    config.github = config.settings as GithubRepoSettings;
                    delete config.settings;
                    hasChanges = true;
                } else if (config.type === 's3' && !config.s3) {
                    config.s3 = config.settings as S3Settings;
                    delete config.settings;
                    hasChanges = true;
                } else if (config.type === 'webdav' && !config.webdav) {
                    config.webdav = config.settings as WebDavSettings;
                    delete config.settings;
                    hasChanges = true;
                } else if (config.type === 'gist' && !config.gist) {
                    config.gist = config.settings as GistSettings;
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
                
                const mergeItems = <T extends { id: string; updatedAt?: number }>(
                    remoteItems: T[] = [], 
                    localItems: T[] = [], 
                    nestedMergeFn?: (remoteItem: T, localItem: T) => T
                ): T[] => {
                    const merged = [...remoteItems];
                    const remoteMap = new Map(remoteItems.map(i => [i.id, i]));
                    
                    for (const localItem of localItems) {
                        const remoteItem = remoteMap.get(localItem.id);
                        if (!remoteItem) {
                            merged.push(localItem);
                        } else {
                            const localTime = localItem.updatedAt || 0;
                            const remoteTime = remoteItem.updatedAt || 0;
                            
                            let updatedItem = remoteItem;
                            if (localTime > remoteTime) {
                                updatedItem = localItem;
                            } else if (nestedMergeFn) {
                                updatedItem = nestedMergeFn(remoteItem, localItem);
                            }
                            
                            const index = merged.findIndex(i => i.id === localItem.id);
                            if (index !== -1) {
                                merged[index] = updatedItem;
                            }
                        }
                    }
                    return merged;
                };

                
                const mergeCategories = (remoteCats: Category[], localCats: Category[]): Category[] => {
                    const mergeCategoryLinks = (remoteCat: Category, localCat: Category): Category => {
                        const mergedLinks = mergeItems(remoteCat.links, localCat.links);
                        return {
                            ...remoteCat,
                            links: mergedLinks
                        };
                    };
                    
                    return mergeItems(remoteCats, localCats, mergeCategoryLinks);
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
          } catch {
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
    } catch (error: unknown) {
      console.error(error);
      setSyncError(true);
      toast.error("保存时发生错误", {
        description: typeof error === 'object' && error !== null && 'message' in error ? (error.message as string) : "请检查网络或配置"
      });
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

  const uploadWallpaper = async (file: File): Promise<string> => {
      const config = getEffectiveConfig();
      if (!config) throw new Error("未配置存储，无法上传");
      
      const adapter = getAdapter(config);
      if (!adapter || !adapter.uploadFile) {
          throw new Error("当前存储方式不支持文件上传");
      }
      
      return await adapter.uploadFile(file, file.name);
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
    uploadWallpaper,
    setData
  };
}