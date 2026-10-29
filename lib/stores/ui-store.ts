import { create } from 'zustand';

/** 待建立的 SSH 连接请求（由命令面板 / 监控右键发起） */
export interface SSHConnectRequest {
  name: string;
  host: string;
  user: string;
  pass: string;
  port?: number;
  /** 递增 token，确保相同参数也能重复触发 */
  token: number;
}

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
  /** 后端 API 是否可用（静态部署时为 false；后端瞬断时短暂为 false） */
  backendAvailable: boolean;
  /** 本次会话是否曾检测到后端：一旦为 true 永不回退。
   *  用于区分"纯静态部署"（从未有后端）与"后端短暂宕机"——
   *  后者必须保持登录门控 fail-closed，不得降级为静态模式放行 */
  backendEverAvailable: boolean;
  /** 登录状态（共享认证状态：所有组件读同一份，避免各自轮询各自为政） */
  authLoggedIn: boolean;
  /** 共享认证状态写入（登录态翻转时组件据此失效缓存/清面板） */
  setAuthStatus: (loggedIn: boolean) => void;
  /** 待处理的 SSH 连接请求 */
  sshConnectRequest: SSHConnectRequest | null;

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
  /** 发起 SSH 终端连接（打开面板 + 投递连接请求） */
  openSSHConnection: (req: Omit<SSHConnectRequest, 'token'>) => void;
  /** SSH 面板消费完连接请求后清除 */
  clearSSHConnectRequest: () => void;
}

const useUIStore = create<UIState>((set, get) => ({
  isSettingsOpen: false,
  activePanel: null,
  isCommandPaletteOpen: false,
  isCheatSheetOpen: false,
  sidebarCollapsed: true,
  backendAvailable: true,
  backendEverAvailable: false,
  authLoggedIn: false,
  sshConnectRequest: null,

  setSettingsOpen: (open) => set({ isSettingsOpen: open }),

  togglePanel: (panelName) => {
    const { activePanel } = get();
    set({ activePanel: activePanel === panelName ? null : panelName });
  },

  setActivePanel: (panelName) => set({ activePanel: panelName }),

  setCommandPaletteOpen: (open) => set({ isCommandPaletteOpen: open }),

  setCheatSheetOpen: (open) => set({ isCheatSheetOpen: open }),

  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

  setBackendAvailable: (available) =>
    set((s) => ({
      backendAvailable: available,
      backendEverAvailable: s.backendEverAvailable || available,
    })),

  setAuthStatus: (loggedIn) => set({ authLoggedIn: loggedIn }),

  openSSHConnection: (req) => set({
    activePanel: 'ssh',
    isCommandPaletteOpen: false,
    sshConnectRequest: { ...req, port: req.port || 22, token: Date.now() },
  }),

  clearSSHConnectRequest: () => set({ sshConnectRequest: null }),

  closeAllPanels: () => set({
    isSettingsOpen: false,
    activePanel: null,
    isCheatSheetOpen: false,
    isCommandPaletteOpen: false,
    sshConnectRequest: null,
  }),
}));

export { useUIStore };
