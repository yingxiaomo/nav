/**
 * 数据合并工具（纯函数，无 React 依赖）
 */
import type { Category, LinkItem, Todo, Note } from '../types/types';

/**
 * 合并两个数组：远程优先，本地有但远程没有的不补回
 */
export function mergeItems<T extends { id: string; updatedAt?: number }>(
  remoteItems: T[] = [],
  localItems: T[] = [],
  nestedMergeFn?: (remoteItem: T, localItem: T) => T
): T[] {
  const merged = [...remoteItems];
  const remoteMap = new Map(remoteItems.map(i => [i.id, i]));

  // 本地有、远程也有 → 按 updatedAt 取新版本
  for (const localItem of localItems) {
    const remoteItem = remoteMap.get(localItem.id);
    if (remoteItem) {
      const localTime = localItem.updatedAt || 0;
      const remoteTime = remoteItem.updatedAt || 0;

      let updatedItem = remoteItem;
      if (localTime > remoteTime) {
        updatedItem = localItem;
      } else if (nestedMergeFn) {
        updatedItem = nestedMergeFn(remoteItem, localItem);
      }

      const index = merged.findIndex(i => i.id === localItem.id);
      if (index !== -1) {
        merged[index] = updatedItem;
      }
    }
    // 本地有、远程没有 → 信任远程，不补回（后端删了就是删了）
  }
  return merged;
}

/**
 * 合并分类（包含分类内的链接合并）
 */
export function mergeCategories(
  remoteCats: Category[],
  localCats: Category[]
): Category[] {
  const mergeCategoryLinks = (remoteCat: Category, localCat: Category): Category => {
    const mergedLinks = mergeItems(remoteCat.links, localCat.links);
    return { ...remoteCat, links: mergedLinks };
  };

  return mergeItems(remoteCats, localCats, mergeCategoryLinks);
}
