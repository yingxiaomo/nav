"use client";

import React, { useState, useEffect, useId, useRef, useMemo } from "react";
import { Category, LinkItem } from "@/lib/types";
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
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { IconRender } from "@/components/nav/settings/shared";

interface LinkGridProps {
  categories: Category[];
  onReorder?: (categories: Category[]) => void;
  onOpenChange?: (open: boolean) => void;
  displayMode?: 'folder' | 'list';
}



const CardContent = ({ category }: { category: Category }) => (
  <motion.div layoutId={category.id} className="flex flex-col items-center justify-center text-center gap-1">
    <div className="mb-1 transition-transform duration-300 group-hover:scale-110 group-hover:-translate-y-0.5">
      <IconRender name={category.icon || "FolderOpen"} className="h-8 w-8 text-yellow-200/90 drop-shadow-[0_4px_4px_rgba(0,0,0,0.3)]" />
    </div>
    
    <div className="text-center w-full"> 
      <h3 className="text-white font-medium tracking-tight drop-shadow-sm truncate text-xs [text-shadow:0_0_8px_rgba(0,0,0,0.8),0_0_4px_rgba(0,0,0,0.6)]">
        {category.title}
      </h3>
    </div>
  </motion.div>
);

function StaticCard({ category, onClick }: { category: Category; onClick: () => void }) {
  return (
    <div 
      onClick={onClick}
      className="cursor-pointer group relative p-4 transition-transform duration-200 hover:scale-105 active:scale-95 touch-none"
    >
      <CardContent category={category} />
    </div>
  );
}

function SortableCard({ category, onClick }: { category: Category; onClick: () => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : "auto",
  };

  return (
    <motion.div 
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className="cursor-pointer group relative p-4 transition-transform duration-200 hover:scale-105 active:scale-95 touch-none"
    >
      <CardContent category={category} />
    </motion.div>
  );
}

const LinkItemCard = ({ item, onClick, className }: { item: LinkItem, onClick?: (item: LinkItem) => void, className?: string }) => {
    const isFolder = item.type === 'folder';
                     
    if (isFolder) {
        return (
           <div
               onClick={() => onClick && onClick(item)}
               className={`group block relative cursor-pointer ${className || ''}`}
           >
               <div className="flex items-center gap-4 p-3 rounded-xl hover:bg-white/10 transition-colors">
                   <div className="h-8 w-8 shrink-0 rounded-lg flex items-center justify-center border border-white/20 overflow-hidden bg-yellow-500/10 text-yellow-500">
                       <IconRender name={item.icon || "FolderOpen"} className="h-4 w-4" />
                   </div>
                   <div className="min-w-0 flex-1">
                       <h4 className="text-white font-medium text-sm" title={item.title}>
                           {item.title}
                       </h4>
                   </div>
                   <ChevronLeft className="h-4 w-4 text-white/50 rotate-180" />
               </div>
           </div>
        );
    }

   return (
       <a
       href={item.url}
       target="_blank"
       rel="noopener noreferrer"
       className={`group block relative ${className || ''}`}
       >
       <div className="flex items-center gap-4 p-3 rounded-xl hover:bg-white/10 transition-colors">
           <div className={`h-8 w-8 shrink-0 rounded-lg flex items-center justify-center border border-white/20 overflow-hidden ${(item.icon || "").startsWith('http') ? 'bg-white/20 p-1.5' : 'bg-blue-500/10 text-blue-500'}`}>
           <IconRender name={item.icon || "Link"} className={(item.icon || "").startsWith('http') ? "w-full h-full" : "h-4 w-4"} />
           </div>
           <div className="min-w-0 flex-1">
           <h4 className="text-white font-medium text-sm" title={item.title}>
               {item.title}
           </h4>
           </div>
       </div>
       </a>
   );
};


const RenderFolderContent = ({ items, onFolderClick }: { 
    items: LinkItem[]; 
    onFolderClick: (item: LinkItem) => void;
}) => {
  // 所有Hooks必须在组件顶部调用
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  
  // 监听容器宽度变化，动态调整列数
  useEffect(() => {
    const updateContainerWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      }
    };
    
    updateContainerWidth();
    window.addEventListener('resize', updateContainerWidth);
    
    return () => {
      window.removeEventListener('resize', updateContainerWidth);
    };
  }, []);
  
  // 根据容器宽度计算列数
  const columnCount = useMemo(() => {
    if (containerWidth >= 1024) return 4; // lg
    if (containerWidth >= 768) return 3; // md
    if (containerWidth >= 640) return 2; // sm
    return 1; // xs
  }, [containerWidth]);
  
  // 计算行数
  const rowCount = Math.ceil(items.length / columnCount);
  
  // 对于少量数据，直接渲染全部项
  if (items.length < 100) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        {items.map((item) => {
          if (item.type === 'folder') {
            return (
              <LinkItemCard 
                key={item.id} 
                item={item} 
                onClick={() => onFolderClick(item)} 
              />
            );
          }

          return (
            <LinkItemCard key={item.id} item={item} />
          );
        })}
      </div>
    );
  }
  
  // 虚拟行渲染，每行包含多个列
  const renderVirtualRows = () => {
    const virtualRows = [];
    for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
      const startIndex = rowIndex * columnCount;
      const endIndex = Math.min(startIndex + columnCount, items.length);
      const rowItems = items.slice(startIndex, endIndex);
      
      virtualRows.push(
        <div key={`row-${rowIndex}`} className="flex gap-3 sm:gap-4">
          {rowItems.map((item) => {
            if (item.type === 'folder') {
              return (
                <LinkItemCard 
                  key={item.id} 
                  item={item} 
                  onClick={() => onFolderClick(item)} 
                  className="flex-1"
                />
              );
            }

            return (
              <LinkItemCard key={item.id} item={item} className="flex-1" />
            );
          })}
          
          {/* 填充空白列，确保每行宽度一致 */}
          {rowItems.length < columnCount && (
            <div className="flex-1" style={{ opacity: 0, pointerEvents: 'none' }} />
          )}
        </div>
      );
    }
    
    return virtualRows;
  };

  return (
    <div 
      ref={containerRef}
      className="overflow-y-auto max-h-[calc(85vh-120px)] p-0"
    >
      <div className="grid grid-cols-1 gap-3 sm:gap-4">
        {renderVirtualRows()}
      </div>
    </div>
  );
};


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