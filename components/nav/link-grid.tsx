"use client";

import { useState, useEffect } from "react";
import { Category } from "@/lib/types";
import { X, FolderOpen } from "lucide-react";
import * as Icons from "lucide-react";
import { LucideIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface LinkGridProps {
  categories: Category[];
}

const IconRender = ({ name, className }: { name: string; className?: string }) => {
  // @ts-ignore
  const Icon = (Icons[name as keyof typeof Icons] as LucideIcon) || Icons.Link;
  return <Icon className={className} />;
};

export function LinkGrid({ categories }: LinkGridProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedCategory = categories.find((c) => c.id === selectedId);

  // Lock body scroll when open
  useEffect(() => {
    if (selectedId) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }
    return () => { document.body.style.overflow = "auto"; };
  }, [selectedId]);

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
            {/* Glass Card - CSS only hover effects for better performance */}
            <div className="h-32 w-full rounded-3xl bg-white/10 dark:bg-black/20 backdrop-blur-md border border-white/20 shadow-lg group-hover:bg-white/15 transition-colors overflow-hidden flex flex-col items-center justify-center gap-2">
               {/* Icon Circle */}
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
            {/* Dark Backdrop - Fades in */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setSelectedId(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />

            {/* Modal Container - Simple Scale/Fade */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="w-full max-w-4xl max-h-[85vh] bg-zinc-900/90 dark:bg-black/90 backdrop-blur-md border border-white/10 rounded-[2rem] shadow-2xl overflow-hidden flex flex-col relative z-10"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-white/5 shrink-0">
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {selectedCategory.links.map((link) => (
                    <a
                      key={link.id}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group block relative"
                    >
                      <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 transition-all duration-200 hover:-translate-y-0.5">
                        {/* Icon Box */}
                        <div className="h-12 w-12 shrink-0 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center border border-white/5 text-blue-200">
                           <IconRender name={link.icon || "Link"} className="h-6 w-6" />
                        </div>
                        
                        {/* Text Info */}
                        <div className="min-w-0 flex-1">
                          <h4 className="text-white font-medium text-sm truncate group-hover:text-blue-200 transition-colors">
                            {link.title}
                          </h4>
                          {link.description ? (
                            <p className="text-white/40 text-xs truncate mt-0.5">
                              {link.description}
                            </p>
                          ) : (
                            <p className="text-white/30 text-[10px] truncate mt-0.5 font-mono">
                              {new URL(link.url).hostname}
                            </p>
                          )}
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