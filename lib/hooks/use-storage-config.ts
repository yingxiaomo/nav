'use client';

import { useCallback } from 'react';
import { STORAGE_CONFIG_KEY, createAdapter, type StorageConfig, type StorageAdapter } from '../adapters/storage';
import { GITHUB_CONFIG_KEY } from '../adapters/github';
import { isPrivateHost } from '../utils/common';

/**
 * 从 localStorage 读取存储配置，支持旧版配置自动迁移
 */
export function useStorageConfig() {
  const getEffectiveConfig = useCallback((): StorageConfig | null => {
    if (typeof window === 'undefined') return null;

    let storageConfigStr = localStorage.getItem(STORAGE_CONFIG_KEY);
    if (storageConfigStr) {
      // 兼容 base64 编码格式：仅在内存中解码用于解析，
      // 不回写明文（回写会主动抹掉对 token/密钥的目视遮挡）。
      if (storageConfigStr.startsWith('__b64__')) {
        try {
          storageConfigStr = atob(storageConfigStr.slice(7));
        } catch { /* 解码失败，忽略 */
        }
      }
      try {
        const rawConfig = JSON.parse(storageConfigStr);

        // 旧版配置迁移：扁平 settings → 新版 StorageConfig
        if (rawConfig.settings && Object.keys(rawConfig.settings).length > 0) {
          const oldSettings = rawConfig.settings;
          if (rawConfig.type === 'github' && !rawConfig.github) {
            rawConfig.github = oldSettings;
          } else if (rawConfig.type === 's3' && !rawConfig.s3) {
            rawConfig.s3 = oldSettings;
          } else if (rawConfig.type === 'webdav' && !rawConfig.webdav) {
            rawConfig.webdav = oldSettings;
          } else if (rawConfig.type === 'gist' && !rawConfig.gist) {
            rawConfig.gist = oldSettings;
          } else if (rawConfig.type === 'dropbox' && !rawConfig.dropbox) {
            rawConfig.dropbox = oldSettings;
          } else if (rawConfig.type === 'googledrive' && !rawConfig.googledrive) {
            rawConfig.googledrive = oldSettings;
          } else if (rawConfig.type === 'api-server' && !rawConfig.apiServer) {
            rawConfig.apiServer = oldSettings;
          }
          delete rawConfig.settings;
          localStorage.setItem(STORAGE_CONFIG_KEY, JSON.stringify(rawConfig));
        }

        return rawConfig as StorageConfig;
      } catch (e) {
        console.error("Error parsing storage config", e);
      }
    }

    // 最旧版 GitHub 配置迁移
    const githubConfigStr = localStorage.getItem(GITHUB_CONFIG_KEY);
    if (githubConfigStr) {
      const githubSettings = JSON.parse(githubConfigStr);
      const migrated: StorageConfig = { type: 'github', github: githubSettings };
      localStorage.setItem(STORAGE_CONFIG_KEY, JSON.stringify(migrated));
      return migrated;
    }

    // 同源/内网环境自动启用 API Server（无需手动配置）
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      if (isPrivateHost(hostname)) {
        return { type: 'api-server', apiServer: { baseUrl: '', token: '' } };
      }
    }

    return null;
  }, []);

  // 懒加载工厂：adapter 按需动态导入，避免云同步 SDK 撑起首屏 bundle
  const getAdapter = useCallback((config: StorageConfig): Promise<StorageAdapter | null> => {
    return createAdapter(config);
  }, []);

  return { getEffectiveConfig, getAdapter };
}
