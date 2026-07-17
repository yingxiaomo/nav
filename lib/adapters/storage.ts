import { DataSchema } from "../types/types";
import { ApiServerAdapter } from './api-server-adapter';
import { GithubRepoAdapter } from './github-repo-adapter';
import { S3Adapter } from './s3-adapter';
import { WebDavAdapter } from './webdav-adapter';
import { DropboxAdapter } from './dropbox-adapter';
import { GoogleDriveAdapter } from './google-drive-adapter';

export const STORAGE_CONFIG_KEY = "clean-nav-storage-config";

export interface StorageConfig {
  type: 'github' | 's3' | 'webdav' | 'gist' | 'dropbox' | 'googledrive' | 'api-server';
  github?: GithubRepoSettings;
  s3?: S3Settings;
  webdav?: WebDavSettings;
  gist?: GistSettings;
  dropbox?: DropboxSettings;
  googledrive?: GoogleDriveSettings;
  apiServer?: ApiServerSettings;
}

export interface StorageAdapter {
  load(): Promise<DataSchema | null>;
  save(data: DataSchema): Promise<boolean>;
  testConnection?(): Promise<void>;
  uploadFile?(file: File, filename: string, onProgress?: (progress: number) => void): Promise<string>;
}

export interface GithubRepoSettings {
  token: string;
  owner: string;
  repo: string;
  branch: string;
  path: string;
}

export interface GistSettings {
  token: string;
  gistId: string;
  filename: string;
}

export interface S3Settings {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  key: string;
  publicUrl?: string;
}

export interface WebDavSettings {
  url: string;
  username?: string;
  password?: string;
  path: string;
}

export interface DropboxSettings {
  token: string;
  path: string;
}

export interface GoogleDriveSettings {
  token: string;
  fileId: string;
  filename: string;
}

export interface ApiServerSettings {
  baseUrl: string;
  token?: string;
}

/** 根据配置创建对应的存储适配器实例 */
export function createAdapter(config: StorageConfig): StorageAdapter | null {
  switch (config.type) {
    case 'api-server':
      return config.apiServer?.baseUrl ? new ApiServerAdapter(config.apiServer) : null;
    case 'github':
      return config.github?.token ? new GithubRepoAdapter(config.github) : null;
    case 's3':
      return config.s3?.accessKeyId ? new S3Adapter(config.s3) : null;
    case 'webdav':
      return config.webdav?.url ? new WebDavAdapter(config.webdav) : null;
    case 'dropbox':
      return config.dropbox?.token ? new DropboxAdapter(config.dropbox) : null;
    case 'googledrive':
      return config.googledrive?.token ? new GoogleDriveAdapter(config.googledrive) : null;
    default:
      return null;
  }
}
