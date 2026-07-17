"use client";

import { useEffect, useState, useRef, useMemo, Suspense, lazy } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ClockWidget } from "@/components/nav/clock";
import { SearchBar } from "@/components/nav/search-bar";
import { LinkGrid, type FolderModalHandle } from "@/components/nav/link-grid";
// 懒加载设置对话框组件
const SettingsDialog = lazy(() => import("@/components/nav/settings").then(mod => ({ default: mod.SettingsDialog })));
// 懒加载快捷键帮助面板
const CheatSheet = lazy(() => import("@/components/features/cheat-sheet").then(mod => ({ default: mod.CheatSheet })));
import { FeaturesLauncher } from "@/components/features/features-launcher";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { SystemStatusFloater } from "@/components/features/system-status-floater";
import { AuthSetupDialog } from "@/components/features/auth-setup-dialog";
import Image from "next/image";

import { useWallpaper, useNavData, useKeyboardShortcuts, useBackendCheck } from "@/lib";
import { useUIStore } from "@/lib/stores";
import { CommandPalette } from "@/components/features/command-palette";
import { AIPanel } from "@/components/features/ai-panel";
import { SSHTerminalPanel } from "@/components/features/ssh-terminal";

interface HomeClientProps {
  initialWallpapers: string[]; 
}

export default function HomeClient({ initialWallpapers }: HomeClientProps) {
  // 创建 QueryClient 实例
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000, // 5分钟后数据过期
        retry: 2, // 重试次数
        refetchOnWindowFocus: true, // 窗口获取焦点时重新获取数据
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <HomeContent initialWallpapers={initialWallpapers} />
    </QueryClientProvider>
  );
}

function HomeContent({ initialWallpapers }: { initialWallpapers: string[] }) {
  const {
    data,
    isReady,
    isSaving,
    hasUnsavedChanges,
    syncError,
    handleSave,
    handleReorder,
    handleLinkReorder,
    handleTodosUpdate,
    handleNotesUpdate,
    uploadWallpaper,
    handlePinLink,
    handleUnpinLink,
    handlePinnedReorder,
    handleUpdatePinnedLink,
  } = useNavData(initialWallpapers);

  const {
    currentWallpaper,
    imgLoaded,
    initWallpaper,
  } = useWallpaper(initialWallpapers, data);

  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const folderNavRef = useRef<FolderModalHandle>(null);
  const { isSettingsOpen, setSettingsOpen, activePanel, closeAllPanels, isCheatSheetOpen, setCheatSheetOpen, setBackendAvailable, setCommandPaletteOpen, isCommandPaletteOpen, togglePanel } = useUIStore();
  const { sidebarCollapsed } = useUIStore();

  // 检测后端是否可用（静态部署时禁用后端功能），定期重试
  useBackendCheck();

  // 拍平所有书签（用于 Fuse.js 模糊搜索）
  const allBookmarks = useMemo(
    () => data.categories.flatMap((cat) => cat.links),
    [data.categories],
  );

  // 键盘快捷键注册表
  useKeyboardShortcuts([
    {
      key: 'meta+s',
      handler: () => handleSave(data),
      label: '保存并同步',
      category: 'global',
      allowInInputs: true,
    },
    {
      key: '/',
      handler: () => setCommandPaletteOpen(true),
      label: '打开命令面板',
      category: 'global',
    },
    {
      key: 'meta+i',
      handler: () => togglePanel('ai'),
      label: 'AI 对话',
      category: 'global',
      allowInInputs: true,
    },
    {
      key: 'meta+t',
      handler: () => togglePanel('ssh'),
      label: 'SSH 终端',
      category: 'global',
      allowInInputs: true,
    },
    {
      key: 'meta+n',
      handler: () => setSettingsOpen(true),
      label: '添加链接',
      category: 'global',
      allowInInputs: true,
    },
    {
      key: 'meta+,',
      handler: () => setSettingsOpen(!useUIStore.getState().isSettingsOpen),
      label: '打开设置',
      category: 'global',
      allowInInputs: true,
    },
    {
      key: 'escape',
      handler: () => {
        // 层级 1：⌘K 面板打开 → 关闭
        if (isCommandPaletteOpen) { setCommandPaletteOpen(false); return; }
        // 层级 2：搜索框聚焦 → 失焦并清空搜索
        if (document.activeElement === searchInputRef.current) {
          searchInputRef.current?.blur();
          setSearchQuery("");
          return;
        }
        // 层级 3：文件夹模态框打开 → 返回上级或关闭
        if (folderNavRef.current?.back()) { return; }
        // 层级 4：快捷键帮助面板打开 → 关闭
        if (isCheatSheetOpen) { closeAllPanels(); return; }
        // 层级 5：有面板打开 → 关闭所有浮动 UI
        if (activePanel !== null || isSettingsOpen) { closeAllPanels(); return; }
      },
      label: '关闭面板 / 返回上级',
      category: 'global',
      allowInInputs: true,
      preventDefault: false,
    },
    // 快捷键帮助面板
    {
      key: '?',
      handler: () => setCheatSheetOpen(!useUIStore.getState().isCheatSheetOpen),
      label: '快捷键速查',
      category: 'global',
    },
    {
      key: 'meta+/',
      handler: () => setCheatSheetOpen(!useUIStore.getState().isCheatSheetOpen),
      label: '快捷键速查',
      category: 'global',
      allowInInputs: true,
    },
  ]);

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log("%c Clean Nav ", "background: #3b82f6; color: #fff; border-radius: 4px; font-weight: bold;");
      console.log("%c✨ 欢迎来到我的导航页 | 项目已开源", "color: #3b82f6;");
      console.log("%cGithub: https://github.com/yingxiaomo/nav", "color: #aaa; font-size: 12px; font-family: monospace;");
      console.log("%c主页: https://ovoxo.cc", "color: #aaa; font-size: 12px; font-family: monospace;");
    }
  }, []);

  const getFilteredCategories = useMemo(() => {
    if (!searchQuery) return data.categories;
    return data.categories.map(cat => ({
        ...cat,
        links: cat.links.filter(l =>
            l.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            l.url.toLowerCase().includes(searchQuery.toLowerCase())
        )
    })).filter(cat => cat.links.length > 0);
  }, [data.categories, searchQuery]);

  const displayCategories = getFilteredCategories;

  if (!isReady) {
    return (
        <div className="min-h-dvh w-full bg-gradient-to-br from-gray-900 via-black to-gray-900 flex flex-col items-center justify-center p-4">
            <div className="flex flex-col items-center gap-4">
                <div className="relative">
                    <div className="h-16 w-16 rounded-full bg-white/10 flex items-center justify-center overflow-hidden">
                        <Image
                            src="/icon/logo.png"
                            alt="Logo"
                            width={48}
                            height={48}
                            className="h-12 w-12 object-contain"
                        />
                    </div>
                    <div className="absolute inset-0 rounded-full border-4 border-white/30 border-t-transparent animate-spin-slow"></div>
                </div>
                <div className="text-center space-y-2">
                    <h2 className="text-white text-xl font-medium animate-in fade-in slide-in-from-bottom-4 duration-300 delay-100">正在加载数据...</h2>
                    <p className="text-white/60 text-sm animate-in fade-in slide-in-from-bottom-4 duration-300 delay-200">请稍候，我们正在为您准备最佳体验</p>
                </div>
            </div>
        </div>
    );
  }

  return (
    <ThemeProvider initialTheme={data.settings.theme || "system"}>
      <main id="main-content" className="relative min-h-dvh w-full overflow-hidden flex flex-col items-center p-6 md:p-12 animate-in fade-in duration-300">
        <div 
          className="fixed inset-0 z-0 transition-opacity duration-700 ease-in-out bg-cover bg-center bg-no-repeat bg-gray-900"
          style={{
              backgroundImage: currentWallpaper ? `url(${currentWallpaper})` : undefined,
              opacity: imgLoaded ? 1 : 0 
          }}
        />
        <div className="fixed inset-0 z-0 bg-[rgba(0,0,0,var(--overlay-darkness,0.2))] pointer-events-none" />
        <div className="fixed top-4 right-4 z-50 flex gap-2">
          <Suspense fallback={
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm">
              <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
            </div>
          }>
            <ErrorBoundary name="settings" fallback={<div className="w-10 h-10" />}>
              <SettingsDialog
                data={data}
                onSave={(newData) => handleSave(newData)}
                isSaving={isSaving}
                hasUnsavedChanges={hasUnsavedChanges}
                syncError={syncError}
                onRefreshWallpaper={() => initWallpaper(data)}
                uploadWallpaper={uploadWallpaper}
              />
            </ErrorBoundary>
          </Suspense>
          {data.settings.showMonitor !== false && <div className="max-md:hidden"><SystemStatusFloater /></div>}
        </div>

        {/* Floating feature icons - top left */}
        {data.settings.showFeatures !== false && !searchQuery && (
          <ErrorBoundary name="features" fallback={null}>
            <FeaturesLauncher
              todos={data.todos || []}
              notes={data.notes || []}
              onTodosUpdate={handleTodosUpdate}
              onNotesUpdate={handleNotesUpdate}
            />
          </ErrorBoundary>
        )}

        <div className="relative z-10 w-full flex flex-col items-center flex-grow">
            <div className={`w-full max-w-5xl flex flex-col items-center shrink-0 ${data.settings.homeLayout === 'list' ? 'mt-8' : 'mt-6 md:mt-10'}`}>
                <div className="flex flex-col items-center w-full">
                  {data.settings.homeLayout !== 'list' && (
                    <>
                      <h1 className="sr-only">Clean Nav</h1>
                      <ClockWidget />
                    </>
                  )}
                  {data.settings.homeLayout === 'list' && (
                    <h1 className="sr-only">Clean Nav</h1>
                  )}

                  <div className={data.settings.homeLayout === 'list' ? "mt-6 w-full" : "w-full"}>
                  <SearchBar
                    ref={searchInputRef}
                    onLocalSearch={setSearchQuery}
                    bookmarks={allBookmarks}
                    onOpenLink={(url) => window.open(url, '_blank', 'noopener,noreferrer')}
                  />
                </div>
                </div>
            </div>

            {data.settings.homeLayout !== 'list' && <div className="flex-grow" />}

            <div className={`w-full max-w-5xl flex flex-col items-center ${data.settings.homeLayout === 'list' ? 'mt-4 mb-20' : '-mt-2 mb-6'}`}>
              <ErrorBoundary name="link-grid" fallback={<p className="text-white/60 text-sm mt-8">书签加载失败</p>}>
                <LinkGrid
                  ref={folderNavRef}
                  categories={displayCategories}
                  onReorder={searchQuery ? undefined : handleReorder}
                  onLinkReorder={handleLinkReorder}
                  displayMode={data.settings.homeLayout}
                  pinnedLinks={data.pinnedLinks || []}
                  onPinLink={handlePinLink}
                  onUnpinLink={handleUnpinLink}
                  onPinnedReorder={handlePinnedReorder}
                  onUpdatePinnedLink={handleUpdatePinnedLink}
                />
              </ErrorBoundary>
            </div>

            <footer className="relative mt-auto pt-4 w-full text-center z-0">
              <p className="text-[10px] text-white/30 font-light tracking-widest font-mono select-none">
                © 2025 Clean Nav · Designed by{' '}
                <a href="https://github.com/YingXiaoMo/clean-nav" target="_blank" rel="noopener noreferrer" className="hover:text-white/80 transition-colors cursor-pointer hover:underline underline-offset-4 decoration-white/30">
                  YingXiaoMo
                </a>
              </p>
            </footer>
        </div>
        
        <Toaster position="top-center" />
        <Suspense fallback={null}>
          <ErrorBoundary name="cheatsheet" fallback={null}>
            <CheatSheet />
          </ErrorBoundary>
        </Suspense>
        <AuthSetupDialog baseUrl={typeof window !== 'undefined' ? window.location.origin : ''} />
        {isCommandPaletteOpen && (
          <CommandPalette
            data={data}
            allBookmarks={allBookmarks}
            onOpenLink={(url) => window.open(url, '_blank', 'noopener,noreferrer')}
            onToggleAI={() => togglePanel('ai')}
            onToggleSSH={() => togglePanel('ssh')}
          />
        )}
        <ErrorBoundary name="ai-panel" fallback={null}>
          <AIPanel />
        </ErrorBoundary>
        <ErrorBoundary name="ssh-terminal" fallback={null}>
          <SSHTerminalPanel />
        </ErrorBoundary>
      </main>
    </ThemeProvider>
  );
}
