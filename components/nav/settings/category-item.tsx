import { useState, useRef, useEffect } from "react";
import { Category } from "@/lib/types";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ChevronDown, ChevronRight, Trash2, Pencil } from "lucide-react";
import { IconRender, PRESET_ICONS } from "./shared";

interface SortableCategoryItemProps {
  cat: Category;
  isCollapsed: boolean;
  toggleCollapse: (id: string) => void;
  children: React.ReactNode;
  handleCategoryIconChange: (id: string, icon: string) => void;
  handleDeleteCategory: (id: string) => void;
  handleRenameCategory: (id: string, title: string) => void;
}

export function SortableCategoryItem({ 
  cat, 
  isCollapsed, 
  toggleCollapse, 
  children, 
  handleCategoryIconChange, 
  handleDeleteCategory,
  handleRenameCategory
}: SortableCategoryItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: cat.id,
    data: {
        type: "Category",
        cat
    }
  });

  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(cat.title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
    }
  }, [isEditing]);

  const handleSave = () => {
    if (editTitle.trim()) {
      handleRenameCategory(cat.id, editTitle.trim());
    } else {
      setEditTitle(cat.title);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") {
      setEditTitle(cat.title);
      setIsEditing(false);
    }
  };

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="space-y-1 mb-2">
      <div 
        {...attributes}
        {...listeners}
        className={`
            flex items-center gap-1 px-2 py-3 rounded-md select-none group sticky top-0 z-10 border transition-all
            ${isDragging ? 'shadow-lg ring-1 ring-primary cursor-grabbing' : 'hover:border-border/50 cursor-grab'}
            bg-zinc-100 dark:bg-zinc-800 border-transparent touch-none min-h-[44px] 
        `}
      >
        <div 
            className="flex items-center justify-center cursor-pointer h-8 w-8 -ml-1 text-muted-foreground hover:text-foreground shrink-0 transition-transform duration-200"
            onPointerDown={(e) => e.stopPropagation()} 
            onClick={(e) => {
                e.stopPropagation();
                toggleCollapse(cat.id);
            }}
        >
            {isCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </div>

        <div 
            className="shrink-0 mr-1" 
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
        >
            <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 p-0 hover:bg-background/50 text-foreground/80">
                <IconRender name={cat.icon || "FolderOpen"} className="h-5 w-5" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[300px] h-[300px] overflow-y-auto">
                <div className="grid grid-cols-6 gap-1 p-2">
                {PRESET_ICONS.map(iconName => (
                    <Button key={iconName} variant="ghost" size="icon" className="h-9 w-9 hover:bg-muted" onClick={() => handleCategoryIconChange(cat.id, iconName)} title={iconName}>
                    <IconRender name={iconName} className="h-5 w-5" />
                    </Button>
                ))}
                </div>
            </DropdownMenuContent>
            </DropdownMenu>
        </div>
          
        <div className="flex-1 flex items-center gap-2 min-w-0 mr-1">
            {isEditing ? (
                <Input
                    ref={inputRef}
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onBlur={handleSave}
                    onKeyDown={handleKeyDown}
                    className="h-8 text-sm px-2 py-0 bg-background/80 w-full"
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                />
            ) : (
                <div 
                    className="flex items-center gap-2 flex-1 min-w-0 h-full py-1 cursor-pointer" 
                    onClick={(e) => {
                        toggleCollapse(cat.id);
                    }}
                    onDoubleClick={(e) => {
                        e.stopPropagation();
                        setIsEditing(true);
                    }}
                >
                    <span className="text-sm font-bold text-foreground/80 truncate">{cat.title}</span>
                    <span className="text-[10px] bg-background/50 px-1.5 py-0.5 rounded-full text-muted-foreground font-normal border border-border/20 shrink-0">
                        {cat.links.length}
                    </span>
                </div>
            )}
        </div>

        {!isEditing && (
            <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0" 
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                    e.stopPropagation();
                    setIsEditing(true);
                }}
                title="重命名"
            >
                <Pencil className="h-4 w-4" />
            </Button>
        )}

        <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteCategory(cat.id);
            }}
            title="删除分类"
        >
            <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      {children}
    </div>
  );
}