import React from 'react';
import { Category } from '@/lib/types';
import { IconRender, PRESET_ICONS } from './shared';

interface CategoryEditorProps {
  activeCategory: Category | null;
  onUpdateCategory: (cat: Category) => void;
  onDeleteCategory: (catId: string) => void;
}

export const CategoryEditor: React.FC<CategoryEditorProps> = ({
  activeCategory,
  onUpdateCategory,
  onDeleteCategory
}) => {
  if (!activeCategory) return null;

  return (
    <div className="p-4 border-t border-border/20 bg-muted/10">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">编辑分类</h3>
      </div>

      <div className="space-y-3">
        <div className="space-y-2">
          <label className="text-sm font-medium">标题</label>
          <input
            type="text"
            value={activeCategory.title}
            onChange={(e) => onUpdateCategory({ ...activeCategory, title: e.target.value })}
            className="w-full px-3 py-2 bg-background rounded-md border border-border/40 text-sm"
            placeholder="输入分类名称"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">图标</label>
          <div className="flex items-center gap-2">
            <div className="flex-shrink-0">
              <IconRender name={activeCategory.icon || "FolderOpen"} className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <select
                value={activeCategory.icon || "FolderOpen"}
                onChange={(e) => onUpdateCategory({ ...activeCategory, icon: e.target.value })}
                className="w-full px-3 py-2 bg-background rounded-md border border-border/40 text-sm"
              >
                <option value="FolderOpen">默认图标</option>
                {PRESET_ICONS.filter(icon => icon.startsWith('Folder')).map((iconName) => (
                  <option key={iconName} value={iconName}>
                    {iconName}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4 pt-2 border-t border-border/20">
          <button
            onClick={() => onDeleteCategory(activeCategory.id)}
            className="px-4 py-2 text-sm bg-destructive/10 text-destructive rounded-md hover:bg-destructive/20"
          >
            删除分类
          </button>
        </div>
      </div>
    </div>
  );
};
