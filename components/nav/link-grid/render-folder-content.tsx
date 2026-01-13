"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { LinkItem } from "@/lib/types/types";
import { LinkItemCard } from "./link-item-card";

interface RenderFolderContentProps {
    items: LinkItem[];
    onFolderClick: (item: LinkItem) => void;
}

export function RenderFolderContent({ items, onFolderClick }: RenderFolderContentProps) {
  // 所有Hooks必须在组件顶部调用
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  
  // 监听容器宽度变化，动态调整列数
  useEffect(() => {
    const updateContainerWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      }
    };
    
    updateContainerWidth();
    window.addEventListener('resize', updateContainerWidth);
    
    return () => {
      window.removeEventListener('resize', updateContainerWidth);
    };
  }, []);
  
  // 根据容器宽度计算列数
  const columnCount = useMemo(() => {
    if (containerWidth >= 1024) return 4; // lg
    if (containerWidth >= 768) return 3; // md
    if (containerWidth >= 640) return 2; // sm
    return 1; // xs
  }, [containerWidth]);
  
  // 计算行数
  const rowCount = Math.ceil(items.length / columnCount);
  
  // 对于少量数据，直接渲染全部项
  if (items.length < 100) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        {items.map((item) => {
          if (item.type === 'folder') {
            return (
              <LinkItemCard 
                key={item.id} 
                item={item} 
                onClick={() => onFolderClick(item)} 
              />
            );
          }

          return (
            <LinkItemCard key={item.id} item={item} />
          );
        })}
      </div>
    );
  }
  
  // 虚拟行渲染，每行包含多个列
  const renderVirtualRows = () => {
    const virtualRows = [];
    for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
      const startIndex = rowIndex * columnCount;
      const endIndex = Math.min(startIndex + columnCount, items.length);
      const rowItems = items.slice(startIndex, endIndex);
      
      virtualRows.push(
        <div key={`row-${rowIndex}`} className="flex gap-3 sm:gap-4">
          {rowItems.map((item) => {
            if (item.type === 'folder') {
              return (
                <LinkItemCard 
                  key={item.id} 
                  item={item} 
                  onClick={() => onFolderClick(item)} 
                  className="flex-1"
                />
              );
            }

            return (
              <LinkItemCard key={item.id} item={item} className="flex-1" />
            );
          })}
          
          {/* 填充空白列，确保每行宽度一致 */}
          {rowItems.length < columnCount && (
            <div className="flex-1" style={{ opacity: 0, pointerEvents: 'none' }} />
          )}
        </div>
      );
    }
    
    return virtualRows;
  };

  return (
    <div 
      ref={containerRef}
      className="overflow-y-auto max-h-[calc(85vh-120px)] p-0"
    >
      <div className="grid grid-cols-1 gap-3 sm:gap-4">
        {renderVirtualRows()}
      </div>
    </div>
  );
}