"use client";

import { useState, useEffect } from "react";
import { Category } from "@/lib/types";
import { X, FolderOpen } from "lucide-react";
import * as Icons from "lucide-react";
import { LucideIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface LinkGridProps {
  categories: Category[];
  onReorder?: (categories: Category[]) => void;
  onOpenChange?: (open: boolean) => void;
}

const IconRender = ({ name, className }: { name: string; className?: string }) => {
  // @ts-ignore
  const Icon = (Icons[name as keyof typeof Icons] as LucideIcon) || Icons.Link;
  return <Icon className={className} />;
};

export function LinkGrid({ categories, onOpenChange }: LinkGridProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedCategory = categories.find((c) => c.id === selectedId);

  // Lock body scroll when open
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
      {/* Grid Layout */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 w-full max-w-5xl mx-auto pb-20 px-6 relative z-30">
        {categories.map((category) => (
          <div
            key={category.id}
            onClick={() => setSelectedId(category.id)}
            className="cursor-pointer group relative transition-transform duration-200 hover:scale-105 active:scale-95"
          >
            {/* 16:9 Card */}
            <div className="aspect-video w-full rounded-2xl bg-white/10 dark:bg-black/20 backdrop-blur-md border border-white/20 shadow-lg group-hover:bg-white/15 transition-colors overflow-hidden flex flex-col items-center justify-center gap-2 will-change-transform">
              <div className="p-3 rounded-full bg-gradient-to-br from-white/20 to-white/5 border border-white/10 shadow-inner">
                <FolderOpen className="h-8 w-8 text-yellow-200/90 drop-shadow-md" />
              </div>
              
              <div className="text-center">
                <h3 className="text-white font-medium tracking-wide drop-shadow-sm">{category.title}</h3>
                <span className="text-[10px] text-white/50 uppercase tracking-wider font-semibold block mt-1">
                  {category.links.length} Links
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Expanded Modal Overlay */}
      <AnimatePresence>
        {selectedId && selectedCategory && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-10">
            {/* Dark Backdrop - 单独层处理模糊，性能更好 */}
            <motion.div
              initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
              animate={{ opacity: 1, backdropFilter: "blur(8px)" }}
              exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
              transition={{ duration: 0.2 }}
              onClick={() => setSelectedId(null)}
              className="absolute inset-0 bg-black/40"
              style={{ willChange: "opacity, backdrop-filter" }}
            />

            {/* Modal Container */}
            <motion.div
              layoutId={`card-${selectedId}`} // (可选) 如果你想做形变动画，但这需要更多配置，这里先保持弹出式
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              // 优化点：使用 spring 动画，感觉更流畅；stiffness 和 damping 模拟物理弹簧
              transition={{ 
                type: "spring", 
                damping: 25, 
                stiffness: 300,
                mass: 0.8
              }}
              // 优化点：移除 backdrop-blur-md，改用高不透明度背景 (bg-zinc-900/95)，极大提升缩放性能
              // 优化点：添加 will-change-transform
              className="w-full max-w-5xl max-h-[85vh] bg-zinc-900/95 border border-white/10 rounded-[2rem] shadow-2xl overflow-hidden flex flex-col relative z-10 will-change-transform"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-white/5 shrink-0 bg-white/5">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-yellow-500/20 text-yellow-200">
                     <FolderOpen className="h-6 w-6" />
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

              {/* Scrollable Content */}
              <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {selectedCategory.links.map((link) => (
                    <a
                      key={link.id}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group block relative"
                    >
                      {/* Link Card - 去掉了复杂的模糊，使用纯色透明度 */}
                      <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 transition-all duration-200 hover:-translate-y-0.5 active:scale-95">
                        <div className="h-12 w-12 shrink-0 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center border border-white/5 text-blue-200">
                           <IconRender name={link.icon || "Link"} className="h-6 w-6" />
                        </div>
                        
                        <div className="min-w-0 flex-1">
                          <h4 className="text-white font-medium text-sm truncate group-hover:text-blue-200 transition-colors">
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