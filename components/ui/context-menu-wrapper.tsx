"use client";

import { useEffect, useRef, type ReactNode } from "react";

interface ContextMenuWrapperProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  triggerRect?: DOMRect | null;
}

/** 右键菜单定位 + 外部点击关闭 */
export function ContextMenuWrapper({
  isOpen,
  onClose,
  children,
  triggerRect,
}: ContextMenuWrapperProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // 延迟添加避免立即关闭
    const timer = setTimeout(() => document.addEventListener("mousedown", handleClick), 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const style: React.CSSProperties = {};
  if (triggerRect) {
    style.left = Math.min(triggerRect.left, window.innerWidth - 200);
    style.top = triggerRect.bottom + 4;
  }

  return (
    <div
      ref={menuRef}
      className="fixed z-[9999] min-w-[160px] bg-popover border rounded-lg shadow-xl py-1"
      style={style}
    >
      {children}
    </div>
  );
}
