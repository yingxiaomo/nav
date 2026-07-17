"use client";

import { useMemo } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataSchema, LinkItem, Category } from "@/lib/types";

type CategoryOrLink = Category | LinkItem;

interface SearchHit {
  link: LinkItem;
  path: string;
  catId: string;
}

interface ManageLinksSearchProps {
  searchQuery: string;
  data: DataSchema;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onEdit: (link: LinkItem) => void;
  onDelete: (parentId: string, linkId: string) => void;
}

function getChildren(item: CategoryOrLink): LinkItem[] | undefined {
  return (item as Category).links || (item as LinkItem).children;
}

export function ManageLinksSearch({
  searchQuery,
  data,
  selectedIds,
  onToggleSelect,
  onEdit,
  onDelete,
}: ManageLinksSearchProps) {
  const results = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase();
    const hits: SearchHit[] = [];
    const searchItems = (items: CategoryOrLink[], path: string) => {
      for (const item of items) {
        const children = getChildren(item);
        if (children) {
          for (const child of children) {
            if (
              child.title.toLowerCase().includes(q) ||
              (child.url && child.url.toLowerCase().includes(q))
            ) {
              hits.push({ link: child, path, catId: item.id });
            }
            if (child.children) searchItems(child.children, `${path} / ${child.title}`);
          }
        }
      }
    };
    for (const cat of data.categories) {
      searchItems([cat], cat.title);
    }
    return hits;
  }, [searchQuery, data.categories]);

  if (!results) return null;

  return (
    <div className="flex-1 border rounded-xl bg-muted/10 overflow-y-auto min-h-0 custom-scrollbar">
      <div className="p-2 pb-10 space-y-0.5">
        {results.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground/50">
            没有找到匹配的书签
          </div>
        ) : (
          <>
            <div className="px-3 py-1.5 text-xs text-muted-foreground/50">
              找到 {results.length} 个匹配结果
            </div>
            {results.map(({ link, path, catId }) => (
              <div
                key={link.id}
                className="flex items-center gap-2 p-2 rounded-lg border border-transparent hover:border-border/40 hover:bg-muted/20"
              >
                <div
                  className="flex items-center justify-center w-6 h-6 shrink-0 cursor-pointer"
                  onClick={() => onToggleSelect(link.id)}
                >
                  <div
                    className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
                      selectedIds.has(link.id)
                        ? "bg-primary border-primary"
                        : "border-muted-foreground/40 hover:border-muted-foreground/70"
                    }`}
                  >
                    {selectedIds.has(link.id) && (
                      <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" className="w-3 h-3">
                        <path d="M5 12l5 5l9-9" />
                      </svg>
                    )}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{link.title}</div>
                  <div className="text-[11px] text-muted-foreground/60 truncate">{path}</div>
                </div>
                {link.url && (
                  <span className="text-[11px] text-muted-foreground/40 truncate hidden md:block max-w-[200px]">
                    {link.url}
                  </span>
                )}
                <div className="flex items-center gap-0.5 shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(link)}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                      <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                    </svg>
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => onDelete(catId, link.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
