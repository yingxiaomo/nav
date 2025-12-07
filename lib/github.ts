import { Octokit } from "@octokit/rest";
import { DataSchema, DEFAULT_DATA } from "./types";

export interface GithubConfig {
  token: string;
  owner: string;
  repo: string;
  path: string; // usually 'public/data.json' or just 'data.json' if in root
}

export const GITHUB_CONFIG_KEY = "clean-nav-github-config";

export async function loadDataFromGithub(config: GithubConfig): Promise<DataSchema | null> {
  if (!config.token || !config.owner || !config.repo) return null;

  try {
    const octokit = new Octokit({ auth: config.token });
    
    // Get the file content
    const response = await octokit.repos.getContent({
      owner: config.owner,
      repo: config.repo,
      path: config.path,
    });

    if (Array.isArray(response.data)) throw new Error("Path is a directory");
    
    // Decode content
    if ('content' in response.data) {
      const content = atob(response.data.content);
      const json = JSON.parse(decodeURIComponent(escape(content))); // Handle UTF-8
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
    
    // 1. Get current SHA (if file exists) to allow update
    let sha: string | undefined;
    try {
      const { data: currentFile } = await octokit.repos.getContent({
        owner: config.owner,
        repo: config.repo,
        path: config.path,
      });
      if (!Array.isArray(currentFile) && 'sha' in currentFile) {
        sha = currentFile.sha;
      }
    } catch (e) {
      // File might not exist yet, which is fine for 'create'
    }

    // 2. Encode content
    const content = unescape(encodeURIComponent(JSON.stringify(data, null, 2))); // Handle UTF-8
    const base64Content = btoa(content);

    // 3. Update/Create
    await octokit.repos.createOrUpdateFileContents({
      owner: config.owner,
      repo: config.repo,
      path: config.path,
      message,
      content: base64Content,
      sha,
    });

    return true;
  } catch (error) {
    console.error("Failed to save to GitHub:", error);
    throw error;
  }
}
