import React from 'react';
import { LinkItem, Category } from '@/lib/types';

interface DragAndDropManagerProps {
  activeLink: LinkItem | null;
  activeCategory: Category | null;
}

export const DragAndDropManager: React.FC<DragAndDropManagerProps> = ({
  activeLink,
  activeCategory
}) => {
  return (
    <div className="w-full">
      {/* 拖拽功能由父组件通过 DndContext 实现 */}
      {/* 此组件主要用于管理拖拽相关的状态和逻辑 */}
      <input
        type="hidden"
        value={activeLink?.id || activeCategory?.id || ''}
      />
    </div>
  );
};
