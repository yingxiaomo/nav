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
import { IconRender } from "./shared";

interface ManageLinksTabProps {
  localData: DataSchema;
  setLocalData: React.Dispatch<React.SetStateAction<DataSchema>>;
}

export function ManageLinksTab({ localData, setLocalData }: ManageLinksTabProps) {
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeLink, setActiveLink] = useState<LinkItem | null>(null);
  const [activeCategory, setActiveCategory] = useState<Category | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const findContainer = (id: string): string | undefined => {
    if (localData.categories.find((c) => c.id === id)) {
      return id;
    }
    return localData.categories.find((c) => c.links.some((l) => l.id === id))?.id;
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

    const activeContainer = findContainer(active.id as string);
    const overContainer = findContainer(overId as string);

    if (!activeContainer || !overContainer || activeContainer === overContainer) {
      return;
    }

    setLocalData((prev) => {
      const activeCatIndex = prev.categories.findIndex((c) => c.id === activeContainer);
      const overCatIndex = prev.categories.findIndex((c) => c.id === overContainer);

      if (activeCatIndex === -1 || overCatIndex === -1) return prev;

      const activeCat = prev.categories[activeCatIndex];
      const overCat = prev.categories[overCatIndex];

      const activeLinkIndex = activeCat.links.findIndex((l) => l.id === active.id);
      
      let newIndex;
      if (over.data.current?.type === "Link") {
        const overLinkIndex = overCat.links.findIndex((l) => l.id === overId);
        const isBelowOverItem = over && active.rect.current.translated && active.rect.current.translated.top > over.rect.top + over.rect.height;
        const modifier = isBelowOverItem ? 1 : 0;
        newIndex = overLinkIndex >= 0 ? overLinkIndex + modifier : overCat.links.length + 1;
      } else {
        newIndex = overCat.links.length + 1;
      }

      const newActiveCat = {
        ...activeCat,
        links: [
            ...activeCat.links.slice(0, activeLinkIndex), 
            ...activeCat.links.slice(activeLinkIndex + 1)
        ]
      };

      const newOverCat = {
        ...overCat,
        links: [
            ...overCat.links.slice(0, newIndex),
            activeCat.links[activeLinkIndex],
            ...overCat.links.slice(newIndex, overCat.links.length)
        ]
      };

      const newCategories = [...prev.categories];
      newCategories[activeCatIndex] = newActiveCat;
      newCategories[overCatIndex] = newOverCat;

      return { ...prev, categories: newCategories };
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
        const activeContainer = findContainer(active.id as string);
        const overContainer = findContainer(overId as string);

        if (activeContainer === overContainer && activeContainer) {
            setLocalData((prev) => {
                const catIndex = prev.categories.findIndex((c) => c.id === activeContainer);
                if (catIndex === -1) return prev;

                const cat = prev.categories[catIndex];
                const oldIndex = cat.links.findIndex((l) => l.id === active.id);
                const newIndex = cat.links.findIndex((l) => l.id === overId);

                const newCat = {
                    ...cat,
                    links: arrayMove(cat.links, oldIndex, newIndex)
                };

                const newCategories = [...prev.categories];
                newCategories[catIndex] = newCat;
                return { ...prev, categories: newCategories };
            });
        }
    }

    setActiveId(null);
    setActiveLink(null);
    setActiveCategory(null);
  };

  const handleDeleteLink = (catId: string, linkId: string) => {
    const newData = { ...localData };
    const catIndex = newData.categories.findIndex(c => c.id === catId);
    if (catIndex === -1) return;
    newData.categories[catIndex].links = newData.categories[catIndex].links.filter(l => l.id !== linkId);
    setLocalData(newData);
  };

  const handleCategoryIconChange = (catId: string, icon: string) => {
    const newData = { ...localData };
    const catIndex = newData.categories.findIndex(c => c.id === catId);
    if (catIndex !== -1) {
        newData.categories[catIndex].icon = icon;
        setLocalData(newData);
    }
  };

  const handleRenameCategory = (id: string, title: string) => {
    setLocalData(prev => {
        const newData = { ...prev };
        const index = newData.categories.findIndex(c => c.id === id);
        if (index !== -1) {
            newData.categories[index].title = title;
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

  return (
    <div className="flex-1 flex flex-col min-h-0 py-4">
      <div className="flex items-center justify-between mb-4 px-1">
          <div className="text-xs text-muted-foreground">
             可拖拽 <span className="font-mono px-1 bg-muted rounded">::</span> 调整排序，支持跨文件夹移动链接
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
                                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                                                {cat.links.map((link) => (
                                                    <SortableLinkItem
                                                        key={link.id}
                                                        link={link}
                                                        catId={cat.id}
                                                        handleDeleteLink={handleDeleteLink}
                                                    />
                                                ))}
                                                {cat.links.length === 0 && (
                                                    <div className="col-span-full py-6 text-center text-xs text-muted-foreground/50 border border-dashed rounded-lg bg-muted/20">
                                                        空文件夹 (拖入链接)
                                                    </div>
                                                )}
                                            </div>
                                        </SortableContext>
                                    </div>
                                )}
                            </SortableCategoryItem>
                        );
                    })}
                </SortableContext>
            </div>
        </div>

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