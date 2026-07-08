import { DataSchema } from "../types/types";

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
