import { DataSchema } from "../types/types";
import { Octokit } from "@octokit/rest";
import type { GistSettings, StorageAdapter } from "./storage";

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
      if (file && file.content) return JSON.parse(file.content) as DataSchema;
      return null;
    } catch (error) {
      console.warn("Gist load error:", error);
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
        files: { [targetFilename]: { content: JSON.stringify(data, null, 2) } },
      });
      return true;
    } catch (error) {
      console.warn("Gist save error:", error);
      return false;
    }
  }
}
