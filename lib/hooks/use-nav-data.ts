"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { DataSchema } from "../types/types";
import { DEFAULT_DATA, Category, Todo, Note, LinkItem } from "../types/types";
import { StorageAdapter, StorageConfig } from "../adapters/storage";
import { toast } from "sonner";
import { convertToWebP } from '../utils/image-utils';
import { deepEqual } from '../utils/common';
import { mergeCategories, mergeItems } from '../utils/data-merge';
import { useStorageConfig } from './use-storage-config';

const LOCAL_DATA_KEY = "clean-nav-local-data";

// 获取远程数据（React Query 用）
const fetchRemoteData = async (config: StorageConfig, getAdapter: (config: StorageConfig) => StorageAdapter | null): Promise<DataSchema | null> => {
  const adapter = getAdapter(config);
  if (!adapter) return null;
  return await adapter.load();
};

// 保存到云端（React Query Mutation 用）
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
  useEffect(() => { dataRef.current = data; }, [data]);

  const { getEffectiveConfig, getAdapter } = useStorageConfig();
  const initialWallpapersRef = useRef(initialWallpapers);

  // ── 本地持久化 ──
  const updateLocalAndState = useCallback((newData: DataSchema) => {
    setData(newData);
    setHasUnsavedChanges(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem(LOCAL_DATA_KEY, JSON.stringify(newData));
    }
  }, []);

  // ── 初始化 ──
  useEffect(() => {
    const wallpapers = initialWallpapersRef.current;
    async function initData() {
      try {
        let loadedFromStorage = false;

        if (typeof window !== 'undefined') {
          const localDataString = localStorage.getItem(LOCAL_DATA_KEY);
          if (localDataString) {
            try {
              const localData = JSON.parse(localDataString) as DataSchema;
              if (wallpapers.length > 0 && (!localData.settings.wallpaperList || localData.settings.wallpaperList.length === 0)) {
                localData.settings.wallpaperList = [...wallpapers];
              }
              setData(localData);
              loadedFromStorage = true;
            } catch (e) {
              console.error("Failed to parse local data", e);
            }
          }
        }

        // 没有本地数据 + 未配置存储 → 从 data.json 加载默认数据
        const config = getEffectiveConfig();
        if (!loadedFromStorage && !config) {
          try {
            const res = await fetch("/data.json");
            if (res.ok) {
              const fetchedData = await res.json();
              const finalData = { ...fetchedData, todos: [], notes: [] };
              if (wallpapers.length > 0) finalData.settings.wallpaperList = [...wallpapers];
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
      } finally {
        setIsReady(true);
      }
    }
    initData();
  }, [getEffectiveConfig]);

  // ── React Query：主动拉取云端数据 ──
  const { data: remoteData } = useQuery({
    queryKey: ['navData', JSON.stringify(getEffectiveConfig())],
    queryFn: async () => {
      const config = getEffectiveConfig();
      if (!config) return null;
      return fetchRemoteData(config, getAdapter);
    },
    enabled: isReady && !!getEffectiveConfig(),
    refetchOnWindowFocus: false,
    refetchInterval: false,
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });

  // ── 处理远程数据 → 本地合并 ──
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
        notes: mergedNotes,
      };

      if (!deepEqual(finalData, currentData)) {
        if (initialWallpapersRef.current.length > 0) {
          finalData.settings.wallpaperList = [...initialWallpapersRef.current];
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

        setTimeout(() => {
          setData(finalData);
          if (isEffectiveDifferent) {
            setHasUnsavedChanges(true);
          }
        }, 0);
      }
    }
  }, [remoteData, dataRef, mergeCategories, mergeItems, deepEqual]);

  // ── React Query：保存到云端 ──
  const { mutate: saveMutate, isPending: isSaving } = useMutation({
    mutationFn: (params: { newData: DataSchema; config: StorageConfig; onWallpaperUpdate?: (cfg: DataSchema) => void }) => {
      const { newData, config, onWallpaperUpdate } = params;
      if (typeof window !== 'undefined') {
        localStorage.setItem(LOCAL_DATA_KEY, JSON.stringify(newData));
      }
      if (onWallpaperUpdate) onWallpaperUpdate(newData);
      return saveData({ data: newData, config, getAdapter });
    },
    onSuccess: (result, variables) => {
      if (result) {
        toast.success("同步成功！", {
          description: "云端更新可能受 CDN 缓存影响有 1-5 分钟延迟，请勿频繁刷新或重复保存。",
          duration: 5000,
        });
        setHasUnsavedChanges(false);
        setSyncError(false);
        setData(variables.newData);
      } else {
        toast.error("同步失败 (已暂存到本地)", {
          description: "请检查网络连接或云端配置，稍后重试",
          duration: 4000,
        });
        setSyncError(true);
        setData(variables.newData);
        setHasUnsavedChanges(true);
      }
    },
    onError: (error, variables) => {
      console.error("Save error", error);
      toast.error("保存时发生错误", {
        description: typeof error === 'object' && error !== null && 'message' in error
          ? (error.message as string) : "请检查网络或配置",
        duration: 4000,
      });
      setSyncError(true);
      setData(variables.newData);
      setHasUnsavedChanges(true);
    },
  });

  // ── 公共 API：保存 ──
  const handleSave = useCallback(async (newData: DataSchema, onWallpaperUpdate?: (cfg: DataSchema) => void) => {
    setSyncError(false);
    const config = getEffectiveConfig();
    if (!config) {
      updateLocalAndState(newData);
      if (onWallpaperUpdate) onWallpaperUpdate(newData);
      toast.success("本地已更新 (未配置云端)");
      return;
    }
    saveMutate({ newData, config, onWallpaperUpdate });
  }, [getEffectiveConfig, saveMutate, updateLocalAndState]);

  // ── 公共 API：链接拖拽排序 ──
  const handleLinkReorder = useCallback((categoryId: string, links: LinkItem[]) => {
    const newCategories = data.categories.map(cat =>
      cat.id === categoryId ? { ...cat, links, updatedAt: Date.now() } : cat
    );
    updateLocalAndState({ ...data, categories: newCategories });
  }, [data, updateLocalAndState]);

  const handleReorder = useCallback((newCategories: Category[]) => {
    updateLocalAndState({ ...data, categories: newCategories });
  }, [data, updateLocalAndState]);

  // ── 公共 API：待办/笔记 ──
  const handleTodosUpdate = useCallback((newTodos: Todo[]) => {
    updateLocalAndState({ ...data, todos: newTodos });
  }, [data, updateLocalAndState]);

  const handleNotesUpdate = useCallback((newNotes: Note[]) => {
    updateLocalAndState({ ...data, notes: newNotes });
  }, [data, updateLocalAndState]);

  // ── 公共 API：置顶链接 ──
  const handlePinLink = useCallback((link: LinkItem) => {
    if ((data.pinnedLinks || []).some(l => l.id === link.id)) return;
    updateLocalAndState({ ...data, pinnedLinks: [...(data.pinnedLinks || []), { ...link }] });
  }, [data, updateLocalAndState]);

  const handleUnpinLink = useCallback((linkId: string) => {
    updateLocalAndState({ ...data, pinnedLinks: (data.pinnedLinks || []).filter(l => l.id !== linkId) });
  }, [data, updateLocalAndState]);

  const handlePinnedReorder = useCallback((newPinned: LinkItem[]) => {
    updateLocalAndState({ ...data, pinnedLinks: newPinned });
  }, [data, updateLocalAndState]);

  // ── 公共 API：壁纸上传 ──
  const uploadWallpaper = useCallback(async (file: File, onProgress?: (progress: number) => void): Promise<string> => {
    const config = getEffectiveConfig();
    if (!config) throw new Error("未配置存储，无法上传");

    const adapter = getAdapter(config);
    if (!adapter || !adapter.uploadFile) {
      throw new Error("当前存储方式不支持文件上传");
    }

    onProgress?.(5);
    const webpFile = await convertToWebP(file);
    onProgress?.(15);

    return await adapter.uploadFile(webpFile, webpFile.name, (progress) => {
      onProgress?.(15 + (progress * 0.85));
    });
  }, [getAdapter, getEffectiveConfig]);

  return {
    data,
    isReady,
    isSaving,
    hasUnsavedChanges,
    syncError,
    handleSave,
    handleReorder,
    handleLinkReorder,
    handleTodosUpdate,
    handleNotesUpdate,
    uploadWallpaper,
    setData,
    handlePinLink,
    handleUnpinLink,
    handlePinnedReorder,
  };
}
