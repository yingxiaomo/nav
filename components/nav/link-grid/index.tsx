"use client";

import { useState, useEffect, useId, forwardRef, useImperativeHandle } from "react";
import { Category, LinkItem } from "@/lib/types/types";
import { X, ChevronLeft, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { IconRender } from "@/components/nav/settings/shared";

import { SortableCard } from "./category-cards";
import { LinkItemCard, SortableLinkItemCard, SortablePinnedLinkCard } from "./link-item-card";
import { RenderFolderContent } from "./render-folder-content";
import { BookmarkSidebar } from "./bookmark-sidebar";

import { arrayMove } from "@dnd-kit/sortable";

/** 方向键 roving tabindex 导航 */
function handleArrowNav(e: React.KeyboardEvent<HTMLElement>, selector: string) {
  const target = e.target as HTMLElement;
  const container = e.currentTarget;
  const items = Array.from(container.querySelectorAll<HTMLElement>(selector));
  const currentIndex = items.findIndex(item => item === target || item.contains(target));
  if (currentIndex === -1) return;

  let nextIndex: number;
  switch (e.key) {
    case 'ArrowRight':
    case 'ArrowDown':
      e.preventDefault();
      nextIndex = (currentIndex + 1) % items.length;
      break;
    case 'ArrowLeft':
    case 'ArrowUp':
      e.preventDefault();
      nextIndex = (currentIndex - 1 + items.length) % items.length;
      break;
    default:
      return;
  }

  items[nextIndex]?.focus();
}

export interface FolderModalHandle {
  /** 返回上一级文件夹；若已在根级则关闭模态框。返回是否实际执行了操作 */
  back: () => boolean;
  /** 直接关闭文件夹模态框 */
  close: () => void;
}

interface LinkGridProps {
  categories: Category[];
  onReorder?: (categories: Category[]) => void;
  onOpenChange?: (open: boolean) => void;
  displayMode?: 'folder' | 'list' | 'sidebar';
  onLinkReorder?: (categoryId: string, links: LinkItem[]) => void;
  pinnedLinks?: LinkItem[];
  onPinLink?: (link: LinkItem) => void;
  onUnpinLink?: (linkId: string) => void;
  onPinnedReorder?: (pinned: LinkItem[]) => void;
}

export const LinkGrid = forwardRef<FolderModalHandle, LinkGridProps>(function LinkGrid({
  categories,
  onReorder,
  onOpenChange,
  onLinkReorder,
  displayMode = 'folder',
  pinnedLinks = [],
  onPinLink,
  onUnpinLink,
  onPinnedReorder,
}: LinkGridProps, ref) {

  const dndContextId = useId();
  const [selectedId, setSelectedId] = useState<string | null>(null); 
  const selectedCategory = categories.find((c) => c.id === selectedId);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const [navStack, setNavStack] = useState<LinkItem[]>([]);
  const [allCollapsedState, setAllCollapsedState] = useState<Record<string, boolean>>({});

  // displayMode 切换时清理 modal 状态
  useEffect(() => {
    setSelectedId(null);
    setNavStack([]);
  }, [displayMode]);

  // 暴露给父组件的文件夹导航控制接口
  useImperativeHandle(ref, () => ({
    /** 返回上一级；若已在根级则关闭模态框。有操作返回 true，无操作（未打开）返回 false */
    back: () => {
      if (selectedId === null) return false;
      if (navStack.length > 0) {
        setNavStack(prev => prev.slice(0, -1));
      } else {
        const idToRestore = selectedId;
        setSelectedId(null);
        // 动画完成后将焦点归还到卡片
        requestAnimationFrame(() => {
          const card = document.querySelector(`[data-category-id="${idToRestore}"]`) as HTMLElement | null;
          card?.focus();
        });
      }
      return true;
    },
    /** 直接关闭文件夹模态框 */
    close: closeModal,
  }), [navStack.length, selectedId]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = categories.findIndex((c) => c.id === active.id);
      const newIndex = categories.findIndex((c) => c.id === over.id);
      if (onReorder) {
        onReorder(arrayMove(categories, oldIndex, newIndex));
      }
    }
  };

  const pinnedDndContextId = useId();
  const handlePinnedDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !onPinnedReorder) return;

    const oldIndex = pinnedLinks.findIndex(l => `pin-${l.id}` === active.id);
    const newIndex = pinnedLinks.findIndex(l => `pin-${l.id}` === over.id);
    if (oldIndex !== -1 && newIndex !== -1) {
      onPinnedReorder(arrayMove(pinnedLinks, oldIndex, newIndex));
    }
  };

  
  useEffect(() => {
    const original = document.body.style.overflow;
    if (selectedId) {
      document.body.style.overflow = "hidden";
      onOpenChange?.(true);
    } else {
      document.body.style.overflow = "auto";
      onOpenChange?.(false);
    }
    return () => {
      document.body.style.overflow = original || "auto";
      onOpenChange?.(false);
    };
  }, [selectedId, onOpenChange]);

  
  


  const modalCurrentItems = navStack.length > 0 
    ? navStack[navStack.length - 1].children || [] 
    : selectedCategory?.links || [];

  const modalCurrentTitle = navStack.length > 0
    ? navStack[navStack.length - 1].title
    : selectedCategory?.title;

  const modalCurrentIcon = navStack.length > 0
    ? navStack[navStack.length - 1].icon || "FolderOpen"
    : selectedCategory?.icon || "FolderOpen";

  // Modal opening or navStack change: auto focus first link item
  useEffect(() => {
    if (!selectedId || modalCurrentItems.length === 0) return;
    const timer = setTimeout(() => {
      const firstItem = document.querySelector('[data-link-id]') as HTMLElement | null;
      firstItem?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, [selectedId, navStack.length, modalCurrentItems.length]);

  const handleModalBack = () => {
      setNavStack(prev => prev.slice(0, -1));
  };


  const handleModalFolderClick = (item: LinkItem) => {
      if (item.type === 'folder') {
          setNavStack(prev => [...prev, item]);
      }
  };

  // 关闭模态框并将焦点返还给卡片
  const closeModal = () => {
    const idToRestore = selectedId;
    setSelectedId(null);
    setNavStack([]);
    if (idToRestore) {
      requestAnimationFrame(() => {
        const card = document.querySelector(`[data-category-id="${idToRestore}"]`) as HTMLElement | null;
        card?.focus();
      });
    }
  };

  const handleLinkDragEnd = (event: DragEndEvent) => {
    if (!onLinkReorder || !selectedId) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = modalCurrentItems.findIndex(item => item.id === active.id);
    const newIndex = modalCurrentItems.findIndex(item => item.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(modalCurrentItems, oldIndex, newIndex);

    onLinkReorder(selectedId, reordered);
  };

  const toggleFolder = (id: string) => {
    setAllCollapsedState(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };


  const isLinkPinned = (linkId: string) => pinnedLinks.some(l => l.id === linkId);

  const renderPinnedLinks = () => {
    if (pinnedLinks.length === 0) return null;

    return (
      <div className="w-full max-w-5xl mx-auto pb-3 px-4 relative z-30">
        <DndContext id={pinnedDndContextId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={handlePinnedDragEnd}>
          <SortableContext items={pinnedLinks.map(l => `pin-${l.id}`)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12 gap-1 sm:gap-1.5">
              {pinnedLinks.map((link) => (
                <SortablePinnedLinkCard
                  key={link.id}
                  item={link}
                  onUnpin={() => onUnpinLink?.(link.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    );
  };


  const renderMainContent = () => {
    if (displayMode === 'list') {
      return (
        <div className="w-full space-y-4 px-4 pb-10">
           {categories.map(cat => {
              const isCollapsed = allCollapsedState[cat.id];
              return (
              <div key={cat.id} className="bg-black/20 backdrop-blur-xl rounded-xl border border-white/10 overflow-hidden">
                  <div 
                    onClick={() => toggleFolder(cat.id)}
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/10 transition-colors"
                  >
                     <div className="flex items-center gap-3">
                        <IconRender name={cat.icon || "FolderOpen"} className="h-5 w-5 text-yellow-200" />
                        <h3 className="text-white font-medium">{cat.title}</h3>
                     </div>
                     <ChevronDown className={`h-4 w-4 text-white/50 transition-transform ml-auto ${isCollapsed ? 'rotate-90' : 'rotate-0'}`} />
                  </div>
                  
                  <motion.div
                    initial={false}
                    animate={{ height: isCollapsed ? 0 : "auto", opacity: isCollapsed ? 0 : 1 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                      <div className="p-4 pt-0">
                          {cat.links.length > 0 ? (
                            <RenderFolderContent 
                                items={cat.links} 
                                onFolderClick={(item) => {
                                  setSelectedId(cat.id);
                                  setNavStack([item]);
                                }}
                            />
                          ) : (
                            <div className="col-span-full py-4 text-center text-sm text-white/30">
                                空文件夹
                            </div>
                          )}
                      </div>
                  </motion.div>
              </div>
           );})}
        </div>
      );
    }

    return (
        <DndContext id={dndContextId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <div className="w-full max-w-5xl mx-auto pb-6 px-4 relative z-30">
            <SortableContext items={categories.map(c => c.id)} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-9 gap-2 sm:gap-3" onKeyDown={(e) => handleArrowNav(e, '[data-category-id]')}>
                {categories.map((category) => (
                  <SortableCard key={category.id} category={category} onClick={() => setSelectedId(category.id)} />
                ))}
              </div>
            </SortableContext>
          </div>
        </DndContext>
      );
  };

  return (
    <>
      {renderPinnedLinks()}

      {displayMode === 'sidebar' ? (
        <>
          <BookmarkSidebar categories={categories} pinnedLinks={pinnedLinks} onPinLink={onPinLink} onUnpinLink={onUnpinLink} />
        </>
      ) : (
        renderMainContent()
      )}

      <AnimatePresence>
        {selectedId && selectedCategory && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={closeModal}
              className="absolute inset-0 bg-black/60"
            />

            <motion.div
              layoutId={selectedId}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="dark w-full max-w-[95vw] max-h-[90vh] bg-white/10 dark:bg-black/20 text-foreground backdrop-blur-xl border border-white/20 rounded-[1rem] sm:rounded-[1.5rem] shadow-lg overflow-hidden flex flex-col relative z-10 will-change-transform"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-2 border-b border-border/20 shrink-0 bg-transparent">
                <div className="flex items-center gap-3">
                  {navStack.length > 0 && (
                      <button onClick={handleModalBack} className="p-1.5 rounded-full bg-muted/50 hover:bg-muted transition-colors mr-1">
                          <ChevronLeft className="h-4 w-4" />
                      </button>
                  )}
                  <div className="p-1.5 rounded-xl bg-yellow-500/20 text-yellow-200">
                     <IconRender name={modalCurrentIcon} className="h-5 w-5" />
                  </div>
                  <h2 className="text-lg font-semibold text-foreground tracking-tight">
                    {modalCurrentTitle}
                  </h2>
                </div>
                <button
                  onClick={closeModal}
                  className="p-1.5 rounded-full bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <motion.div 
                key={navStack.length} 
                initial={{ opacity: 0, x: 10 }} 
                animate={{ opacity: 1, x: 0 }} 
                exit={{ opacity: 0, x: -10 }} 
                transition={{ duration: 0.2 }} 
                className="p-6 overflow-y-auto flex-1 bg-transparent [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-muted-foreground/20 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/40"
              >
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleLinkDragEnd}>
                  <SortableContext items={modalCurrentItems.map(i => i.id)} strategy={rectSortingStrategy}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4" onKeyDown={(e) => handleArrowNav(e, '[data-link-id]')}>
                      {modalCurrentItems.map((item) => (
                        <SortableLinkItemCard
                          key={item.id}
                          item={item}
                          onClick={handleModalFolderClick}
                          showPinButton={item.type !== 'folder'}
                          isPinned={isLinkPinned(item.id)}
                          onPinToggle={() => {
                            if (isLinkPinned(item.id)) {
                              onUnpinLink?.(item.id);
                            } else {
                              onPinLink?.(item);
                            }
                          }}
                        />
                      ))}
                      {modalCurrentItems.length === 0 && (
                        <div className="col-span-full py-10 text-center text-muted-foreground">
                          此文件夹为空
                        </div>
                      )}
                    </div>
                  </SortableContext>
                </DndContext>
              </motion.div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
});
