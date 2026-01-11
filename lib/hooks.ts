import { useState, useEffect, useCallback, useRef } from "react";
import { DataSchema, DEFAULT_DATA, Category, Todo, Note } from "./types";
import { GITHUB_CONFIG_KEY } from "./github";
import { StorageAdapter, GithubRepoAdapter, S3Adapter, STORAGE_CONFIG_KEY, StorageConfig } from "./storage";
import { toast } from "sonner";

export function useLocalStorage<T>(key: string, initialValue: T | (() => T)) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === "undefined") {
      return initialValue instanceof Function ? initialValue() : initialValue;
    }
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : (initialValue instanceof Function ? initialValue() : initialValue);
    } catch (error) {
      console.error(error);
      return initialValue instanceof Function ? initialValue() : initialValue;
    }
  });

  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    setInitialized(true);
  }, []);

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      console.error(error);
    }
  };

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
    if (config.type === 'github') return new GithubRepoAdapter(config.settings);
    if (config.type === 's3') return new S3Adapter(config.settings);
    return null;
  }, []);

  const getEffectiveConfig = useCallback((): StorageConfig | null => {
    if (typeof window === 'undefined') return null;
    
    const storageConfigStr = localStorage.getItem(STORAGE_CONFIG_KEY);
    if (storageConfigStr) return JSON.parse(storageConfigStr);

    const githubConfigStr = localStorage.getItem(GITHUB_CONFIG_KEY);
    if (githubConfigStr) {
      const githubSettings = JSON.parse(githubConfigStr);
      const migrated: StorageConfig = {
        type: 'github',
        settings: githubSettings
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

                // Smart Merge: Protect local data if remote is empty
                let mergedCategories = remoteData.categories;
                // If remote has no categories but we do, keep ours (prevent data loss on fresh sync)
                if ((!mergedCategories || mergedCategories.length === 0) && localCategories.length > 0) {
                    mergedCategories = localCategories;
                }

                const mergedTodos = (remoteData.todos && remoteData.todos.length > 0) ? remoteData.todos : localTodos;
                const mergedNotes = (remoteData.notes && remoteData.notes.length > 0) ? remoteData.notes : localNotes;
                
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

                  const isDifferent =
                    JSON.stringify(mergedTodos) !== JSON.stringify(remoteData.todos) ||
                    JSON.stringify(mergedNotes) !== JSON.stringify(remoteData.notes);

                  if (isDifferent) {
                    setHasUnsavedChanges(true);
                    toast.info("有设置未同步，点击提交到云端");
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
        setIsReady(true);
      }
    }

    initData();
  }, [initialWallpapers, getAdapter, getEffectiveConfig]);

  const handleSave = async (newData: DataSchema, onWallpaperUpdate?: (cfg: DataSchema) => void) => {
    setSaving(true);
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
    handleSave,
    handleReorder,
    handleTodosUpdate,
    handleNotesUpdate,
    setData
  };
}