"use client";

import { LinkItem } from "@/lib/types/types";
import { ChevronLeft } from "lucide-react";
import { IconRender } from "@/components/nav/settings/shared";

interface LinkItemCardProps {
  item: LinkItem;
  onClick?: (item: LinkItem) => void;
  className?: string;
}

export function LinkItemCard({ item, onClick, className }: LinkItemCardProps) {
    const isFolder = item.type === 'folder';
                    
    if (isFolder) {
        return (
           <div className={`group block relative ${className || ''}`} onClick={() => onClick?.(item)}>
               <div className="flex items-center gap-4 p-3 rounded-xl hover:bg-white/10 transition-colors cursor-pointer">
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
       <div className={`group block relative ${className || ''}`}>
           <div className="flex items-center gap-4 p-3 rounded-xl hover:bg-white/10 transition-colors">
               <div className="h-8 w-8 shrink-0 rounded-lg flex items-center justify-center border border-white/20 overflow-hidden bg-blue-500/10 text-blue-500">
                   <IconRender name={item.icon || "Link"} className="h-4 w-4" />
               </div>
               <div className="min-w-0 flex-1">
                   <h4 className="text-white font-medium text-sm" title={item.title}>
                       {item.title}
                   </h4>
               </div>
           </div>
       </div>
    );
}