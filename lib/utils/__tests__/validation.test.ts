import { describe, it, expect } from "vitest";
import {
  isEmptyString,
  isValidUrl,
  isValidFolderName,
  isValidLinkTitle,
  isValidLinkUrl,
  isValidIconName,
  isValidGistId,
  isValidGithubToken,
  isValidWebdavUrl,
  sanitizeText,
  isValidImageFile,
  isValidFileSize,
  isValidStorageConfig,
} from "../validation";

// ---------------------------------------------------------------------------
// isEmptyString
// ---------------------------------------------------------------------------
describe("isEmptyString", () => {
  it("应将空字符串识别为空", () => {
    expect(isEmptyString("")).toBe(true);
  });

  it("应将空白字符串识别为空", () => {
    expect(isEmptyString("   ")).toBe(true);
    expect(isEmptyString("\t\n")).toBe(true);
  });

  it("应将 null 和 undefined 视为空", () => {
    expect(isEmptyString(null)).toBe(true);
    expect(isEmptyString(undefined)).toBe(true);
  });

  it("应将非空字符串识别为非空", () => {
    expect(isEmptyString("hello")).toBe(false);
    expect(isEmptyString("  a  ")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isValidUrl
// ---------------------------------------------------------------------------
describe("isValidUrl", () => {
  it("应接受完整的 HTTP/HTTPS URL", () => {
    expect(isValidUrl("https://example.com")).toBe(true);
    expect(isValidUrl("http://example.com/path?q=1")).toBe(true);
  });

  it("应拒绝空字符串", () => {
    expect(isValidUrl("")).toBe(false);
  });

  it("应拒绝不合法的 URL 字符串", () => {
    expect(isValidUrl("not-a-url")).toBe(false);
    expect(isValidUrl("")).toBe(false);
  });

  it("应接受带协议的其他合法 URL", () => {
    expect(isValidUrl("ftp://files.example.com")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isValidFolderName
// ---------------------------------------------------------------------------
describe("isValidFolderName", () => {
  it("应接受 1-50 个字符的有效名称", () => {
    expect(isValidFolderName("工作")).toBe(true);
    expect(isValidFolderName("a")).toBe(true);
    expect(isValidFolderName("A".repeat(50))).toBe(true);
  });

  it("应拒绝空名称", () => {
    expect(isValidFolderName("")).toBe(false);
    expect(isValidFolderName("  ")).toBe(false);
  });

  it("应拒绝超过 50 个字符的名称", () => {
    expect(isValidFolderName("A".repeat(51))).toBe(false);
  });

  it("应拒绝包含非法文件字符的名称", () => {
    expect(isValidFolderName("test<foo")).toBe(false);
    expect(isValidFolderName("test>foo")).toBe(false);
    expect(isValidFolderName("test:foo")).toBe(false);
    expect(isValidFolderName('test"foo')).toBe(false);
    expect(isValidFolderName("test/foo")).toBe(false);
    expect(isValidFolderName("test\\foo")).toBe(false);
    expect(isValidFolderName("test|foo")).toBe(false);
    expect(isValidFolderName("test?foo")).toBe(false);
    expect(isValidFolderName("test*foo")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isValidLinkTitle
// ---------------------------------------------------------------------------
describe("isValidLinkTitle", () => {
  it("应接受 1-100 个字符的标题", () => {
    expect(isValidLinkTitle("GitHub")).toBe(true);
    expect(isValidLinkTitle("B".repeat(100))).toBe(true);
  });

  it("应拒绝空标题", () => {
    expect(isValidLinkTitle("")).toBe(false);
  });

  it("应拒绝超过 100 个字符的标题", () => {
    expect(isValidLinkTitle("C".repeat(101))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isValidLinkUrl
// ---------------------------------------------------------------------------
describe("isValidLinkUrl", () => {
  it("应接受合法的 URL", () => {
    expect(isValidLinkUrl("https://example.com")).toBe(true);
    expect(isValidLinkUrl("http://localhost:3000")).toBe(true);
  });

  it("应拒绝空字符串", () => {
    expect(isValidLinkUrl("")).toBe(false);
    expect(isValidLinkUrl("  ")).toBe(false);
  });

  it("应拒绝非法 URL", () => {
    expect(isValidLinkUrl("随便写")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isValidIconName
// ---------------------------------------------------------------------------
describe("isValidIconName", () => {
  it("应接受 1-50 个字符的图标名", () => {
    expect(isValidIconName("github")).toBe(true);
  });

  it("应拒绝空字符串", () => {
    expect(isValidIconName("")).toBe(false);
  });

  it("应拒绝超过 50 个字符的图标名", () => {
    expect(isValidIconName("I".repeat(51))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isValidGistId
// ---------------------------------------------------------------------------
describe("isValidGistId", () => {
  it("应接受 32 位以上的十六进制 Gist ID", () => {
    expect(isValidGistId("a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4")).toBe(true);
  });

  it("应拒绝空字符串", () => {
    expect(isValidGistId("")).toBe(false);
  });

  it("应拒绝过短的 ID", () => {
    expect(isValidGistId("abc")).toBe(false);
  });

  it("应拒绝包含非十六进制字符的 ID", () => {
    expect(isValidGistId("z1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isValidGithubToken
// ---------------------------------------------------------------------------
describe("isValidGithubToken", () => {
  it("应接受 ghp_ 开头的经典 PAT", () => {
    const token = "ghp_" + "a".repeat(36);
    expect(isValidGithubToken(token)).toBe(true);
  });

  it("应接受 github_pat_ 开头的细粒度 PAT", () => {
    const token = "github_pat_" + "a".repeat(36);
    expect(isValidGithubToken(token)).toBe(true);
  });

  it("应拒绝空字符串", () => {
    expect(isValidGithubToken("")).toBe(false);
  });

  it("应拒绝明显不合法的 Token", () => {
    expect(isValidGithubToken("invalid-token")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isValidWebdavUrl
// ---------------------------------------------------------------------------
describe("isValidWebdavUrl", () => {
  it("应接受 http/https WebDAV URL", () => {
    expect(isValidWebdavUrl("https://webdav.example.com")).toBe(true);
    expect(isValidWebdavUrl("http://webdav.local")).toBe(true);
  });

  it("应拒绝空字符串", () => {
    expect(isValidWebdavUrl("")).toBe(false);
  });

  it("应拒绝非 http/https 协议", () => {
    expect(isValidWebdavUrl("ftp://webdav.example.com")).toBe(false);
  });

  it("应拒绝非法字符串", () => {
    expect(isValidWebdavUrl("not-a-url")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// sanitizeText
// ---------------------------------------------------------------------------
describe("sanitizeText", () => {
  it("应转义 HTML 标签", () => {
    expect(sanitizeText("<script>alert('xss')</script>")).not.toContain("<script>");
  });

  it("应返回普通文本不变", () => {
    expect(sanitizeText("Hello, World!")).toBe("Hello, World!");
  });

  it("应对空字符串返回空", () => {
    expect(sanitizeText("")).toBe("");
  });
});

// ---------------------------------------------------------------------------
// isValidImageFile
// ---------------------------------------------------------------------------
describe("isValidImageFile", () => {
  it("应接受支持的图片格式", () => {
    expect(isValidImageFile(new File([], "test.png", { type: "image/png" }))).toBe(true);
    expect(isValidImageFile(new File([], "test.jpg", { type: "image/jpeg" }))).toBe(true);
    expect(isValidImageFile(new File([], "test.gif", { type: "image/gif" }))).toBe(true);
    expect(isValidImageFile(new File([], "test.svg", { type: "image/svg+xml" }))).toBe(true);
    expect(isValidImageFile(new File([], "test.webp", { type: "image/webp" }))).toBe(true);
  });

  it("应拒绝非图片文件", () => {
    expect(isValidImageFile(new File([], "test.pdf", { type: "application/pdf" }))).toBe(false);
    expect(isValidImageFile(new File([], "test.txt", { type: "text/plain" }))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isValidFileSize
// ---------------------------------------------------------------------------
describe("isValidFileSize", () => {
  it("应接受小于默认上限 (2MB) 的文件", () => {
    const small = new File([new Uint8Array(1024)], "small.png", { type: "image/png" });
    expect(isValidFileSize(small)).toBe(true);
  });

  it("应拒绝超过默认上限的文件", () => {
    const large = new File([new Uint8Array(3 * 1024 * 1024)], "large.png", { type: "image/png" });
    expect(isValidFileSize(large)).toBe(false);
  });

  it("应使用自定义上限", () => {
    const file = new File([new Uint8Array(3 * 1024 * 1024)], "med.png", { type: "image/png" });
    expect(isValidFileSize(file, 5)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isValidStorageConfig
// ---------------------------------------------------------------------------
describe("isValidStorageConfig", () => {
  it("应接受包含 type 字段的配置", () => {
    expect(isValidStorageConfig({ type: "github" })).toBe(true);
  });

  it("应拒绝空对象", () => {
    expect(isValidStorageConfig({})).toBe(false);
  });

  it("应拒绝非对象", () => {
    expect(isValidStorageConfig(null as unknown as Record<string, unknown>)).toBe(false);
    expect(isValidStorageConfig(undefined as unknown as Record<string, unknown>)).toBe(false);
  });
});
