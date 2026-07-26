/**
 * 数据合并工具（纯函数，无 React 依赖）
 */
import type { Category } from '../types/types';

/**
 * 合并两个数组。
 *
 * 相同 id 两边都有 → 按 updatedAt 取较新版本（相同则可选 nestedMergeFn）。
 *
 * 本地有、远程没有的条目如何处理取决于 `baseIds`（上次成功同步时的 id 集合）：
 *   - 不传 baseIds（无同步基线）→ 沿用旧行为：信任远程，丢弃本地独有项。
 *   - 传 baseIds → 三方合并：
 *       · 基线里也有该 id → 说明远程把它删了 → 丢弃；
 *       · 基线里没有该 id → 说明是本地新增（尚未同步）→ 保留，避免离线新增被覆盖丢失。
 */
export function mergeItems<T extends { id: string; updatedAt?: number }>(
  remoteItems: T[] = [],
  localItems: T[] = [],
  nestedMergeFn?: (remoteItem: T, localItem: T) => T,
  baseIds?: Set<string>
): T[] {
  const merged = [...remoteItems];
  const remoteMap = new Map(remoteItems.map(i => [i.id, i]));

  for (const localItem of localItems) {
    const remoteItem = remoteMap.get(localItem.id);
    if (remoteItem) {
      // 两边都有 → 按 updatedAt 取新版本
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
    } else if (baseIds && !baseIds.has(localItem.id)) {
      // 本地有、远程没有、且不在上次同步基线中 → 本地新增，保留
      merged.push(localItem);
    }
    // 否则：本地有、远程没有、但基线里有 → 远程已删除，丢弃
  }
  return merged;
}

/** 收集一层链接的 id（顶层即可：文件夹整体按 updatedAt 替换，无需展开子项）。 */
function topLevelIds(cats: Category[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const c of cats) {
    map.set(c.id, new Set((c.links || []).map(l => l.id)));
  }
  return map;
}

/**
 * 合并分类（包含分类内的链接合并）。
 * `base` 为上次成功同步的分类快照，用于区分"远程删除"与"本地新增"。
 */
export function mergeCategories(
  remoteCats: Category[],
  localCats: Category[],
  base?: Category[]
): Category[] {
  const baseCatIds = base ? new Set(base.map(c => c.id)) : undefined;
  const baseLinkIds = base ? topLevelIds(base) : undefined;

  const mergeCategoryLinks = (remoteCat: Category, localCat: Category): Category => {
    const mergedLinks = mergeItems(
      remoteCat.links,
      localCat.links,
      undefined,
      baseLinkIds?.get(remoteCat.id)
    );
    return { ...remoteCat, links: mergedLinks };
  };

  return mergeItems(remoteCats, localCats, mergeCategoryLinks, baseCatIds);
}
