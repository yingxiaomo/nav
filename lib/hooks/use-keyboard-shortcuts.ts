"use client"

import { useEffect, useCallback, useRef } from "react"

interface KeyboardShortcutOptions {
  onSave?: () => void
  onSearch?: () => void
  onAddLink?: () => void
  onToggleSettings?: () => void
  onRefreshWallpaper?: () => void
}

export function useKeyboardShortcuts(options: KeyboardShortcutOptions) {
  const optionsRef = useRef(options)
  optionsRef.current = options
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const opts = optionsRef.current
      // 检查是否按下了 Ctrl 或 Cmd 键
      const isModifierPressed = event.ctrlKey || event.metaKey
      
      // 检查是否在输入框中，避免影响正常输入
      const target = event.target as HTMLElement
      const isInputElement = 
        target.tagName === "INPUT" || 
        target.tagName === "TEXTAREA" || 
        target.isContentEditable
      
      if (isInputElement) return
      
      // 处理快捷键
      if (isModifierPressed) {
        switch (event.key.toLowerCase()) {
          case "s":
            event.preventDefault()
            opts.onSave?.()
            break
          case "f":
            event.preventDefault()
            opts.onSearch?.()
            break
          case "n":
            event.preventDefault()
            opts.onAddLink?.()
            break
        }
      }
      
      // 处理单键快捷键
      switch (event.key.toLowerCase()) {
        case "escape":
          // 可以用于关闭弹窗等
          break
      }
    },
    [] // Stable reference ? callbacks accessed via optionsRef
  )

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [handleKeyDown])
}
