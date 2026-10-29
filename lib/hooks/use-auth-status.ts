'use client';

import { useEffect } from 'react';
import { useUIStore } from '../stores';

/**
 * 登录状态轮询（写入共享 zustand 状态，所有组件读同一份）。
 *
 * 设计要点：
 * - 认证状态必须是全局单份——此前每个组件各自轮询各自持有状态，
 *   管理页登出后首页要等最多 60s 才感知（跨标签页更久）；
 * - backendEverAvailable（见 use-backend-check）区分"纯静态部署"与
 *   "后端短暂宕机"：前者门控放行，后者保持 fail-closed；
 * - 请求失败保留上次状态并 5s 快速重试（网络抖动不闪断已登录用户）；
 * - 后端可用时窗口聚焦立即刷新（跨标签页登出后切回即感知）。
 */
export function useAuthStatus() {
  const backendAvailable = useUIStore((s) => s.backendAvailable);
  const setAuthStatus = useUIStore((s) => s.setAuthStatus);
  const loggedIn = useUIStore((s) => s.authLoggedIn);

  useEffect(() => {
    if (!backendAvailable) return;
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const fetchStatus = () => {
      fetch('/api/v1/auth/status', { credentials: 'include' })
        .then((r) => r.json())
        .then((d) => {
          if (!cancelled) setAuthStatus(!!d.loggedIn);
        })
        .catch(() => {
          // 失败保留上次状态，5s 后快速重试以尽快收敛
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
    const onFocus = () => {
      if (document.visibilityState === 'visible') fetchStatus();
    };
    document.addEventListener('visibilitychange', onFocus);
    window.addEventListener('focus', onFocus);
    return () => {
      cancelled = true;
      clearInterval(timer);
      if (retryTimer) clearTimeout(retryTimer);
      document.removeEventListener('visibilitychange', onFocus);
      window.removeEventListener('focus', onFocus);
    };
  }, [backendAvailable, setAuthStatus]);

  return { loggedIn };
}
