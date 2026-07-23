"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useMonitorConfig } from "@/lib/hooks/use-monitor-config";
import {
  SystemInfo, CheckResult, TargetInfo, ContainerInfo, ContainerStats,
} from "@/lib/types/monitor";

interface MonitorData {
  sys: SystemInfo | null;
  checks: CheckResult[];
  targets: TargetInfo[];
  containers: ContainerInfo[];
  containerStats: ContainerStats[];
  dockerMeta: Record<string, { label: string; icon: string; url: string; order: number }>;
  uptime: number;
}

export function useMonitorData() {
  const config = useMonitorConfig();
  const [data, setData] = useState<MonitorData>({
    sys: null, checks: [], targets: [], containers: [], containerStats: [], dockerMeta: {}, uptime: 0,
  });
  const headersRef = useRef<Record<string, string>>({});

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/admin/monitor/all", {
        headers: { ...headersRef.current },
      });
      if (!res.ok) return;
      const d = await res.json();
      setData({
        sys: d.system || null,
        checks: d.results || [],
        targets: d.targets || [],
        containers: d.containers || [],
        containerStats: d.containerStats || [],
        dockerMeta: d.dockerMeta || {},
        uptime: d.system?.uptime || 0,
      });
    } catch {}
  }, []);

  useEffect(() => {
    fetchData();
    const timer = setInterval(fetchData, 30000);
    return () => clearInterval(timer);
  }, [fetchData]);

  useEffect(() => {
    if (config?.authHeaders) {
      headersRef.current = config.authHeaders;
    }
  }, [config]);

  return { ...data, refresh: fetchData };
}
