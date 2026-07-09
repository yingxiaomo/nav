import { DataSchema } from "../types/types";
import { createClient, WebDAVClient } from "webdav";
import type { WebDavSettings, StorageAdapter } from "./storage";

export class WebDavAdapter implements StorageAdapter {
  private client: WebDAVClient;

  constructor(private config: WebDavSettings) {
    this.client = createClient(config.url, { username: config.username, password: config.password });
  }

  async testConnection(): Promise<void> {
    try {
      await this.client.getDirectoryContents("/");
    } catch (e: unknown) {
      const msg = typeof e === 'object' && e !== null && 'message' in e ? e.message as string : "未知错误";
      throw new Error(`WebDAV 连接失败: ${msg}`);
    }
  }

  async load(): Promise<DataSchema | null> {
    if (!this.config.url) return null;
    try {
      if (await this.client.exists(this.config.path) === false) return null;
      const content = await this.client.getFileContents(this.config.path, { format: "text" });
      if (typeof content === 'string') {
        try { return JSON.parse(content) as DataSchema; }
        catch {
          console.warn("WebDAV 文件内容不是有效的 JSON 格式，请确保文件为 .json 格式");
          return null;
        }
      }
      return null;
    } catch (error) {
      console.warn("WebDAV load error:", error);
      return null;
    }
  }

  async save(data: DataSchema): Promise<boolean> {
    if (!this.config.url) return false;
    if (this.config.path.endsWith('.html') || this.config.path.endsWith('.htm')) {
      throw new Error("无法将 JSON 数据保存到 HTML 文件。请在设置中更改文件扩展名为 .json");
    }
    try {
      await this.client.putFileContents(this.config.path, JSON.stringify(data, null, 2));
      return true;
    } catch (error) {
      console.warn("WebDAV save error:", error);
      return false;
    }
  }

  async uploadFile(file: File, filename: string, onProgress?: (progress: number) => void): Promise<string> {
    if (!this.config.url) throw new Error("WebDAV 配置不完整");
    try {
      const wallpapersDir = "/wallpapers";
      if (!(await this.client.exists(wallpapersDir))) {
        await this.client.createDirectory(wallpapersDir, { recursive: true });
      }
      const uniqueFilename = `${Date.now()}-${filename}`;
      const filePath = `${wallpapersDir}/${uniqueFilename}`;
      onProgress?.(20);
      const arrayBuffer = await file.arrayBuffer();
      onProgress?.(50);
      await this.client.putFileContents(filePath, arrayBuffer);
      onProgress?.(100);
      return `${this.config.url}${filePath}`;
    } catch (error) {
      console.warn("WebDAV upload error:", error);
      throw error;
    }
  }
}
