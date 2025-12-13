import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { LinkItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Trash2, Settings2, FolderInput, Pencil, MoreVertical } from "lucide-react";
import { IconRender } from "./shared";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface SortableLinkItemProps {
  link: LinkItem;
  catId: string;
  handleDeleteLink: (catId: string, linkId: string) => void;
  onEditFolder?: (link: LinkItem) => void;
  onEdit: (link: LinkItem) => void;
  onMove: (link: LinkItem) => void;
}

export function SortableLinkItem({ link, catId, handleDeleteLink, onEditFolder, onEdit, onMove }: SortableLinkItemProps) {
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
      className="relative flex items-center gap-2 p-2 rounded-lg bg-card border border-border/40 hover:border-border hover:shadow-sm transition-all group select-none min-h-[42px]"
    >
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
        <div className={`p-1.5 rounded-md shrink-0 flex items-center justify-center pointer-events-none ${isFolder ? 'bg-yellow-500/10 text-yellow-600' : 'bg-muted/50 text-foreground/70'}`}>
          <IconRender name={link.icon || (isFolder ? "FolderOpen" : "Link")} className="h-4 w-4" />
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
            size="icon" 
            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={(e) => {
                e.stopPropagation();
                onEdit(link);
            }}
            title="编辑"
        >
            <Pencil className="h-4 w-4" />
        </Button>

        <DropdownMenu>
            <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground">
                <MoreVertical className="h-4 w-4" />
            </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => onMove(link)}>
                <FolderInput className="mr-2 h-4 w-4" />
                <span>移动到...</span>
            </DropdownMenuItem>
            
            <DropdownMenuSeparator />
            
            <DropdownMenuItem 
                className="text-destructive focus:text-destructive"
                onClick={() => handleDeleteLink(catId, link.id)}
            >
                <Trash2 className="mr-2 h-4 w-4" />
                <span>删除</span>
            </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}