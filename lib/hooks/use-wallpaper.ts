"use client";

import { useState, useCallback } from "react";
import { DataSchema } from "../types/types";

export function useWallpaper(initialWallpapers: string[], initialData: DataSchema) {
  const getInitialWallpaper = useCallback((data: DataSchema): string => {
    if (data.settings.wallpaperType === 'local' && initialWallpapers.length > 0) {
      return initialWallpapers[Math.floor(Math.random() * initialWallpapers.length)];
    }
    if (data.settings.wallpaperType !== 'local' && data.settings.wallpaper) {
        return data.settings.wallpaper;
    }
    return "";
  }, [initialWallpapers]);

  const [currentWallpaper, setCurrentWallpaper] = useState(() => getInitialWallpaper(initialData));
  const [imgLoaded, setImgLoaded] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const preloadWallpaper = useCallback((url: string) => {
    if (!url) return Promise.resolve();

    let cancelled = false;
    return new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.src = url;
      img.onload = () => { if (!cancelled) resolve(); else resolve(); };
      img.onerror = () => { if (!cancelled) resolve(); else reject(new Error('Image load failed')); };
      return () => { cancelled = true; img.src = ''; };
    });
  }, []);

  const initWallpaper = useCallback((cfg: DataSchema) => {
    const { wallpaperType, wallpaper, wallpaperList } = cfg.settings;

    let newWallpaper: string = "";
    if (wallpaperType === 'local') {
      const list = (initialWallpapers.length > 0) ? initialWallpapers : wallpaperList;
      if (list && list.length > 0) {
        newWallpaper = list[Math.floor(Math.random() * list.length)];
      }
    } else if (wallpaperType === 'bing') {
      newWallpaper = `https://bing.img.run/1920x1080.php?t=${new Date().getTime()}`;
    } else {
      newWallpaper = wallpaper;
    }

    if (newWallpaper) {
      if (initialWallpapers.includes(newWallpaper)) {
        setCurrentWallpaper(newWallpaper);
        setImgLoaded(true);
        setIsLoading(false);
      } else {
        setIsLoading(true);
        setImgLoaded(false);
        preloadWallpaper(newWallpaper)
          .then(() => { setCurrentWallpaper(newWallpaper); setImgLoaded(true); })
          .catch(() => { setCurrentWallpaper(newWallpaper); setImgLoaded(true); })
          .finally(() => { setIsLoading(false); });
      }
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
    if (initialWallpapers.includes(newWallpaper)) {
      setCurrentWallpaper(newWallpaper);
      setImgLoaded(true);
      setIsLoading(false);
    } else {
      setIsLoading(true);
      setImgLoaded(false);
      preloadWallpaper(newWallpaper)
        .then(() => { setCurrentWallpaper(newWallpaper); setImgLoaded(true); })
        .catch(() => { setCurrentWallpaper(newWallpaper); setImgLoaded(true); })
        .finally(() => { setIsLoading(false); });
    }
  }, [initialWallpapers, preloadWallpaper]);

  return {
    currentWallpaper,
    imgLoaded,
    isLoading,
    initWallpaper,
    setCurrentWallpaper: handleWallpaperChange,
  };
}
