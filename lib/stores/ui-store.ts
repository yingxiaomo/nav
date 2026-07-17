import { create } from 'zustand';

interface UIState {
  /** 设置对话框是否打开 */
  isSettingsOpen: boolean;
  /** 当前激活的功能面板，互斥 */
  activePanel: 'todo' | 'note' | 'monitor' | 'ai' | 'ssh' | null;
  /** ⌘K 命令面板是否打开 */
  isCommandPaletteOpen: boolean;
  /** 快捷键帮助面板是否打开 */
  isCheatSheetOpen: boolean;
  /** 侧边栏书签是否收起 */
  sidebarCollapsed: boolean;
  /** 后端 API 是否可用（静态部署时为 false） */
  backendAvailable: boolean;

  /** 打开/关闭设置对话框 */
  setSettingsOpen: (open: boolean) => void;
  /** 切换功能面板：相同面板关闭，不同面板切换 */
  togglePanel: (panelName: 'todo' | 'note' | 'monitor' | 'ai' | 'ssh') => void;
  /** 直接设置活动面板（用于外部控制或焦点切换） */
  setActivePanel: (panelName: 'todo' | 'note' | 'monitor' | 'ai' | 'ssh' | null) => void;
  /** 打开/关闭 ⌘K 面板 */
  setCommandPaletteOpen: (open: boolean) => void;
  /** 开关快捷键帮助面板 */
  setCheatSheetOpen: (open: boolean) => void;
  /** 关闭所有浮动面板（Escape 统一回调） */
  closeAllPanels: () => void;
  /** 切换侧边栏展开/收起 */
  setSidebarCollapsed: (collapsed: boolean) => void;
  /** 设置后端可用状态 */
  setBackendAvailable: (available: boolean) => void;
}

const useUIStore = create<UIState>((set, get) => ({
  isSettingsOpen: false,
  activePanel: null,
  isCommandPaletteOpen: false,
  isCheatSheetOpen: false,
  sidebarCollapsed: true,
  backendAvailable: true,

  setSettingsOpen: (open) => set({ isSettingsOpen: open }),

  togglePanel: (panelName) => {
    const { activePanel } = get();
    set({ activePanel: activePanel === panelName ? null : panelName });
  },

  setActivePanel: (panelName) => set({ activePanel: panelName }),

  setCommandPaletteOpen: (open) => set({ isCommandPaletteOpen: open }),

  setCheatSheetOpen: (open) => set({ isCheatSheetOpen: open }),

  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

  setBackendAvailable: (available) => set({ backendAvailable: available }),

  closeAllPanels: () => set({
    isSettingsOpen: false,
    activePanel: null,
    isCheatSheetOpen: false,
    isCommandPaletteOpen: false,
  }),
}));

export { useUIStore };
