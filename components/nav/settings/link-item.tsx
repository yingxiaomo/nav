import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { LinkItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { IconRender } from "./shared";

interface SortableLinkItemProps {
  link: LinkItem;
  catId: string;
  handleDeleteLink: (catId: string, linkId: string) => void;
}

export function SortableLinkItem({ link, catId, handleDeleteLink }: SortableLinkItemProps) {
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="relative flex items-center gap-2 p-2 rounded-lg bg-card border border-border/40 hover:border-border hover:shadow-sm transition-all group touch-none cursor-grab active:cursor-grabbing select-none h-[42px]" // 固定高度，视觉更整齐
    >
      <div className="p-1.5 rounded-md bg-muted/50 text-foreground/70 shrink-0 flex items-center justify-center pointer-events-none">
        <IconRender name={link.icon || "Link"} className="h-4 w-4" />
      </div>
      
      <div className="flex-1 min-w-0 pr-6">
        <span className="block text-sm font-medium truncate leading-none">
            {link.title}
        </span>
      </div>
      
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-1 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 hover:text-destructive z-10"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
            e.stopPropagation();
            handleDeleteLink(catId, link.id);
        }}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}