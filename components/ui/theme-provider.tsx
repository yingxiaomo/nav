"use client"

import { createContext, useContext, useEffect, useState } from "react"

interface ThemeProviderProps {
  children: React.ReactNode
  initialTheme?: "light" | "dark" | "system"
}

interface ThemeContextType {
  theme: "light" | "dark" | "system"
  setTheme: (theme: "light" | "dark" | "system") => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children, initialTheme = "system" }: ThemeProviderProps) {
  const [theme, setTheme] = useState<"light" | "dark" | "system">(initialTheme)

  useEffect(() => {
    const root = window.document.documentElement

    const updateTheme = () => {
      const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)
      
      root.classList.remove("light", "dark")
      root.classList.add(isDark ? "dark" : "light")
      
      // 设置 data-theme 属性以支持 Tailwind 的深色模式
      root.setAttribute("data-theme", isDark ? "dark" : "light")
    }

    updateTheme()

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    mediaQuery.addEventListener("change", updateTheme)

    return () => {
      mediaQuery.removeEventListener("change", updateTheme)
    }
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }
  return context
}