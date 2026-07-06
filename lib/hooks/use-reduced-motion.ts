"use client";

import { useEffect, useState } from "react";

/**
 * 检测用户是否偏好减少动画（prefers-reduced-motion）
 * 返回 true 时应禁用或大幅减少动画效果
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    typeof window !== 'undefined'
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false,
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return reduced;
}
