import { Category, LinkItem, DataSchema, DEFAULT_DATA } from "./types";
import { v4 as uuidv4 } from "uuid";

export function parseNetscapeBookmarks(html: string): DataSchema | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const result: DataSchema = JSON.parse(JSON.stringify(DEFAULT_DATA));
    result.categories = [];

    const processList = (dl: Element): LinkItem[] => {
      const items: LinkItem[] = [];
      
      for (const dt of Array.from(dl.children)) {
        if (dt.tagName !== 'DT') continue;

        const a = dt.querySelector(':scope > a');
        if (a) {
          items.push({
            id: uuidv4(),
            title: a.textContent || "未命名链接",
            url: (a.getAttribute('href') || "").trim(),
            icon: a.getAttribute('icon') || undefined, 
            type: 'link'
          });
          continue;
        }

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

    const rootDl = doc.querySelector('body > dl');
    
    if (rootDl) {
     
      const topLevelItems = processList(rootDl);
      const unclassifiedLinks: LinkItem[] = [];

      for (const item of topLevelItems) {
        if (item.type === 'folder') {

          result.categories.push({
            id: uuidv4(),
            title: item.title,
            links: item.children || []
          });
        } else {
          unclassifiedLinks.push(item);
        }
      }


      if (unclassifiedLinks.length > 0) {
        result.categories.push({
          id: uuidv4(),
          title: "其他书签",
          links: unclassifiedLinks
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
