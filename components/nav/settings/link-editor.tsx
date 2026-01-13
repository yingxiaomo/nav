import React from 'react';
import { LinkItem } from '@/lib/types';
import { IconRender, PRESET_ICONS } from './shared';
import { Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

interface LinkEditorProps {
  editingLink: LinkItem | null;
  onUpdate: (link: LinkItem) => void;
  onSmartIdentify: (url: string) => void;
}

export const LinkEditor: React.FC<LinkEditorProps> = ({
  editingLink,
  onUpdate,
  onSmartIdentify
}) => {
  if (!editingLink) return null;

  return (
    <div className="grid gap-4 py-4">
      {editingLink.type !== 'folder' && (
        <div className="grid gap-2">
          <Label>URL</Label>
          <div className="flex gap-2">
            <Input 
              value={editingLink.url} 
              onChange={(e) => onUpdate({ ...editingLink, url: e.target.value })} 
              placeholder="https://example.com"
            />
            <Button size="icon" variant="outline" onClick={() => onSmartIdentify(editingLink.url)} title="自动识别">
              <Wand2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
      <div className="grid gap-2">
        <Label>标题</Label>
        <Input 
          value={editingLink.title} 
          onChange={(e) => onUpdate({ ...editingLink, title: e.target.value })} 
          placeholder="输入标题"
        />
      </div>
      <div className="grid gap-2">
        <Label>图标</Label>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="shrink-0" title="选择内置图标">
                <IconRender name={editingLink.icon || "Link"} className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[300px] h-[300px] overflow-y-auto" align="start">
              <div className="grid grid-cols-6 gap-1 p-2">
                {PRESET_ICONS.map((iconName) => (
                  <Button
                    key={iconName}
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => onUpdate({ ...editingLink, icon: iconName })}
                  >
                    <IconRender name={iconName} className="h-5 w-5" />
                  </Button>
                ))}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
          <Input 
            value={editingLink.icon} 
            onChange={(e) => onUpdate({ ...editingLink, icon: e.target.value })} 
            placeholder="输入图标 URL 或选择内置图标"
            className="flex-1"
          />
        </div>
      </div>
    </div>
  );
};
