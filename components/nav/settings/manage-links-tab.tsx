import { useState, useMemo } from "react";
import { DataSchema, Category, LinkItem } from "@/lib/types";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  DragOverlay,
  defaultDropAnimationSideEffects,
  DropAnimation,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { createPortal } from "react-dom";
import { SortableCategoryItem } from "./category-item";
import { SortableLinkItem } from "./link-item";
import { IconRender, PRESET_ICONS } from "./shared";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Wand2, Folder } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

interface ManageLinksTabProps {
  localData: DataSchema;
  setLocalData: React.Dispatch<React.SetStateAction<DataSchema>>;
}

const getChildren = (item: Category | LinkItem): LinkItem[] | undefined => {
    return (item as Category).links || (item as LinkItem).children;
};

export function ManageLinksTab({ localData, setLocalData }: ManageLinksTabProps) {
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set());
  const [activeLink, setActiveLink] = useState<LinkItem | null>(null);
  const [activeCategory, setActiveCategory] = useState<Category | null>(null);
  const [folderPath, setFolderPath] = useState<LinkItem[]>([]);
  const [editingLink, setEditingLink] = useState<LinkItem | null>(null);
  const [movingLink, setMovingLink] = useState<LinkItem | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleSmartIdentifyForEdit = (rawUrl: string) => {
    if (!rawUrl || !editingLink) return;
    
    const processedUrl = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`;
    
    try {
      const urlObj = new URL(processedUrl);
      const hostname = urlObj.hostname;
      const iconUrl = `https://www.google.com/s2/favicons?domain=${hostname}&sz=128`;
      
      let title = editingLink.title;
      if (!title) {
          const name = hostname.replace(/^www\./, "").split(".")[0];
          if (name) {
              title = name.charAt(0).toUpperCase() + name.slice(1);
          }
      }

      setEditingLink({ ...editingLink, url: processedUrl, icon: iconUrl, title: title });
      toast.success("已尝试自动识别信息");
    } catch {
       toast.error("URL 格式不正确");
    }
  };

  const handleSaveEdit = () => {
      if (!editingLink) return;
      
      const isFolder = editingLink.type === 'folder';
      if (!editingLink.title || (!isFolder && !editingLink.url)) {
          toast.error("标题不能为空，普通链接必须填写URL");
          return;
      }

      const updatedLink = { ...editingLink, updatedAt: Date.now() };

      setLocalData((prev) => {
          const newData = JSON.parse(JSON.stringify(prev)) as DataSchema;
          
          const updateRecursive = (items: (Category|LinkItem)[]) => {
              for (const item of items) {
                  const children = getChildren(item);
                  if (children) {
                      const idx = children.findIndex(l => l.id === updatedLink.id);
                      if (idx !== -1) {
                          children[idx] = updatedLink;
                          if ('links' in item) (item as Category).links = children;
                          else (item as LinkItem).children = children;

                          return true;
                      }
                      if (updateRecursive(children)) return true;
                  }
              }
              return false;
          };
          
          updateRecursive(newData.categories);
          return newData;
      });
      setEditingLink(null);
      toast.success("修改已保存");
  };

  const handleMoveConfirm = (targetId: string) => {
      if (!movingLink) return;
      
      setLocalData((prev) => {
          const newData = JSON.parse(JSON.stringify(prev)) as DataSchema;
          let movedItem: LinkItem | null = null;

          const removeRecursive = (items: (Category|LinkItem)[]) => {
              for (const item of items) {
                  const children = getChildren(item);
                  if (children) {
                      const idx = children.findIndex(l => l.id === movingLink.id);
                      if (idx !== -1) {
                          movedItem = children[idx];
                          children.splice(idx, 1);
                          if ('links' in item) (item as Category).links = children;
                          else (item as LinkItem).children = children;
                          return true;
                      }
                      if (removeRecursive(children)) return true;
                  }
              }
              return false;
          };
          removeRecursive(newData.categories);

          if (!movedItem) return prev; 

          const addRecursive = (items: (Category|LinkItem)[]) => {
              for (const item of items) {
                  if (item.id === targetId) {
                      const children = getChildren(item);
                      if (children) {
                          children.push(movedItem!);
                          if ('links' in item) (item as Category).links = children;
                          else (item as LinkItem).children = children;
                      }
                      return true;
                  }
                  const children = getChildren(item);
                  if (children) {
                      if (addRecursive(children)) return true;
                  }
              }
              return false;
          };
          
          addRecursive(newData.categories);
          return newData;
      });
      
      setMovingLink(null);
      toast.success("移动成功");
  };

  const moveOptions = useMemo(() => {
      if (!movingLink) return [];
      const options: { id: string, title: string, level: number }[] = [];
      
      const traverse = (items: (Category|LinkItem)[], level: number) => {
          for (const item of items) {
              if (item.id === movingLink.id) continue; 

              const isCategory = 'links' in item;
              const isFolder = 'type' in item && item.type === 'folder';
              
              if (isCategory || isFolder) {
                  options.push({ id: item.id, title: item.title, level });
                  const children = getChildren(item);
                  if (children) traverse(children, level + 1);
              }
          }
      };
      traverse(localData.categories, 0);
      return options;
  }, [localData.categories, movingLink]);

  const findContainer = (id: string, items: (Category | LinkItem)[]): string | undefined => {
      if (items.find(i => i.id === id)) return id; 
  
      for (const item of items) {
          const children = getChildren(item);
          if (children) {
              if (children.find(c => c.id === id)) {
                  return item.id;
              }
              const found = findContainer(id, children);
              if (found) return found;
          }
      }
      return undefined;
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const { data } = active;
    setActiveId(active.id as string);

    if (data.current?.type === "Link") {
      setActiveLink(data.current.link);
      setActiveCategory(null);
    } else if (data.current?.type === "Category") {
      setActiveCategory(data.current.cat);
      setActiveLink(null);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    const overId = over?.id;

    if (!overId || active.id === overId) return;

    if (active.data.current?.type !== "Link") return;

    const activeContainer = findContainer(active.id as string, localData.categories);
    const overContainer = findContainer(overId as string, localData.categories);

    if (!activeContainer || !overContainer || activeContainer === overContainer) {
      return;
    }

    setLocalData((prev) => {
     
        const newData = JSON.parse(JSON.stringify(prev)) as DataSchema;
        const findParentContainerAndList = (items: (Category|LinkItem)[], id: string): [Category|LinkItem, LinkItem[]] | null => {
            for (const item of items) {
                const children = getChildren(item);
                if (children) {
                     if (children.find(c => c.id === id)) return [item, children];
                     const found = findParentContainerAndList(children, id);
                     if (found) return found;
                }
            }
            return null;
        };

        const activeRes = findParentContainerAndList(newData.categories, active.id as string);
        const overRes = findParentContainerAndList(newData.categories, overId as string);

        if (!activeRes || !overRes) return prev;

        const [, activeList] = activeRes;
        const [, overList] = overRes;
        const activeIndex = activeList.findIndex(l => l.id === active.id);
        const overIndex = overList.findIndex(l => l.id === overId);

        let newIndex;
        if (overList.includes(over.data.current?.link)) { 
             const isBelowOverItem = over && active.rect.current.translated && active.rect.current.translated.top > over.rect.top + over.rect.height;
             const modifier = isBelowOverItem ? 1 : 0;
             newIndex = overIndex >= 0 ? overIndex + modifier : overList.length + 1;
        } else {
             newIndex = overList.length + 1;
        }

        const [movedItem] = activeList.splice(activeIndex, 1);
        overList.splice(newIndex, 0, movedItem);

        return newData;
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    const activeType = active.data.current?.type;
    const overId = over?.id;

    if (!overId || active.id === overId) {
        setActiveId(null);
        setActiveLink(null);
        setActiveCategory(null);
        return;
    }

    if (activeType === "Category") {
        setLocalData((prev) => {
            const oldIndex = prev.categories.findIndex((c) => c.id === active.id);
            const newIndex = prev.categories.findIndex((c) => c.id === overId);
            return {
                ...prev,
                categories: arrayMove(prev.categories, oldIndex, newIndex),
            };
        });
    } 
    else if (activeType === "Link") {
        const activeContainer = findContainer(active.id as string, localData.categories);
        const overContainer = findContainer(overId as string, localData.categories);

        if (activeContainer === overContainer && activeContainer) {
            setLocalData((prev) => {
                const newData = JSON.parse(JSON.stringify(prev)) as DataSchema;
                
                const findAndSort = (items: (Category|LinkItem)[]) => {
                    for (const item of items) {
                        const children = getChildren(item);
                        if (children) {
                            if (item.id === activeContainer) {
                                const oldIndex = children.findIndex(l => l.id === active.id);
                                const newIndex = children.findIndex(l => l.id === overId);
                                const newChildren = arrayMove(children, oldIndex, newIndex);
                                if ('links' in item) (item as Category).links = newChildren;
                                else (item as LinkItem).children = newChildren;
                                return true;
                            }
                            if (findAndSort(children)) return true;
                        }
                    }
                    return false;
                };

                findAndSort(newData.categories);
                return newData;
            });
        }
    }

    setActiveId(null);
    setActiveLink(null);
    setActiveCategory(null);
  };

  const handleDeleteLink = (parentId: string, linkId: string) => {
    setLocalData((prev) => {
        const newData = JSON.parse(JSON.stringify(prev)) as DataSchema;
        const deleteRecursive = (items: (Category|LinkItem)[]) => {
            for (const item of items) {
                let children = getChildren(item);
                if (children) {
                    if (children.some(l => l.id === linkId)) {
                        children = children.filter(l => l.id !== linkId);
                        if ('links' in item) (item as Category).links = children;
                        else (item as LinkItem).children = children;
                        return true;
                    }
                    if (deleteRecursive(children)) return true;
                }
            }
            return false;
        };
        deleteRecursive(newData.categories);
        return newData;
    });
  };

  const handleCategoryIconChange = (catId: string, icon: string) => {
    const newData = { ...localData };
    const catIndex = newData.categories.findIndex(c => c.id === catId);
    if (catIndex !== -1) {
        newData.categories[catIndex].icon = icon;
        newData.categories[catIndex].updatedAt = Date.now();
        setLocalData(newData);
    }
  };

  const handleRenameCategory = (id: string, title: string) => {
    setLocalData(prev => {
        const newData = { ...prev };
        const index = newData.categories.findIndex(c => c.id === id);
        if (index !== -1) {
            newData.categories[index].title = title;
            newData.categories[index].updatedAt = Date.now();
        }
        return newData;
    });
  };

  const handleDeleteCategory = (catId: string) => {
    const newData = { ...localData };
    const catIndex = newData.categories.findIndex(c => c.id === catId);
    if (catIndex === -1) return;
    if (newData.categories[catIndex].links.length > 0) {
        if (!confirm("该分类下还有链接，确定要删除吗？")) return;
    }
    newData.categories.splice(catIndex, 1);
    setLocalData(newData);
  };

  const toggleCollapse = (catId: string) => {
    const newSet = new Set(collapsedCats);
    if (newSet.has(catId)) newSet.delete(catId);
    else newSet.add(catId);
    setCollapsedCats(newSet);
  };

  const dropAnimation: DropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        active: { opacity: '0.5' },
      },
    }),
  };
  
  const currentFolder = folderPath.length > 0 ? folderPath[folderPath.length - 1] : null;
  const resolvedCurrentFolder = useMemo(() => {
      if (!currentFolder) return null;

      const findItem = (items: (Category|LinkItem)[], id: string): LinkItem | null => {
          for (const item of items) {
             if (item.id === id && 'type' in item) return item as LinkItem;
             const children = getChildren(item);
             if (children) {
                 const found = findItem(children, id);
                 if (found) return found;
             }
          }
          return null;
      };
      return findItem(localData.categories, currentFolder.id);
  }, [localData, currentFolder]);


  if (currentFolder && !resolvedCurrentFolder) {
      setFolderPath([]);
  }

  const itemsToShow = resolvedCurrentFolder ? (resolvedCurrentFolder.children || []) : [];

  return (
    <div className="flex-1 flex flex-col min-h-0 py-4">
      <div className="flex items-center justify-between mb-4 px-1">
          <div className="text-xs text-muted-foreground">
             长按调整排序，支持跨文件夹移动链接
          </div>
          <div className="text-xs text-muted-foreground">
             {localData.categories.length} 个分类
          </div>
      </div>
      
      <DndContext 
        sensors={sensors} 
        collisionDetection={closestCenter} 
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 border rounded-xl bg-muted/10 overflow-y-auto min-h-0 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-muted-foreground/20 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/40">
            <div className="space-y-1 p-2 pb-10">
                {!currentFolder ? (

                    <SortableContext items={localData.categories.map(c => c.id)} strategy={verticalListSortingStrategy}>
                        {localData.categories.map((cat) => {
                            const isCollapsed = collapsedCats.has(cat.id);
                            return (
                                <SortableCategoryItem
                                    key={cat.id}
                                    cat={cat}
                                    isCollapsed={isCollapsed}
                                    toggleCollapse={toggleCollapse}
                                    handleCategoryIconChange={handleCategoryIconChange}
                                    handleDeleteCategory={handleDeleteCategory}
                                    handleRenameCategory={handleRenameCategory}
                                >
                                    {!isCollapsed && (
                                        <div className="pl-8 pr-2 py-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                            <SortableContext 
                                                id={cat.id} 
                                                items={cat.links.map(l => l.id)} 
                                                strategy={rectSortingStrategy}
                                            >
                                                                                            <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                                                                                {cat.links.map((link) => (
                                                                                                    <SortableLinkItem
                                                                                                        key={link.id}
                                                                                                        link={link}
                                                                                                        catId={cat.id}
                                                                                                        handleDeleteLink={handleDeleteLink}
                                                                                                        onEditFolder={(f) => setFolderPath([...folderPath, f])}
                                                                                                        onEdit={(link) => setEditingLink(link)}
                                                                                                        onMove={(link) => setMovingLink(link)}
                                                                                                    />
                                                                                                ))}
                                                                                                {cat.links.length === 0 && (
                                                                                                    <div className="col-span-full py-6 text-center text-xs text-muted-foreground/50 border border-dashed rounded-lg bg-muted/20">
                                                                                                        空文件夹 (拖入链接)
                                                                                                    </div>
                                                                                                )}
                                                                                            </div>                                            </SortableContext>
                                        </div>
                                    )}
                                </SortableCategoryItem>
                            );
                        })}
                    </SortableContext>
                ) : (

                    <div className="space-y-4">
                        <div className="flex items-center gap-2 p-2 pb-4 border-b border-border/20">
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => setFolderPath(prev => prev.slice(0, -1))}
                                className="h-8 gap-1"
                            >
                                <ChevronLeft className="h-4 w-4" /> 返回
                            </Button>
                            <div className="flex items-center gap-2 font-medium text-sm text-foreground/80">
                                <IconRender name={resolvedCurrentFolder?.icon || "FolderOpen"} className="h-4 w-4" />
                                <span>{resolvedCurrentFolder?.title}</span>
                            </div>
                        </div>

                        <SortableContext 
                            id={resolvedCurrentFolder!.id} 
                            items={itemsToShow.map(l => l.id)} 
                            strategy={rectSortingStrategy}
                        >
                             <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 p-2">
                                {itemsToShow.map((link) => (
                                    <SortableLinkItem
                                        key={link.id}
                                        link={link}
                                        catId={resolvedCurrentFolder!.id}
                                        handleDeleteLink={handleDeleteLink}
                                        onEditFolder={(f) => setFolderPath([...folderPath, f])}
                                        onEdit={(link) => setEditingLink(link)}
                                        onMove={(link) => setMovingLink(link)}
                                    />
                                ))}
                                {itemsToShow.length === 0 && (
                                    <div className="col-span-full py-10 text-center text-muted-foreground border border-dashed rounded-lg">
                                        此文件夹为空
                                    </div>
                                )}
                            </div>
                        </SortableContext>
                    </div>
                )}
            </div>
        </div>

      <Dialog open={!!editingLink} onOpenChange={(open) => !open && setEditingLink(null)}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>编辑链接</DialogTitle>
                <DialogDescription>修改链接的标题、URL 或图标。</DialogDescription>
            </DialogHeader>
            {editingLink && (
                <div className="grid gap-4 py-4">
                    {editingLink.type !== 'folder' && (
                    <div className="grid gap-2">
                        <Label>URL</Label>
                        <div className="flex gap-2">
                            <Input 
                                value={editingLink.url} 
                                onChange={(e) => setEditingLink({ ...editingLink, url: e.target.value })} 
                                placeholder="https://example.com"
                            />
                            <Button size="icon" variant="outline" onClick={() => handleSmartIdentifyForEdit(editingLink.url)} title="自动识别">
                                <Wand2 className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                    )}
                    <div className="grid gap-2">
                        <Label>标题</Label>
                        <Input 
                            value={editingLink.title} 
                            onChange={(e) => setEditingLink({ ...editingLink, title: e.target.value })} 
                            placeholder="输入标题"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label>图标</Label>
                        <div className="flex gap-2">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="icon" className="shrink-0" title="选择内置图标">
                                        <IconRender name={editingLink.icon || "Link"} className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="w-[300px] h-[300px] overflow-y-auto" align="start">
                                    <div className="grid grid-cols-6 gap-1 p-2">
                                        {PRESET_ICONS.map((iconName) => (
                                            <Button
                                                key={iconName}
                                                variant="ghost"
                                                size="icon"
                                                className="h-9 w-9"
                                                onClick={() => setEditingLink({ ...editingLink, icon: iconName })}
                                            >
                                                <IconRender name={iconName} className="h-5 w-5" />
                                            </Button>
                                        ))}
                                    </div>
                                </DropdownMenuContent>
                            </DropdownMenu>
                            <Input 
                                value={editingLink.icon} 
                                onChange={(e) => setEditingLink({ ...editingLink, icon: e.target.value })} 
                                placeholder="输入图标 URL 或选择内置图标"
                                className="flex-1"
                            />
                        </div>
                    </div>
                </div>
            )}
            <DialogFooter>
                <Button variant="outline" onClick={() => setEditingLink(null)}>取消</Button>
                <Button onClick={handleSaveEdit}>保存修改</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!movingLink} onOpenChange={(open) => !open && setMovingLink(null)}>
        <DialogContent className="h-[50vh] flex flex-col">
            <DialogHeader>
                <DialogTitle>移动链接</DialogTitle>
                <DialogDescription>选择要将 &quot;{movingLink?.title}&quot; 移动到的位置。</DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto py-2 -mx-2 px-2">
                <div className="space-y-1">
                    {moveOptions.map((option) => (
                        <Button
                            key={option.id}
                            variant="ghost"
                            className="w-full justify-start font-normal"
                            style={{ paddingLeft: `${option.level * 1.5 + 1}rem` }}
                            onClick={() => handleMoveConfirm(option.id)}
                        >
                            <Folder className="mr-2 h-4 w-4 text-muted-foreground" />
                            {option.title}
                        </Button>
                    ))}
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setMovingLink(null)}>取消</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

        {createPortal(
            <DragOverlay dropAnimation={dropAnimation}>
                {activeCategory && (
                     <div className="p-2 bg-background border rounded-lg shadow-xl opacity-90 w-[300px]">
                        <div className="flex items-center gap-2">
                            <IconRender name={activeCategory.icon || "FolderOpen"} className="h-4 w-4" />
                            <span className="font-bold">{activeCategory.title}</span>
                        </div>
                     </div>
                )}
                {activeLink && (
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-background border shadow-xl opacity-90 w-[200px]">
                        <div className="p-1.5 rounded-md bg-muted text-foreground shrink-0">
                            <IconRender name={activeLink.icon || "Link"} className="h-4 w-4" />
                        </div>
                        <span className="text-sm font-medium truncate">{activeLink.title}</span>
                    </div>
                )}
            </DragOverlay>,
            document.body
        )}
      </DndContext>
    </div>
  );
}