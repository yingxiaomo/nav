"use client";

import { useState, useEffect, useId } from "react";
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
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { IconRender } from "@/components/nav/settings/shared";

import { SortableCard, StaticCard } from "./category-cards";
import { LinkItemCard } from "./link-item-card";
import { RenderFolderContent } from "./render-folder-content";

interface LinkGridProps {
  categories: Category[];
  onReorder?: (categories: Category[]) => void;
  onOpenChange?: (open: boolean) => void;
  displayMode?: 'folder' | 'list';
}

export function LinkGrid({ categories, onReorder, onOpenChange, displayMode = 'folder' }: LinkGridProps) {

  const dndContextId = useId();
  const [selectedId, setSelectedId] = useState<string | null>(null); 
  const selectedCategory = categories.find((c) => c.id === selectedId);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const [navStack, setNavStack] = useState<LinkItem[]>([]); 
  const [allCollapsedState, setAllCollapsedState] = useState<Record<string, boolean>>({}); 

  const mounted = true;

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

  
  useEffect(() => {
    if (selectedId) {
      document.body.style.overflow = "hidden";
      onOpenChange?.(true);
    } else {
      document.body.style.overflow = "auto";
      onOpenChange?.(false);
    }
    return () => { 
      document.body.style.overflow = "auto";
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

  const handleModalBack = () => {
      setNavStack(prev => prev.slice(0, -1));
  };


  const handleModalFolderClick = (item: LinkItem) => {
      if (item.type === 'folder') {
          setNavStack(prev => [...prev, item]);
      }
  };

  const toggleFolder = (id: string) => {
    setAllCollapsedState(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
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

    return mounted ? (
        <DndContext id={dndContextId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <div className="w-full max-w-5xl mx-auto pb-6 px-4 relative z-30">
            <SortableContext items={categories.map(c => c.id)} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-9 gap-2 sm:gap-3">
                {categories.map((category) => (
                  <SortableCard key={category.id} category={category} onClick={() => setSelectedId(category.id)} />
                ))}
              </div>
            </SortableContext>
          </div>
        </DndContext>
      ) : (
        <div className="w-full max-w-5xl mx-auto pb-6 px-4 relative z-30">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-9 gap-2 sm:gap-3">
            {categories.map((category) => (
              <StaticCard key={category.id} category={category} onClick={() => setSelectedId(category.id)} />
            ))}
          </div>
        </div>
      );
  };

  return (
    <>
      {renderMainContent()}

      <AnimatePresence>
        {selectedId && selectedCategory && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-10">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setSelectedId(null)}
              className="absolute inset-0 bg-black/60"
            />

            <motion.div
              layoutId={selectedId}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="dark w-full max-w-5xl max-h-[85vh] bg-white/10 dark:bg-black/20 text-foreground backdrop-blur-xl border border-white/20 rounded-[1.5rem] shadow-lg overflow-hidden flex flex-col relative z-10 will-change-transform"
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
                  onClick={() => setSelectedId(null)}
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
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                  {modalCurrentItems.map((item) => (
                       <LinkItemCard key={item.id} item={item} onClick={handleModalFolderClick} />
                  ))}
                  {modalCurrentItems.length === 0 && (
                      <div className="col-span-full py-10 text-center text-muted-foreground">
                          此文件夹为空
                      </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}