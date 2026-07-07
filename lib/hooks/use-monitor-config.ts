'use client';

import { STORAGE_CONFIG_KEY } from '@/lib/adapters/storage';
import { isPrivateHost } from '@/lib/utils';
import { useUIStore } from '@/lib/stores';

export interface MonitorConfig {
  baseUrl: string | null;
  authHeaders: Record<string, string>;
  isActive: boolean;
}

/**
 * 从 localStorage 中读取存储配置，
 * 仅当存储类型为 api-server 且地址是内网/私有地址时返回有效配置。
 * 否则返回 isActive: false，监控组件据此决定是否渲染。
 *
 * 同源/内网环境无需手动配置存储，自动启用。
 * 静态部署时（后端不可用）自动禁用所有后端功能。
 */
export function useMonitorConfig(): MonitorConfig {
  const backendAvailable = useUIStore(s => s.backendAvailable);
  try {
    const raw = localStorage.getItem(STORAGE_CONFIG_KEY);

    // 无配置时检测是否内网环境，自动启用（同源模式）
    if (!raw) {
      const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
      if (hostname && isPrivateHost(hostname)) {
        // 静态部署时后端不可用，不激活
        if (!backendAvailable) return { baseUrl: null, authHeaders: {}, isActive: false };
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        return { baseUrl: origin, authHeaders: {}, isActive: true };
      }
      return { baseUrl: null, authHeaders: {}, isActive: false };
    }

    const config = JSON.parse(raw);
    if (config.type !== 'api-server') {
      return { baseUrl: null, authHeaders: {}, isActive: false };
    }

    const authHeaders: Record<string, string> = {};
    if (config.apiServer?.token) {
      authHeaders['Authorization'] = `Bearer ${config.apiServer.token}`;
    }

    // baseUrl 为空 → 同源模式（走 Next.js rewrite 代理），自动激活
    if (!config.apiServer?.baseUrl) {
      if (!backendAvailable) return { baseUrl: null, authHeaders: {}, isActive: false };
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      return { baseUrl: origin, authHeaders, isActive: true };
    }

    const baseUrl = config.apiServer.baseUrl.replace(/\/+$/, '');
    const hostname = new URL(baseUrl).hostname;

    if (!isPrivateHost(hostname)) {
      return { baseUrl: null, authHeaders: {}, isActive: false };
    }

    return { baseUrl, authHeaders, isActive: true };
  } catch {
    return { baseUrl: null, authHeaders: {}, isActive: false };
  }
}
