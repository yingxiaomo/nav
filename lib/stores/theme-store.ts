import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface ThemeState {
  // ── 基础主题 ──
  theme: 'light' | 'dark' | 'system';

  // ── 视觉定制 ──
  accentColor: string;
  overlayDarkness: number;    // 0–100
  cardOpacity: number;        // 0–100
  fontFamily: 'system' | 'mono';
  blurLevel: 'low' | 'medium' | 'high';

  // ── 动作 ──
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setAccentColor: (color: string) => void;
  setOverlayDarkness: (value: number) => void;
  setCardOpacity: (value: number) => void;
  setFontFamily: (family: 'system' | 'mono') => void;
  setBlurLevel: (level: 'low' | 'medium' | 'high') => void;
  updateTheme: () => void;
  resetTheme: () => void;
}

const BLUR_MAP = { low: '4px', medium: '12px', high: '24px' } as const;
const ACCENT_MAP: Record<string, { light: string; dark: string }> = {
  blue:   { light: '#3b82f6', dark: '#60a5fa' },
  purple: { light: '#8b5cf6', dark: '#a78bfa' },
  green:  { light: '#10b981', dark: '#34d399' },
  orange: { light: '#f59e0b', dark: '#fbbf24' },
  amber:  { light: '#f97316', dark: '#fb923c' },
};

export const THEME_DEFAULTS = {
  theme: 'system' as const,
  accentColor: 'blue',
  overlayDarkness: 20,
  cardOpacity: 10,
  fontFamily: 'system' as const,
  blurLevel: 'medium' as const,
};

function applyCSS(state: ThemeState) {
  if (typeof window === 'undefined') return;
  const root = document.documentElement;
  const isDark = state.theme === 'dark' ||
    (state.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  // Theme mode class
  root.classList.remove('light', 'dark');
  root.classList.add(isDark ? 'dark' : 'light');
  root.setAttribute('data-theme', isDark ? 'dark' : 'light');

  // Accent color
  const accent = ACCENT_MAP[state.accentColor];
  if (accent) {
    root.style.setProperty('--accent', isDark ? accent.dark : accent.light);
  }

  // Overlay darkness (0–1 decimal for CSS rgba)
  const darkness = Math.min(100, Math.max(0, state.overlayDarkness)) / 100;
  root.style.setProperty('--overlay-darkness', `${darkness}`);

  // Card backdrop opacity (0–1 decimal)
  const opacity = Math.min(100, Math.max(0, state.cardOpacity)) / 100;
  root.style.setProperty('--card-opacity', `${opacity}`);

  // Blur
  root.style.setProperty('--blur-amount', BLUR_MAP[state.blurLevel] || BLUR_MAP.medium);

  // Font
  root.style.setProperty('--font-body', state.fontFamily === 'mono'
    ? 'var(--font-geist-mono)'
    : 'var(--font-geist-sans)');
}

// System theme change listener
let mediaListener: ((e: MediaQueryListEvent) => void) | null = null;

function setupListener(store: typeof useThemeStore) {
  if (typeof window === 'undefined') return;
  if (mediaListener) {
    window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', mediaListener);
  }
  mediaListener = () => {
    const state = store.getState();
    if (state.theme === 'system') {
      applyCSS(state);
    }
  };
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', mediaListener);
}

const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'system',
      accentColor: 'blue',
      overlayDarkness: 20,
      cardOpacity: 10,
      fontFamily: 'system',
      blurLevel: 'medium',

      setTheme: (theme) => {
        set({ theme });
        applyCSS(get());
        setupListener(useThemeStore);
      },

      setAccentColor: (color) => {
        set({ accentColor: color });
        applyCSS(get());
      },

      setOverlayDarkness: (value) => {
        set({ overlayDarkness: value });
        applyCSS(get());
      },

      setCardOpacity: (value) => {
        set({ cardOpacity: value });
        applyCSS(get());
      },

      setFontFamily: (family) => {
        set({ fontFamily: family });
        applyCSS(get());
      },

      setBlurLevel: (level) => {
        set({ blurLevel: level });
        applyCSS(get());
      },

      updateTheme: () => {
        applyCSS(get());
      },

      resetTheme: () => {
        set({
          theme: 'system',
          accentColor: 'blue',
          overlayDarkness: 20,
          cardOpacity: 10,
          fontFamily: 'system',
          blurLevel: 'medium',
        });
        applyCSS(get());
        setupListener(useThemeStore);
      },
    }),
    {
      name: 'theme-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);

// Init on load
if (typeof window !== 'undefined') {
  setTimeout(() => {
    const state = useThemeStore.getState();
    applyCSS(state);
    setupListener(useThemeStore);
  }, 0);
}

export { useThemeStore, ACCENT_MAP, BLUR_MAP };
