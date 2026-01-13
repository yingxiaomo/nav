import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface ThemeState {
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  updateTheme: () => void;
}

const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'system',
      
      setTheme: (theme) => {
        set({ theme });
        get().updateTheme();
      },
      
      updateTheme: () => {
        if (typeof window === 'undefined') return;
        
        const root = window.document.documentElement;
        const { theme } = get();
        const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
        
        root.classList.remove('light', 'dark');
        root.classList.add(isDark ? 'dark' : 'light');
        root.setAttribute('data-theme', isDark ? 'dark' : 'light');
      },
    }),
    {
      name: 'theme-storage', // name of the item in the storage (must be unique)
      storage: createJSONStorage(() => localStorage), // (optional) by default, 'localStorage' is used
    }
  )
);

export { useThemeStore };
