export interface LinkItem {
  id: string;
  title: string;
  url: string;
  icon?: string;
  description?: string;
}

export interface Category {
  id: string;
  title: string;
  icon?: string; 
  links: LinkItem[];
}

export interface SiteSettings {
  title: string;
  wallpaper: string;
  wallpaperType: 'custom' | 'local' | 'bing' | 'url';
  wallpaperList: string[];
  blurLevel: 'low' | 'medium' | 'high';
  maxPackedWallpapers?: number;
}

export interface DataSchema {
  settings: SiteSettings;
  categories: Category[];
}


export const DEFAULT_DATA: DataSchema = {
  settings: {
    title: "Clean Nav",
    wallpaper: "", 
    wallpaperType: 'local',
    wallpaperList: [],
    blurLevel: 'medium',
    maxPackedWallpapers: 10 
  },
  categories: [] 
};