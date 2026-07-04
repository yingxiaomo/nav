export interface CategoryInput {
  id?: string;
  title: string;
  icon?: string;
  order?: number;
}

export interface BookmarkInput {
  id?: string;
  categoryId: string;
  title: string;
  url: string;
  icon?: string;
  description?: string;
  order?: number;
}

export interface SettingInput {
  key: string;
  value: string;
}

// ===== DataSchema — 完整数据快照 (对应前端 DataSchema) =====

export interface LinkItem {
  id: string;
  title: string;
  url: string;
  icon?: string;
  description?: string;
  type?: 'link' | 'folder';
  children?: LinkItem[];
  updatedAt?: number;
  order?: number;
}

export interface Category {
  id: string;
  title: string;
  icon?: string;
  links: LinkItem[];
  updatedAt?: number;
  order?: number;
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
  showFeatures?: boolean;
  homeLayout?: 'folder' | 'list' | 'sidebar';
  theme?: 'light' | 'dark' | 'system';
}

export interface DataSchema {
  settings: SiteSettings;
  categories: Category[];
  todos?: Todo[];
  notes?: Note[];
  pinnedLinks?: LinkItem[];
}
