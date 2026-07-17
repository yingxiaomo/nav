import { generateId } from "@/lib/utils/common";
import { LinkItem, DataSchema, DEFAULT_DATA } from "../types/types";

/**
 * 从 DT 元素的直接子元素中查找指定标签名的第一个元素
 * 不使用 :scope 选择器，避免部分环境（如 jsdom）中 :scope > 选择器
 * 错误匹配非直接子元素的问题
 */
function findDirectChild(el: Element, tagName: string): Element | null {
  for (const child of el.children) {
    if (child.tagName === tagName) return child;
  }
  return null;
}

export function parseNetscapeBookmarks(html: string): DataSchema | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const result: DataSchema = JSON.parse(JSON.stringify(DEFAULT_DATA));
    result.categories = [];

    const processList = (dl: Element): LinkItem[] => {
      const items: LinkItem[] = [];

      for (const dt of Array.from(dl.children)) {
        if (dt.tagName !== "DT") continue;

        // 使用 findDirectChild 代替 :scope > 选择器
        const a = findDirectChild(dt, "A");
        if (a) {
          items.push({
            id: generateId(),
            title: a.textContent || "未命名链接",
            url: (a.getAttribute("href") || "").trim(),
            icon: a.getAttribute("icon") || undefined,
            type: "link",
          });
          continue;
        }

        const h3 = findDirectChild(dt, "H3");
        const subDl = findDirectChild(dt, "DL");

        if (h3 && subDl) {
          const folderTitle = h3.textContent || "新建文件夹";
          const children = processList(subDl);

          items.push({
            id: generateId(),
            title: folderTitle,
            url: "",
            type: "folder",
            children: children,
          });
        }
      }
      return items;
    };

    const rootDl = doc.querySelector("body > dl");

    if (rootDl) {
      const topLevelItems = processList(rootDl);
      const unclassifiedLinks: LinkItem[] = [];

      for (const item of topLevelItems) {
        if (item.type === "folder") {
          result.categories.push({
            id: generateId(),
            title: item.title,
            links: item.children || [],
          });
        } else {
          unclassifiedLinks.push(item);
        }
      }

      if (unclassifiedLinks.length > 0) {
        result.categories.push({
          id: generateId(),
          title: "其他书签",
          links: unclassifiedLinks,
        });
      }
    } else {
      if (!html.includes("<!DOCTYPE NETSCAPE-Bookmark-file-1>")) {
        return null;
      }
    }

    return result;
  } catch (e) {
    console.error("Failed to parse bookmarks html", e);
    return null;
  }
}
