import { DataSchema } from "../types/types";
import { uint8ArrayToBase64 } from "../utils/common";
import { Octokit } from "@octokit/rest";
import type { GithubRepoSettings, StorageAdapter } from "./storage";

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
      const response = await octokit.repos.getContent({ owner, repo, path, ref: branch });
      if (Array.isArray(response.data)) throw new Error("Path is a directory");
      if ('content' in response.data) {
        const content = atob(response.data.content);
        const bytes = Uint8Array.from(content, c => c.charCodeAt(0));
        return JSON.parse(new TextDecoder().decode(bytes)) as DataSchema;
      }
      return null;
    } catch (error) {
      console.warn("Github load error:", error);
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
        const { data: currentFile } = await octokit.repos.getContent({ owner, repo, path, ref: branch });
        if (!Array.isArray(currentFile) && 'sha' in currentFile) sha = currentFile.sha;
      } catch (e: unknown) {
        if (typeof e === 'object' && e !== null && 'status' in e && e.status !== 404) {
          console.warn("Error checking file:", e);
        }
      }
      const encoder = new TextEncoder();
      const encoded = encoder.encode(JSON.stringify(data, null, 2));
      await octokit.repos.createOrUpdateFileContents({
        owner, repo, path,
        message: "Update navigation data (via StorageAdapter)",
        content: uint8ArrayToBase64(encoded), sha, branch,
      });
      return true;
    } catch (error) {
      console.warn("Github save error:", error);
      return false;
    }
  }

  async uploadFile(file: File, filename: string, onProgress?: (progress: number) => void): Promise<string> {
    const { token, owner, repo, branch } = this.config;
    if (!token || !owner || !repo) throw new Error("GitHub 配置不完整");
    try {
      const octokit = new Octokit({ auth: token });
      const uniqueFilename = `${Date.now()}-${filename}`;
      const base64Filename = `base64-uploads/${uniqueFilename}.b64`;
      onProgress?.(10);
      const arrayBuffer = await file.arrayBuffer();
      const base64 = uint8ArrayToBase64(new Uint8Array(arrayBuffer));
      onProgress?.(50);
      await octokit.repos.createOrUpdateFileContents({
        owner, repo, path: base64Filename,
        message: `Upload file: ${uniqueFilename} (Base64 encoded)`,
        content: base64, branch,
      });
      onProgress?.(100);
      return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${base64Filename}`;
    } catch (error) {
      console.warn("GitHub upload error:", error);
      throw error;
    }
  }
}
