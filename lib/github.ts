import { Octokit } from "@octokit/rest";
import { DataSchema } from "./types";

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
      const json = JSON.parse(decodeURIComponent(escape(content))); 
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


    const content = unescape(encodeURIComponent(JSON.stringify(data, null, 2))); 
    const base64Content = btoa(content);

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