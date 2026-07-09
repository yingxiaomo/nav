"use client";

import { LinkItem } from "@/lib/types";
import { LinkItemCard } from "./link-item-card";

interface RenderFolderContentProps {
    items: LinkItem[];
    onFolderClick: (item: LinkItem) => void;
}

export function RenderFolderContent({ items, onFolderClick }: RenderFolderContentProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
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