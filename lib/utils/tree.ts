// 树遍历工具 — 消除重复的递归遍历
// 支持自定义 children 访问器，适配 Category['links'] 和 LinkItem['children'] 两种结构

type ChildrenAccessor<T> = (item: T) => T[] | undefined;

const defaultGetChildren = <T,>(item: T): T[] | undefined => {
	const children = (item as Record<string, unknown>).children;
	return Array.isArray(children) ? (children as T[]) : undefined;
};

/** 在树中查找首个匹配 predicate 的节点 */
export function findNode<T>(
  items: T[],
  predicate: (item: T) => boolean,
  getChildren: ChildrenAccessor<T> = defaultGetChildren,
): T | undefined {
  for (const item of items) {
    if (predicate(item)) return item;
    const children = getChildren(item);
    if (children) {
      const found = findNode(children as T[], predicate, getChildren);
      if (found) return found;
    }
  }
  return undefined;
}

/** 在树中查找包含匹配节点的父节点 */
export function findParent<T>(
  items: T[],
  predicate: (item: T) => boolean,
  getChildren: ChildrenAccessor<T> = defaultGetChildren,
): { parent: T; list: T[] } | null {
  for (const item of items) {
    const children = getChildren(item);
    if (children) {
      if (children.some(predicate)) return { parent: item, list: children };
      const found = findParent(children as T[], predicate, getChildren);
      if (found) return found;
    }
  }
  return null;
}

/** 从树中移除匹配 predicate 的节点，返回新数组（不修改原数组） */
export function removeNode<T>(
  items: T[],
  predicate: (item: T) => boolean,
  getChildren: ChildrenAccessor<T> = defaultGetChildren,
): T[] {
  return items.filter((item) => !predicate(item)).map((item) => {
    const children = getChildren(item);
    if (children) {
      return { ...item, children: removeNode(children as T[], predicate, getChildren) };
    }
    return item;
  });
}

/** 遍历树，对每个节点执行回调 */
export function traverseTree<T>(
  items: T[],
  callback: (item: T, parent: T | null) => void,
  getChildren: ChildrenAccessor<T> = defaultGetChildren,
  parent: T | null = null,
): void {
  for (const item of items) {
    callback(item, parent);
    const children = getChildren(item);
    if (children) traverseTree(children as T[], callback, getChildren, item);
  }
}

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

/** 从树中找到包含指定 id 的父节点 */
export function findParentInTree<T>(
  items: T[],
  id: string,
  getChildren: (item: T) => T[] | undefined,
): T | undefined {
  for (const item of items) {
    const children = getChildren(item);
    if (children) {
      if (children.some((c) => (c as any).id === id)) return item;
      const found = findParentInTree(children, id, getChildren);
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

/** 递归重新设置某节点的子节点 */
export function setChildrenInTree<T>(
  items: T[],
  id: string,
  newChildren: T[],
  getChildren: (item: T) => T[] | undefined,
  setChildren: (item: T, children: T[]) => void,
): boolean {
  for (const item of items) {
    if ((item as any).id === id) {
      setChildren(item, newChildren);
      return true;
    }
    const children = getChildren(item);
    if (children && setChildrenInTree(children, id, newChildren, getChildren, setChildren)) {
      return true;
    }
  }
  return false;
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
