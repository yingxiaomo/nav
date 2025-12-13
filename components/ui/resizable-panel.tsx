"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { GripHorizontal, X, Pin, PinOff } from "lucide-react"; 
import { Button } from "@/components/ui/button";

interface ResizablePanelProps {
  children: React.ReactNode;
  defaultWidth?: number;
  defaultHeight?: number;
  minWidth?: number;
  minHeight?: number;
  title: string;
  icon: React.ReactNode;
  onClose?: () => void;
}

export function ResizablePanel({ 
  children, 
  defaultWidth = 500, 
  defaultHeight = 600,
  minWidth = 350,
  minHeight = 400,
  title,
  icon,
  onClose
}: ResizablePanelProps) {
  const [rect, setRect] = useState<{x: number, y: number, w: number, h: number} | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && rect === null) {
      const isMobile = window.innerWidth < 768;
      
      if (isMobile) {
        const w = window.innerWidth - 32; // 16px padding on each side
        const h = Math.min(defaultHeight, window.innerHeight * 0.6);
        setRect({
          x: 16,
          y: (window.innerHeight - h) / 2,
          w,
          h
        });
      } else {
        setRect({
          x: Math.max(0, (window.innerWidth - defaultWidth) / 2),
          y: Math.max(0, (window.innerHeight - defaultHeight) / 2),
          w: defaultWidth,
          h: defaultHeight,
        });
      }
    }
  }, [defaultWidth, defaultHeight, rect]);

  const dragRef = useRef({
    startX: 0,
    startY: 0,
    startRect: { x: 0, y: 0, w: 0, h: 0 },
    action: '' 
  });

  const handleMouseDown = useCallback((e: React.MouseEvent, action: string) => {
    if (isPinned) return;

    e.preventDefault();
    e.stopPropagation();

    if (!rect) return;

    if (action === 'move') setIsDragging(true);
    else setIsResizing(true);

    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startRect: { ...rect },
      action
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, [rect, isPinned]);

  const onMouseMove = useCallback((e: MouseEvent) => {
    e.preventDefault();
    const { startX, startY, startRect, action } = dragRef.current;
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;

    if (action === 'move') {
      setRect({
        ...startRect,
        x: startRect.x + deltaX,
        y: startRect.y + deltaY,
      });
      return;
    }

    let newX = startRect.x;
    let newY = startRect.y;
    let newW = startRect.w;
    let newH = startRect.h;

    if (action.includes('e')) {
      newW = startRect.w + deltaX * 2;
    } else if (action.includes('w')) {
      newW = startRect.w - deltaX * 2;
    }

    if (action.includes('s')) {
      newH = startRect.h + deltaY * 2;
    } else if (action.includes('n')) {
      newH = startRect.h - deltaY * 2;
    }

    newW = Math.max(minWidth, newW);
    newH = Math.max(minHeight, newH);

    const centerX = startRect.x + startRect.w / 2;
    const centerY = startRect.y + startRect.h / 2;
    newX = centerX - newW / 2;
    newY = centerY - newH / 2;

    setRect({ x: newX, y: newY, w: newW, h: newH });
  }, [minWidth, minHeight]);

  const onMouseUp = useCallback(() => {
    setIsDragging(false);
    setIsResizing(false);
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
  }, [onMouseMove]);

  useEffect(() => {
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [onMouseMove, onMouseUp]);

  if (!rect) return null;

  const resizeHandleClass = (position: string, cursor: string) => 
    `absolute z-50 ${position} ${cursor} touch-none select-none ` +
    (isResizing ? "bg-primary/20" : "bg-transparent hover:bg-primary/50");

  return (
    <div 
      ref={panelRef}
      className={cn(
        "fixed flex flex-col overflow-hidden z-[100] transition-all duration-300",
        isPinned 
          ? "dark bg-black/20 backdrop-blur-[2px] border border-white/5 shadow-none text-shadow-sm" 
          : "bg-background/80 backdrop-blur-xl border border-white/20 shadow-2xl sm:rounded-xl text-foreground",
        (isDragging || isResizing) && "transition-none select-none"
      )}
      style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
    >
      <div 
        className={cn(
          "h-12 px-4 flex items-center justify-between shrink-0 transition-colors",
          isPinned 
            ? "bg-transparent cursor-default border-b border-transparent hover:bg-black/20" 
            : "bg-muted/40 border-b cursor-move group hover:bg-muted/60",
          isDragging && "bg-muted/60"
        )}
        onMouseDown={(e) => handleMouseDown(e, 'move')}
      >
        <div className="flex items-center gap-2 pointer-events-none text-sm font-medium">
          {icon}
          <span className={cn(isPinned && "drop-shadow-md font-bold")}>{title}</span>
        </div>
        
        <div className="flex items-center gap-1">
          {!isPinned && (
            <GripHorizontal className="w-4 h-4 text-muted-foreground/30 mr-2" />
          )}

          <div onMouseDown={(e) => e.stopPropagation()}>
            <Button 
              variant="ghost" 
              size="icon" 
              className={cn(
                "h-7 w-7 rounded-full transition-colors",
                isPinned ? "text-white hover:bg-white/20" : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setIsPinned(!isPinned)}
              title={isPinned ? "取消固定 (允许移动)" : "固定到桌面 (透明模式)"}
            >
              {isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
            </Button>
          </div>

          {onClose && (
            <div onMouseDown={(e) => e.stopPropagation()}>
              <Button 
                variant="ghost" 
                size="icon" 
                className={cn(
                  "h-7 w-7 rounded-full hover:bg-red-500/20 hover:text-red-500",
                  isPinned ? "text-white/70 hover:text-white" : "text-muted-foreground"
                )}
                onClick={onClose}
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className={cn("flex-1 p-0 overflow-hidden relative", isPinned && "text-foreground")}>
        {children}
      </div>

      {!isPinned && (
        <>
          <div className={resizeHandleClass("top-0 left-2 right-2 h-1.5", "cursor-ns-resize")} onMouseDown={(e) => handleMouseDown(e, 'n')} />
          <div className={resizeHandleClass("bottom-0 left-2 right-2 h-1.5", "cursor-ns-resize")} onMouseDown={(e) => handleMouseDown(e, 's')} />
          <div className={resizeHandleClass("left-0 top-2 bottom-2 w-1.5", "cursor-ew-resize")} onMouseDown={(e) => handleMouseDown(e, 'w')} />
          <div className={resizeHandleClass("right-0 top-2 bottom-2 w-1.5", "cursor-ew-resize")} onMouseDown={(e) => handleMouseDown(e, 'e')} />

          <div className={resizeHandleClass("top-0 left-0 w-3 h-3 z-50", "cursor-nwse-resize")} onMouseDown={(e) => handleMouseDown(e, 'nw')} />
          <div className={resizeHandleClass("top-0 right-0 w-3 h-3 z-50", "cursor-nesw-resize")} onMouseDown={(e) => handleMouseDown(e, 'ne')} />
          <div className={resizeHandleClass("bottom-0 left-0 w-3 h-3 z-50", "cursor-nesw-resize")} onMouseDown={(e) => handleMouseDown(e, 'sw')} />
          <div className={resizeHandleClass("bottom-0 right-0 w-3 h-3 z-50", "cursor-nwse-resize")} onMouseDown={(e) => handleMouseDown(e, 'se')} />
          
          <div className="absolute bottom-0 right-0 p-0.5 pointer-events-none opacity-50">
            <svg viewBox="0 0 6 6" className="w-2.5 h-2.5 text-foreground fill-current"><path d="M6 6L6 0L0 6Z" /></svg>
          </div>
        </>
      )}
    </div>
  );
}