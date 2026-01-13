// 通用工具函数模块

/**
 * 验证URL格式是否正确
 * @param url 要验证的URL字符串
 * @returns 布尔值，表示URL格式是否正确
 */
export const isValidUrl = (url: string): boolean => {
  if (!url) return false;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * 处理URL，确保其包含协议
 * @param url 要处理的URL字符串
 * @returns 处理后的URL字符串，确保包含协议
 */
export const normalizeUrl = (url: string): string => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  return `https://${url}`;
};

/**
 * 从URL中提取主机名
 * @param url URL字符串
 * @returns 提取的主机名
 */
export const extractHostname = (url: string): string => {
  if (!url) return '';
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return '';
  }
};

/**
 * 从URL中提取网站名称
 * @param url URL字符串
 * @returns 提取的网站名称
 */
export const extractSiteName = (url: string): string => {
  if (!url) return '';
  const hostname = extractHostname(url);
  return hostname.replace(/^www\./, '').split('.')[0] || '';
};

/**
 * 生成随机ID
 * @returns 随机ID字符串
 */
export const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
};

/**
 * 格式化日期时间
 * @param date 日期对象或时间戳
 * @returns 格式化的日期时间字符串
 */
export const formatDateTime = (date: Date | number): string => {
  const d = typeof date === 'number' ? new Date(date) : date;
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

/**
 * 格式化日期
 * @param date 日期对象或时间戳
 * @returns 格式化的日期字符串
 */
export const formatDate = (date: Date | number): string => {
  const d = typeof date === 'number' ? new Date(date) : date;
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
};

/**
 * 格式化时间
 * @param date 日期对象或时间戳
 * @returns 格式化的时间字符串
 */
export const formatTime = (date: Date | number): string => {
  const d = typeof date === 'number' ? new Date(date) : date;
  return d.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

/**
 * 深拷贝对象
 * @param obj 要拷贝的对象
 * @returns 拷贝后的对象
 */
export const deepCopy = <T>(obj: T): T => {
  return JSON.parse(JSON.stringify(obj));
};

/**
 * 合并两个对象，优先使用新对象的值
 * @param oldObj 旧对象
 * @param newObj 新对象
 * @returns 合并后的对象
 */
export const mergeObjects = <T>(oldObj: T, newObj: Partial<T>): T => {
  return { ...oldObj, ...newObj };
};

/**
 * 防抖函数
 * @param func 要防抖的函数
 * @param delay 延迟时间，单位毫秒
 * @returns 防抖处理后的函数
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

/**
 * 节流函数
 * @param func 要节流的函数
 * @param limit 时间限制，单位毫秒
 * @returns 节流处理后的函数
 */
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

/**
 * 生成Google favicon URL
 * @param domain 域名
 * @returns Google favicon URL
 */
export const generateFaviconUrl = (domain: string): string => {
  if (!domain) return '';
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
};

/**
 * 获取文件扩展名
 * @param filename 文件名
 * @returns 文件扩展名
 */
export const getFileExtension = (filename: string): string => {
  if (!filename) return '';
  const lastDotIndex = filename.lastIndexOf('.');
  if (lastDotIndex === -1 || lastDotIndex === filename.length - 1) {
    return '';
  }
  return filename.substring(lastDotIndex + 1).toLowerCase();
};

/**
 * 检查文件是否为图片类型
 * @param filename 文件名
 * @returns 布尔值，表示文件是否为图片类型
 */
export const isImageFile = (filename: string): boolean => {
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'];
  const extension = getFileExtension(filename);
  return imageExtensions.includes(extension);
};

/**
 * 生成随机颜色
 * @returns 随机颜色的十六进制字符串
 */
export const generateRandomColor = (): string => {
  const letters = '0123456789ABCDEF';
  let color = '#';
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
};

/**
 * 生成随机背景颜色
 * @returns 随机背景颜色的十六进制字符串
 */
export const generateRandomBackgroundColor = (): string => {
  // 生成较浅的随机颜色
  const r = Math.floor(Math.random() * 150) + 100;
  const g = Math.floor(Math.random() * 150) + 100;
  const b = Math.floor(Math.random() * 150) + 100;
  return `rgb(${r}, ${g}, ${b})`;
};

/**
 * 生成随机前景颜色（与背景颜色形成对比）
 * @param backgroundColor 背景颜色的十六进制字符串
 * @returns 随机前景颜色的十六进制字符串，与背景颜色形成对比
 */
export const generateContrastColor = (backgroundColor: string): string => {
  // 提取RGB值
  const match = backgroundColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (!match) return '#000000';
  
  const r = parseInt(match[1]);
  const g = parseInt(match[2]);
  const b = parseInt(match[3]);
  
  // 计算亮度
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  
  // 返回对比色
  return brightness > 128 ? '#000000' : '#ffffff';
};

/**
 * 格式化文件大小
 * @param bytes 文件大小，单位字节
 * @returns 格式化后的文件大小字符串
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * 从对象中删除空值属性
 * @param obj 要处理的对象
 * @returns 处理后的对象，不包含空值属性
 */
export const removeEmptyValues = <T extends Record<string, any>>(obj: T): Partial<T> => {
  const result = { ...obj };
  for (const key in result) {
    if (result[key] === null || result[key] === undefined || result[key] === '') {
      delete result[key];
    }
  }
  return result;
};

/**
 * 检查对象是否为空
 * @param obj 要检查的对象
 * @returns 布尔值，表示对象是否为空
 */
export const isEmptyObject = (obj: Record<string, any>): boolean => {
  return Object.keys(obj).length === 0;
};

/**
 * 将字符串首字母大写
 * @param str 要处理的字符串
 * @returns 首字母大写的字符串
 */
export const capitalize = (str: string): string => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
};

/**
 * 将字符串转换为驼峰命名
 * @param str 要处理的字符串
 * @returns 驼峰命名的字符串
 */
export const toCamelCase = (str: string): string => {
  if (!str) return '';
  return str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
};

/**
 * 将字符串转换为蛇形命名
 * @param str 要处理的字符串
 * @returns 蛇形命名的字符串
 */
export const toSnakeCase = (str: string): string => {
  if (!str) return '';
  return str.replace(/([A-Z])/g, '_$1').toLowerCase();
};

/**
 * 将字符串转换为连字符命名
 * @param str 要处理的字符串
 * @returns 连字符命名的字符串
 */
export const toKebabCase = (str: string): string => {
  if (!str) return '';
  return str.replace(/([A-Z])/g, '-$1').toLowerCase();
};

/**
 * 生成唯一的临时ID
 * @returns 唯一的临时ID字符串
 */
export const generateTempId = (): string => {
  return `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

/**
 * 检查ID是否为临时ID
 * @param id 要检查的ID字符串
 * @returns 布尔值，表示ID是否为临时ID
 */
export const isTempId = (id: string): boolean => {
  return id.startsWith('temp-');
};

/**
 * 安全获取对象属性
 * @param obj 要获取属性的对象
 * @param path 属性路径
 * @param defaultValue 默认值
 * @returns 属性值或默认值
 */
export const getSafe = <T>(obj: any, path: string, defaultValue?: T): T | undefined => {
  if (!obj || typeof obj !== 'object') return defaultValue;
  
  const keys = path.split('.');
  let result = obj;
  
  for (const key of keys) {
    if (result === null || result === undefined) return defaultValue;
    result = result[key];
  }
  
  return result === undefined ? defaultValue : result;
};

/**
 * 安全设置对象属性
 * @param obj 要设置属性的对象
 * @param path 属性路径
 * @param value 属性值
 * @returns 更新后的对象
 */
export const setSafe = (obj: Record<string, any>, path: string, value: any): Record<string, any> => {
  if (!obj || typeof obj !== 'object') return obj;
  
  const keys = path.split('.');
  const result = { ...obj };
  let current = result;
  
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!current[key] || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current[key] = { ...current[key] };
    current = current[key] as Record<string, any>;
  }
  
  current[keys[keys.length - 1]] = value;
  return result;
};

/**
 * 从数组中移除指定元素
 * @param array 要处理的数组
 * @param condition 移除条件
 * @returns 处理后的数组
 */
export const removeFromArray = <T>(array: T[], condition: (item: T) => boolean): T[] => {
  return array.filter(item => !condition(item));
};

/**
 * 查找数组中符合条件的元素
 * @param array 要查找的数组
 * @param condition 查找条件
 * @returns 符合条件的元素或undefined
 */
export const findInArray = <T>(array: T[], condition: (item: T) => boolean): T | undefined => {
  return array.find(item => condition(item));
};

/**
 * 查找数组中符合条件的元素的索引
 * @param array 要查找的数组
 * @param condition 查找条件
 * @returns 符合条件的元素的索引或-1
 */
export const findIndexInArray = <T>(array: T[], condition: (item: T) => boolean): number => {
  return array.findIndex(item => condition(item));
};

/**
 * 更新数组中符合条件的元素
 * @param array 要更新的数组
 * @param condition 更新条件
 * @param update 更新函数
 * @returns 更新后的数组
 */
export const updateInArray = <T>(array: T[], condition: (item: T) => boolean, update: (item: T) => T): T[] => {
  return array.map(item => {
    if (condition(item)) {
      return update(item);
    }
    return item;
  });
};

/**
 * 替换数组中符合条件的元素
 * @param array 要替换的数组
 * @param condition 替换条件
 * @param replacement 替换元素
 * @returns 替换后的数组
 */
export const replaceInArray = <T>(array: T[], condition: (item: T) => boolean, replacement: T): T[] => {
  return array.map(item => {
    if (condition(item)) {
      return replacement;
    }
    return item;
  });
};

/**
 * 检查数组是否包含符合条件的元素
 * @param array 要检查的数组
 * @param condition 检查条件
 * @returns 布尔值，表示数组是否包含符合条件的元素
 */
export const containsInArray = <T>(array: T[], condition: (item: T) => boolean): boolean => {
  return array.some(item => condition(item));
};

/**
 * 计算数组中符合条件的元素数量
 * @param array 要计算的数组
 * @param condition 计算条件
 * @returns 符合条件的元素数量
 */
export const countInArray = <T>(array: T[], condition: (item: T) => boolean): number => {
  return array.filter(item => condition(item)).length;
};

/**
 * 对数组进行排序
 * @param array 要排序的数组
 * @param compare 比较函数
 * @returns 排序后的数组
 */
export const sortArray = <T>(array: T[], compare: (a: T, b: T) => number): T[] => {
  return [...array].sort(compare);
};

/**
 * 对数组进行分组
 * @param array 要分组的数组
 * @param key 分组键
 * @returns 分组后的对象
 */
export const groupArray = <T, K extends string | number>(array: T[], key: (item: T) => K): Record<K, T[]> => {
  return array.reduce((result, item) => {
    const groupKey = key(item);
    if (!result[groupKey]) {
      result[groupKey] = [];
    }
    result[groupKey].push(item);
    return result;
  }, {} as Record<K, T[]>);
};

/**
 * 对数组进行去重
 * @param array 要去重的数组
 * @param key 去重键
 * @returns 去重后的数组
 */
export const uniqueArray = <T, K extends keyof T>(array: T[], key: K): T[] => {
  const seen = new Set();
  return array.filter(item => {
    const value = item[key];
    if (seen.has(value)) {
      return false;
    }
    seen.add(value);
    return true;
  });
};

/**
 * 打乱数组顺序
 * @param array 要打乱的数组
 * @returns 打乱后的数组
 */
export const shuffleArray = <T>(array: T[]): T[] => {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

/**
 * 分页获取数组数据
 * @param array 要分页的数组
 * @param page 页码
 * @param pageSize 每页大小
 * @returns 分页后的数据
 */
export const paginateArray = <T>(array: T[], page: number = 1, pageSize: number = 10): T[] => {
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  return array.slice(startIndex, endIndex);
};

/**
 * 将数组转换为树形结构
 * @param array 要转换的数组
 * @param idKey ID键
 * @param parentIdKey 父ID键
 * @param childrenKey 子节点键
 * @returns 树形结构数组
 */
export const arrayToTree = <T extends Record<string, any>>(array: T[], idKey: string = 'id', parentIdKey: string = 'parentId', childrenKey: string = 'children'): T[] => {
  const map = new Map();
  const result: T[] = [];
  
  // 创建映射
  for (const item of array) {
    map.set(item[idKey], { ...item, [childrenKey]: [] });
  }
  
  // 构建树形结构
  for (const item of array) {
    const current = map.get(item[idKey]);
    if (item[parentIdKey]) {
      const parent = map.get(item[parentIdKey]);
      if (parent) {
        parent[childrenKey].push(current);
      }
    } else {
      result.push(current);
    }
  }
  
  return result;
};

/**
 * 将树形结构转换为数组
 * @param tree 要转换的树形结构数组
 * @param childrenKey 子节点键
 * @returns 数组
 */
export const treeToArray = <T extends Record<string, any>>(tree: T[], childrenKey: string = 'children'): T[] => {
  const result: T[] = [];
  
  const traverse = (node: T) => {
    const { [childrenKey]: children, ...rest } = node;
    result.push(rest as T);
    if (children && children.length > 0) {
      for (const child of children) {
        traverse(child);
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
 * @param tree 要遍历的树形结构数组
 * @param callback 回调函数
 * @param childrenKey 子节点键
 */
export const traverseTree = <T extends Record<string, any>>(tree: T[], callback: (node: T, level: number) => void, childrenKey: string = 'children', level: number = 0): void => {
  for (const node of tree) {
    callback(node, level);
    if (node[childrenKey] && node[childrenKey].length > 0) {
      traverseTree(node[childrenKey], callback, childrenKey, level + 1);
    }
  }
};

/**
 * 查找树形结构中的节点
 * @param tree 要查找的树形结构数组
 * @param condition 查找条件
 * @param childrenKey 子节点键
 * @returns 查找结果
 */
export const findInTree = <T extends Record<string, any>>(tree: T[], condition: (node: T) => boolean, childrenKey: string = 'children'): T | undefined => {
  for (const node of tree) {
    if (condition(node)) {
      return node;
    }
    if (node[childrenKey] && node[childrenKey].length > 0) {
      const result = findInTree(node[childrenKey], condition, childrenKey);
      if (result) {
        return result;
      }
    }
  }
  return undefined;
};

/**
 * 更新树形结构中的节点
 * @param tree 要更新的树形结构数组
 * @param condition 更新条件
 * @param update 更新函数
 * @param childrenKey 子节点键
 * @returns 更新后的树形结构数组
 */
export const updateInTree = <T extends Record<string, any>>(tree: T[], condition: (node: T) => boolean, update: (node: T) => T, childrenKey: string = 'children'): T[] => {
  return tree.map(node => {
    if (condition(node)) {
      return { ...update(node), [childrenKey]: updateInTree(node[childrenKey] || [], condition, update, childrenKey) };
    }
    return { ...node, [childrenKey]: updateInTree(node[childrenKey] || [], condition, update, childrenKey) };
  });
};

/**
 * 删除树形结构中的节点
 * @param tree 要删除的树形结构数组
 * @param condition 删除条件
 * @param childrenKey 子节点键
 * @returns 删除后的树形结构数组
 */
export const deleteInTree = <T extends Record<string, any>>(tree: T[], condition: (node: T) => boolean, childrenKey: string = 'children'): T[] => {
  return tree
    .filter(node => !condition(node))
    .map(node => ({
      ...node,
      [childrenKey]: deleteInTree(node[childrenKey] || [], condition, childrenKey)
    }));
};
