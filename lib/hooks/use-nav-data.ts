"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DataSchema, DEFAULT_DATA, Category, Todo, Note } from "../types/types";
import { GITHUB_CONFIG_KEY } from "../adapters/github";
import { StorageAdapter, GithubRepoAdapter, S3Adapter, WebDavAdapter, GistAdapter, STORAGE_CONFIG_KEY, StorageConfig, GithubRepoSettings, S3Settings, WebDavSettings, GistSettings } from "../adapters/storage";
import { toast } from "sonner";

const LOCAL_DATA_KEY = "clean-nav-local-data";

// 获取远程数据的函数，用于React Query
const fetchRemoteData = async (config: StorageConfig, getAdapter: (config: StorageConfig) => StorageAdapter | null): Promise<DataSchema | null> => {
  const adapter = getAdapter(config);
  if (!adapter) return null;
  return await adapter.load();
};

// 保存数据的函数，用于React Query Mutation
const saveData = async (params: {
  data: DataSchema;
  config: StorageConfig;
  getAdapter: (config: StorageConfig) => StorageAdapter | null;
}): Promise<boolean> => {
  const { data, config, getAdapter } = params;
  const adapter = getAdapter(config);
  if (!adapter) return false;
  return await adapter.save(data);
};

export function useNavData(initialWallpapers: string[]) {
  const [isReady, setIsReady] = useState(false);
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

  // 初始化数据
  useEffect(() => {
    async function initData() {
      try {
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
              setData(localData);
              loadedFromStorage = true;
            } catch (e) {
              console.error("Failed to parse local data", e);
            }
          }
        }

        // 如果没有配置存储，尝试从data.json加载
        const config = getEffectiveConfig();
        if (!loadedFromStorage && !config) {
          try {
            const res = await fetch("/data.json");
            if (res.ok) {
              const fetchedData = await res.json();
              const finalData = { ...fetchedData, todos: [], notes: [] };
              if (initialWallpapers.length > 0) finalData.settings.wallpaperList = [...initialWallpapers];
              setData(finalData);
              if (typeof window !== 'undefined') {
                localStorage.setItem(LOCAL_DATA_KEY, JSON.stringify(finalData));
              }
            }
          } catch {
            console.log("No deployed data.json found.");
          }
        }
      } catch (err) {
        console.error("Initialization error", err);
        setSyncError(true);
        toast.error("初始化同步失败，请检查网络或配置", {
          duration: 4000
        });
      } finally {
        // 确保所有数据加载尝试完成后再标记为就绪
        setIsReady(true);
      }
    }

    initData();
  }, [initialWallpapers, getEffectiveConfig]);

  // 数据合并函数
  const mergeItems = useCallback(<T extends { id: string; updatedAt?: number }>(
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
  }, []);

  // 分类合并函数
  const mergeCategories = useCallback((remoteCats: Category[], localCats: Category[]): Category[] => {
      const mergeCategoryLinks = (remoteCat: Category, localCat: Category): Category => {
          const mergedLinks = mergeItems(remoteCat.links, localCat.links);
          return {
              ...remoteCat,
              links: mergedLinks
          };
      };
      
      return mergeItems(remoteCats, localCats, mergeCategoryLinks);
  }, [mergeItems]);

  // 使用 React Query Mutation 保存数据
  const { mutate: saveMutate, isPending: isSaving, isSuccess, isError, error, data: mutationResult, variables: mutationVariables } = useMutation({
    mutationFn: (params: {
      newData: DataSchema;
      config: StorageConfig;
      onWallpaperUpdate?: (cfg: DataSchema) => void;
    }) => {
      const { newData, config, onWallpaperUpdate } = params;
      
      // 保存到本地
      if (typeof window !== 'undefined') {
        localStorage.setItem(LOCAL_DATA_KEY, JSON.stringify(newData));
      }
      
      // 更新壁纸
      if (onWallpaperUpdate) {
        onWallpaperUpdate(newData);
      }
      
      // 保存到云端
      return saveData({ data: newData, config, getAdapter });
    },
  });

  // 处理保存成功
  useEffect(() => {
    if (isSuccess && mutationResult && mutationVariables) {
      if (mutationResult) {
        toast.success("同步成功！", {
          description: "云端更新可能受 CDN 缓存影响有 1-5 分钟延迟，请勿频繁刷新或重复保存。",
          duration: 5000,
        });
        setTimeout(() => {
          setHasUnsavedChanges(false);
          setSyncError(false);
          setData(mutationVariables.newData);
        }, 0);
      } else {
        toast.error("同步失败 (已暂存到本地)", {
          description: "请检查网络连接或云端配置，稍后重试",
          duration: 4000
        });
        setTimeout(() => {
          setSyncError(true);
          setData(mutationVariables.newData);
          setHasUnsavedChanges(true);
        }, 0);
      }
    }
  }, [isSuccess, mutationResult, mutationVariables]);

  // 处理保存错误
  useEffect(() => {
    if (isError && mutationVariables) {
      console.error("Save error", error);
      toast.error("保存时发生错误", {
        description: typeof error === 'object' && error !== null && 'message' in error ? (error.message as string) : "请检查网络或配置",
        duration: 4000
      });
      setTimeout(() => {
        setSyncError(true);
        setData(mutationVariables.newData);
        setHasUnsavedChanges(true);
      }, 0);
    }
  }, [isError, error, mutationVariables]);

  // 使用 React Query 获取远程数据
  const { data: remoteData } = useQuery({
    queryKey: ['navData', getEffectiveConfig()],
    queryFn: async () => {
      const config = getEffectiveConfig();
      if (!config) return null;
      return fetchRemoteData(config, getAdapter);
    },
    enabled: isReady && !!getEffectiveConfig(), // 只有在配置了存储时才获取远程数据
    refetchOnWindowFocus: false, // 禁用窗口聚焦时自动刷新
    refetchInterval: false, // 禁用自动刷新
    staleTime: 10 * 60 * 1000, // 数据10分钟内视为新鲜
    retry: 1, // 只重试一次，减少加载时间
  });

  // 处理远程数据获取成功
  useEffect(() => {
    if (remoteData) {
      const currentData = dataRef.current;
      const localTodos = currentData.todos || [];
      const localNotes = currentData.notes || [];
      const localCategories = currentData.categories || [];
      
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
        if (typeof window !== 'undefined') {
          localStorage.setItem(LOCAL_DATA_KEY, JSON.stringify(finalData));
        }

        const isEffectiveDifferent = 
          JSON.stringify(mergedCategories) !== JSON.stringify(remoteData.categories) ||
          JSON.stringify(mergedTodos) !== JSON.stringify(remoteData.todos) ||
          JSON.stringify(mergedNotes) !== JSON.stringify(remoteData.notes);

        if (isEffectiveDifferent) {
          toast.info("已合并云端数据，本地新增内容已保留 (请点击保存以同步到云端)");
        } else {
          toast.success("已从云端同步最新数据");
        }
        
        // 使用 setTimeout 包装 setState 调用，使其异步执行
        setTimeout(() => {
          setData(finalData);
          if (isEffectiveDifferent) {
            setHasUnsavedChanges(true);
          }
        }, 0);
      }
    }
  }, [remoteData, dataRef, initialWallpapers, mergeCategories, mergeItems]);

  // 处理远程数据获取错误
  useEffect(() => {
    // 移除未使用的变量
  }, []);

  const handleSave = useCallback(async (newData: DataSchema, onWallpaperUpdate?: (cfg: DataSchema) => void) => {
    setSyncError(false);
    
    const config = getEffectiveConfig();
    if (!config) {
      // 未配置云端，只保存到本地
      updateLocalAndState(newData);
      if (onWallpaperUpdate) {
        onWallpaperUpdate(newData);
      }
      toast.success("本地已更新 (未配置云端)");
      return;
    }

    // 调用 React Query Mutation 保存数据
    saveMutate({ newData, config, onWallpaperUpdate });
  }, [getEffectiveConfig, saveMutate, updateLocalAndState]);

  const handleReorder = useCallback((newCategories: Category[]) => {
    updateLocalAndState({ ...data, categories: newCategories });
  }, [data, updateLocalAndState]);

  const handleTodosUpdate = useCallback((newTodos: Todo[]) => {
    updateLocalAndState({ ...data, todos: newTodos });
  }, [data, updateLocalAndState]);

  const handleNotesUpdate = useCallback((newNotes: Note[]) => {
    updateLocalAndState({ ...data, notes: newNotes });
  }, [data, updateLocalAndState]);

  const uploadWallpaper = useCallback(async (file: File, onProgress?: (progress: number) => void): Promise<string> => {
      const config = getEffectiveConfig();
      if (!config) throw new Error("未配置存储，无法上传");
      
      const adapter = getAdapter(config);
      if (!adapter || !adapter.uploadFile) {
          throw new Error("当前存储方式不支持文件上传");
      }
      
      return await adapter.uploadFile(file, file.name, onProgress);
  }, [getAdapter, getEffectiveConfig]);

  return {
    data,
    isReady,
    isSaving,
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
