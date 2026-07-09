import { describe, it, expect } from "vitest";
import { normalizeUrl, extractHostname, extractSiteName, generateFaviconUrl, getFileExtension, isImageFile } from "../url";

describe("normalizeUrl", () => {
  it("应为无协议的主机名添加 https://", () => {
    expect(normalizeUrl("example.com")).toBe("https://example.com");
  });
  it("不应修改已有协议的 URL", () => {
    expect(normalizeUrl("http://example.com")).toBe("http://example.com");
    expect(normalizeUrl("https://example.com")).toBe("https://example.com");
    expect(normalizeUrl("ftp://files.example.com")).toBe("ftp://files.example.com");
  });
  it("应对空字符串返回空", () => {
    expect(normalizeUrl("")).toBe("");
  });
  it("应处理带路径的 URL", () => {
    expect(normalizeUrl("github.com/owner/repo")).toBe("https://github.com/owner/repo");
  });
});

describe("extractHostname", () => {
  it("应从完整 URL 中提取主机名", () => {
    expect(extractHostname("https://www.example.com/path?q=1")).toBe("www.example.com");
  });
  it("应对非法 URL 返回空", () => {
    expect(extractHostname("")).toBe("");
    expect(extractHostname("not-a-url")).toBe("");
  });
  it("应处理带端口的 URL", () => {
    expect(extractHostname("http://localhost:3000/page")).toBe("localhost");
  });
});

describe("extractSiteName", () => {
  it("应从 URL 中提取站点名称", () => {
    expect(extractSiteName("https://github.com")).toBe("github");
  });
  it("应去除 www 前缀", () => {
    expect(extractSiteName("https://www.google.com")).toBe("google");
  });
  it("应处理子域名（返回第一个分段）", () => {
    expect(extractSiteName("https://maps.google.com")).toBe("maps");
  });
  it("应对空输入返回空", () => {
    expect(extractSiteName("")).toBe("");
  });
});

describe("generateFaviconUrl", () => {
  it("应为域名生成自部署 Favicon API URL", () => {
    expect(generateFaviconUrl("github.com")).toBe("https://iconapi.396638.xyz/api/icon?url=github.com");
  });
  it("应对空输入返回空", () => {
    expect(generateFaviconUrl("")).toBe("");
  });
  it("应处理带路径的域名输入", () => {
    const url = generateFaviconUrl("github.com/features");
    expect(url).toContain("github.com");
  });
});

describe("getFileExtension", () => {
  it("应提取常见扩展名", () => {
    expect(getFileExtension("photo.jpg")).toBe("jpg");
    expect(getFileExtension("archive.tar.gz")).toBe("gz");
    expect(getFileExtension("script.min.js")).toBe("js");
  });
  it("应对无扩展名的文件返回空", () => {
    expect(getFileExtension("README")).toBe("");
    expect(getFileExtension("file.")).toBe("");
  });
  it("应对空输入返回空", () => {
    expect(getFileExtension("")).toBe("");
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
    expect(isImageFile("photo.bmp")).toBe(true);
  });
  it("应拒绝非图片文件", () => {
    expect(isImageFile("document.pdf")).toBe(false);
    expect(isImageFile("script.js")).toBe(false);
    expect(isImageFile("")).toBe(false);
  });
  it("应区分大小写不敏感", () => {
    expect(isImageFile("photo.JPG")).toBe(true);
    expect(isImageFile("photo.PNG")).toBe(true);
  });
});
