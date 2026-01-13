export interface LinkItem {
  id: string;
  title: string;
  url: string;
  icon?: string;
  description?: string;
  type?: 'link' | 'folder';
  children?: LinkItem[];
  updatedAt?: number;
}

export interface Category {
  id: string;
  title: string;
  icon?: string; 
  links: LinkItem[];
  updatedAt?: number;
}

export interface Todo {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  updatedAt: number;
}

export interface SiteSettings {
  title: string;
  wallpaper: string;
  wallpaperType: 'custom' | 'local' | 'bing' | 'url';
  wallpaperList: string[];
  blurLevel: 'low' | 'medium' | 'high';
  maxPackedWallpapers?: number;
  showFeatures?: boolean; 
  homeLayout?: 'folder' | 'list';
  theme?: 'light' | 'dark' | 'system';
}

export interface DataSchema {
  settings: SiteSettings;
  categories: Category[];
  todos?: Todo[];
  notes?: Note[];
}

export const DEFAULT_DATA: DataSchema = {
  settings: {
    title: "Clean Nav",
    wallpaper: "", 
    wallpaperType: 'local',
    wallpaperList: [],
    blurLevel: 'medium',
    maxPackedWallpapers: 10,
    showFeatures: true,
    homeLayout: 'folder',
    theme: 'system'
  },
  categories: [],
  todos: [],
  notes: []
};