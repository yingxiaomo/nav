import { describe, it, expect } from "vitest";
import {
  cn,
  isValidUrl,
  normalizeUrl,
  extractHostname,
  extractSiteName,
  generateId,
  generateTempId,
  isTempId,
  formatDateTime,
  formatDate,
  formatTime,
  deepCopy,
  mergeObjects,
  debounce,
  throttle,
  generateFaviconUrl,
  getFileExtension,
  isImageFile,
  formatFileSize,
  removeEmptyValues,
  isEmptyObject,
  capitalize,
  toCamelCase,
  toSnakeCase,
  toKebabCase,
  generateRandomColor,
  generateRandomBackgroundColor,
  generateContrastColor,
  getSafe,
  setSafe,
  removeFromArray,
  findInArray,
  findIndexInArray,
  updateInArray,
  replaceInArray,
  containsInArray,
  countInArray,
  sortArray,
  uniqueArray,
  shuffleArray,
  paginateArray,
} from "../common";

// ---------------------------------------------------------------------------
// cn（样式合并）
// ---------------------------------------------------------------------------
describe("cn", () => {
  it("应合并 class 字符串", () => {
    expect(cn("px-4", "py-2")).toContain("px-4");
    expect(cn("px-4", "py-2")).toContain("py-2");
  });

  it("应处理条件 class", () => {
    expect(cn("base", false && "hidden")).toBe("base");
    expect(cn("base", true && "visible")).toContain("visible");
  });

  it("应合并 Tailwind 冲突 class", () => {
    // twMerge 应保留最后一个
    const result = cn("px-4", "px-6");
    expect(result).toBe("px-6");
  });
});

// ---------------------------------------------------------------------------
// isValidUrl
// ---------------------------------------------------------------------------
describe("isValidUrl", () => {
  it("应识别合法 URL", () => {
    expect(isValidUrl("https://example.com")).toBe(true);
    expect(isValidUrl("http://localhost:3000/api")).toBe(true);
  });

  it("应拒绝非法输入", () => {
    expect(isValidUrl("")).toBe(false);
    expect(isValidUrl("not-a-url")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// normalizeUrl
// ---------------------------------------------------------------------------
describe("normalizeUrl", () => {
  it("应为主机名添加 https://", () => {
    expect(normalizeUrl("example.com")).toBe("https://example.com");
  });

  it("不应修改已有协议的 URL", () => {
    expect(normalizeUrl("http://example.com")).toBe("http://example.com");
    expect(normalizeUrl("https://example.com")).toBe("https://example.com");
  });

  it("应对空字符串返回空", () => {
    expect(normalizeUrl("")).toBe("");
  });
});

// ---------------------------------------------------------------------------
// extractHostname / extractSiteName
// ---------------------------------------------------------------------------
describe("extractHostname", () => {
  it("应从 URL 中提取主机名", () => {
    expect(extractHostname("https://www.example.com/path")).toBe("www.example.com");
  });

  it("应对非法 URL 返回空", () => {
    expect(extractHostname("")).toBe("");
  });
});

describe("extractSiteName", () => {
  it("应从 URL 中提取站点名称", () => {
    expect(extractSiteName("https://github.com")).toBe("github");
  });

  it("应去除 www 前缀", () => {
    expect(extractSiteName("https://www.google.com")).toBe("google");
  });
});

// ---------------------------------------------------------------------------
// generateId / generateTempId / isTempId
// ---------------------------------------------------------------------------
describe("generateId", () => {
  it("应生成非空字符串", () => {
    expect(generateId()).toBeTruthy();
  });

  it("应生成包含时间戳 base36 前缀的 ID", () => {
    const id = generateId();
    // 格式：时间戳36进制 + 随机字符串
    expect(id.length).toBeGreaterThan(8);
  });
});

describe("generateTempId / isTempId", () => {
  it("generateTempId 应以 temp- 开头", () => {
    expect(generateTempId()).toMatch(/^temp-/);
  });

  it("isTempId 应正确识别临时 ID", () => {
    expect(isTempId("temp-abc123")).toBe(true);
    expect(isTempId("perm-abc")).toBe(false);
    expect(isTempId("")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 日期格式化
// ---------------------------------------------------------------------------
describe("formatDateTime / formatDate / formatTime", () => {
  const ts = new Date(2026, 0, 15, 14, 30, 45).getTime();

  it("formatDateTime 应返回中文日期时间格式", () => {
    const result = formatDateTime(ts);
    expect(result).toContain("2026");
    expect(result).toContain("01");
  });

  it("formatDate 应返回中文日期格式", () => {
    const result = formatDate(ts);
    expect(result).toContain("2026");
  });

  it("formatTime 应返回中文时间格式", () => {
    const result = formatTime(ts);
    expect(result).toContain("14");
    expect(result).toContain("30");
  });
});

// ---------------------------------------------------------------------------
// deepCopy
// ---------------------------------------------------------------------------
describe("deepCopy", () => {
  it("应深拷贝对象", () => {
    const original = { a: 1, b: { c: 2 } };
    const copy = deepCopy(original);
    expect(copy).toEqual(original);
    expect(copy).not.toBe(original);
    expect(copy.b).not.toBe(original.b);
  });

  it("应拷贝数组", () => {
    const arr = [1, [2, 3]];
    const copy = deepCopy(arr);
    expect(copy).toEqual(arr);
    expect(copy[1]).not.toBe(arr[1]);
  });
});

// ---------------------------------------------------------------------------
// mergeObjects
// ---------------------------------------------------------------------------
describe("mergeObjects", () => {
  it("应合并两个对象，新值覆盖旧值", () => {
    const result = mergeObjects({ a: 1, b: 2 }, { b: 3, c: 4 });
    expect(result).toEqual({ a: 1, b: 3, c: 4 });
  });
});

// ---------------------------------------------------------------------------
// debounce / throttle
// ---------------------------------------------------------------------------
describe("debounce", () => {
  it("应在延迟后执行函数", async () => {
    let count = 0;
    const fn = debounce(() => { count++; }, 50);
    fn();
    fn();
    fn();
    expect(count).toBe(0); // 尚未执行
    await new Promise((r) => setTimeout(r, 100));
    expect(count).toBe(1); // 只执行最后一次
  });
});

describe("throttle", () => {
  it("应在限制时间内只执行一次", async () => {
    let count = 0;
    const fn = throttle(() => { count++; }, 50);
    fn();
    fn();
    fn();
    expect(count).toBe(1); // 第一次立即执行
    await new Promise((r) => setTimeout(r, 60));
    fn();
    expect(count).toBe(2); // 限制时间后再次执行
  });
});

// ---------------------------------------------------------------------------
// generateFaviconUrl
// ---------------------------------------------------------------------------
describe("generateFaviconUrl", () => {
  it("应为域名生成 Google Favicon URL", () => {
    const url = generateFaviconUrl("github.com");
    expect(url).toContain("google.com/s2/favicons");
    expect(url).toContain("domain=github.com");
  });

  it("应对空输入返回空", () => {
    expect(generateFaviconUrl("")).toBe("");
  });
});

// ---------------------------------------------------------------------------
// getFileExtension / isImageFile
// ---------------------------------------------------------------------------
describe("getFileExtension", () => {
  it("应提取文件扩展名", () => {
    expect(getFileExtension("photo.jpg")).toBe("jpg");
    expect(getFileExtension("archive.tar.gz")).toBe("gz");
  });

  it("应对无扩展名的文件返回空", () => {
    expect(getFileExtension("README")).toBe("");
  });
});

describe("isImageFile", () => {
  it("应识别常见图片扩展名", () => {
    expect(isImageFile("photo.jpg")).toBe(true);
    expect(isImageFile("photo.jpeg")).toBe(true);
    expect(isImageFile("photo.png")).toBe(true);
    expect(isImageFile("photo.gif")).toBe(true);
    expect(isImageFile("photo.webp")).toBe(true);
    expect(isImageFile("photo.svg")).toBe(true);
  });

  it("应拒绝非图片文件", () => {
    expect(isImageFile("document.pdf")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// formatFileSize
// ---------------------------------------------------------------------------
describe("formatFileSize", () => {
  it("应格式化字节数", () => {
    expect(formatFileSize(0)).toBe("0 Bytes");
    expect(formatFileSize(1024)).toBe("1 KB");
    expect(formatFileSize(1048576)).toBe("1 MB");
  });
});

// ---------------------------------------------------------------------------
// removeEmptyValues / isEmptyObject
// ---------------------------------------------------------------------------
describe("removeEmptyValues", () => {
  it("应移除 null/undefined/空字符串属性", () => {
    const result = removeEmptyValues({ a: 1, b: null, c: undefined, d: "", e: "ok" });
    expect(result).toEqual({ a: 1, e: "ok" });
  });
});

describe("isEmptyObject", () => {
  it("应判断空对象", () => {
    expect(isEmptyObject({})).toBe(true);
    expect(isEmptyObject({ a: 1 })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// capitalize / toCamelCase / toSnakeCase / toKebabCase
// ---------------------------------------------------------------------------
describe("capitalize", () => {
  it("应将首字母大写", () => {
    expect(capitalize("hello")).toBe("Hello");
  });
});

describe("toCamelCase", () => {
  it("应将连字符格式转为驼峰", () => {
    expect(toCamelCase("hello-world")).toBe("helloWorld");
  });
});

describe("toSnakeCase", () => {
  it("应将驼峰转为蛇形", () => {
    expect(toSnakeCase("helloWorld")).toBe("hello_world");
  });
});

describe("toKebabCase", () => {
  it("应将驼峰转为连字符格式", () => {
    expect(toKebabCase("helloWorld")).toBe("hello-world");
  });
});

// ---------------------------------------------------------------------------
// 颜色工具
// ---------------------------------------------------------------------------
describe("generateRandomColor", () => {
  it("应生成 7 位十六进制颜色", () => {
    expect(generateRandomColor()).toMatch(/^#[0-9A-F]{6}$/);
  });
});

describe("generateContrastColor", () => {
  it("应对浅色背景返回深色文字", () => {
    expect(generateContrastColor("rgb(200, 200, 200)")).toBe("#000000");
  });

  it("应对深色背景返回浅色文字", () => {
    expect(generateContrastColor("rgb(50, 50, 50)")).toBe("#ffffff");
  });
});

// ---------------------------------------------------------------------------
// getSafe / setSafe
// ---------------------------------------------------------------------------
describe("getSafe", () => {
  it("应安全获取嵌套属性", () => {
    const obj = { a: { b: { c: 42 } } };
    expect(getSafe(obj, "a.b.c")).toBe(42);
  });

  it("应在路径不存在时返回默认值", () => {
    expect(getSafe({}, "a.b", "default")).toBe("default");
  });
});

describe("setSafe", () => {
  it("应设置嵌套属性并返回新对象", () => {
    const result = setSafe({ a: { b: 1 } }, "a.c", 2);
    expect(result.a).toEqual({ b: 1, c: 2 });
  });
});

// ---------------------------------------------------------------------------
// 数组操作
// ---------------------------------------------------------------------------
describe("removeFromArray", () => {
  it("应移除符合条件的元素", () => {
    expect(removeFromArray([1, 2, 3, 4], (n) => n % 2 === 0)).toEqual([1, 3]);
  });
});

describe("findInArray", () => {
  it("应找到第一个匹配元素", () => {
    expect(findInArray([1, 2, 3], (n) => n > 1)).toBe(2);
  });
});

describe("findIndexInArray", () => {
  it("应返回第一个匹配元素的索引", () => {
    expect(findIndexInArray([1, 2, 3], (n) => n > 1)).toBe(1);
  });
});

describe("updateInArray", () => {
  it("应更新匹配元素", () => {
    const result = updateInArray([1, 2, 3], (n) => n % 2 === 0, (n) => n * 10);
    expect(result).toEqual([1, 20, 3]);
  });
});

describe("replaceInArray", () => {
  it("应替换匹配元素", () => {
    const result = replaceInArray([1, 2, 3], (n) => n === 2, 99);
    expect(result).toEqual([1, 99, 3]);
  });
});

describe("containsInArray", () => {
  it("应判断是否包含匹配元素", () => {
    expect(containsInArray([1, 2, 3], (n) => n === 2)).toBe(true);
    expect(containsInArray([1, 2, 3], (n) => n === 5)).toBe(false);
  });
});

describe("countInArray", () => {
  it("应统计匹配元素数量", () => {
    expect(countInArray([1, 2, 3, 4, 5], (n) => n > 2)).toBe(3);
  });
});

describe("sortArray", () => {
  it("应返回排序后的新数组（不修改原数组）", () => {
    const arr = [3, 1, 2];
    const sorted = sortArray(arr, (a, b) => a - b);
    expect(sorted).toEqual([1, 2, 3]);
    expect(arr).toEqual([3, 1, 2]); // 原数组不变
  });
});

describe("uniqueArray", () => {
  it("应基于指定 key 去重", () => {
    const arr = [{ id: 1 }, { id: 2 }, { id: 1 }];
    expect(uniqueArray(arr, "id")).toEqual([{ id: 1 }, { id: 2 }]);
  });
});

describe("shuffleArray", () => {
  it("应返回包含相同元素的新数组", () => {
    const arr = [1, 2, 3, 4, 5];
    const shuffled = shuffleArray(arr);
    expect(shuffled.sort()).toEqual([1, 2, 3, 4, 5]);
    expect(shuffled).not.toBe(arr); // 新数组
  });
});

describe("paginateArray", () => {
  it("应正确分页", () => {
    const arr = [1, 2, 3, 4, 5, 6];
    expect(paginateArray(arr, 1, 2)).toEqual([1, 2]);
    expect(paginateArray(arr, 2, 2)).toEqual([3, 4]);
    expect(paginateArray(arr, 3, 2)).toEqual([5, 6]);
  });

  it("应正确处理超出范围的页码", () => {
    expect(paginateArray([1, 2], 5, 10)).toEqual([]);
  });
});
