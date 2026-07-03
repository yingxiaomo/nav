import { useState, useCallback, useRef, useEffect, useMemo } from "react";
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
import { LinkEditor } from "./link-editor";
import { FolderNavigator } from "./folder-navigator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Folder, Trash2, FolderInput, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { isValidUrl, sanitizeText } from "@/lib/utils/validation";
import { generateFaviconUrl } from "@/lib/utils/common";
import { FaviconImage, extractTitleFromUrl } from "@/lib/utils/favicon";

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
  const [confirmDeleteCategory, setConfirmDeleteCategory] = useState<{ id: string; hasLinks: boolean } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchMoveTarget, setBatchMoveTarget] = useState<string | null>(null);
  const [confirmBatchDelete, setConfirmBatchDelete] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  // SSR 安全：延迟 portal 渲染到客户端
  useEffect(() => {
    setPortalTarget(document.body);
  }, []);

  // 搜索结果：平铺所有匹配链接，附带所属分类路径
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase();
    type Hit = { link: LinkItem; path: string; catId: string };
    const hits: Hit[] = [];
    const searchItems = (items: (Category | LinkItem)[], path: string) => {
      for (const item of items) {
        const children = getChildren(item);
        if (children) {
          for (const child of children) {
            if (
              child.title.toLowerCase().includes(q) ||
              (child.url && child.url.toLowerCase().includes(q))
            ) {
              hits.push({ link: child, path, catId: item.id });
            }
            if (child.children) searchItems(child.children, `${path} / ${child.title}`);
          }
        }
      }
    };
    for (const cat of localData.categories) {
      searchItems([cat], cat.title);
    }
    return hits;
  }, [searchQuery, localData.categories]);


  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(getVisibleLinkIds()));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  // 获取当前可见的所有链接 ID（function 声明，会被提升）
  function getVisibleLinkIds(): string[] {
    const ids: string[] = [];
    const collect = (items: (Category | LinkItem)[]) => {
      for (const item of items) {
        const children = getChildren(item);
        if (children) {
          for (const child of children) {
            ids.push(child.id);
          }
          collect(children);
        }
      }
    };
    for (const cat of localData.categories) {
      if (!collapsedCats.has(cat.id)) {
        for (const link of cat.links) {
          ids.push(link.id);
          if (link.children) collect(link.children);
        }
      }
    }
    return ids;
  }

  const handleBatchDelete = () => {
    setLocalData((prev) => {
      const newData = JSON.parse(JSON.stringify(prev)) as DataSchema;
      const deleteRecursive = (items: (Category | LinkItem)[]) => {
        for (const item of items) {
          const children = getChildren(item);
          if (children) {
            const filtered = children.filter((l) => !selectedIds.has(l.id));
            if ('links' in item) (item as Category).links = filtered;
            else (item as LinkItem).children = filtered;
            deleteRecursive(children);
          }
        }
      };
      deleteRecursive(newData.categories);
      return newData;
    });
    setSelectedIds(new Set());
    setConfirmBatchDelete(false);
    toast.success(`已删除 ${selectedIds.size} 个链接`);
  };

  const handleBatchMove = (targetId: string) => {

    setLocalData((prev) => {
      const newData = JSON.parse(JSON.stringify(prev)) as DataSchema;

      // Remove selected items from all locations
      const removed: LinkItem[] = [];
      const removeRecursive = (items: (Category | LinkItem)[]) => {
        for (const item of items) {
          const children = getChildren(item);
          if (children) {
            let i = children.length;
            while (i--) {
              if (selectedIds.has(children[i].id)) {
                removed.push(children[i]);
                children.splice(i, 1);
              }
            }
            if ('links' in item) (item as Category).links = children;
            else (item as LinkItem).children = children;
            removeRecursive(children);
          }
        }
      };
      removeRecursive(newData.categories);

      // Add to target
      const addToTarget = (items: (Category | LinkItem)[]): boolean => {
        for (const item of items) {
          if (item.id === targetId) {
            const children = getChildren(item);
            if (children) {
              children.push(...removed);
              if ('links' in item) (item as Category).links = children;
              else (item as LinkItem).children = children;
            }
            return true;
          }
          const children = getChildren(item);
          if (children && addToTarget(children)) return true;
        }
        return false;
      };
      addToTarget(newData.categories);
      return newData;
    });

    setSelectedIds(new Set());
    setBatchMoveTarget(null);
    toast.success(`已移动 ${selectedIds.size} 个链接`);
  };

  const batchMoveOptions = useMemo(() => {
    const options: { id: string; title: string; level: number }[] = [];
    const traverse = (items: (Category | LinkItem)[], level: number) => {
      for (const item of items) {
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
  }, [localData.categories]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleSmartIdentifyForEdit = useCallback((rawUrl: string) => {
    if (!rawUrl || !editingLink) return;
    
    const processedUrl = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`;
    
    try {
      const iconUrl = generateFaviconUrl(new URL(processedUrl).hostname);
      
      let title = editingLink.title;
      if (!title) {
          title = extractTitleFromUrl(processedUrl);
      }

      setEditingLink({ ...editingLink, url: processedUrl, icon: iconUrl, title: title });
      toast.success("已尝试自动识别信息", { description: "已从 URL 中提取标题和图标" });
    } catch {
       toast.error("URL 格式不正确", { description: "请输入有效的 URL 地址，如 https://example.com" });
    }
  }, [editingLink]);

  const handleSaveEdit = useCallback(() => {
      if (!editingLink) return;
      
      const isFolder = editingLink.type === 'folder';
      
      // 净化和验证输入
      const sanitizedTitle = sanitizeText(editingLink.title.trim());
      const sanitizedUrl = editingLink.url.trim();
      
      if (!sanitizedTitle) {
          toast.error("标题不能为空", { description: "请填写链接或文件夹的标题" });
          return;
      }
      
      if (!isFolder) {
          if (!sanitizedUrl) {
              toast.error("普通链接必须填写URL", { description: "请检查并填写完整的链接信息" });
              return;
          }
          
          // 验证URL格式
          const finalUrl = sanitizedUrl.startsWith("http") ? sanitizedUrl : `https://${sanitizedUrl}`;
          if (!isValidUrl(finalUrl)) {
              toast.error("URL格式不正确", { description: "请输入有效的URL地址，如 https://example.com" });
              return;
          }
      }

      const updatedLink = { 
          ...editingLink, 
          title: sanitizedTitle,
          url: isFolder ? editingLink.url : (sanitizedUrl.startsWith("http") ? sanitizedUrl : `https://${sanitizedUrl}`),
          updatedAt: Date.now() 
      };

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
      toast.success("修改已保存", {
        description: "链接信息已更新",
        duration: 3000
      });
  }, [editingLink, setLocalData]);

  const handleMoveConfirm = useCallback((targetId: string) => {
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
      toast.success("移动成功", {
        description: "链接已成功移动到新位置",
        duration: 3000
      });
  }, [movingLink, setLocalData]);

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

  // 定义递归函数 findContainer（不依赖 hooks）
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

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    const { data } = active;

    if (data.current?.type === "Link") {
      setActiveLink(data.current.link);
      setActiveCategory(null);
    } else if (data.current?.type === "Category") {
      setActiveCategory(data.current.cat);
      setActiveLink(null);
    }
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
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
  }, [localData.categories, setLocalData, findContainer]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    const activeType = active.data.current?.type;
    const overId = over?.id;

    if (!overId || active.id === overId) {
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

    setActiveLink(null);
    setActiveCategory(null);
  }, [localData.categories, setLocalData, findContainer]);

  const handleDeleteLink = useCallback((_parentId: string, linkId: string) => {
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
  }, [setLocalData]);

  const handleCategoryIconChange = useCallback((catId: string, icon: string) => {
    setLocalData(prev => {
        const newData = JSON.parse(JSON.stringify(prev)) as DataSchema;
        const catIndex = newData.categories.findIndex(c => c.id === catId);
        if (catIndex !== -1) {
            newData.categories[catIndex].icon = icon;
            newData.categories[catIndex].updatedAt = Date.now();
        }
        return newData;
    });
  }, [setLocalData]);

  const handleRenameCategory = useCallback((id: string, title: string) => {
    setLocalData(prev => {
        const newData = JSON.parse(JSON.stringify(prev)) as DataSchema;
        const index = newData.categories.findIndex(c => c.id === id);
        if (index !== -1) {
            newData.categories[index].title = title;
            newData.categories[index].updatedAt = Date.now();
        }
        return newData;
    });
  }, [setLocalData]);

  const handleDeleteCategory = useCallback((catId: string) => {
    setLocalData(prev => {
        const newData = { ...prev };
        const catIndex = newData.categories.findIndex(c => c.id === catId);
        if (catIndex === -1) return prev;
        if (newData.categories[catIndex].links.length > 0) {
            setConfirmDeleteCategory({ id: catId, hasLinks: true });
            return prev;
        }
        newData.categories = newData.categories.filter((_, i) => i !== catIndex);
        return newData;
    });
  }, [setLocalData]);

  const handleConfirmDeleteCategory = useCallback(() => {
    if (!confirmDeleteCategory) return;
    setLocalData(prev => {
        const newData = { ...prev };
        newData.categories = newData.categories.filter(c => c.id !== confirmDeleteCategory.id);
        return newData;
    });
    setConfirmDeleteCategory(null);
  }, [confirmDeleteCategory, setLocalData]);

  const toggleCollapse = useCallback((catId: string) => {
    const newSet = new Set(collapsedCats);
    if (newSet.has(catId)) newSet.delete(catId);
    else newSet.add(catId);
    setCollapsedCats(newSet);
  }, [collapsedCats]);

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


  useEffect(() => {
    if (currentFolder && !resolvedCurrentFolder) {
        setFolderPath([]);
    }
  }, [currentFolder, resolvedCurrentFolder]);

  const itemsToShow = resolvedCurrentFolder ? (resolvedCurrentFolder.children || []) : [];

  return (
    <div className="flex-1 flex flex-col min-h-0 py-4">
      <div className="flex items-center justify-between mb-4 px-1 min-h-[20px]">
          <div className="flex items-center gap-3">
            {selectedIds.size > 0 ? (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-primary">
                  已选 {selectedIds.size} 项
                </span>
                <button
                  onClick={deselectAll}
                  className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
                >
                  取消选择
                </button>
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">
                {currentFolder ? '管理文件夹内链接' : '长按调整排序，支持跨文件夹移动链接'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {selectedIds.size === 0 ? (
              <div className="text-xs text-muted-foreground">
                {localData.categories.length} 个分类
              </div>
            ) : null}
            {!currentFolder && selectedIds.size === 0 && (
              <button
                onClick={() => {
                  const ids = getVisibleLinkIds();
                  if (ids.length > 0) setSelectedIds(new Set(ids));
                }}
                className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
              >
                全选
              </button>
            )}
          </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 mb-3 px-3 py-2.5 rounded-lg bg-primary/5 border border-primary/20">
          <span className="text-sm font-medium text-primary flex-1">
            已选择 {selectedIds.size} 个链接
          </span>
          <Button
            variant="secondary"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => setBatchMoveTarget("start")}
          >
            <FolderInput className="h-3.5 w-3.5" />
            批量移动
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => setConfirmBatchDelete(true)}
          >
            <Trash2 className="h-3.5 w-3.5" />
            批量删除
          </Button>
        </div>
      )}

      {/* 搜索框 */}
      {!currentFolder && (
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50 pointer-events-none" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索书签标题或 URL..."
            className="h-9 pl-9 pr-4 text-sm rounded-lg border-muted-foreground/20 bg-muted/20"
          />
        </div>
      )}

      {searchResults !== null ? (
        /* ── 搜索结果视图 ── */
        <div className="flex-1 border rounded-xl bg-muted/10 overflow-y-auto min-h-0 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-muted-foreground/20 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/40">
          <div className="p-2 pb-10 space-y-0.5">
            {searchResults.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground/50">
                没有找到匹配的书签
              </div>
            ) : (
              <div className="space-y-0.5">
                <div className="px-3 py-1.5 text-xs text-muted-foreground/50">
                  找到 {searchResults.length} 个匹配结果
                </div>
                {searchResults.map(({ link, path, catId }) => (
                  <div key={link.id} className="flex items-center gap-2 p-2 rounded-lg transition-all group border border-transparent hover:border-border/40 hover:bg-muted/20">
                    <div
                      className="flex items-center justify-center w-6 h-6 shrink-0"
                      onClick={(e) => { e.stopPropagation(); toggleSelect(link.id); }}
                    >
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all cursor-pointer ${
                        selectedIds.has(link.id) ? 'bg-primary border-primary' : 'border-muted-foreground/40 hover:border-muted-foreground/70'
                      }`}>
                        {selectedIds.has(link.id) && (
                          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" className="w-3 h-3">
                            <path d="M5 12l5 5l9-9" />
                          </svg>
                        )}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium truncate block">{link.title}</span>
                        <span className="text-[11px] text-muted-foreground/60 truncate block">{path}</span>
                      </div>
                      {link.url && (
                        <span className="text-[11px] text-muted-foreground/40 truncate hidden md:block max-w-[200px]">{link.url}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => setEditingLink(link)} title="编辑">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteLink(catId, link.id)} title="删除">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
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
                                                                                            <div className="grid grid-cols-1 gap-2">
                                                                                                {cat.links.map((link) => (
                                                                                                    <SortableLinkItem
                                                                                                        key={link.id}
                                                                                                        link={link}
                                                                                                        catId={cat.id}
                                                                                                        handleDeleteLink={handleDeleteLink}
                                                                                                        onEditFolder={(f) => setFolderPath([...folderPath, f])}
                                                                                                        onEdit={(link) => setEditingLink(link)}
                                                                                                        onMove={(link) => setMovingLink(link)}
                                                                                                        isSelected={selectedIds.has(link.id)}
                                                                                                        onToggleSelect={toggleSelect}
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
                        <FolderNavigator
                            onBack={() => setFolderPath(prev => prev.slice(0, -1))}    
                            resolvedCurrentFolder={resolvedCurrentFolder}
                        />

                        <SortableContext 
                            id={resolvedCurrentFolder!.id} 
                            items={itemsToShow.map(l => l.id)} 
                            strategy={rectSortingStrategy}
                        >
                             <div className="grid grid-cols-1 gap-2 p-2">
                                {itemsToShow.map((link) => (
                                    <SortableLinkItem
                                        key={link.id}
                                        link={link}
                                        catId={resolvedCurrentFolder!.id}
                                        handleDeleteLink={handleDeleteLink}
                                        onEditFolder={(f) => setFolderPath([...folderPath, f])}
                                        onEdit={(link) => setEditingLink(link)}
                                        onMove={(link) => setMovingLink(link)}
                                        isSelected={selectedIds.has(link.id)}
                                        onToggleSelect={toggleSelect}
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
            <LinkEditor
                editingLink={editingLink}
                onUpdate={setEditingLink}
                onSmartIdentify={handleSmartIdentifyForEdit}
            />
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

        {portalTarget && createPortal(
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
                            <FaviconImage icon={activeLink.icon} url={activeLink.url} className="h-4 w-4" />
                        </div>
                        <span className="text-sm font-medium truncate">{activeLink.title}</span>
                    </div>
                )}
            </DragOverlay>,
            portalTarget
        )}
      </DndContext>
      )}

      {/* 确认删除分类对话框 */}
      <Dialog open={!!confirmDeleteCategory} onOpenChange={(open) => !open && setConfirmDeleteCategory(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              该分类下还有链接，确定要删除吗？删除后链接将无法恢复。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmDeleteCategory(null)}>取消</Button>
            <Button variant="destructive" onClick={handleConfirmDeleteCategory}>确认删除</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 批量删除确认 */}
      <Dialog open={confirmBatchDelete} onOpenChange={(open) => !open && setConfirmBatchDelete(false)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>确认批量删除</DialogTitle>
            <DialogDescription>
              确定要删除选中的 {selectedIds.size} 个链接吗？此操作无法撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmBatchDelete(false)}>取消</Button>
            <Button variant="destructive" onClick={handleBatchDelete}>删除 {selectedIds.size} 项</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 批量移动 */}
      <Dialog open={batchMoveTarget !== null} onOpenChange={(open) => !open && setBatchMoveTarget(null)}>
        <DialogContent className="h-[50vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>批量移动到...</DialogTitle>
            <DialogDescription>
              将 {selectedIds.size} 个链接移动到所选位置。
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto py-2 -mx-2 px-2">
            <div className="space-y-1">
              {batchMoveOptions.map((option) => (
                <Button
                  key={option.id}
                  variant="ghost"
                  className="w-full justify-start font-normal"
                  style={{ paddingLeft: `${option.level * 1.5 + 1}rem` }}
                  onClick={() => handleBatchMove(option.id)}
                >
                  <Folder className="mr-2 h-4 w-4 text-muted-foreground" />
                  {option.title}
                </Button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchMoveTarget(null)}>取消</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}