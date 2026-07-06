'use client';

import { STORAGE_CONFIG_KEY } from '@/lib/adapters/storage';
import { isPrivateHost } from '@/lib/utils';

export interface MonitorConfig {
  baseUrl: string | null;
  authHeaders: Record<string, string>;
  isActive: boolean;
}

/**
 * 从 localStorage 中读取存储配置，
 * 仅当存储类型为 api-server 且地址是内网/私有地址时返回有效配置。
 * 否则返回 isActive: false，监控组件据此决定是否渲染。
 */
export function useMonitorConfig(): MonitorConfig {
  try {
    const raw = localStorage.getItem(STORAGE_CONFIG_KEY);
    if (!raw) return { baseUrl: null, authHeaders: {}, isActive: false };

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
