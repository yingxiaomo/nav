import { Octokit } from "@octokit/rest";
import { DataSchema } from "../types/types";

export interface GithubConfig {
  token: string;
  owner: string;
  repo: string;
  branch?: string; 
  path: string;
}

export const GITHUB_CONFIG_KEY = "clean-nav-github-config";

export async function loadDataFromGithub(config: GithubConfig): Promise<DataSchema | null> {
  if (!config.token || !config.owner || !config.repo) return null;

  try {
    const octokit = new Octokit({ auth: config.token });
    
    const response = await octokit.repos.getContent({
      owner: config.owner,
      repo: config.repo,
      path: config.path,
      ref: config.branch, 
    });

    if (Array.isArray(response.data)) throw new Error("Path is a directory");
    
    if ('content' in response.data) {
      const content = atob(response.data.content);
      // 将 Base64 解为 UTF-8 字符串（替代已废弃的 escape/unescape）
      const bytes = Uint8Array.from(content, c => c.charCodeAt(0));
      const json = JSON.parse(new TextDecoder().decode(bytes)); 
      return json as DataSchema;
    }
    
    return null;
  } catch (error) {
    console.error("Failed to load from GitHub:", error);
    return null;
  }
}

export async function saveDataToGithub(config: GithubConfig, data: DataSchema, message: string = "Update navigation data"): Promise<boolean> {
  if (!config.token || !config.owner || !config.repo) return false;

  try {
    const octokit = new Octokit({ auth: config.token });
    

    let sha: string | undefined;
    try {
      const { data: currentFile } = await octokit.repos.getContent({
        owner: config.owner,
        repo: config.repo,
        path: config.path,
        ref: config.branch, 
      });
      if (!Array.isArray(currentFile) && 'sha' in currentFile) {
        sha = currentFile.sha;
      }
    } catch (e: unknown) {

      if (typeof e === 'object' && e !== null && 'status' in e && e.status !== 404) {
        console.warn("Error checking for existing file:", e);
      }
    }


    const encoder = new TextEncoder();
    const encoded = encoder.encode(JSON.stringify(data, null, 2));
    const base64Content = btoa(String.fromCharCode(...encoded));

    await octokit.repos.createOrUpdateFileContents({
      owner: config.owner,
      repo: config.repo,
      path: config.path,
      message,
      content: base64Content,
      sha,
      branch: config.branch, 
    });

    return true;
  } catch (error) {
    console.error("Failed to save to GitHub:", error);
    throw error;
  }
}