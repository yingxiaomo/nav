"use client";

import { useEffect } from "react";
import { useUIStore } from "@/lib/stores";

/**
 * 每 15 秒轮询后端健康检查端点，更新 backendAvailable 状态。
 *
 * 必须校验响应体是 {"status":"ok"} 的 JSON：带 SPA 回退的静态托管
 * （Vercel/Netlify catch-all、nginx try_files）会把 /api/v1/health
 * 回退成 index.html 且返回 200——只看状态码会把纯静态部署误判为
 * 后端可用，进而错误隐藏笔记/待办等入口、错误显示 AI/终端按钮。
 */
export function useBackendCheck() {
  const setBackendAvailable = useUIStore((s) => s.setBackendAvailable);

  useEffect(() => {
    let cancelled = false;
    const check = () =>
      fetch("/api/v1/health")
        .then(async (r) => {
          if (!r.ok) return false;
          try {
            const data = await r.json();
            return data?.status === "ok";
          } catch {
            return false;
          }
        })
        .then((available) => {
          if (!cancelled) setBackendAvailable(available);
        })
        .catch(() => {
          if (!cancelled) setBackendAvailable(false);
        });

    check();
    const timer = setInterval(check, 15000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [setBackendAvailable]);
}
