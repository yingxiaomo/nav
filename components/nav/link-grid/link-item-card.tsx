"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { LinkItem } from "@/lib/types";
import { ChevronLeft, X, Pencil, PinOff, Loader2 } from "lucide-react";
import { IconRender, PRESET_ICONS } from "@/components/nav/settings/shared";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { FaviconImage } from "@/lib/utils/favicon";
import { convertToWebP } from "@/lib/utils/image-utils";
import { isValidImageFile, isValidFileSize } from "@/lib/utils/validation";
import { useUIStore } from "@/lib/stores";

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
  onUnpin,
  onUpdate
}: {
  item: LinkItem;
  onUnpin: () => void;
  onUpdate?: (updated: LinkItem) => void;
}) {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTitle, setEditTitle] = useState(item.title);
  const [editUrl, setEditUrl] = useState(item.url);
  const [editIcon, setEditIcon] = useState(item.icon || '');
  const [uploading, setUploading] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // 关闭右键菜单
  useEffect(() => {
    if (!menu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menu]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY });
  };

  const openEdit = () => {
    setEditTitle(item.title);
    setEditUrl(item.url);
    setEditIcon(item.icon || '');
    setMenu(null);
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!editTitle.trim()) return;
    onUpdate?.({ ...item, title: editTitle.trim(), url: editUrl.trim() || item.url, icon: editIcon || undefined });
    setDialogOpen(false);
  };

  const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!isValidImageFile(file)) return;
    if (!isValidFileSize(file, 2)) return;
    setUploading(true);
    try {
      const backendAvailable = useUIStore.getState().backendAvailable;
      const origin = typeof window !== 'undefined' ? window.location.origin : '';

      if (backendAvailable && origin) {
        // 后端模式：上传到 /api/v1/upload，返回图片 URL
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch(`${origin}/api/v1/upload`, { method: 'POST', body: formData });
        if (res.ok) { const d = await res.json(); if (d.url) { setEditIcon(d.url); setUploading(false); return; } }
      }

      // 静态部署：转为 base64 data URL
      const webp = await convertToWebP(file);
      const reader = new FileReader();
      reader.onload = () => { setEditIcon(reader.result as string); setUploading(false); };
      reader.readAsDataURL(webp);
    } catch { setUploading(false); }
  };

  const handleDetectIcon = async () => {
    const targetUrl = editUrl || item.url;
    if (!targetUrl) return;
    setDetecting(true);
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const res = await fetch(`${origin}/api/v1/admin/monitor/fetch-icon`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl }),
      });
      if (res.ok) { const d = await res.json(); if (d.icon) setEditIcon(d.icon); }
    } catch { /* ignore */ }
    setDetecting(false);
  };

  return (
    <>
      <div className="group relative cursor-pointer py-1" onContextMenu={handleContextMenu}>
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
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              window.open(item.url, '_blank', 'noopener,noreferrer');
            }
          }}
        >
          <div className="flex items-center justify-center w-12 h-12 drop-shadow-xl">
            <FaviconImage icon={item.icon} url={item.url} className="w-12 h-12 object-contain drop-shadow-lg" />
          </div>
          <span className="text-white/80 text-[10px] font-medium truncate max-w-full text-center leading-tight drop-shadow-sm max-w-[64px]">
            {item.title}
          </span>
        </div>

        {/* 右键菜单 */}
        {menu && (
          <div
            ref={menuRef}
            className="fixed z-[70] min-w-[140px] rounded-xl backdrop-blur-xl border border-white/20 p-1 shadow-2xl"
            style={{
              left: Math.max(8, Math.min(menu.x, window.innerWidth - 160)),
              top: Math.max(8, Math.min(menu.y, window.innerHeight - 120)),
              background: 'rgba(0,0,0,0.75)',
            }}
          >
            <button
              className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-white/80 hover:bg-white/10 rounded-lg transition-colors"
              onClick={openEdit}
            >
              <Pencil className="w-3.5 h-3.5" /> 编辑
            </button>
            <button
              className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-red-300 hover:bg-white/10 rounded-lg transition-colors"
              onClick={() => { onUnpin(); setMenu(null); }}
            >
              <PinOff className="w-3.5 h-3.5" /> 取消固定
            </button>
          </div>
        )}
      </div>

      {/* 编辑弹窗 — 仿监控面板风格 */}
      {dialogOpen && createPortal(
        <div className="fixed inset-0 z-[999] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}
          onPointerDown={e => { if (!(e.target as Element).closest('.dialog-content')) setDialogOpen(false); }}>
          <div className="bg-background/90 backdrop-blur-xl border border-border/40 rounded-2xl p-5 w-80 shadow-2xl dialog-content">
            <div className="text-sm font-medium text-foreground mb-3">编辑固定链接</div>
            <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
              placeholder="标题"
              className="w-full px-3 py-2 rounded-xl text-sm bg-muted/50 border border-border/40 text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-border/80 transition-colors mb-2"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setDialogOpen(false); }}
            />
            <input value={editUrl} onChange={e => setEditUrl(e.target.value)}
              placeholder="https://"
              className="w-full px-3 py-2 rounded-xl text-sm bg-muted/50 border border-border/40 text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-border/80 transition-colors mb-2"
              onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setDialogOpen(false); }}
            />
            <div className="text-[11px] text-muted-foreground mb-1.5">图标</div>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {PRESET_ICONS.slice(0, 24).map(ico => (
                <button key={ico}
                  className={`p-1.5 rounded-lg border transition-colors ${editIcon === ico ? 'bg-white/20 border-white/40' : 'bg-muted/30 border-border/30 hover:bg-accent/50'}`}
                  onClick={() => setEditIcon(ico)}
                  title={ico}
                >
                  <IconRender name={ico} className="w-4 h-4" />
                </button>
              ))}
            </div>
            <div className="flex gap-1.5 items-center mb-2">
              <input value={editIcon.startsWith(':') ? '' : editIcon} onChange={e => setEditIcon(e.target.value)}
                placeholder="图标 URL / 选中上方"
                className="flex-1 px-3 py-2 rounded-xl text-sm bg-muted/50 border border-border/40 text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-border/80 transition-colors"
              />
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleIconUpload} />
              <button className="shrink-0 px-2 py-2 rounded-xl text-[11px] bg-muted/50 border border-border/30 hover:bg-accent transition-colors disabled:opacity-50" disabled={uploading} onClick={() => fileRef.current?.click()}>
                {uploading ? <Loader2 className="size-3.5 animate-spin" /> : '上传'}
              </button>
              <button className="shrink-0 px-2 py-2 rounded-xl text-[11px] bg-muted/50 border border-border/30 hover:bg-accent transition-colors disabled:opacity-50" disabled={detecting} onClick={handleDetectIcon}>
                {detecting ? <Loader2 className="size-3.5 animate-spin" /> : '识别'}
              </button>
            </div>
            {editIcon && !editIcon.startsWith(':') && (
              <img src={editIcon} alt="" className="w-8 h-8 rounded-lg mb-2" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            )}
            <div className="flex gap-2">
              <button className="flex-1 px-3 py-1.5 rounded-xl text-sm font-medium text-foreground bg-muted/50 border border-border/30 hover:bg-accent transition-colors" onClick={() => setDialogOpen(false)}>取消</button>
              <button className="flex-1 px-3 py-1.5 rounded-xl text-sm font-medium text-white transition-colors disabled:opacity-50" style={{ background: '#6366f1' }} onClick={handleSave}>
                保存
              </button>
            </div>
          </div>
        </div>, document.body)}
    </>
  );
}

/** 可拖拽排序的固定链接卡片 */
export function SortablePinnedLinkCard({
  item,
  onUnpin,
  onUpdate
}: {
  item: LinkItem;
  onUnpin: () => void;
  onUpdate?: (updated: LinkItem) => void;
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
      <PinnedLinkCard item={item} onUnpin={onUnpin} onUpdate={onUpdate} />
    </div>
  );
}
