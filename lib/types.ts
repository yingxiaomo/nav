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
  links: LinkItem[];
}

export interface SiteSettings {
  title: string;
  wallpaper: string;
  wallpaperType: 'url' | 'bing' | 'daily';
  blurLevel: 'low' | 'medium' | 'high';
}

export interface DataSchema {
  settings: SiteSettings;
  categories: Category[];
}

export const DEFAULT_DATA: DataSchema = {
  settings: {
    title: "Clean Nav",
    wallpaper: "https://images.unsplash.com/photo-1477346611705-65d1883cee1e?auto=format&fit=crop&q=80&w=3870&ixlib=rb-4.0.3",
    wallpaperType: 'url',
    blurLevel: 'medium'
  },
  categories: [
    {
      id: "c1",
      title: "常用",
      links: [
        { id: "l1", title: "Google", url: "https://google.com", icon: "Search" },
        { id: "l2", title: "GitHub", url: "https://github.com", icon: "Github" },
        { id: "l3", title: "ChatGPT", url: "https://chatgpt.com", icon: "Bot" },
      ]
    },
    {
      id: "c2",
      title: "开发",
      links: [
        { id: "l4", title: "Vercel", url: "https://vercel.com", icon: "Triangle" },
        { id: "l5", title: "React", url: "https://react.dev", icon: "Atom" },
      ]
    }
  ]
};
