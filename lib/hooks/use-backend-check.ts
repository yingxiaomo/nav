"use client";

import { useEffect } from "react";
import { useUIStore } from "@/lib/stores";

/** 每 15 秒轮询后端健康检查端点，更新 backendAvailable 状态 */
export function useBackendCheck() {
  const setBackendAvailable = useUIStore((s) => s.setBackendAvailable);

  useEffect(() => {
    let cancelled = false;
    const check = () =>
      fetch("/api/v1/health")
        .then((r) => {
          if (!cancelled) setBackendAvailable(r.ok);
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
