"use client";

import { Folder } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type FolderOption = { id: string; title: string; level: number };

interface MoveToDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  options: FolderOption[];
  onConfirm: (targetId: string) => void;
}

export function MoveToDialog({
  open,
  onOpenChange,
  title,
  description,
  options,
  onConfirm,
}: MoveToDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[50vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto py-2 -mx-2 px-2 custom-scrollbar">
          <div className="space-y-1">
            {options.map((option) => (
              <Button
                key={option.id}
                variant="ghost"
                className="w-full justify-start font-normal"
                style={{ paddingLeft: `${option.level * 1.5 + 1}rem` }}
                onClick={() => onConfirm(option.id)}
              >
                <Folder className="mr-2 h-4 w-4 text-muted-foreground" />
                {option.title}
              </Button>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
