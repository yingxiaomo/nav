"use client";

import { motion } from "framer-motion";
import {
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Category } from "@/lib/types/types";
import { IconRender } from "@/components/nav/settings/shared";

interface CardContentProps {
  category: Category;
}

export const CardContent = ({ category }: CardContentProps) => (
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

interface StaticCardProps {
  category: Category;
  onClick: () => void;
}

export function StaticCard({ category, onClick }: StaticCardProps) {
  return (
    <motion.div 
      onClick={onClick}
      className="cursor-pointer group relative p-4 transition-transform duration-200 hover:scale-105 active:scale-95 touch-none"
    >
      <CardContent category={category} />
    </motion.div>
  );
}

interface SortableCardProps {
  category: Category;
  onClick: () => void;
}

export function SortableCard({ category, onClick }: SortableCardProps) {
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
