const STORAGE_KEY = 'clean-nav-bookmark-stats';

interface BookmarkStats {
  [bookmarkId: string]: number;
}

function loadStats(): BookmarkStats {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** 记录书签点击 */
export function recordClick(bookmarkId: string) {
  const stats = loadStats();
  stats[bookmarkId] = (stats[bookmarkId] || 0) + 1;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
}

/** 获取高频书签（排序后取 topN） */
export function getFrequentBookmarks<T extends { id: string }>(items: T[], topN = 8): T[] {
  const stats = loadStats();
  return [...items].sort((a, b) => (stats[b.id] || 0) - (stats[a.id] || 0)).slice(0, topN);
}

/** 获取指定书签的点击次数 */
export function getClickCount(bookmarkId: string): number {
  return loadStats()[bookmarkId] || 0;
}
