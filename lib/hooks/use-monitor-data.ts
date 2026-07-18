"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useMonitorConfig } from "@/lib/hooks/use-monitor-config";
import {
  SystemInfo, CheckResult, TargetInfo, ContainerInfo, ContainerStats,
} from "@/components/features/monitor-types";

interface MonitorData {
  sys: SystemInfo | null;
  checks: CheckResult[];
  targets: TargetInfo[];
  containers: ContainerInfo[];
  containerStats: ContainerStats[];
  dockerMeta: Record<string, { name: string; icon?: string; label?: string; url?: string; order?: number }>;
  uptime: Record<string, number>;
  loading: boolean;
  refresh: () => void;
}

const POLL_MS = 30_000;

/** 监控面板数据获取 hook — 每 30 秒轮询 /api/v1/admin/monitor/all */
export function useMonitorData(): MonitorData {
  const [sys, setSys] = useState<SystemInfo | null>(null);
  const [checks, setChecks] = useState<CheckResult[]>([]);
  const [targets, setTargets] = useState<TargetInfo[]>([]);
  const [containers, setContainers] = useState<ContainerInfo[]>([]);
  const [containerStats, setContainerStats] = useState<ContainerStats[]>([]);
  const [dockerMeta, setDockerMeta] = useState<Record<string, { name: string; icon?: string; label?: string; url?: string; order?: number }>>({});
  const [uptime, setUptime] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const { baseUrl, authHeaders } = useMonitorConfig();
  const mountedRef = useRef(true);
  // 用 ref 持有 headers，避免对象引用变化触发 effect 重建
  const headersRef = useRef(authHeaders);
  useEffect(() => {
    headersRef.current = authHeaders;
  }, [authHeaders]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const fetchData = useCallback(async () => {
    if (!baseUrl) return;
    try {
      const res = await fetch(`${baseUrl}/api/v1/admin/monitor/all`, {
        headers: headersRef.current,
      });
      if (res.ok && mountedRef.current) {
        const d = await res.json();
        setSys(d.system);
        setChecks(d.results || []);
        setTargets(d.targets || []);
        setContainers(d.containers || []);
        setContainerStats(d.stats || []);
        setDockerMeta(d.metadata || {});
        setUptime(d.uptime || {});
        setLoading(false);
      }
    } catch (err) {
      console.warn("[Monitor] fetch data failed:", err);
    }
  }, [baseUrl]);

  useEffect(() => {
    if (!baseUrl) return;
    fetchData();
    const t = setInterval(fetchData, POLL_MS);
    return () => clearInterval(t);
  }, [fetchData, baseUrl]);

  return { sys, checks, targets, containers, containerStats, dockerMeta, uptime, loading, refresh: fetchData };
}
