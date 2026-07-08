'use client';

import { useCallback } from 'react';
import { GithubRepoAdapter, S3Adapter, WebDavAdapter, GistAdapter, DropboxAdapter, GoogleDriveAdapter, ApiServerAdapter, STORAGE_CONFIG_KEY, type StorageConfig, type StorageAdapter } from '../adapters';
import { GITHUB_CONFIG_KEY } from '../adapters/github';
import { isPrivateHost } from '../utils/common';

/**
 * 从 localStorage 读取存储配置，支持旧版配置自动迁移
 */
export function useStorageConfig() {
  const getEffectiveConfig = useCallback((): StorageConfig | null => {
    if (typeof window === 'undefined') return null;

    const storageConfigStr = localStorage.getItem(STORAGE_CONFIG_KEY);
    if (storageConfigStr) {
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

  const getAdapter = useCallback((config: StorageConfig): StorageAdapter | null => {
    switch (config.type) {
      case 'github': return config.github ? new GithubRepoAdapter(config.github) : null;
      case 's3': return config.s3 ? new S3Adapter(config.s3) : null;
      case 'webdav': return config.webdav ? new WebDavAdapter(config.webdav) : null;
      case 'gist': return config.gist ? new GistAdapter(config.gist) : null;
      case 'dropbox': return config.dropbox ? new DropboxAdapter(config.dropbox) : null;
      case 'googledrive': return config.googledrive ? new GoogleDriveAdapter(config.googledrive) : null;
      case 'api-server': return config.apiServer ? new ApiServerAdapter(config.apiServer) : null;
      default: return null;
    }
  }, []);

  return { getEffectiveConfig, getAdapter };
}
