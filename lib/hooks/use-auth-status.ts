'use client';

import { useEffect, useState } from 'react';
import { useUIStore } from '../stores';

interface AuthStatusState {
  /** 是否已登录管理后台（仅后端模式下有意义） */
  loggedIn: boolean;
  /** 是否需要初始化管理员 */
  setupRequired: boolean;
  /** 后端是否可用（静态部署模式恒为 false） */
  backendAvailable: boolean;
}

/**
 * 获取当前登录状态（公开端点 /api/v1/auth/status，60s 轮询）。
 *
 * 用于首页敏感入口的门控：后端模式下笔记/待办/监控面板仅登录后展示；
 * 静态部署模式（无后端）数据来自本地/云同步，不门控。
 */
export function useAuthStatus(): AuthStatusState {
  const backendAvailable = useUIStore((s) => s.backendAvailable);
  const [state, setState] = useState<Omit<AuthStatusState, 'backendAvailable'>>({
    loggedIn: false,
    setupRequired: false,
  });

  useEffect(() => {
    if (!backendAvailable) return;
    let cancelled = false;
    const fetchStatus = () => {
      fetch('/api/v1/auth/status', { credentials: 'include' })
        .then((r) => r.json())
        .then((d) => {
          if (!cancelled) setState({ loggedIn: !!d.loggedIn, setupRequired: !!d.setupRequired });
        })
        .catch(() => {});
    };
    fetchStatus();
    const timer = setInterval(fetchStatus, 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [backendAvailable]);

  return { ...state, backendAvailable };
}
