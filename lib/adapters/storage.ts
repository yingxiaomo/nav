import { DataSchema } from "../types/types";
import { Octokit } from "@octokit/rest";
import { S3Client, GetObjectCommand, PutObjectCommand, HeadBucketCommand } from "@aws-sdk/client-s3";
import { createClient, WebDAVClient } from "webdav";
import { parseNetscapeBookmarks } from "../parsers/bookmark-parser";

export const STORAGE_CONFIG_KEY = "clean-nav-storage-config";
export interface StorageConfig {
  type: 'github' | 's3' | 'webdav' | 'gist';
  github?: GithubRepoSettings;
  s3?: S3Settings;
  webdav?: WebDavSettings;
  gist?: GistSettings;
  settings?: GithubRepoSettings | S3Settings | WebDavSettings | GistSettings;
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

export class S3Adapter implements StorageAdapter {
  private client: S3Client;

  constructor(private config: S3Settings) {
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region || "auto",
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
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
      const command = new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: this.config.key,
      });
      const response = await this.client.send(command);
      const content = await response.Body?.transformToString();
      if (content) {
        return JSON.parse(content) as DataSchema;
      }
      return null;
    } catch (error: unknown) {
      if (typeof error === 'object' && error !== null && 'name' in error && error.name === 'NoSuchKey') {
        return null;
      }
      console.error("S3 load error:", error);
      return null;
    }
  }

  async save(data: DataSchema): Promise<boolean> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: this.config.key,
        Body: JSON.stringify(data, null, 2),
        ContentType: "application/json",
      });
      await this.client.send(command);
      return true;
    } catch (error) {
      console.error("S3 save error:", error);
      return false;
    }
  }

  async uploadFile(file: File, filename: string, onProgress?: (progress: number) => void): Promise<string> {
    try {
      const uniqueFilename = `${Date.now()}-${filename}`;
      const key = `wallpapers/${uniqueFilename}`;
      
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      const command = new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Body: uint8Array,
        ContentType: file.type,
      });
      await this.client.send(command);

      let baseUrl = this.config.publicUrl || this.config.endpoint;
      if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
      
      if (this.config.publicUrl) {
          return `${baseUrl}/${key}`;
      } else {

          return `${baseUrl}/${this.config.bucket}/${key}`;
      }
    } catch (error) {
      console.error("S3 upload error:", error);
      throw error;
    }
  }
}

export class GithubRepoAdapter implements StorageAdapter {
  constructor(private config: GithubRepoSettings) {}

  async testConnection(): Promise<void> {
    const { token, owner, repo } = this.config;
    if (!token || !owner || !repo) throw new Error("请先填写完整的配置信息");

    const octokit = new Octokit({ auth: token });

    await octokit.repos.get({ owner, repo });
  }

  async load(): Promise<DataSchema | null> {
    const { token, owner, repo, branch, path } = this.config;
    if (!token || !owner || !repo) return null;

    try {
      const octokit = new Octokit({ auth: token });
      const response = await octokit.repos.getContent({
        owner,
        repo,
        path,
        ref: branch,
      });

      if (Array.isArray(response.data)) throw new Error("Path is a directory");
      
      if ('content' in response.data) {
        const content = atob(response.data.content);
        return JSON.parse(decodeURIComponent(escape(content))) as DataSchema;
      }
      return null;
    } catch (error) {
      console.error("Github load error:", error);
      return null;
    }
  }

  async save(data: DataSchema): Promise<boolean> {
    const { token, owner, repo, branch, path } = this.config;
    if (!token || !owner || !repo) return false;

    try {
      const octokit = new Octokit({ auth: token });
      let sha: string | undefined;
      
      try {
        const { data: currentFile } = await octokit.repos.getContent({
          owner, repo, path, ref: branch,
        });
        if (!Array.isArray(currentFile) && 'sha' in currentFile) {
          sha = currentFile.sha;
        }
      } catch (e: unknown) {
        if (typeof e === 'object' && e !== null && 'status' in e && e.status !== 404) {
            console.warn("Error checking file:", e);
        }
    }

      const content = btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2))));

      await octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path,
        message: "Update navigation data (via StorageAdapter)",
        content,
        sha,
        branch,
      });
      return true;
    } catch (error) {
      console.error("Github save error:", error);
      return false;
    }
  }

  async uploadFile(file: File, filename: string, onProgress?: (progress: number) => void): Promise<string> {
    const { token, owner, repo, branch } = this.config;
    if (!token || !owner || !repo) throw new Error("GitHub 配置不完整");

    try {
      const octokit = new Octokit({ auth: token });
      
      // 生成唯一文件名
      const uniqueFilename = `${Date.now()}-${filename}`;
      const base64Filename = `base64-uploads/${uniqueFilename}.b64`;
      
      // 将文件转换为 Base64
      onProgress?.(10);
      const arrayBuffer = await file.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      onProgress?.(50);
      
      // 保存 Base64 内容到 GitHub
      await octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: base64Filename,
        message: `Upload file: ${uniqueFilename} (Base64 encoded)`,
        content: base64,
        branch,
      });
      onProgress?.(100);
      
      // 返回文件的访问路径
      return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${base64Filename}`;
    } catch (error) {
      console.error("GitHub upload error:", error);
      throw error;
    }
  }
}

export class GistAdapter implements StorageAdapter {
  constructor(private config: GistSettings) {}

  async testConnection(): Promise<void> {
    const { token, gistId } = this.config;
    if (!token || !gistId) throw new Error("请先填写完整的配置信息");

    const octokit = new Octokit({ auth: token });
    await octokit.gists.get({ gist_id: gistId });
  }

  async load(): Promise<DataSchema | null> {
    const { token, gistId, filename } = this.config;
    if (!token || !gistId) return null;

    try {
      const octokit = new Octokit({ auth: token });
      const response = await octokit.gists.get({ gist_id: gistId });
      
      const file = response.data.files?.[filename || Object.keys(response.data.files || {})[0]];
      
      if (file && file.content) {
          return JSON.parse(file.content) as DataSchema;
      }
      return null;
    } catch (error) {
      console.error("Gist load error:", error);
      return null;
    }
  }

  async save(data: DataSchema): Promise<boolean> {
    const { token, gistId, filename } = this.config;
    if (!token || !gistId) return false;
    
    const targetFilename = filename || "nav-data.json";

    try {
      const octokit = new Octokit({ auth: token });
      await octokit.gists.update({
        gist_id: gistId,
        files: {
            [targetFilename]: {
                content: JSON.stringify(data, null, 2)
            }
        }
      });
      return true;
    } catch (error) {
      console.error("Gist save error:", error);
      return false;
    }
  }
}

export class WebDavAdapter implements StorageAdapter {
  private client: WebDAVClient;

  constructor(private config: WebDavSettings) {
    this.client = createClient(config.url, {
        username: config.username,
        password: config.password
    });
  }

  async testConnection(): Promise<void> {
     try {
         await this.client.getDirectoryContents("/");
     } catch (e: unknown) {
         const errorMessage = typeof e === 'object' && e !== null && 'message' in e ? e.message as string : "未知错误";
         throw new Error(`WebDAV 连接失败: ${errorMessage}`);
     }
  }

  async load(): Promise<DataSchema | null> {
    if (!this.config.url) return null;
    try {
        if (await this.client.exists(this.config.path) === false) {
            return null;
        }
        const content = await this.client.getFileContents(this.config.path, { format: "text" });
        if (typeof content === 'string') {

            try {
                return JSON.parse(content) as DataSchema;
            } catch {

                const parsed = parseNetscapeBookmarks(content);
                if (parsed) {
                    console.log("Successfully parsed WebDAV file as Netscape HTML bookmarks");
                    return parsed;
                }
                console.warn("File content is neither JSON nor valid HTML Bookmarks");
                return null;
            }
        }
        return null;
    } catch (error) {
        console.error("WebDAV load error:", error);
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
        console.error("WebDAV save error:", error);
        return false;
    }
  }
}
