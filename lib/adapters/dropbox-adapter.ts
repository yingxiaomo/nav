import { DataSchema } from "../types/types";
import type { DropboxSettings, StorageAdapter } from "./storage";

export class DropboxAdapter implements StorageAdapter {
  constructor(private config: DropboxSettings) {}

  async testConnection(): Promise<void> {
    try {
      const response = await fetch("https://api.dropboxapi.com/2/users/get_current_account", {
        headers: { Authorization: `Bearer ${this.config.token}`, "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error(`Dropbox 连接失败: ${response.statusText}`);
    } catch (error) {
      const msg = typeof error === 'object' && error !== null && 'message' in error ? error.message as string : "未知错误";
      throw new Error(`Dropbox 连接失败: ${msg}`);
    }
  }

  async load(): Promise<DataSchema | null> {
    if (!this.config.token || !this.config.path) return null;
    try {
      const response = await fetch("https://api.dropboxapi.com/2/files/download", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.token}`,
          "Dropbox-API-Arg": JSON.stringify({ path: this.config.path }),
        },
      });
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`Dropbox 下载失败: ${response.statusText}`);
      }
      const content = await response.text();
      return JSON.parse(content) as DataSchema;
    } catch (error) {
      console.warn("Dropbox load error:", error);
      return null;
    }
  }

  async save(data: DataSchema): Promise<boolean> {
    if (!this.config.token || !this.config.path) return false;
    try {
      const response = await fetch("https://api.dropboxapi.com/2/files/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.token}`,
          "Dropbox-API-Arg": JSON.stringify({ path: this.config.path, mode: "overwrite" }),
          "Content-Type": "application/octet-stream",
        },
        body: JSON.stringify(data, null, 2),
      });
      return response.ok;
    } catch (error) {
      console.warn("Dropbox save error:", error);
      return false;
    }
  }

  async uploadFile(file: File, filename: string, onProgress?: (progress: number) => void): Promise<string> {
    if (!this.config.token) throw new Error("Dropbox 配置不完整");
    try {
      const uniqueFilename = `${Date.now()}-${filename}`;
      const filePath = `/wallpapers/${uniqueFilename}`;
      onProgress?.(20);
      const arrayBuffer = await file.arrayBuffer();
      onProgress?.(50);
      const response = await fetch("https://api.dropboxapi.com/2/files/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.token}`,
          "Dropbox-API-Arg": JSON.stringify({ path: filePath, mode: "add" }),
          "Content-Type": "application/octet-stream",
        },
        body: arrayBuffer,
      });
      if (!response.ok) throw new Error(`Dropbox 文件上传失败: ${response.statusText}`);
      onProgress?.(100);
      const shareResponse = await fetch("https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings", {
        method: "POST",
        headers: { Authorization: `Bearer ${this.config.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ path: filePath, settings: { access: "viewer", allow_download: true } }),
      });
      if (!shareResponse.ok) throw new Error(`Dropbox 创建共享链接失败: ${shareResponse.statusText}`);
      const shareData = await shareResponse.json();
      return shareData.url.replace("www.dropbox.com", "dl.dropboxusercontent.com").replace("?dl=0", "?raw=1");
    } catch (error) {
      console.warn("Dropbox upload error:", error);
      throw error;
    }
  }
}
