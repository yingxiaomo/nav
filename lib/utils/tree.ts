/**
 * 树形结构工具函数
 */

/**
 * 将数组转换为树形结构
 */
export const arrayToTree = <T extends Record<string, unknown>>(
  array: T[],
  idKey: string = 'id',
  parentIdKey: string = 'parentId',
  childrenKey: string = 'children'
): (T & Record<string, T[]>)[] => {
  const map = new Map<unknown, T & Record<string, T[]>>();
  const result: (T & Record<string, T[]>)[] = [];
  for (const item of array) {
    map.set(item[idKey], { ...item, [childrenKey]: [] });
  }
  for (const item of array) {
    const current = map.get(item[idKey]);
    if (item[parentIdKey]) {
      const parent = map.get(item[parentIdKey]);
      if (parent && current) {
        parent[childrenKey].push(current);
      }
    } else if (current) {
      result.push(current);
    }
  }
  return result;
};

/**
 * 将树形结构转换为数组
 */
export const treeToArray = <T extends Record<string, unknown>>(
  tree: T[],
  childrenKey: string = 'children'
): Omit<T, string>[] => {
  const result: Omit<T, string>[] = [];
  const traverse = (node: T) => {
    const { [childrenKey]: children, ...rest } = node;
    result.push(rest as Omit<T, string>);
    if (children && Array.isArray(children) && children.length > 0) {
      for (const child of children) {
        traverse(child as T);
      }
    }
  };
  for (const node of tree) {
    traverse(node);
  }
  return result;
};

/**
 * 遍历树形结构
 */
export const traverseTree = <T extends Record<string, unknown>>(
  tree: T[],
  callback: (node: T, level: number) => void,
  childrenKey: string = 'children',
  level: number = 0
): void => {
  for (const node of tree) {
    callback(node, level);
    const children = node[childrenKey];
    if (children && Array.isArray(children) && children.length > 0) {
      traverseTree(children as T[], callback, childrenKey, level + 1);
    }
  }
};

/**
 * 查找树形结构中的节点
 */
export const findInTree = <T extends Record<string, unknown>>(
  tree: T[],
  condition: (node: T) => boolean,
  childrenKey: string = 'children'
): T | undefined => {
  for (const node of tree) {
    if (condition(node)) return node;
    const children = node[childrenKey];
    if (children && Array.isArray(children) && children.length > 0) {
      const result = findInTree(children as T[], condition, childrenKey);
      if (result) return result;
    }
  }
  return undefined;
};

/**
 * 更新树形结构中的节点
 */
export const updateInTree = <T extends Record<string, unknown>>(
  tree: T[],
  condition: (node: T) => boolean,
  update: (node: T) => T,
  childrenKey: string = 'children'
): T[] => {
  return tree.map(node => {
    const children = (node[childrenKey] as T[]) || [];
    if (condition(node)) {
      return { ...update(node), [childrenKey]: updateInTree(children, condition, update, childrenKey) };
    }
    return { ...node, [childrenKey]: updateInTree(children, condition, update, childrenKey) };
  });
};

/**
 * 删除树形结构中的节点
 */
export const deleteInTree = <T extends Record<string, unknown>>(
  tree: T[],
  condition: (node: T) => boolean,
  childrenKey: string = 'children'
): T[] => {
  return tree
    .filter(node => !condition(node))
    .map(node => ({
      ...node,
      [childrenKey]: deleteInTree((node[childrenKey] as T[]) || [], condition, childrenKey)
    }));
};
