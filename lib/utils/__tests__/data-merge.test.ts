import { describe, it, expect } from "vitest";
import { mergeItems, mergeCategories } from "../data-merge";
import type { Category, LinkItem } from "../../types/types";

describe("mergeItems", () => {
  it("远程为空时合并结果为空", () => {
    expect(mergeItems([], [{ id: "1", title: "a", url: "https://a.com" }])).toEqual([]);
  });

  it("本地有空但远程有内容时取远程", () => {
    const remote = [{ id: "1", title: "remote", url: "https://r.com" }];
    expect(mergeItems(remote, [])).toEqual(remote);
  });

  it("相同 id 本地更新更晚时取本地版本", () => {
    const remote = [{ id: "1", title: "旧", url: "https://r.com", updatedAt: 100 }];
    const local = [{ id: "1", title: "新", url: "https://r.com", updatedAt: 200 }];
    const result = mergeItems(remote, local);
    expect(result[0].title).toBe("新");
  });

  it("相同 id 远程更新更晚时取远程版本", () => {
    const remote = [{ id: "1", title: "新", url: "https://r.com", updatedAt: 200 }];
    const local = [{ id: "1", title: "旧", url: "https://r.com", updatedAt: 100 }];
    const result = mergeItems(remote, local);
    expect(result[0].title).toBe("新");
  });

  it("无 updatedAt 时默认为 0，视为远程新", () => {
    const remote = [{ id: "1", title: "远程", url: "https://r.com" }];
    const local = [{ id: "1", title: "本地", url: "https://l.com" }];
    const result = mergeItems(remote, local);
    expect(result[0].title).toBe("远程");
  });

  it("本地有但远程没有的条目被丢弃（不补回）", () => {
    const remote = [{ id: "1", title: "a", url: "https://a.com" }];
    const local = [{ id: "2", title: "b", url: "https://b.com" }];
    expect(mergeItems(remote, local)).toHaveLength(1);
    expect(mergeItems(remote, local)[0].id).toBe("1");
  });

  it("当时间相同时调用 nestedMergeFn", () => {
    const remote = [{ id: "1", title: "r", url: "https://r.com", updatedAt: 100, children: [{ id: "c1", title: "rc", url: "https://rc.com" }] }];
    const local = [{ id: "1", title: "r", url: "https://r.com", updatedAt: 100, children: [{ id: "c1", title: "lc", url: "https://lc.com" }] }];
    const result = mergeItems(remote, local, (r, l) => ({
      ...r,
      children: mergeItems(r.children || [], l.children || []),
    }));
    // 远程优先，所以取远程的子项
    expect((result[0] as LinkItem).children?.[0].title).toBe("rc");
  });
});

describe("mergeCategories", () => {
  it("应合并分类内的链接", () => {
    const remote: Category[] = [{
      id: "cat1", title: "分类", links: [
        { id: "link1", title: "远程链接", url: "https://r.com", updatedAt: 100 },
      ],
    }];
    const local: Category[] = [{
      id: "cat1", title: "分类", links: [
        { id: "link1", title: "本地链接", url: "https://l.com", updatedAt: 200 },
      ],
    }];
    const result = mergeCategories(remote, local);
    expect(result[0].links[0].title).toBe("本地链接");
  });

  it("本地新增分类（远程无）应丢弃", () => {
    const remote: Category[] = [{ id: "cat1", title: "远程分类", links: [] }];
    const local: Category[] = [{ id: "cat2", title: "本地分类", links: [] }];
    expect(mergeCategories(remote, local)).toHaveLength(1);
    expect(mergeCategories(remote, local)[0].id).toBe("cat1");
  });

  it("两边分类都为空时应返回空数组", () => {
    expect(mergeCategories([], [])).toEqual([]);
  });

  it("远程分类有序时应保持顺序", () => {
    const remote: Category[] = [
      { id: "c1", title: "A", links: [] },
      { id: "c2", title: "B", links: [] },
    ];
    const result = mergeCategories(remote, []);
    expect(result[0].id).toBe("c1");
    expect(result[1].id).toBe("c2");
  });

  it("分类内链接全部为空时应保留空分类", () => {
    const remote: Category[] = [{ id: "c1", title: "空分类", links: [] }];
    const result = mergeCategories(remote, []);
    expect(result).toHaveLength(1);
    expect(result[0].links).toEqual([]);
  });
});
