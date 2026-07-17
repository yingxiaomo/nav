"use client";

import { useRef } from "react";
import { Upload } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Category, LinkItem } from "@/lib/types";
import { parseNetscapeBookmarks } from "@/lib/parsers/bookmark-parser";

interface BookmarkImportProps {
  existingCategories: Category[];
  onImport: (categories: Category[]) => void;
}

export function BookmarkImport({ existingCategories, onImport }: BookmarkImportProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (!content) {
        toast.error("无法读取文件");
        return;
      }

      try {
        const parsed = parseNetscapeBookmarks(content);
        if (!parsed || parsed.categories.length === 0) {
          toast.warning("没有找到可导入的书签");
          return;
        }

        // Add icons to categories and rename "其他书签" to "导入的书签"
        const importedCategories: Category[] = parsed.categories.map(c => ({
          ...c,
          icon: "FolderOpen",
          title: c.title === "其他书签" ? "导入的书签" : c.title,
        }));

        // Count total links recursively
        const countLinks = (items: LinkItem[]): number => {
          let count = 0;
          for (const item of items) {
            if (item.type !== "folder") count++;
            if (item.children) count += countLinks(item.children);
          }
          return count;
        };
        let totalLinks = 0;
        for (const cat of importedCategories) {
          totalLinks += countLinks(cat.links);
        }

        // Deduplicate against existing categories
        const existingUrls = new Set<string>();
        for (const cat of existingCategories) {
          for (const link of cat.links) {
            if (link.url) existingUrls.add(link.url);
          }
        }

        // Recursive dedup that handles nested folder children
        const filterDups = (items: LinkItem[]): [LinkItem[], number] => {
          let skipped = 0;
          const filtered = items.flatMap(item => {
            if (item.url && existingUrls.has(item.url)) {
              skipped++;
              return [];
            }
            if (item.children) {
              const [filteredKids, kidSkipped] = filterDups(item.children);
              skipped += kidSkipped;
              if (filteredKids.length === 0) return [];
              return [{ ...item, children: filteredKids }];
            }
            return [item];
          });
          return [filtered, skipped];
        };

        let totalSkipped = 0;
        const filtered = importedCategories
          .map(cat => {
            const [filteredLinks, skipped] = filterDups(cat.links);
            totalSkipped += skipped;
            return { ...cat, links: filteredLinks };
          })
          .filter(cat => cat.links.length > 0);

        if (filtered.length > 0) {
          onImport(filtered);
          toast.success(
            `成功导入 ${filtered.length} 个文件夹，共 ${totalLinks - totalSkipped} 个链接${
              totalSkipped > 0 ? `（${totalSkipped} 个重复已跳过）` : ""
            }`
          );
        } else {
          toast.info("所有书签都已存在");
        }
      } catch {
        toast.error("解析失败，请确保是浏览器导出的 HTML 书签文件");
      }
    };
    reader.readAsText(file);
    if (event.target) event.target.value = "";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 px-1">
        <div className="h-1 w-1 rounded-full bg-primary/50" />
        <h3 className="text-sm font-medium text-muted-foreground">导入书签</h3>
      </div>
      <div className="p-6 border rounded-xl bg-muted/30 border-dashed hover:border-primary/30 transition-colors">
        <Label htmlFor="bookmark-import" className="flex flex-col items-center justify-center gap-3 cursor-pointer py-4 group">
          <div className="p-3 rounded-full bg-background shadow-sm group-hover:scale-110 transition-transform">
            <Upload className="h-6 w-6 text-primary" />
          </div>
          <div className="text-center space-y-1">
            <span className="text-sm font-medium">点击导入浏览器书签</span>
            <p className="text-xs text-muted-foreground">支持 Chrome, Edge, Firefox 导出的 HTML 文件</p>
          </div>
        </Label>
        <Input id="bookmark-import" type="file" accept=".html" onChange={handleImport} className="hidden" />
      </div>
    </div>
  );
}
