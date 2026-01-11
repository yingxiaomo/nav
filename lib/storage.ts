import { DataSchema } from "./types";
import { Octokit } from "@octokit/rest";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";

export const STORAGE_CONFIG_KEY = "clean-nav-storage-config";

export interface StorageConfig {
  type: 'github' | 's3' | 'webdav' | 'gist';
  settings: any;
}

export interface StorageAdapter {
  load(): Promise<DataSchema | null>;
  save(data: DataSchema): Promise<boolean>;
}

// GitHub Repository Adapter
export interface GithubRepoSettings {
  token: string;
  owner: string;
  repo: string;
  branch: string;
  path: string;
}

// S3 / R2 Adapter
export interface S3Settings {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  key: string;
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
      // Important for R2/Custom S3 providers
      forcePathStyle: true,
    });
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
    } catch (error: any) {
      if (error.name === 'NoSuchKey') return null;
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
}

export class GithubRepoAdapter implements StorageAdapter {
  constructor(private config: GithubRepoSettings) {}

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
      } catch (e: any) {
        if (e.status !== 404) console.warn("Error checking file:", e);
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
}
