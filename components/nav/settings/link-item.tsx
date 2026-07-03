import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { LinkItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Trash2, FolderInput, Pencil } from "lucide-react";
import { IconRender } from "./shared";
import { FaviconImage } from "@/lib/utils/favicon";

interface SortableLinkItemProps {
  link: LinkItem;
  catId: string;
  handleDeleteLink: (catId: string, linkId: string) => void;
  onEditFolder?: (link: LinkItem) => void;
  onEdit: (link: LinkItem) => void;
  onMove: (link: LinkItem) => void;
  /** 是否已选中（批量模式） */
  isSelected?: boolean;
  /** 切换选中 */
  onToggleSelect?: (id: string) => void;
}

const SortableLinkItemComponent = ({ link, catId, handleDeleteLink, onEditFolder, onEdit, onMove, isSelected, onToggleSelect }: SortableLinkItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: link.id,
    data: {
      type: "Link",
      link,
      catId,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  const isFolder = link.type === 'folder';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={`relative flex items-center gap-1.5 p-2 rounded-lg transition-all group select-none min-h-[42px] ${
        isSelected
          ? 'bg-primary/10 border border-primary/40 shadow-sm'
          : 'bg-card border border-border/40 hover:border-border hover:shadow-sm'
      }`}
    >
      {/* 多选框 */}
      <div
        className="flex items-center justify-center w-6 h-6 shrink-0 -ml-0.5"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onToggleSelect?.(link.id);
        }}
      >
        <div
          className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all cursor-pointer ${
            isSelected
              ? 'bg-primary border-primary'
              : 'border-muted-foreground/40 hover:border-muted-foreground/70'
          }`}
        >
          {isSelected && (
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" className="w-3 h-3">
              <path d="M5 12l5 5l9-9" />
            </svg>
          )}
        </div>
      </div>
      <div
        {...listeners}
        className="flex-1 flex items-center gap-2 cursor-grab active:cursor-grabbing hover:bg-muted/50 rounded-md p-1 -ml-1 transition-colors min-w-0 outline-none touch-none"
        onClick={() => {
            if (isFolder && onEditFolder) {
                onEditFolder(link);
            } else {
                onEdit(link);
            }
        }}
      >
        <div className={`p-1.5 rounded-md shrink-0 flex items-center justify-center pointer-events-none ${isFolder ? 'bg-yellow-500/10 text-yellow-500' : 'bg-muted/50 text-foreground/70'}`}>
          {isFolder ? (
            <IconRender name="FolderOpen" className="h-4 w-4" />
          ) : (
            <FaviconImage icon={link.icon} url={link.url} className="h-4 w-4 object-contain rounded-sm" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <span className="block text-sm font-medium truncate" title={link.title}>
              {link.title}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-0.5">
        <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1 px-2 text-muted-foreground hover:text-foreground text-xs"
            onClick={(e) => {
                e.stopPropagation();
                onMove(link);
            }}
            title="移动到..."
        >
            <FolderInput className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">移动</span>
        </Button>
        <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1 px-2 text-muted-foreground hover:text-destructive text-xs"
            onClick={(e) => {
                e.stopPropagation();
                handleDeleteLink(catId, link.id);
            }}
            title="删除"
        >
            <Trash2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">删除</span>
        </Button>
      </div>
    </div>
  );
};

export const SortableLinkItem = React.memo(SortableLinkItemComponent);
