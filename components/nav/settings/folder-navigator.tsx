import React from 'react';
import { LinkItem } from '@/lib/types';
import { IconRender } from './shared';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FolderNavigatorProps {
  onBack: () => void;
  resolvedCurrentFolder: LinkItem | null;
}

export const FolderNavigator: React.FC<FolderNavigatorProps> = ({
  onBack,
  resolvedCurrentFolder
}) => {
  return (
    <div className="flex items-center gap-2 p-2 pb-4 border-b border-border/20">
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={onBack}
        className="h-8 gap-1"
      >
        <ChevronLeft className="h-4 w-4" /> 返回
      </Button>
      <div className="flex items-center gap-2 font-medium text-sm text-foreground/80">
        <IconRender name={resolvedCurrentFolder?.icon || "FolderOpen"} className="h-4 w-4" />
        <span>{resolvedCurrentFolder?.title}</span>
      </div>
    </div>
  );
};
