import { describe, test, expect } from '@jest/globals';

interface LinkItem {
  id: string;
  title: string;
  url: string;
  icon?: string;
  type: 'link' | 'folder';
  children?: LinkItem[];
}

interface Category {
  id: string;
  title: string;
  links: LinkItem[];
}

interface DataSchema {
  categories: Category[];
}

const DEFAULT_DATA: DataSchema = { categories: [] };

const genId = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
};

function parseNetscapeBookmarks(html: string): DataSchema | null {
  try {
    if (!html.includes('<A') && !html.includes('<!DOCTYPE NETSCAPE-Bookmark-file-1>')) {
      return null;
    }

    const result: DataSchema = JSON.parse(JSON.stringify(DEFAULT_DATA));
    result.categories = [];

    // Simple HTML tag-based extraction
    const aRegex = /<A\s[^>]*HREF="([^"]*)"[^>]*>([^<]*)<\/A>/gi;
    let match;

    const links: LinkItem[] = [];

    while ((match = aRegex.exec(html)) !== null) {
      const url = match[1].trim();
      const title = match[2].trim() || 'Unnamed Link';

      // Extract ICON attribute separately
      const tagStart = match.index;
      const tagEnd = html.indexOf('>', tagStart);
      const tagContent = html.substring(tagStart, tagEnd + 1);
      const iconMatch = tagContent.match(/ICON="([^"]*)"/i);
      const icon = iconMatch ? iconMatch[1] : undefined;

      links.push({
        id: genId(),
        title: title,
        url: url,
        icon: icon,
        type: 'link'
      });
    }

    if (links.length > 0) {
      result.categories.push({
        id: genId(),
        title: 'Imported Bookmarks',
        links: links
      });
    }

    return result;
  } catch {
    return null;
  }
}

describe('bookmark parser', () => {
  test('parses simple bookmark file', () => {
    const html = '<!DOCTYPE NETSCAPE-Bookmark-file-1>\n<DL><DT><A HREF="https://example.com" ICON="icon.png">Example</A></DT></DL>';
    const result = parseNetscapeBookmarks(html);
    expect(result).not.toBeNull();
    expect(result!.categories.length).toBe(1);
    expect(result!.categories[0].links[0].title).toBe('Example');
    expect(result!.categories[0].links[0].url).toBe('https://example.com');
  });

  test('parses multiple bookmarks', () => {
    const html = '<!DOCTYPE NETSCAPE-Bookmark-file-1>\n<DL>\n<DT><A HREF="https://a.com">A</A></DT>\n<DT><A HREF="https://b.com">B</A></DT>\n</DL>';
    const result = parseNetscapeBookmarks(html);
    expect(result).not.toBeNull();
    expect(result!.categories[0].links.length).toBe(2);
  });

  test('returns null for invalid html', () => {
    expect(parseNetscapeBookmarks('<html><body>Not bookmarks</body></html>')).toBeNull();
  });

  test('returns null for empty string', () => {
    expect(parseNetscapeBookmarks('')).toBeNull();
  });

  test('handles bookmark with icon', () => {
    const html = '<!DOCTYPE NETSCAPE-Bookmark-file-1>\n<DL><DT><A HREF="https://test.com" ICON="https://icons.com/test.png">Test</A></DT></DL>';
    const result = parseNetscapeBookmarks(html);
    expect(result).not.toBeNull();
    expect(result!.categories[0].links[0].icon).toBe('https://icons.com/test.png');
  });

  test('handles bookmark without icon', () => {
    const html = '<!DOCTYPE NETSCAPE-Bookmark-file-1>\n<DL><DT><A HREF="https://test.com">Test</A></DT></DL>';
    const result = parseNetscapeBookmarks(html);
    expect(result).not.toBeNull();
    expect(result!.categories[0].links[0].icon).toBeUndefined();
  });

  test('handles bookmarks with extra attributes', () => {
    const html = '<!DOCTYPE NETSCAPE-Bookmark-file-1>\n<DL><DT><A HREF="https://x.com" ADD_DATE="1234567890" ICON="https://x.com/favicon.ico" TAGS="">X</A></DT></DL>';
    const result = parseNetscapeBookmarks(html);
    expect(result).not.toBeNull();
    expect(result!.categories[0].links[0].url).toBe('https://x.com');
    expect(result!.categories[0].links[0].icon).toBe('https://x.com/favicon.ico');
  });

  test('trims whitespace from title', () => {
    const html = '<!DOCTYPE NETSCAPE-Bookmark-file-1>\n<DL><DT><A HREF="https://x.com">  X.com  </A></DT></DL>';
    const result = parseNetscapeBookmarks(html);
    expect(result!.categories[0].links[0].title).toBe('X.com');
  });
});
