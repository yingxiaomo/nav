/**
 * GitHub 适配器
 *
 * 此文件为向前兼容的重新导出。
 * GithubRepoAdapter 已在 storage.ts 中实现，
 * GITHUB_CONFIG_KEY 为旧版配置键，仅用于迁移兼容。
 */

import type { GithubRepoSettings } from './storage';

/** @deprecated 请使用 storage.ts 中的 GithubRepoSettings */
export type GithubConfig = GithubRepoSettings;

// 保持现有导入不变
export { STORAGE_CONFIG_KEY as GITHUB_CONFIG_KEY } from './storage';
