// 树遍历工具 — 消除重复的递归遍历
// 支持自定义 children 访问器，适配 Category['links'] 和 LinkItem['children'] 两种结构
/* eslint-disable @typescript-eslint/no-explicit-any */

/** 从树中找到指定 id 的节点 */
export function findNodeInTree<T>(
  items: T[],
  id: string,
  getChildren: (item: T) => T[] | undefined,
): T | undefined {
  for (const item of items) {
    if ((item as any).id === id) return item;
    const children = getChildren(item);
    if (children) {
      const found = findNodeInTree(children, id, getChildren);
      if (found) return found;
    }
  }
  return undefined;
}

/** 从树中删除指定 id 的节点，返回删除的节点 */
export function removeNodeFromTree<T>(
  items: T[],
  id: string,
  getChildren: (item: T) => T[] | undefined,
): T | null {
  for (const item of items) {
    const children = getChildren(item);
    if (children) {
      const idx = children.findIndex((c) => (c as any).id === id);
      if (idx !== -1) {
        const [removed] = children.splice(idx, 1);
        return removed;
      }
      const found = removeNodeFromTree(children, id, getChildren);
      if (found) return found;
    }
  }
  return null;
}

/** 移动到指定目标节点下 */
export function moveNodeToTree<T>(
  items: T[],
  targetId: string,
  node: T,
  getChildren: (item: T) => T[] | undefined,
  setChildren: (item: T, children: T[]) => void,
): boolean {
  for (const item of items) {
    if ((item as any).id === targetId) {
      const children = getChildren(item) || [];
      children.push(node);
      setChildren(item, children);
      return true;
    }
    const children = getChildren(item);
    if (children && moveNodeToTree(children, targetId, node, getChildren, setChildren)) {
      return true;
    }
  }
  return false;
}

/** 收集树中所有节点的 id */
export function getAllIds<T>(
  items: T[],
  getChildren: (item: T) => T[] | undefined,
): string[] {
  const ids: string[] = [];
  const walk = (list: T[]) => {
    for (const item of list) {
      ids.push((item as any).id);
      const children = getChildren(item);
      if (children) walk(children);
    }
  };
  walk(items);
  return ids;
}

/** 从嵌套树中查找指定 id 的完整路径 */
export function findPathInTree<T>(
  items: T[],
  id: string,
  getChildren: (item: T) => T[] | undefined,
  parents: T[] = [],
): T[] | null {
  for (const item of items) {
    if ((item as any).id === id) return [...parents, item];
    const children = getChildren(item);
    if (children) {
      const found = findPathInTree(children, id, getChildren, [...parents, item]);
      if (found) return found;
    }
  }
  return null;
}

/** 深拷贝（用于 React setState 不可变更新）*/
export function deepClone<T>(data: T): T {
  return JSON.parse(JSON.stringify(data));
}
