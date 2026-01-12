import { Category, LinkItem, DataSchema, DEFAULT_DATA } from "./types";
import { v4 as uuidv4 } from "uuid";

/**
 * 解析 Netscape Bookmark HTML 格式字符串为 DataSchema
 * 这种格式被 Chrome, Firefox, Safari 以及 Floccus (HTML模式) 等广泛使用。
 */
export function parseNetscapeBookmarks(html: string): DataSchema | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    
    // 根数据结构
    const result: DataSchema = JSON.parse(JSON.stringify(DEFAULT_DATA));
    result.categories = [];

    // 查找主要的 DL 列表
    // 标准格式通常是 <DT><H3>文件夹</H3><DL>...</DL></DT>
    
    // 辅助函数：处理书签节点
    const processList = (dl: Element): LinkItem[] => {
      const items: LinkItem[] = [];
      
      // 遍历所有 DT 节点（DT 通常包含 H3+DL(文件夹) 或 A(链接)）
      // 注意：Netscape 格式很乱，有时不闭合标签，DOMParser 会尽力修复
      for (const dt of Array.from(dl.children)) {
        if (dt.tagName !== 'DT') continue;

        // 尝试找链接 <A>
        const a = dt.querySelector(':scope > a');
        if (a) {
          items.push({
            id: uuidv4(),
            title: a.textContent || "未命名链接",
            url: (a.getAttribute('href') || "").trim(),
            icon: a.getAttribute('icon') || undefined, // 有些导出包含 icon base64
            type: 'link'
          });
          continue;
        }

        // 尝试找文件夹 <H3> + <DL>
        const h3 = dt.querySelector(':scope > h3');
        const subDl = dt.querySelector(':scope > dl');
        
        if (h3 && subDl) {
          const folderTitle = h3.textContent || "新建文件夹";
          const children = processList(subDl);
          
          items.push({
            id: uuidv4(),
            title: folderTitle,
            url: "",
            type: 'folder',
            children: children
          });
        }
      }
      return items;
    };

    // 查找根书签列表
    // 通常在 body 下的第一个 dl
    const rootDl = doc.querySelector('body > dl');
    
    if (rootDl) {
      // 顶层文件夹直接转换为 Categories
      // 但是 Netscape 格式的顶层可能直接混合了链接和文件夹
      // 我们的 Nav 结构要求顶层必须是 Category。
      // 策略：
      // 1. 顶层的文件夹 -> 转换成 Category
      // 2. 顶层的散乱链接 -> 收集到一个 "未分类" Category 中
      
      const topLevelItems = processList(rootDl);
      const unclassifiedLinks: LinkItem[] = [];

      for (const item of topLevelItems) {
        if (item.type === 'folder') {
          // 文件夹转分类
          result.categories.push({
            id: uuidv4(),
            title: item.title,
            links: item.children || []
          });
        } else {
          unclassifiedLinks.push(item);
        }
      }

      // 如果有散乱的链接，放入“其他书签”
      if (unclassifiedLinks.length > 0) {
        result.categories.push({
          id: uuidv4(),
          title: "其他书签",
          links: unclassifiedLinks
        });
      }
    } else {
        // 尝试从 text content 判断是否是有效文件
        if (!html.includes("<!DOCTYPE NETSCAPE-Bookmark-file-1>")) {
            return null; // 不是书签文件
        }
    }

    return result;
  } catch (e) {
    console.error("Failed to parse bookmarks html", e);
    return null;
  }
}
