import { useState, useRef, useEffect } from "react";
import { Category } from "@/lib/types";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ChevronDown, ChevronRight, GripVertical, Trash2, Pencil } from "lucide-react";
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
        className={`
            flex items-center gap-1 px-2 py-2 rounded-md select-none group sticky top-0 z-10 border transition-all
            ${isDragging ? 'shadow-lg ring-1 ring-primary' : 'hover:border-border/50'}
            bg-zinc-100 dark:bg-zinc-800 border-transparent
        `}
      >
        <Button variant="ghost" size="icon" {...attributes} {...listeners} className="cursor-grab h-6 w-6 active:cursor-grabbing text-muted-foreground/70 hover:text-foreground shrink-0">
          <GripVertical className="h-4 w-4" />
        </Button>

        <div 
            className="flex items-center justify-center cursor-pointer h-6 w-6 text-muted-foreground hover:text-foreground shrink-0 transition-transform duration-200"
            onClick={() => toggleCollapse(cat.id)}
        >
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>

        <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 p-0 hover:bg-background/50 text-foreground/80">
                <IconRender name={cat.icon || "FolderOpen"} className="h-4 w-4" />
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
          
        <div className="flex-1 flex items-center gap-2 ml-1 min-w-0">
            {isEditing ? (
                <Input
                    ref={inputRef}
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onBlur={handleSave}
                    onKeyDown={handleKeyDown}
                    className="h-7 text-sm px-2 py-0 bg-background/80"
                    onClick={(e) => e.stopPropagation()} 
                    onPointerDown={(e) => e.stopPropagation()} 
                />
            ) : (
                <div 
                    className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer" 
                    onClick={() => toggleCollapse(cat.id)}
                    onDoubleClick={() => setIsEditing(true)} 
                    title="双击重命名"
                >
                    <span className="text-sm font-bold text-foreground/80 truncate">{cat.title}</span>
                    <span className="text-[10px] bg-background/50 px-1.5 py-0.5 rounded-full text-muted-foreground font-normal border border-border/20 shrink-0">
                        {cat.links.length}
                    </span>
                    
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-5 w-5 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity"
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsEditing(true);
                        }}
                    >
                        <Pencil className="h-3 w-3" />
                    </Button>
                </div>
            )}
        </div>

        <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all shrink-0"
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