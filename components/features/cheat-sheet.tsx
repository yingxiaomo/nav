"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useUIStore } from "@/lib/stores";
import { getRegisteredShortcuts, type Shortcut } from "@/lib/hooks/use-keyboard-shortcuts";

/** 将机器键位定义转为人类可读的显示文本 */
function formatKey(key: string): string {
  const isMac =
    typeof navigator !== "undefined" &&
    navigator.platform.toLowerCase().includes("mac");

  const parts = key.split("+");
  return parts
    .map((part) => {
      const p = part.toLowerCase();
      if (p === "meta") return isMac ? "⌘" : "Ctrl";
      if (p === "ctrl") return "Ctrl";
      if (p === "alt") return isMac ? "⌥" : "Alt";
      if (p === "shift") return "⇧";
      if (p === "escape") return "Esc";
      if (p === "arrowleft") return "←";
      if (p === "arrowright") return "→";
      if (p === "arrowup") return "↑";
      if (p === "arrowdown") return "↓";
      return part.length === 1 ? part.toUpperCase() : part;
    })
    .join(isMac ? "" : "+");
}

const CATEGORY_LABELS: Record<string, string> = {
  global: "全局",
  panel: "面板",
  navigation: "导航",
};

export function CheatSheet() {
  const { isCheatSheetOpen, setCheatSheetOpen } = useUIStore();
  const shortcuts = getRegisteredShortcuts();

  // 按 category 分组
  const grouped = shortcuts.reduce<Record<string, Shortcut[]>>((acc, s) => {
    const cat = s.category || "global";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(s);
    return acc;
  }, {});

  // 定义分类展示顺序
  const categoryOrder = ["global", "panel", "navigation"];

  return (
    <AnimatePresence>
      {isCheatSheetOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          {/* 背景遮罩 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => setCheatSheetOpen(false)}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          />

          {/* 面板 */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="relative w-full max-w-lg max-h-[80vh] overflow-y-auto
                       bg-white/10 dark:bg-black/30 backdrop-blur-2xl
                       border border-white/20 rounded-2xl shadow-2xl
                       text-white p-0"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 头部 */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
                <kbd className="px-1.5 py-0.5 text-xs rounded-md bg-white/10 border border-white/20 font-mono">
                  ?
                </kbd>
                <span>快捷键速查</span>
              </h2>
              <button
                onClick={() => setCheatSheetOpen(false)}
                className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
              >
                <X className="h-4 w-4 text-white/60" />
              </button>
            </div>

            {/* 分组列表 */}
            <div className="px-5 py-4 space-y-5">
              {categoryOrder.map((cat) => {
                const items = grouped[cat];
                if (!items || items.length === 0) return null;
                return (
                  <div key={cat}>
                    <h3 className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-2">
                      {CATEGORY_LABELS[cat] || cat}
                    </h3>
                    <div className="space-y-1">
                      {items.map((s, i) => (
                        <div
                          key={`${s.key}-${i}`}
                          className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/5 transition-colors"
                        >
                          <span className="text-sm text-white/80">
                            {s.label}
                          </span>
                          <kbd className="px-2 py-1 text-xs font-mono rounded-md bg-white/10 border border-white/15 text-white/70 whitespace-nowrap">
                            {formatKey(s.key)}
                          </kbd>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {categoryOrder.every((cat) => !grouped[cat]) && (
                <p className="text-sm text-white/40 text-center py-8">
                  暂无已注册的快捷键
                </p>
              )}
            </div>

            {/* 底部提示 */}
            <div className="px-5 py-3 border-t border-white/10 text-center">
              <p className="text-xs text-white/30">
                按 <kbd className="px-1 py-0.5 rounded bg-white/10 text-white/50 font-mono text-[10px]">?</kbd>{" "}
                或 <kbd className="px-1 py-0.5 rounded bg-white/10 text-white/50 font-mono text-[10px]">{typeof navigator !== 'undefined' && navigator.platform.includes("Mac") ? "⌘" : "Ctrl"}+/</kbd> 随时打开此面板
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
