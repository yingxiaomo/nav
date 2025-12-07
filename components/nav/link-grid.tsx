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

  const id = category.id; 

  return (
    <motion.div 
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className="cursor-pointer group relative p-4 transition-transform duration-200 hover:scale-105 active:scale-95 touch-none"
    >
      <motion.div layoutId={id} className="flex flex-col items-center justify-center text-center gap-1">
        
        {/* 关键修改：h-10 w-10 -> h-8 w-8，并去除 mb-1 确保紧凑 */}
        <div className="transition-transform duration-300 group-hover:scale-110 group-hover:-translate-y-0.5">
          <IconRender name={category.icon || "FolderOpen"} className="h-8 w-8 text-yellow-200/90 drop-shadow-[0_4px_4px_rgba(0,0,0,0.3)]" />
        </div>
        
        <div className="text-center px-4 w-full">
          {/* 关键修改：text-lg -> text-base，缩小字号 */}
          <h3 className="text-white font-medium tracking-wide drop-shadow-sm truncate text-base [text-shadow:0_0_8px_rgba(0,0,0,0.8),0_0_4px_rgba(0,0,0,0.6)]">
            {category.title}
          </h3>
        </div>
      </motion.div>
    </motion.div>
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
        <div className="w-full max-w-5xl mx-auto pb-6 px-6 relative z-30">
          <SortableContext items={categories.map(c => c.id)} strategy={rectSortingStrategy}>
            {/* 间距已调整为 gap-3 */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
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
              layoutId={selectedId}
              className="w-full max-w-5xl max-h-[85vh] bg-zinc-900/90 backdrop-blur-md border border-white/10 rounded-[1.5rem] shadow-2xl overflow-hidden flex flex-col relative z-10 will-change-transform"
              onClick={(e) => e.stopPropagation()}
            >
              {/* 标题栏：已压缩高度 */}
              <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 shrink-0 bg-transparent">
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded-xl bg-yellow-500/20 text-yellow-200">
                     <IconRender name={selectedCategory.icon || "FolderOpen"} className="h-5 w-5" />
                  </div>
                  <h2 className="text-lg font-semibold text-white tracking-tight">
                    {selectedCategory.title}
                  </h2>
                </div>
                <button
                  onClick={() => setSelectedId(null)}
                  className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* 内容区 */}
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2, delay: 0.1 }} className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-transparent">
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
              </motion.div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}