/**
 * 登出时的敏感本地数据清理。
 *
 * 这些 localStorage 键分散在多个模块（use-nav-data / ai-panel），
 * 共享浏览器场景下登出（无论从首页还是 /admin）都应整体清除，
 * 防止下一位使用者读取上一会话的明文笔记/待办/AI 对话。
 */
const SENSITIVE_KEYS = [
  "clean-nav-local-data", // 本地数据缓存（use-nav-data）
  "clean-nav-sync-data", // 云同步三方合并基线（use-nav-data）
  "clean-nav-ai-conversations", // AI 对话历史（ai-panel）
] as const;

export function clearSensitiveLocalData(): void {
  for (const key of SENSITIVE_KEYS) {
    localStorage.removeItem(key);
  }
}
