// 树遍历工具 — 消除重复的递归遍历
// 支持自定义 children 访问器，适配 Category['links'] 和 LinkItem['children'] 两种结构

type ChildrenAccessor<T> = (item: T) => T[] | undefined;

const defaultGetChildren = (item: Record<string, unknown>): unknown[] | undefined => {
	const children = item.children;
	return Array.isArray(children) ? children : undefined;
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

/** 深拷贝（用于 React setState 不可变更新）*/
export function deepClone<T>(data: T): T {
  return JSON.parse(JSON.stringify(data));
}
