"use client";

import { useState, useCallback, useEffect } from "react";
import { DataSchema } from "../types/types";

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
