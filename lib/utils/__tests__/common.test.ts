import { describe, it, expect } from "vitest";
import {
  cn,
  generateId,
  capitalize,
  deepEqual,
  uint8ArrayToBase64,
  normalizeUrl,
  extractHostname,
  extractSiteName,
  generateFaviconUrl,
  getFileExtension,
  isImageFile,
  formatDateTime,
  formatDate,
  formatTime,
  formatFileSize,
  isPrivateHost,
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
    const result = cn("px-4", "px-6");
    expect(result).toBe("px-6");
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
// generateId
// ---------------------------------------------------------------------------
describe("generateId", () => {
  it("应生成非空 UUID 字符串", () => {
    const id = generateId();
    expect(id).toBeTruthy();
    expect(id.length).toBeGreaterThan(8);
  });
});

// ---------------------------------------------------------------------------
// 日期格式化
// ---------------------------------------------------------------------------
describe("formatDateTime / formatDate / formatTime", () => {
  const ts = new Date(2026, 0, 15, 14, 30, 45).getTime();
  it("formatDateTime 应返回中文日期时间格式", () => {
    expect(formatDateTime(ts)).toContain("2026");
  });
  it("formatDate 应返回中文日期格式", () => {
    expect(formatDate(ts)).toContain("2026");
  });
  it("formatTime 应返回中文时间格式", () => {
    expect(formatTime(ts)).toContain("14");
  });
});

// ---------------------------------------------------------------------------
// deepEqual
// ---------------------------------------------------------------------------
describe("deepEqual", () => {
  it("应深度比较相等的对象", () => {
    expect(deepEqual({ a: 1, b: { c: 2 } }, { a: 1, b: { c: 2 } })).toBe(true);
  });
  it("应检测不等的对象", () => {
    expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false);
  });
  it("应对同一引用返回 true", () => {
    const obj = { a: 1 };
    expect(deepEqual(obj, obj)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// uint8ArrayToBase64
// ---------------------------------------------------------------------------
describe("uint8ArrayToBase64", () => {
  it("应将 Uint8Array 转为 Base64", () => {
    const arr = new Uint8Array([104, 101, 108, 108, 111]); // "hello"
    expect(uint8ArrayToBase64(arr)).toBe("aGVsbG8=");
  });
});

// ---------------------------------------------------------------------------
// capitalize
// ---------------------------------------------------------------------------
describe("capitalize", () => {
  it("应将首字母大写", () => {
    expect(capitalize("hello")).toBe("Hello");
  });
  it("应对空字符串返回空", () => {
    expect(capitalize("")).toBe("");
  });
});

// ---------------------------------------------------------------------------
// generateFaviconUrl
// ---------------------------------------------------------------------------
describe("generateFaviconUrl", () => {
  it("应为域名生成 Favicon API URL", () => {
    expect(generateFaviconUrl("github.com")).toBe("https://iconapi.396638.xyz/api/icon?url=github.com");
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
    expect(isImageFile("photo.png")).toBe(true);
    expect(isImageFile("photo.webp")).toBe(true);
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
    expect(formatFileSize(0)).toBe("0 B");
    expect(formatFileSize(1024)).toBe("1.0 KB");
    expect(formatFileSize(1048576)).toBe("1.0 MB");
  });
});

// ---------------------------------------------------------------------------
// isPrivateHost（与后端 security.test.ts 对齐）
// ---------------------------------------------------------------------------
describe("isPrivateHost", () => {
  it("应识别 localhost", () => {
    expect(isPrivateHost("localhost")).toBe(true);
    expect(isPrivateHost("127.0.0.1")).toBe(true);
    expect(isPrivateHost("[::1]")).toBe(true);
  });
  it("应识别 IPv4 私有段", () => {
    expect(isPrivateHost("10.0.0.1")).toBe(true);
    expect(isPrivateHost("172.16.0.1")).toBe(true);
    expect(isPrivateHost("172.31.255.255")).toBe(true);
    expect(isPrivateHost("192.168.1.1")).toBe(true);
  });
  it("应拒绝公网 IPv4", () => {
    expect(isPrivateHost("8.8.8.8")).toBe(false);
    expect(isPrivateHost("1.1.1.1")).toBe(false);
    expect(isPrivateHost("172.32.0.1")).toBe(false);
  });
  it("应识别私有域名后缀", () => {
    expect(isPrivateHost("server.local")).toBe(true);
    expect(isPrivateHost("nas.internal")).toBe(true);
    expect(isPrivateHost("router.lan")).toBe(true);
  });
  it("应拒绝公网域名", () => {
    expect(isPrivateHost("github.com")).toBe(false);
    expect(isPrivateHost("example.com")).toBe(false);
  });
  it("应处理 0.0.0.0", () => {
    expect(isPrivateHost("0.0.0.0")).toBe(true);
    expect(isPrivateHost("[::]")).toBe(true);
  });
});
