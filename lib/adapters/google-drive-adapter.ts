import { DataSchema } from "../types/types";
import type { GoogleDriveSettings, StorageAdapter } from "./storage";

export class GoogleDriveAdapter implements StorageAdapter {
  constructor(private config: GoogleDriveSettings) {}

  async testConnection(): Promise<void> {
    try {
      const response = await fetch("https://www.googleapis.com/drive/v3/about?fields=user", {
        headers: { Authorization: `Bearer ${this.config.token}` },
      });
      if (!response.ok) throw new Error(`Google Drive 连接失败: ${response.statusText}`);
    } catch (error) {
      const msg = typeof error === 'object' && error !== null && 'message' in error ? error.message as string : "未知错误";
      throw new Error(`Google Drive 连接失败: ${msg}`);
    }
  }

  async load(): Promise<DataSchema | null> {
    if (!this.config.token || !this.config.fileId) return null;
    try {
      const response = await fetch(`https://www.googleapis.com/drive/v3/files/${this.config.fileId}?alt=media`, {
        headers: { Authorization: `Bearer ${this.config.token}` },
      });
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`Google Drive 下载失败: ${response.statusText}`);
      }
      const content = await response.text();
      return JSON.parse(content) as DataSchema;
    } catch (error) {
      console.warn("Google Drive load error:", error);
      return null;
    }
  }

  async save(data: DataSchema): Promise<boolean> {
    if (!this.config.token || !this.config.fileId) return false;
    try {
      const response = await fetch(
        `https://www.googleapis.com/upload/drive/v3/files/${this.config.fileId}?uploadType=media`,
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${this.config.token}`, "Content-Type": "application/json" },
          body: JSON.stringify(data, null, 2),
        },
      );
      return response.ok;
    } catch (error) {
      console.warn("Google Drive save error:", error);
      return false;
    }
  }

  async uploadFile(file: File, filename: string, onProgress?: (progress: number) => void): Promise<string> {
    if (!this.config.token) throw new Error("Google Drive 配置不完整");
    try {
      const uniqueFilename = `${Date.now()}-${filename}`;
      onProgress?.(20);
      const arrayBuffer = await file.arrayBuffer();
      onProgress?.(50);
      const formData = new FormData();
      const metadata = { name: uniqueFilename, mimeType: file.type };
      formData.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
      formData.append("file", new Blob([arrayBuffer], { type: file.type }), uniqueFilename);
      const uploadResponse = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
        method: "POST", headers: { Authorization: `Bearer ${this.config.token}` }, body: formData,
      });
      if (!uploadResponse.ok) throw new Error(`Google Drive 文件上传失败: ${uploadResponse.statusText}`);
      const fileData = await uploadResponse.json();
      await fetch(`https://www.googleapis.com/drive/v3/files/${fileData.id}/permissions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.config.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ role: "reader", type: "anyone" }),
      });
      onProgress?.(100);
      return `https://drive.google.com/uc?export=view&id=${fileData.id}`;
    } catch (error) {
      console.warn("Google Drive upload error:", error);
      throw error;
    }
  }
}
