"use client";

import React, { useState, useEffect, useId, memo } from "react";
import { Category, LinkItem } from "@/lib/types";
import { X, FolderOpen, ChevronLeft } from "lucide-react";
import * as Icons from "lucide-react";
import { LucideIcon } from "lucide-react";
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

interface LinkGridProps {
  categories: Category[];
  onReorder?: (categories: Category[]) => void;
  onOpenChange?: (open: boolean) => void;
}

const IconRender = memo(({ name, className }: { name: string; className?: string }) => {
  const [error, setError] = useState(false);

  useEffect(() => {
    setError(false);
  }, [name]);

  if ((name?.startsWith("http") || name?.startsWith("/")) && !error) {
    return (
      <img 
        src={name} 
        alt="icon" 
        className={`${className} object-contain rounded-sm`} 
        style={{ width: '100%', height: '100%' }} 
        loading="lazy" 
        onError={() => setError(true)}
      />
    );
  }

  const iconName = name as keyof typeof Icons;
  // Ensure the icon exists AND is a function (React component), not an object/constant
  const isValidIcon = name && !error && /^[A-Z]/.test(name) && Boolean(Icons[iconName]);
  
  const IconComponent = isValidIcon ? Icons[iconName] : Icons.FolderOpen;
  const Icon = IconComponent as LucideIcon;
  
  return <Icon className={className} />;
});
IconRender.displayName = "IconRender";

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

export function LinkGrid({ categories, onReorder, onOpenChange }: LinkGridProps) {

  const dndContextId = useId();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedCategory = categories.find((c) => c.id === selectedId);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Stack for folder navigation: LinkItem[]
  const [navStack, setNavStack] = useState<LinkItem[]>([]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

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
      setNavStack([]); // Reset stack when opening a new category
    } else {
      document.body.style.overflow = "auto";
      onOpenChange?.(false);
      setNavStack([]);
    }
    return () => { 
      document.body.style.overflow = "auto";
      onOpenChange?.(false);
    };
  }, [selectedId, onOpenChange]);

  const currentItems = navStack.length > 0 
    ? navStack[navStack.length - 1].children || [] 
    : selectedCategory?.links || [];

  const currentTitle = navStack.length > 0
    ? navStack[navStack.length - 1].title
    : selectedCategory?.title;

  const currentIcon = navStack.length > 0
    ? navStack[navStack.length - 1].icon || "FolderOpen"
    : selectedCategory?.icon || "FolderOpen";

  const handleBack = () => {
      setNavStack(prev => prev.slice(0, -1));
  };

  const handleFolderClick = (folder: LinkItem) => {
      setNavStack(prev => [...prev, folder]);
  };

  return (
    <>
      {mounted ? (
        <DndContext id={dndContextId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <div className="w-full max-w-5xl mx-auto pb-6 px-4 relative z-30">
            <SortableContext items={categories.map(c => c.id)} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-3 md:grid-cols-3 lg:grid-cols-9 gap-2">
                {categories.map((category) => (
                  <SortableCard key={category.id} category={category} onClick={() => setSelectedId(category.id)} />
                ))}
              </div>
            </SortableContext>
          </div>
        </DndContext>
      ) : (
        <div className="w-full max-w-5xl mx-auto pb-6 px-4 relative z-30">
          <div className="grid grid-cols-3 md:grid-cols-3 lg:grid-cols-9 gap-2">
            {categories.map((category) => (
              <StaticCard key={category.id} category={category} onClick={() => setSelectedId(category.id)} />
            ))}
          </div>
        </div>
      )}

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
                      <button onClick={handleBack} className="p-1.5 rounded-full bg-muted/50 hover:bg-muted transition-colors mr-1">
                          <ChevronLeft className="h-4 w-4" />
                      </button>
                  )}
                  <div className="p-1.5 rounded-xl bg-yellow-500/20 text-yellow-200">
                     <IconRender name={currentIcon} className="h-5 w-5" />
                  </div>
                  <h2 className="text-lg font-semibold text-foreground tracking-tight">
                    {currentTitle}
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
                key={navStack.length} // Force re-render/animation on navigation
                initial={{ opacity: 0, x: 10 }} 
                animate={{ opacity: 1, x: 0 }} 
                exit={{ opacity: 0, x: -10 }} 
                transition={{ duration: 0.2 }} 
                className="p-6 overflow-y-auto flex-1 bg-transparent [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-muted-foreground/20 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/40"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {currentItems.map((item) => {
                     const isFolder = item.type === 'folder';
                     
                     if (isFolder) {
                         return (
                            <div
                                key={item.id}
                                onClick={() => handleFolderClick(item)}
                                className="group block relative cursor-pointer"
                            >
                                <div className="flex items-center gap-4 p-4 rounded-xl hover:bg-muted border border-transparent hover:border-border/40 transition-colors">
                                    <div className="h-10 w-10 shrink-0 rounded-lg flex items-center justify-center border border-border/40 overflow-hidden bg-yellow-500/10 text-yellow-500">
                                        <IconRender name="FolderOpen" className="h-5 w-5" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h4 className="text-foreground font-medium text-sm" title={item.title}>
                                            {item.title}
                                        </h4>
                                    </div>
                                    <ChevronLeft className="h-4 w-4 text-muted-foreground rotate-180" />
                                </div>
                            </div>
                         );
                     }

                    return (
                        <a
                        key={item.id}
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group block relative"
                        >
                        <div className="flex items-center gap-4 p-4 rounded-xl hover:bg-muted border border-transparent hover:border-border/40 transition-colors">
                            <div className={`h-10 w-10 shrink-0 rounded-lg flex items-center justify-center border border-border/40 overflow-hidden ${
                            (item.icon || "").startsWith('http') ? 'bg-background/50 p-1.5' : 'bg-blue-500/20 text-blue-200'
                            }`}>
                            <IconRender name={item.icon || "Link"} className={(item.icon || "").startsWith('http') ? "w-full h-full" : "h-5 w-5"} />
                            </div>
                            <div className="min-w-0 flex-1">
                            <h4 className="text-foreground font-medium text-sm" title={item.title}>
                                {item.title}
                            </h4>
                            </div>
                        </div>
                        </a>
                    );
                  })}
                  {currentItems.length === 0 && (
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