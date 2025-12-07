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
  wallpaperType: 'custom' | 'local' | 'bing';
  wallpaperList: string[];
  blurLevel: 'low' | 'medium' | 'high';
}

export interface DataSchema {
  settings: SiteSettings;
  categories: Category[];
}

export const DEFAULT_DATA: DataSchema = {
  settings: {
    title: "Clean Nav",
    wallpaper: "https://images.unsplash.com/photo-1477346611705-65d1883cee1e?auto=format&fit=crop&q=80&w=1920",
    wallpaperType: 'local',
    wallpaperList: [],
    blurLevel: 'medium'
  },
  categories: [
    {
      id: "c1",
      title: "常用",
      icon: "FolderOpen", 
      links: [
        { id: "l1", title: "Google", url: "https://google.com", icon: "Search" },
        { id: "l2", title: "GitHub", url: "https://github.com", icon: "Github" },
      ]
    }
  ]
};