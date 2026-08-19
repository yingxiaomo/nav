/**
 * 存储适配器共享类型。
 *
 * 从 storage.ts 中拆出，切断 api-server-adapter ⟷ storage 的循环导入：
 * storage.ts（运行时）→ api-server-adapter.ts（运行时类），而
 * api-server-adapter.ts 只依赖这里的纯类型定义。
 */

import type { DataSchema } from "../types/types";

/** 统一存储适配器接口 */
export interface StorageAdapter {
  load(): Promise<DataSchema | null>;
  save(data: DataSchema): Promise<boolean>;
  testConnection?(): Promise<void>;
  uploadFile?(file: File, filename: string, onProgress?: (progress: number) => void): Promise<string>;
}

/** API Server 同步设置 */
export interface ApiServerSettings {
  baseUrl: string;
  token?: string;
}
