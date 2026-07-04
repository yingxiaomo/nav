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

/**
 * 旧版 GitHub 配置的 localStorage 键名
 * 用于从旧版本迁移到新版 StorageConfig，不可与 STORAGE_CONFIG_KEY 共用
 */
export const GITHUB_CONFIG_KEY = "clean-nav-github-config";
