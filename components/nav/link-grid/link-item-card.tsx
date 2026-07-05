"use client";

import { LinkItem } from "@/lib/types";
import { ChevronLeft, X } from "lucide-react";
import { IconRender } from "@/components/nav/settings/shared";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { FaviconImage } from "@/lib/utils/favicon";

interface LinkItemCardProps {
  item: LinkItem;
  onClick?: (item: LinkItem) => void;
  className?: string;
  showPinButton?: boolean;
  isPinned?: boolean;
  onPinToggle?: () => void;
  noKeyboard?: boolean;
}

export function LinkItemCard({ item, onClick, className, showPinButton, isPinned, onPinToggle, noKeyboard }: LinkItemCardProps) {
    const isFolder = item.type === 'folder';

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (isFolder) {
          onClick?.(item);
        } else if (item.url) {
          window.open(item.url, '_blank', 'noopener,noreferrer');
        }
      }
    };

    const commonProps = noKeyboard ? {} : {
      tabIndex: 0,
      role: "button" as const,
      onKeyDown: handleKeyDown,
    };

    if (isFolder) {
        return (
           <div className={`group block relative ${className || ''}`} onClick={() => onClick?.(item)} {...commonProps}>
               <div className="flex items-center gap-4 p-3 rounded-xl hover:bg-white/10 transition-all cursor-pointer active:scale-[0.98]">
                   <div className="h-8 w-8 shrink-0 rounded-lg flex items-center justify-center border border-white/20 overflow-hidden bg-yellow-500/10 text-yellow-500">
                       <IconRender name={item.icon || "FolderOpen"} className="h-4 w-4" />
                   </div>
                   <div className="min-w-0 flex-1">
                       <h4 className="text-white font-medium text-sm truncate" title={item.title}>
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
           {showPinButton && (
             <button
               onPointerDown={(e) => e.stopPropagation()}
               onClick={(e) => { e.stopPropagation(); onPinToggle?.(); }}
               className="absolute -top-1.5 -right-1.5 z-10 p-1 rounded-full bg-white/20 backdrop-blur-sm text-white/70 hover:text-white hover:bg-white/30 transition-all opacity-0 group-hover:opacity-100 max-sm:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
               title={isPinned ? "取消固定" : "固定到主页"}
             >
               <svg
                 xmlns="http://www.w3.org/2000/svg"
                 viewBox="0 0 24 24"
                 fill={isPinned ? "currentColor" : "none"}
                 stroke="currentColor"
                 strokeWidth={2}
                 className="h-3 w-3"
               >
                 <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
               </svg>
             </button>
           )}
           <div className="flex items-center gap-4 p-3 rounded-xl hover:bg-white/10 transition-all cursor-pointer active:scale-[0.98]" onClick={() => window.open(item.url, '_blank', 'noopener,noreferrer')} {...commonProps}>
               <div className="h-8 w-8 shrink-0 rounded-lg flex items-center justify-center overflow-hidden border border-white/20 bg-blue-500/10 text-blue-500">
                 <FaviconImage icon={item.icon} url={item.url} className="h-8 w-8 object-cover" />
               </div>
               <div className="min-w-0 flex-1">
                   <h4 className="text-white font-medium text-sm truncate" title={item.title}>
                       {item.title}
                   </h4>
               </div>
           </div>
       </div>
    );
}

interface SortableLinkItemCardProps {
  item: LinkItem;
  onClick?: (item: LinkItem) => void;
  showPinButton?: boolean;
  isPinned?: boolean;
  onPinToggle?: () => void;
}

export function SortableLinkItemCard({ item, onClick, showPinButton, isPinned, onPinToggle }: SortableLinkItemCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      data-link-id={item.id}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (item.type === 'folder') {
            onClick?.(item);
          } else if (item.url) {
            window.open(item.url, '_blank', 'noopener,noreferrer');
          }
        }
      }}
    >
      <LinkItemCard item={item} onClick={onClick} showPinButton={showPinButton} isPinned={isPinned} onPinToggle={onPinToggle} noKeyboard />
    </div>
  );
}


/** 固定链接卡片（紧凑型，用于主页固定链接区域） */
export function PinnedLinkCard({
  item,
  onUnpin
}: {
  item: LinkItem;
  onUnpin: () => void;
}) {
  return (
    <div className="group relative cursor-pointer py-1">
      <button
        onClick={(e) => { e.stopPropagation(); onUnpin(); }}
        className="absolute -top-1 -right-1 z-10 p-0.5 rounded-full bg-red-500/70 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 max-sm:hidden"
        title="取消固定"
      >
        <X className="h-2.5 w-2.5" />
      </button>
      <div
        className="flex flex-col items-center gap-1 active:scale-95 transition-transform"
        onClick={() => window.open(item.url, '_blank', 'noopener,noreferrer')}
      >
        <div className="flex items-center justify-center w-12 h-12 drop-shadow-xl">
          <FaviconImage icon={item.icon} url={item.url} className="w-12 h-12 object-contain drop-shadow-lg" />
        </div>
        <span className="text-white/80 text-[10px] font-medium truncate max-w-full text-center leading-tight drop-shadow-sm max-w-[64px]">
          {item.title}
        </span>
      </div>
    </div>
  );
}

/** 可拖拽排序的固定链接卡片 */
export function SortablePinnedLinkCard({
  item,
  onUnpin
}: {
  item: LinkItem;
  onUnpin: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `pin-${item.id}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : "auto",
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <PinnedLinkCard item={item} onUnpin={onUnpin} />
    </div>
  );
}
