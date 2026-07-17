"use client";

import { Button } from "@/components/ui/button";
import { FolderInput, Trash2 } from "lucide-react";

interface BatchActionsBarProps {
  selectedCount: number;
  onBatchMove: () => void;
  onBatchDelete: () => void;
  onClearSelection: () => void;
}

export function BatchActionsBar({
  selectedCount,
  onBatchMove,
  onBatchDelete,
  onClearSelection,
}: BatchActionsBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="flex items-center gap-2 mb-3 px-3 py-2.5 rounded-lg bg-primary/5 border border-primary/20">
      <span className="text-sm font-medium text-primary flex-1">
        已选择 {selectedCount} 个链接
      </span>
      <Button variant="secondary" size="sm" className="h-8 gap-1.5 text-xs" onClick={onBatchMove}>
        <FolderInput className="h-3.5 w-3.5" />
        批量移动
      </Button>
      <Button variant="destructive" size="sm" className="h-8 gap-1.5 text-xs" onClick={onBatchDelete}>
        <Trash2 className="h-3.5 w-3.5" />
        批量删除
      </Button>
      <button
        onClick={onClearSelection}
        className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
      >
        取消选择
      </button>
    </div>
  );
}
