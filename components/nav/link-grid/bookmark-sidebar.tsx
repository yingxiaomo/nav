"use client";

import { useState, useMemo } from "react";
import { Category, LinkItem } from "@/lib/types/types";
import { IconRender } from "@/components/nav/settings/shared";
import { PanelLeft, PanelLeftClose, ChevronLeft, Pin } from "lucide-react";

interface BookmarkSidebarProps {
  categories: Category[];
  pinnedLinks: LinkItem[];
  onPinLink?: (link: LinkItem) => void;
  onUnpinLink?: (linkId: string) => void;
}

interface TreeNode {
  id: string;
  title: string;
  icon?: string;
  type: "category" | "folder" | "link";
  children?: TreeNode[];
  url?: string;
  original: Category | LinkItem;
}

function buildTree(categories: Category[]): TreeNode[] {
  const roots: TreeNode[] = [];
  for (const cat of categories) {
    roots.push({
      id: cat.id,
      title: cat.title,
      icon: cat.icon || "FolderOpen",
      type: "category",
      children: buildLinkTree(cat.links, cat.id + "-sub-"),
      original: cat,
    });
  }
  return roots;
}

function buildLinkTree(items: LinkItem[], _prefix: string): TreeNode[] {
  const nodes: TreeNode[] = [];
  for (const item of items) {
    nodes.push({
      id: _prefix + item.id,
      title: item.title,
      icon: item.icon || (item.type === "folder" ? "FolderOpen" : "Link"),
      type: item.type === "folder" ? "folder" : "link",
      children: item.children ? buildLinkTree(item.children, _prefix + item.id + "-") : undefined,
      url: item.url,
      original: item,
    });
  }
  return nodes;
}

export function BookmarkSidebar({ categories, pinnedLinks, onPinLink, onUnpinLink }: BookmarkSidebarProps) {
  const tree = useMemo(() => buildTree(categories), [categories]);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [navHistory, setNavHistory] = useState<TreeNode[][]>([tree]);
  const [navTitles, setNavTitles] = useState<string[]>(["书签"]);

  const currentNodes = navHistory[navHistory.length - 1];
  const currentTitle = navTitles[navTitles.length - 1];
  const canGoBack = navHistory.length > 1;

  const isLinkPinned = (linkId: string) => pinnedLinks.some((l) => l.id === linkId);

  const handleNodeClick = (node: TreeNode) => {
    if (node.type === "link" && node.url) {
      window.open(node.url, "_blank", "noopener,noreferrer");
      return;
    }
    if (node.children && node.children.length > 0) {
      setNavHistory((prev) => [...prev, node.children!]);
      setNavTitles((prev) => [...prev, node.title]);
    }
  };

  const handleBack = () => {
    if (navHistory.length <= 1) return;
    setNavHistory((prev) => prev.slice(0, -1));
    setNavTitles((prev) => prev.slice(0, -1));
  };

  const toggleCollapse = () => {
    if (!sidebarCollapsed) {
      setNavHistory([tree]);
      setNavTitles(["书签"]);
    }
    setSidebarCollapsed(!sidebarCollapsed);
  };

  if (sidebarCollapsed) {
    return (
      <div className="fixed left-0 top-1/2 -translate-y-1/2 z-40">
        <button
          onClick={toggleCollapse}
          className="flex items-center justify-center w-10 h-14 rounded-r-lg bg-white/10 hover:bg-white/20 backdrop-blur-xl border border-white/10 border-l-0 text-white/60 hover:text-white transition-all shadow-lg"
          title="展开侧边栏"
        >
          <PanelLeft className="h-5 w-5" />
        </button>
      </div>
    );
  }

  return (
    <><div className="fixed inset-0 z-40 bg-black/20" onClick={toggleCollapse} /><div className="fixed left-0 top-0 h-full z-50" style={{ width: "360px" }}>
      <div className="w-full h-full bg-black/50 backdrop-blur-2xl border-r border-white/10 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0 h-[52px]">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {canGoBack && (
              <button
                onClick={handleBack}
                className="p-1.5 rounded-md hover:bg-white/10 text-white/60 hover:text-white transition-colors flex-shrink-0"
                title="返回"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
            <span className="text-white/80 text-sm font-medium truncate">{currentTitle}</span>
          </div>
          <button
            onClick={toggleCollapse}
            className="p-1.5 rounded-md hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors flex-shrink-0 ml-2"
            title="收起"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {currentNodes.length === 0 ? (
            <p className="text-center text-white/30 text-xs py-8">空文件夹</p>
          ) : (
            currentNodes.map((node) => {
              const isLink = node.type === "link";
              const hasChildren = node.children && node.children.length > 0;
              const pinned = isLink ? isLinkPinned(node.id.split("-sub-").pop() || node.id) : false;
              const iconColor = node.type === "category"
                ? "text-yellow-200/90" : node.type === "folder"
                  ? "text-blue-200/90" : "text-white/40";

              return (
                <div key={node.id} className="group flex items-center">
                  <button
                    onClick={() => handleNodeClick(node)}
                    className="flex-1 flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors text-white/60 hover:text-white hover:bg-white/5"
                    style={{ minWidth: 0 }}
                  >
                    <IconRender name={node.icon || "Link"} className={"h-4 w-4 flex-shrink-0 " + iconColor} />
                    <span className="text-sm truncate flex-1">{node.title}</span>
                    {hasChildren && <ChevronLeft className="h-3.5 w-3.5 flex-shrink-0 -rotate-90 text-white/30" />}
                  </button>
                  {isLink && (
                    <button
                      onClick={(e) => { e.stopPropagation(); const item = node.original as LinkItem; if (pinned) { onUnpinLink?.(item.id); } else { onPinLink?.(item); }; }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-white/10 text-white/40 hover:text-white flex-shrink-0 mr-1"
                      title={pinned ? "取消固定" : "固定"}
                    >
                      <Pin className={"h-3.5 w-3.5 " + (pinned ? "text-blue-400 fill-blue-400" : "")} />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

    </div></>
  );
}