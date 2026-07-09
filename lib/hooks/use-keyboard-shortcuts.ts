"use client";

import { useEffect, useRef } from "react";

/**
 * 快捷键定义
 */
export interface Shortcut {
  /** 键位定义：'meta+s'（同时匹配 Ctrl/Cmd）、'escape'、'/'、't' 等 */
  key: string;
  /** 触发回调 */
  handler: () => void;
  /** 显示名称（帮助面板用） */
  label: string;
  /** 分类（帮助面板用） */
  category: "global" | "panel" | "navigation";
  /**
   * 是否在输入框（INPUT/TEXTAREA/contentEditable）中也响应。
   * - `true` —— 在输入框中也能触发（用于 meta 组合键、Escape）
   * - `false`（默认）—— 输入框中不触发，防止单键快捷键干扰正常输入
   */
  allowInInputs?: boolean;
  /**
   * 是否阻止浏览器默认行为。
   * - `true`（默认）—— 调用 `event.preventDefault()`，防止浏览器默认动作
   * - `false` —— 不阻止（用于 Escape，让 Radix Dialog 也能处理）
   */
  preventDefault?: boolean;
}

// ── Module-level shortcut registry ──────────────────────────────────
// 允许外部组件（如 CheatSheet）读取当前注册的快捷键列表
let _shortcutRegistry: Shortcut[] = [];

/** 获取当前注册的全部快捷键（用于 CheatSheet 面板） */
export function getRegisteredShortcuts(): Shortcut[] {
  return _shortcutRegistry;
}

/**
 * 匹配按键事件与快捷键定义
 */
function matchesKey(event: KeyboardEvent, keyDef: string): boolean {
  const keyDefLower = keyDef.toLowerCase();
  const eventKey = event.key.toLowerCase();
  const hasMetaOrCtrl = event.ctrlKey || event.metaKey;

  // meta+ 前缀的快捷键：Cmd 或 Ctrl 均可
  if (keyDefLower.startsWith("meta+")) {
    if (!hasMetaOrCtrl) return false;
    if (event.altKey) return false;
    const baseKey = keyDefLower.slice(5);
    return eventKey === baseKey;
  }

  // 单键快捷键：不允许 Ctrl/Cmd/Alt 修饰
  if (hasMetaOrCtrl || event.altKey) return false;
  return eventKey === keyDefLower;
}

/**
 * useKeyboardShortcuts
 *
 * 注册表模式（Registry Pattern）的全局键盘快捷键 Hook。
 * 将快捷键定义与事件监听分离，便于后续扩展和生成帮助面板。
 *
 * @example
 * useKeyboardShortcuts([
 *   { key: 'meta+s', handler: onSave, label: '保存', category: 'global', allowInInputs: true },
 *   { key: '/', handler: () => searchRef.current?.focus(), label: '搜索', category: 'global' },
 * ]);
 */
export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  const shortcutsRef = useRef(shortcuts);

  // 同步 ref 和模块级注册表（放到 effect 中，避免 render 时副作用）
  useEffect(() => {
    _shortcutRegistry = shortcuts;
    shortcutsRef.current = shortcuts;
  }, [shortcuts]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const isInputElement =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      // 遍历注册表，匹配第一个符合条件的快捷键
      for (const shortcut of shortcutsRef.current) {
        if (!matchesKey(event, shortcut.key)) continue;

        // Focus Guard：在输入框中且不允许触发 → 跳过
        if (isInputElement && !shortcut.allowInInputs) continue;

        // 阻止浏览器默认行为（除非显式关闭）
        if (shortcut.preventDefault !== false) {
          event.preventDefault();
        }

        shortcut.handler();
        return; // 一次只触发一个
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
}
