import { describe, it, expect } from "vitest";
import { arrayToTree, treeToArray, traverseTree, findInTree, updateInTree, deleteInTree } from "../tree";

interface TestNode {
  id: string;
  parentId?: string;
  name: string;
  children?: TestNode[];
}

// Helpers to cast tree results for test assertions
function asTree(data: Record<string, unknown>[]): TestNode[] {
  return data as unknown as TestNode[];
}

describe("arrayToTree", () => {
  it("应将平坦数组转为树形结构", () => {
    const items: Record<string, unknown>[] = [
      { id: "1", name: "根" },
      { id: "2", parentId: "1", name: "子1" },
      { id: "3", parentId: "1", name: "子2" },
    ];
    const tree = arrayToTree(items);
    expect(tree).toHaveLength(1);
    expect(asTree(tree)[0].children).toHaveLength(2);
  });

  it("应处理多层嵌套", () => {
    const items: Record<string, unknown>[] = [
      { id: "1", name: "根" },
      { id: "2", parentId: "1", name: "子" },
      { id: "3", parentId: "2", name: "孙" },
    ];
    const tree = arrayToTree(items);
    const t = asTree(tree);
    expect(t[0].children![0].children![0].name).toBe("孙");
  });

  it("应处理空数组", () => {
    expect(arrayToTree([])).toEqual([]);
  });
});

describe("treeToArray", () => {
  it("应将树形结构转为平坦数组", () => {
    const tree = [
      { id: "1", name: "根", children: [
        { id: "2", name: "子", children: [] },
      ]},
    ];
    const flat = treeToArray(tree);
    expect(flat).toHaveLength(2);
  });
});

describe("traverseTree", () => {
  it("应遍历所有节点", () => {
    const tree: Record<string, unknown>[] = [
      { id: "1", name: "根", children: [
        { id: "2", name: "子", children: [] },
      ]},
    ];
    const visited: string[] = [];
    traverseTree(tree, (node) => visited.push(node.id as string));
    expect(visited).toEqual(["1", "2"]);
  });
});

describe("findInTree", () => {
  it("应找到匹配的节点", () => {
    const tree: Record<string, unknown>[] = [
      { id: "1", name: "根", children: [
        { id: "2", name: "目标", children: [] },
      ]},
    ];
    const found = findInTree(tree, (n) => n.id === "2");
    expect((found as unknown as TestNode)?.name).toBe("目标");
  });

  it("未找到时返回 undefined", () => {
    const tree: Record<string, unknown>[] = [{ id: "1", name: "根", children: [] }];
    expect(findInTree(tree, (n) => n.id === "999")).toBeUndefined();
  });
});

describe("updateInTree", () => {
  it("应更新匹配的节点", () => {
    const tree: Record<string, unknown>[] = [
      { id: "1", name: "旧名", children: [
        { id: "2", name: "叶子", children: [] },
      ]},
    ];
    const updated = updateInTree(tree, (n) => n.id === "1", (n) => ({ ...n, name: "新名" }));
    const u = asTree(updated);
    expect(u[0].name).toBe("新名");
    expect(u[0].children![0].name).toBe("叶子");
  });
});

describe("deleteInTree", () => {
  it("应删除匹配的节点", () => {
    const tree: Record<string, unknown>[] = [
      { id: "1", name: "保留", children: [
        { id: "2", name: "删除", children: [] },
      ]},
    ];
    const result = deleteInTree(tree, (n) => n.id === "2");
    expect(asTree(result)[0].children).toHaveLength(0);
  });
});
