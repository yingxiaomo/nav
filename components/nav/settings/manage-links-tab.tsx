"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { DataSchema, Category, LinkItem } from "@/lib/types";
import { deepClone, findNodeInTree, removeNodeFromTree, moveNodeToTree, getAllIds } from "@/lib/utils/tree";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent, DragOverEvent, DragStartEvent, DragOverlay, defaultDropAnimationSideEffects, DropAnimation } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, rectSortingStrategy } from "@dnd-kit/sortable";
import { createPortal } from "react-dom";
import { Search } from "lucide-react";
import { SortableCategoryItem } from "./category-item";
import { SortableLinkItem } from "./link-item";
import { IconRender } from "./shared";
import { LinkEditor } from "./link-editor";
import { FolderNavigator } from "./folder-navigator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { isValidUrl, sanitizeText } from "@/lib/utils/validation";
import { generateFaviconUrl } from "@/lib/utils/common";
import { FaviconImage, extractTitleFromUrl } from "@/lib/utils/favicon";
import { BatchActionsBar } from "./batch-actions-bar";
import { ManageLinksSearch } from "./manage-links-search";
import { MoveToDialog } from "./move-to-dialog";
import { ConfirmDeleteDialog } from "./confirm-delete-dialog";

interface ManageLinksTabProps {
  localData: DataSchema;
  setLocalData: React.Dispatch<React.SetStateAction<DataSchema>>;
}

const getChildren = (item: Category | LinkItem): (Category | LinkItem)[] | undefined =>
  'links' in item ? (item as Category).links : (item as LinkItem).children;

const setChildren = (item: Category | LinkItem, children: (Category | LinkItem)[]) => {
  if ('links' in item) (item as Category).links = children as LinkItem[];
  else if ('children' in item) (item as LinkItem).children = children as LinkItem[];
};

/* eslint-disable @typescript-eslint/no-explicit-any */
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

  useEffect(() => { setPortalTarget(document.body); }, []);

  const toggleSelect = (id: string) => setSelectedIds(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });
  const deselectAll = () => setSelectedIds(new Set());

  const visibleLinkIds = useMemo((): string[] => {
    const ids: string[] = [];
    for (const cat of localData.categories) {
      if (!collapsedCats.has(cat.id)) ids.push(...getAllIds(cat.links, (l) => l.children));
    }
    return ids;
  }, [localData.categories, collapsedCats]);

  const handleBatchDelete = useCallback(() => {
    setLocalData(prev => {
      const newData = deepClone(prev);
      for (const id of selectedIds) removeNodeFromTree(newData.categories as any, id, getChildren);
      return newData;
    });
    setSelectedIds(new Set());
    setConfirmBatchDelete(false);
    toast.success(`已删除 ${selectedIds.size} 个链接`);
  }, [selectedIds, setLocalData]);

  const handleBatchMove = useCallback((targetId: string) => {
    setLocalData(prev => {
      const newData = deepClone(prev);
      const removed: LinkItem[] = [];
      for (const id of selectedIds) {
        const r = removeNodeFromTree(newData.categories as any, id, getChildren);
        if (r) removed.push(r as LinkItem);
      }
      if (removed.length === 0) return prev;
      const addTarget = (items: (Category | LinkItem)[]): boolean => {
        for (const item of items) {
          if (item.id === targetId) {
            const ch = getChildren(item) || []; ch.push(...removed); setChildren(item, ch); return true;
          }
          const ch = getChildren(item);
          if (ch && addTarget(ch)) return true;
        }
        return false;
      };
      addTarget(newData.categories);
      return newData;
    });
    setSelectedIds(new Set());
    setBatchMoveTarget(null);
    toast.success(`已移动 ${selectedIds.size} 个链接`);
  }, [selectedIds, setLocalData]);

  const buildFolderOptions = useCallback((excludeId?: string) => {
    const opts: { id: string; title: string; level: number }[] = [];
    const walk = (items: (Category | LinkItem)[], level: number) => {
      for (const item of items) {
        if (item.id === excludeId) continue;
        if ('links' in item || 'children' in item) {
          opts.push({ id: item.id, title: item.title, level });
          const ch = getChildren(item);
          if (ch) walk(ch, level + 1);
        }
      }
    };
    walk(localData.categories, 0);
    return opts;
  }, [localData.categories]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleSmartIdentifyForEdit = useCallback((rawUrl: string) => {
    if (!rawUrl || !editingLink) return;
    const url = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`;
    try {
      const iconUrl = generateFaviconUrl(new URL(url).hostname);
      const title = editingLink.title || extractTitleFromUrl(url);
      setEditingLink({ ...editingLink, url, icon: iconUrl, title });
      toast.success("已尝试自动识别信息");
    } catch { toast.error("URL 格式不正确"); }
  }, [editingLink]);

  const handleSaveEdit = useCallback(() => {
    if (!editingLink) return;
    const isFolder = editingLink.type === 'folder';
    const title = sanitizeText(editingLink.title.trim());
    const url = editingLink.url.trim();
    if (!title) { toast.error("标题不能为空"); return; }
    if (!isFolder) {
      if (!url) { toast.error("普通链接必须填写URL"); return; }
      if (!isValidUrl(url.startsWith("http") ? url : `https://${url}`)) { toast.error("URL格式不正确"); return; }
    }
    const updated = { ...editingLink, title, url: isFolder ? editingLink.url : (url.startsWith("http") ? url : `https://${url}`), updatedAt: Date.now() };
    setLocalData(prev => {
      const newData = deepClone(prev);
      const found = findNodeInTree(newData.categories as any, updated.id, getChildren) as LinkItem | undefined;
      if (found) Object.assign(found, updated);
      return newData;
    });
    setEditingLink(null);
    toast.success("修改已保存");
  }, [editingLink, setLocalData]);

  const handleMoveConfirm = useCallback((targetId: string) => {
    if (!movingLink) return;
    setLocalData(prev => {
      const newData = deepClone(prev);
      const removed = removeNodeFromTree(newData.categories as any, movingLink.id, getChildren);
      if (!removed) return prev;
      moveNodeToTree(newData.categories as any, targetId, removed, getChildren, setChildren);
      return newData;
    });
    setMovingLink(null);
    toast.success("移动成功");
  }, [movingLink, setLocalData]);

  const findContainer = useCallback(function find(id: string, items: (Category | LinkItem)[]): string | undefined {
    if (items.find(i => i.id === id)) return id;
    for (const item of items) {
      const ch = getChildren(item);
      if (ch) {
        if (ch.find(c => c.id === id)) return item.id;
        const f = find(id, ch); if (f) return f;
      }
    }
    return undefined;
  }, []);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const d = event.active.data.current;
    if (d?.type === "Link") { setActiveLink(d.link); setActiveCategory(null); }
    else if (d?.type === "Category") { setActiveCategory(d.cat); setActiveLink(null); }
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    const overId = over?.id;
    if (!overId || active.id === overId || active.data.current?.type !== "Link") return;
    const aC = findContainer(active.id as string, localData.categories);
    const oC = findContainer(overId as string, localData.categories);
    if (!aC || !oC || aC === oC) return;
    setLocalData(prev => {
      const newData = deepClone(prev);
      const findList = (items: (Category | LinkItem)[], id: string): [Category | LinkItem, LinkItem[]] | null => {
        for (const item of items) {
          const ch = getChildren(item) as LinkItem[] | undefined;
          if (ch) {
            if (ch.find(c => c.id === id)) return [item, ch];
            const f = findList(ch, id); if (f) return f;
          }
        }
        return null;
      };
      const ar = findList(newData.categories, active.id as string);
      const or = findList(newData.categories, overId as string);
      if (!ar || !or) return prev;
      const [, al] = ar; const [, ol] = or;
      const ai = al.findIndex(l => l.id === active.id);
      const oi = ol.findIndex(l => l.id === overId);
      const below = over && active.rect.current.translated && active.rect.current.translated.top > over.rect.top + over.rect.height;
      const ni = oi >= 0 ? oi + (below ? 1 : 0) : ol.length + 1;
      const [moved] = al.splice(ai, 1);
      ol.splice(ni, 0, moved);
      return newData;
    });
  }, [localData.categories, setLocalData, findContainer]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    const overId = over?.id;
    if (!overId || active.id === overId) { setActiveLink(null); setActiveCategory(null); return; }
    const type = active.data.current?.type;
    if (type === "Category") {
      setLocalData(prev => ({
        ...prev,
        categories: arrayMove(prev.categories, prev.categories.findIndex(c => c.id === active.id), prev.categories.findIndex(c => c.id === overId)),
      }));
    } else if (type === "Link") {
      const aC = findContainer(active.id as string, localData.categories);
      const oC = findContainer(overId as string, localData.categories);
      if (aC === oC && aC) {
        setLocalData(prev => {
          const newData = deepClone(prev);
          const sortIn = (items: (Category | LinkItem)[]): boolean => {
            for (const item of items) {
              const ch = getChildren(item);
              if (ch && item.id === aC) {
                const oi = ch.findIndex(l => l.id === active.id);
                const ni = ch.findIndex(l => l.id === overId);
                const sorted = arrayMove(ch, oi, ni);
                setChildren(item, sorted);
                return true;
              }
              const ch2 = getChildren(item);
              if (ch2 && sortIn(ch2)) return true;
            }
            return false;
          };
          sortIn(newData.categories);
          return newData;
        });
      }
    }
    setActiveLink(null); setActiveCategory(null);
  }, [localData.categories, setLocalData, findContainer]);

  const handleDeleteLink = useCallback((_: string, linkId: string) => {
    setLocalData(prev => {
      const newData = deepClone(prev);
      removeNodeFromTree(newData.categories as any, linkId, getChildren);
      return newData;
    });
  }, [setLocalData]);

  const handleCategoryIconChange = useCallback((catId: string, icon: string) => setLocalData(prev => {
    const d = deepClone(prev);
    const c = d.categories.find(x => x.id === catId);
    if (c) { c.icon = icon; c.updatedAt = Date.now(); }
    return d;
  }), [setLocalData]);

  const handleRenameCategory = useCallback((id: string, title: string) => setLocalData(prev => {
    const d = deepClone(prev);
    const c = d.categories.find(x => x.id === id);
    if (c) { c.title = title; c.updatedAt = Date.now(); }
    return d;
  }), [setLocalData]);

  const handleDeleteCategory = useCallback((catId: string) => setLocalData(prev => {
    const idx = prev.categories.findIndex(c => c.id === catId);
    if (idx === -1) return prev;
    if (prev.categories[idx].links.length > 0) { setConfirmDeleteCategory({ id: catId, hasLinks: true }); return prev; }
    return { ...prev, categories: prev.categories.filter((_, i) => i !== idx) };
  }), [setLocalData]);

  const handleConfirmDeleteCategory = useCallback(() => {
    if (!confirmDeleteCategory) return;
    setLocalData(prev => ({ ...prev, categories: prev.categories.filter(c => c.id !== confirmDeleteCategory.id) }));
    setConfirmDeleteCategory(null);
  }, [confirmDeleteCategory, setLocalData]);

  const toggleCollapse = useCallback((catId: string) => setCollapsedCats(prev => {
    const n = new Set(prev); n.has(catId) ? n.delete(catId) : n.add(catId); return n;
  }), []);

  const dropAnimation: DropAnimation = { sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.5' } } }) };
  const currentFolder = folderPath.length > 0 ? folderPath[folderPath.length - 1] : null;
  const resolvedCurrentFolder = useMemo(() => {
    if (!currentFolder) return null;
    return findNodeInTree(localData.categories as any, currentFolder.id, getChildren) as LinkItem | null;
  }, [localData, currentFolder]);

  useEffect(() => { if (currentFolder && !resolvedCurrentFolder) setFolderPath([]); }, [currentFolder, resolvedCurrentFolder]);
  const itemsToShow = resolvedCurrentFolder ? (resolvedCurrentFolder.children || []) : [];

  const moveOptions = useMemo(() => buildFolderOptions(movingLink?.id), [buildFolderOptions, movingLink?.id]);
  const batchOptions = useMemo(() => buildFolderOptions(), [buildFolderOptions]);

  return (
    <div className="flex-1 flex flex-col min-h-0 py-4">
      <div className="flex items-center justify-between mb-4 px-1 min-h-[20px]">
        <div className="flex items-center gap-3">
          {selectedIds.size > 0 ? (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-primary">已选 {selectedIds.size} 项</span>
              <button onClick={deselectAll} className="text-[11px] text-muted-foreground hover:text-foreground underline">取消选择</button>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">{currentFolder ? '管理文件夹内链接' : '长按调整排序，支持跨文件夹移动链接'}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.size === 0 && <div className="text-xs text-muted-foreground">{localData.categories.length} 个分类</div>}
          {!currentFolder && selectedIds.size === 0 && (
            <button onClick={() => { const ids = visibleLinkIds; if (ids.length > 0) setSelectedIds(new Set(ids)); }}
              className="text-[11px] text-muted-foreground hover:text-foreground underline">全选</button>
          )}
        </div>
      </div>

      <BatchActionsBar selectedCount={selectedIds.size} onBatchMove={() => setBatchMoveTarget("start")} onBatchDelete={() => setConfirmBatchDelete(true)} onClearSelection={deselectAll} />

      {!currentFolder && (
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50 pointer-events-none" />
          <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="搜索书签标题或 URL..."
            className="h-9 pl-9 pr-4 text-sm rounded-lg border-muted-foreground/20 bg-muted/20" />
        </div>
      )}

      {searchQuery.trim() ? (
        <ManageLinksSearch searchQuery={searchQuery} data={localData} selectedIds={selectedIds}
          onToggleSelect={toggleSelect} onEdit={setEditingLink} onDelete={handleDeleteLink} />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
          <div className="flex-1 border rounded-xl bg-muted/10 overflow-y-auto min-h-0 custom-scrollbar">
            <div className="space-y-1 p-2 pb-10">
              {!currentFolder ? (
                <SortableContext items={localData.categories.map(c => c.id)} strategy={verticalListSortingStrategy}>
                  {localData.categories.map(cat => (
                    <SortableCategoryItem key={cat.id} cat={cat} isCollapsed={collapsedCats.has(cat.id)}
                      toggleCollapse={toggleCollapse} handleCategoryIconChange={handleCategoryIconChange}
                      handleDeleteCategory={handleDeleteCategory} handleRenameCategory={handleRenameCategory}>
                      {!collapsedCats.has(cat.id) && (
                        <div className="pl-8 pr-2 py-2 animate-in fade-in slide-in-from-top-1 duration-200">
                          <SortableContext id={cat.id} items={cat.links.map(l => l.id)} strategy={rectSortingStrategy}>
                            <div className="grid grid-cols-1 gap-2">
                              {cat.links.map(link => (
                                <SortableLinkItem key={link.id} link={link} catId={cat.id} handleDeleteLink={handleDeleteLink}
                                  onEditFolder={f => setFolderPath([...folderPath, f])} onEdit={setEditingLink}
                                  onMove={setMovingLink} isSelected={selectedIds.has(link.id)} onToggleSelect={toggleSelect} />
                              ))}
                              {cat.links.length === 0 && (
                                <div className="col-span-full py-6 text-center text-xs text-muted-foreground/50 border border-dashed rounded-lg bg-muted/20">空文件夹 (拖入链接)</div>
                              )}
                            </div>
                          </SortableContext>
                        </div>
                      )}
                    </SortableCategoryItem>
                  ))}
                </SortableContext>
              ) : (
                <div className="space-y-4">
                  <FolderNavigator onBack={() => setFolderPath(prev => prev.slice(0, -1))} resolvedCurrentFolder={resolvedCurrentFolder} />
                  <SortableContext id={resolvedCurrentFolder!.id} items={itemsToShow.map(l => l.id)} strategy={rectSortingStrategy}>
                    <div className="grid grid-cols-1 gap-2 p-2">
                      {itemsToShow.map(link => (
                        <SortableLinkItem key={link.id} link={link} catId={resolvedCurrentFolder!.id} handleDeleteLink={handleDeleteLink}
                          onEditFolder={f => setFolderPath([...folderPath, f])} onEdit={setEditingLink}
                          onMove={setMovingLink} isSelected={selectedIds.has(link.id)} onToggleSelect={toggleSelect} />
                      ))}
                      {itemsToShow.length === 0 && <div className="col-span-full py-10 text-center text-muted-foreground border border-dashed rounded-lg">此文件夹为空</div>}
                    </div>
                  </SortableContext>
                </div>
              )}
            </div>
          </div>

          <Dialog open={!!editingLink} onOpenChange={open => !open && setEditingLink(null)}>
            <DialogContent>
              <DialogHeader><DialogTitle>编辑链接</DialogTitle><DialogDescription>修改链接的标题、URL 或图标。</DialogDescription></DialogHeader>
              <LinkEditor editingLink={editingLink} onUpdate={setEditingLink} onSmartIdentify={handleSmartIdentifyForEdit} />
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditingLink(null)}>取消</Button>
                <Button onClick={handleSaveEdit}>保存修改</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <MoveToDialog open={!!movingLink} onOpenChange={open => !open && setMovingLink(null)}
            title="移动链接" description={`选择要将 "${movingLink?.title}" 移动到的位置。`}
            options={moveOptions}
            onConfirm={handleMoveConfirm} />

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
            </DragOverlay>, portalTarget
          )}
        </DndContext>
      )}

      <ConfirmDeleteDialog open={!!confirmDeleteCategory} onOpenChange={open => !open && setConfirmDeleteCategory(null)}
        title="确认删除" description="该分类下还有链接，确定要删除吗？删除后链接将无法恢复。"
        onConfirm={handleConfirmDeleteCategory} />

      <ConfirmDeleteDialog open={confirmBatchDelete} onOpenChange={open => !open && setConfirmBatchDelete(false)}
        title="确认批量删除" description={`确定要删除选中的 ${selectedIds.size} 个链接吗？此操作无法撤销。`}
        onConfirm={handleBatchDelete} />

      <MoveToDialog open={batchMoveTarget !== null} onOpenChange={open => !open && setBatchMoveTarget(null)}
        title="批量移动到..." description={`将 ${selectedIds.size} 个链接移动到所选位置。`}
        options={batchOptions} onConfirm={handleBatchMove} />
    </div>
  );
}
