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
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const fetchStatus = () => {
      fetch('/api/v1/auth/status', { credentials: 'include' })
        .then((r) => r.json())
        .then((d) => {
          if (!cancelled) setState({ loggedIn: !!d.loggedIn, setupRequired: !!d.setupRequired });
        })
        .catch(() => {
          // 请求失败保留上次状态（网络抖动不应把已登录用户闪断为未登录），
          // 但 5s 后快速重试以尽快收敛
          if (!cancelled && !retryTimer) {
            retryTimer = setTimeout(() => {
              retryTimer = undefined;
              fetchStatus();
            }, 5000);
          }
        });
    };
    fetchStatus();
    const timer = setInterval(fetchStatus, 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [backendAvailable]);

  return { ...state, backendAvailable };
}
