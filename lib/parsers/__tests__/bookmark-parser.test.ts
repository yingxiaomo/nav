import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { parseNetscapeBookmarks } from "../bookmark-parser";

const loadFixture = (name: string): string =>
  fs.readFileSync(path.join(__dirname, "fixtures", name), "utf-8");

const SAMPLE_HTML = loadFixture("sample-bookmarks.html");
const EMPTY_HTML = loadFixture("empty-bookmarks.html");
const INVALID_HTML = loadFixture("invalid.html");

describe("parseNetscapeBookmarks", () => {
  it("should parse bookmarks with folders and links", () => {
    const result = parseNetscapeBookmarks(SAMPLE_HTML);
    expect(result).not.toBeNull();
    expect(result!.categories.length).toBeGreaterThan(0);
  });

  it("should convert top-level folders to categories", () => {
    const result = parseNetscapeBookmarks(SAMPLE_HTML);
    const workCat = result!.categories.find((c) => c.title === "工作");
    expect(workCat).toBeDefined();
    expect(workCat!.links.length).toBeGreaterThan(0);
  });

  it("should put unclassified links into a category", () => {
    const result = parseNetscapeBookmarks(SAMPLE_HTML);
    const otherCat = result!.categories.find(
      (c) => c.title === "其他书签"
    );
    expect(otherCat).toBeDefined();
    expect(otherCat!.links.length).toBe(2);
    expect(otherCat!.links[0].title).toBe("Hacker News");
    expect(otherCat!.links[1].title).toBe("Reddit");
  });

  it("should generate unique IDs for each link", () => {
    const result = parseNetscapeBookmarks(SAMPLE_HTML);
    const allLinks = result!.categories.flatMap((c) => c.links);
    const ids = allLinks.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("should extract title, url, and icon from links", () => {
    const result = parseNetscapeBookmarks(SAMPLE_HTML);
    const workCat = result!.categories.find((c) => c.title === "工作")!;
    const github = workCat.links.find((l) => l.title === "GitHub")!;
    expect(github.url).toBe("https://github.com");
    expect(github.icon).toBeDefined();
    expect(github.type).toBe("link");
  });

  it("should parse nested folders as a LinkItem tree", () => {
    const result = parseNetscapeBookmarks(SAMPLE_HTML);
    const workCat = result!.categories.find((c) => c.title === "工作")!;
    const internalTools = workCat.links.find((l) => l.title === "内部工具");
    expect(internalTools).toBeDefined();
    expect(internalTools!.type).toBe("folder");
    expect(internalTools!.children).toBeDefined();
    expect(internalTools!.children!.length).toBe(1);
    expect(internalTools!.children![0].title).toBe("Jenkins");
  });

  it("should return null for invalid HTML", () => {
    const result = parseNetscapeBookmarks(INVALID_HTML);
    expect(result).toBeNull();
  });

  it("should handle an empty bookmarks file", () => {
    const result = parseNetscapeBookmarks(EMPTY_HTML);
    expect(result).not.toBeNull();
    expect(result!.categories.length).toBe(0);
  });

  it("should return a valid DataSchema object", () => {
    const result = parseNetscapeBookmarks(SAMPLE_HTML);
    expect(result).toHaveProperty("settings");
    expect(result).toHaveProperty("categories");
    expect(result).toHaveProperty("todos");
    expect(result).toHaveProperty("notes");
    expect(result).toHaveProperty("pinnedLinks");
  });
});