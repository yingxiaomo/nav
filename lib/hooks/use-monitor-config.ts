'use client';

import { useMemo } from 'react';
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

  return useMemo(() => {
    // 尝试从 localStorage 解析存储配置
    let config: { type?: string; apiServer?: { baseUrl?: string; token?: string } } | null = null;
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_CONFIG_KEY) : null;
      if (raw) {
        config = JSON.parse(raw);
      }
    } catch {
      // localStorage 数据损坏或旧版加密格式，忽略后走自动检测
    }

    // 有 API-Server 配置 → 按配置连后端
    if (config?.type === 'api-server') {
      const authHeaders: Record<string, string> = {};
      if (config.apiServer?.token) {
        authHeaders['Authorization'] = `Bearer ${config.apiServer.token}`;
      }

      // baseUrl 为空 → 同源模式
      if (!config.apiServer?.baseUrl) {
        if (!backendAvailable) {
          return { baseUrl: null, authHeaders: {}, isActive: false };
        }
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        return { baseUrl: origin, authHeaders, isActive: true };
      }

      const baseUrl = config.apiServer.baseUrl.replace(/\/+$/, '');
      try {
        if (!isPrivateHost(new URL(baseUrl).hostname)) {
          return { baseUrl: null, authHeaders: {}, isActive: false };
        }
      } catch {
        return { baseUrl: null, authHeaders: {}, isActive: false };
      }

      return { baseUrl, authHeaders, isActive: true };
    }

    // 无配置 / 配置损坏 / 非 API-Server → 同源/内网环境自动检测
    const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
    if (hostname && isPrivateHost(hostname)) {
      if (!backendAvailable) {
        return { baseUrl: null, authHeaders: {}, isActive: false };
      }
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      return { baseUrl: origin, authHeaders: {}, isActive: true };
    }

    return { baseUrl: null, authHeaders: {}, isActive: false };
  }, [backendAvailable]);
}
