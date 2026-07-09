import { describe, it, expect } from "vitest";
import { DEFAULT_DATA } from "../../types/types";

describe("DEFAULT_DATA", () => {
  it("应包含所有必需字段", () => {
    expect(DEFAULT_DATA).toHaveProperty("settings");
    expect(DEFAULT_DATA).toHaveProperty("categories");
    expect(DEFAULT_DATA).toHaveProperty("todos");
    expect(DEFAULT_DATA).toHaveProperty("notes");
    expect(DEFAULT_DATA).toHaveProperty("pinnedLinks");
  });

  it("settings 应有合理默认值", () => {
    const s = DEFAULT_DATA.settings;
    expect(typeof s.title).toBe("string");
    expect(s.title.length).toBeGreaterThan(0);
    expect(["low", "medium", "high"]).toContain(s.blurLevel);
    expect(["folder", "list", "sidebar"]).toContain(s.homeLayout);
    expect(["light", "dark", "system"]).toContain(s.theme);
    expect(typeof s.wallpaper).toBe("string");
    expect(Array.isArray(s.wallpaperList)).toBe(true);
  });

  it("分类、待办、笔记为空数组", () => {
    expect(DEFAULT_DATA.categories).toEqual([]);
    expect(DEFAULT_DATA.todos).toEqual([]);
    expect(DEFAULT_DATA.notes).toEqual([]);
    expect(DEFAULT_DATA.pinnedLinks).toEqual([]);
  });

  it("深层拷贝独立，修改副本不影响原值", () => {
    const copy = JSON.parse(JSON.stringify(DEFAULT_DATA));
    copy.settings.title = "Modified";
    copy.categories.push({ id: "new", title: "New", links: [] });
    expect(DEFAULT_DATA.settings.title).not.toBe("Modified");
    expect(DEFAULT_DATA.categories.length).toBe(0);
  });
});
