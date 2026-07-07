import { create } from 'zustand';

interface UIState {
  /** 设置对话框是否打开 */
  isSettingsOpen: boolean;
  /** 当前激活的功能面板（待办/笔记），互斥 */
  activePanel: 'todo' | 'note' | 'monitor' | null;
  /** 快捷键帮助面板是否打开 */
  isCheatSheetOpen: boolean;
  /** 侧边栏书签是否收起 */
  sidebarCollapsed: boolean;

  /** 打开/关闭设置对话框 */
  setSettingsOpen: (open: boolean) => void;
  /** 切换功能面板：相同面板关闭，不同面板切换 */
  togglePanel: (panelName: 'todo' | 'note' | 'monitor') => void;
  /** 直接设置活动面板（用于外部控制或焦点切换） */
  setActivePanel: (panelName: 'todo' | 'note' | 'monitor' | null) => void;
  /** 开关快捷键帮助面板 */
  setCheatSheetOpen: (open: boolean) => void;
  /** 关闭所有浮动面板（Escape 统一回调） */
  closeAllPanels: () => void;
  /** 切换侧边栏展开/收起 */
  setSidebarCollapsed: (collapsed: boolean) => void;
}

const useUIStore = create<UIState>((set, get) => ({
  isSettingsOpen: false,
  activePanel: null,
  isCheatSheetOpen: false,
  sidebarCollapsed: true,

  setSettingsOpen: (open) => set({ isSettingsOpen: open }),

  togglePanel: (panelName) => {
    const { activePanel } = get();
    set({ activePanel: activePanel === panelName ? null : panelName });
  },

  setActivePanel: (panelName) => set({ activePanel: panelName }),

  setCheatSheetOpen: (open) => set({ isCheatSheetOpen: open }),

  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

  closeAllPanels: () => set({
    isSettingsOpen: false,
    activePanel: null,
    isCheatSheetOpen: false,
  }),
}));

export { useUIStore };
