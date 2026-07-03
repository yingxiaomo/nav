"use client"

import { useEffect } from "react"
import { useThemeStore } from "@/lib/stores/theme-store"

interface ThemeProviderProps {
  children: React.ReactNode
  initialTheme?: "light" | "dark" | "system"
}

export function ThemeProvider({ children, initialTheme = "system" }: ThemeProviderProps) {
  const { setTheme, updateTheme } = useThemeStore()

  // 初始化主题
  useEffect(() => {
    setTheme(initialTheme)
    updateTheme()
  }, [initialTheme, setTheme, updateTheme])

  // 监听系统主题变化
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    const handleChange = () => updateTheme()
    
    mediaQuery.addEventListener("change", handleChange)
    
    return () => {
      mediaQuery.removeEventListener("change", handleChange)
    }
  }, [updateTheme])

  return <>{children}</>
}

export function useTheme() {
  const { theme, setTheme } = useThemeStore()
  return { theme, setTheme }
}