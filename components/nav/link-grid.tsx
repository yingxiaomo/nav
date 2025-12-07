"use client";

import { useState, useEffect } from "react";
import { Category } from "@/lib/types";
import { X, FolderOpen } from "lucide-react";
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

const IconRender = ({ name, className }: { name: string; className?: string }) => {
  // 支持图片链接
  if (name?.startsWith("http") || name?.startsWith("/")) {
    /* eslint-disable-next-line @next/next/no-img-element */
    return <img src={name} alt="icon" className={`${className} object-contain rounded-sm`} style={{ width: '100%', height: '100%' }} />;
  }
  // @ts-ignore
  const Icon = (Icons[name as keyof typeof Icons] as LucideIcon) || Icons.FolderOpen;
  return <Icon className={className} />;
};

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
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className="cursor-pointer group relative transition-transform duration-200 hover:scale-105 active:scale-95 touch-none"
    >
      <div className="aspect-video w-full rounded-2xl bg-white/10 dark:bg-black/20 backdrop-blur-md border border-white/20 shadow-lg group-hover:bg-white/15 transition-colors overflow-hidden flex flex-col items-center justify-center gap-2 will-change-transform">
        {/* 图标容器 */}
        <div className="p-3 rounded-full bg-gradient-to-br from-white/20 to-white/5 border border-white/10 shadow-inner">
          {/* 修改：使用动态图标，默认为 FolderOpen */}
          <IconRender name={category.icon || "FolderOpen"} className="h-8 w-8 text-yellow-200/90 drop-shadow-md" />
        </div>
        <div className="text-center">
          <h3 className="text-white font-medium tracking-wide drop-shadow-sm">{category.title}</h3>
          <span className="text-[10px] text-white/50 uppercase tracking-wider font-semibold block mt-1">
            {category.links.length} Links
          </span>
        </div>
      </div>
    </div>
  );
}

export function LinkGrid({ categories, onReorder, onOpenChange }: LinkGridProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedCategory = categories.find((c) => c.id === selectedId);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

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

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="w-full max-w-5xl mx-auto pb-20 px-6 relative z-30">
          <SortableContext items={categories.map(c => c.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {categories.map((category) => (
                <SortableCard key={category.id} category={category} onClick={() => setSelectedId(category.id)} />
              ))}
            </div>
          </SortableContext>
        </div>
      </DndContext>

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
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", stiffness: 350, damping: 30 }}
              className="w-full max-w-5xl max-h-[85vh] bg-zinc-900 border border-white/10 rounded-[1.5rem] shadow-xl overflow-hidden flex flex-col relative z-10 will-change-transform"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-6 border-b border-white/5 shrink-0 bg-zinc-900">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-yellow-500/20 text-yellow-200">
                     {/* 模态框标题也使用自定义图标 */}
                     <IconRender name={selectedCategory.icon || "FolderOpen"} className="h-6 w-6" />
                  </div>
                  <h2 className="text-2xl font-semibold text-white tracking-tight">
                    {selectedCategory.title}
                  </h2>
                </div>
                <button
                  onClick={() => setSelectedId(null)}
                  className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-zinc-900">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {selectedCategory.links.map((link) => (
                    <a
                      key={link.id}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group block relative"
                    >
                      <div className="flex items-center gap-4 p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition-colors">
                        <div className={`h-10 w-10 shrink-0 rounded-lg flex items-center justify-center border border-white/5 overflow-hidden ${
                          link.icon?.startsWith('http') ? 'bg-white/10 p-1.5' : 'bg-blue-500/20 text-blue-200'
                        }`}>
                           <IconRender name={link.icon || "Link"} className={link.icon?.startsWith('http') ? "w-full h-full" : "h-5 w-5"} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-white font-medium text-sm truncate">
                            {link.title}
                          </h4>
                          <p className="text-white/30 text-[10px] truncate mt-0.5 font-mono">
                            {new URL(link.url).hostname}
                          </p>
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}