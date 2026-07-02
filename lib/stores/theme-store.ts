import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface ThemeState {
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  updateTheme: () => void;
}

// 系统主题变化监听器引用
let mediaQueryListener: ((e: MediaQueryListEvent) => void) | null = null;

function setupSystemThemeListener(store: typeof useThemeStore) {
  if (typeof window === 'undefined') return;

  // 清理旧监听器
  if (mediaQueryListener) {
    window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', mediaQueryListener);
    mediaQueryListener = null;
  }

  // 创建新监听器：只有当前主题为 system 时才自动跟随
  mediaQueryListener = (e: MediaQueryListEvent) => {
    const state = store.getState();
    if (state.theme === 'system') {
      state.updateTheme();
    }
  };

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', mediaQueryListener);
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
      name: 'theme-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);

// 在 persist 水合完成后初始化系统主题监听
if (typeof window !== 'undefined') {
  setTimeout(() => {
    const state = useThemeStore.getState();
    if (state.theme === 'system') {
      state.updateTheme();
    }
    setupSystemThemeListener(useThemeStore);
  }, 0);
}

export { useThemeStore };
