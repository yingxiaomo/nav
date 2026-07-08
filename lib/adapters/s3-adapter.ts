import { DataSchema } from "../types/types";
import { S3Client, GetObjectCommand, PutObjectCommand, HeadBucketCommand } from "@aws-sdk/client-s3";
import type { S3Settings, StorageAdapter } from "./storage";

export class S3Adapter implements StorageAdapter {
  private client: S3Client;

  constructor(private config: S3Settings) {
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region || "auto",
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
      forcePathStyle: true,
    });
  }

  async testConnection(): Promise<void> {
    try {
      const command = new HeadBucketCommand({ Bucket: this.config.bucket });
      await this.client.send(command);
    } catch (error: unknown) {
      const s3Error = error as { name?: string; $metadata?: { httpStatusCode?: number } };
      if (s3Error.name === 'NotFound' || (s3Error.$metadata && s3Error.$metadata.httpStatusCode === 404)) {
        throw new Error(`Bucket "${this.config.bucket}" 不存在`);
      }
      if (s3Error.$metadata && s3Error.$metadata.httpStatusCode === 403) {
        throw new Error(`没有访问 Bucket "${this.config.bucket}" 的权限 (403)`);
      }
      throw error;
    }
  }

  async load(): Promise<DataSchema | null> {
    if (!this.config.endpoint) return null;
    try {
      const command = new GetObjectCommand({ Bucket: this.config.bucket, Key: this.config.key });
      const response = await this.client.send(command);
      const content = await response.Body?.transformToString();
      return content ? JSON.parse(content) as DataSchema : null;
    } catch (error: unknown) {
      if (typeof error === 'object' && error !== null && 'name' in error && error.name === 'NoSuchKey') return null;
      console.warn("S3 load error:", error);
      return null;
    }
  }

  async save(data: DataSchema): Promise<boolean> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.config.bucket, Key: this.config.key,
        Body: JSON.stringify(data, null, 2), ContentType: "application/json",
      });
      await this.client.send(command);
      return true;
    } catch (error) {
      console.warn("S3 save error:", error);
      return false;
    }
  }

  async uploadFile(file: File, filename: string, onProgress?: (progress: number) => void): Promise<string> {
    try {
      const uniqueFilename = `${Date.now()}-${filename}`;
      const key = `wallpapers/${uniqueFilename}`;
      onProgress?.(10);
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      onProgress?.(40);
      await this.client.send(new PutObjectCommand({
        Bucket: this.config.bucket, Key: key, Body: uint8Array, ContentType: file.type,
      }));
      onProgress?.(100);
      let baseUrl = this.config.publicUrl || this.config.endpoint;
      if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
      return this.config.publicUrl ? `${baseUrl}/${key}` : `${baseUrl}/${this.config.bucket}/${key}`;
    } catch (error) {
      console.warn("S3 upload error:", error);
      throw error;
    }
  }
}
