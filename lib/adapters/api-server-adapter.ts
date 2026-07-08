import { DataSchema } from "../types/types";
import type { ApiServerSettings, StorageAdapter } from "./storage";

export class ApiServerAdapter implements StorageAdapter {
  private baseUrl: string;

  constructor(private config: ApiServerSettings) {
    let url = (config.baseUrl || "").trim();
    if (url && !/^https?:\/\//i.test(url)) url = `http://${url}`;
    this.baseUrl = url.replace(/\/+$/, '');
  }

  private async request(path: string, options?: RequestInit): Promise<Response> {
    const headers: Record<string, string> = {};
    if (options?.headers) {
      const h = options.headers;
      if (Array.isArray(h)) { for (const [k, v] of h) headers[k] = v; }
      else if ('forEach' in h && typeof h.forEach === 'function') { h.forEach((v: string, k: string) => { headers[k] = v; }); }
      else { Object.assign(headers, h as Record<string, string>); }
    }
    if (this.config.token) headers['Authorization'] = `Bearer ${this.config.token}`;
    if (!(options?.body instanceof FormData)) headers['Content-Type'] ??= 'application/json';
    const url = this.baseUrl ? `${this.baseUrl}${path}` : path;
    return fetch(url, { ...options, headers });
  }

  async load(): Promise<DataSchema | null> {
    try {
      const res = await this.request('/api/v1/data');
      if (!res.ok) return null;
      return res.json() as Promise<DataSchema>;
    } catch (err) {
      console.warn('[ApiServerAdapter] load failed:', err);
      return null;
    }
  }

  async save(data: DataSchema): Promise<boolean> {
    try {
      const res = await this.request('/api/v1/data', { method: 'PUT', body: JSON.stringify(data) });
      return res.ok;
    } catch (err) {
      console.warn('[ApiServerAdapter] save failed:', err);
      return false;
    }
  }

  async testConnection(): Promise<void> {
    const headers: Record<string, string> = {};
    if (this.config.token) headers['Authorization'] = `Bearer ${this.config.token}`;
    const url = this.baseUrl ? `${this.baseUrl}/api/v1/health` : '/api/v1/health';
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`后端连接失败 (${res.status})`);
  }

  async uploadFile(file: File, filename: string, onProgress?: (progress: number) => void): Promise<string> {
    const formData = new FormData();
    formData.append('file', file, filename);
    onProgress?.(30);
    const res = await this.request('/api/v1/upload', { method: 'POST', body: formData });
    onProgress?.(100);
    if (!res.ok) throw new Error('上传失败');
    const data = await res.json();
    return data.url;
  }
}
