// ===== Types =====

export interface SuggestionResult {
  source: string;
  suggestions: string[];
}

// ===== 各搜索引擎 API 适配 =====

interface SuggestionSource {
  name: string;
  buildUrl(query: string): string;
  /** 自定义 response 解析（返回 JSON 或失败后 fallback 到 text 解析） */
  fetchResponse(url: string, signal: AbortSignal): Promise<string[]>;
}

const sources: Record<string, SuggestionSource> = {
  duckduckgo: {
    name: 'duckduckgo',
    buildUrl(q: string) {
      return `https://duckduckgo.com/ac/?q=${encodeURIComponent(q)}`;
    },
    async fetchResponse(url, signal) {
      const res = await fetch(url, {
        signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NavServer/1.0)' },
      });
      const data: unknown = await res.json();
      // DuckDuckGo 返回 [{phrase: "suggestion1"}, {phrase: "suggestion2"}, ...]
      if (!Array.isArray(data)) return [];
      return data
        .map((item: unknown) => {
          if (typeof item === 'object' && item !== null && 'phrase' in item) {
            return String((item as Record<string, unknown>).phrase);
          }
          return null;
        })
        .filter((s): s is string => s !== null && s.length > 0);
    },
  },

  baidu: {
    name: 'baidu',
    buildUrl(q: string) {
      return `https://sp0.baidu.com/5a1Fazu8AA54nxGko9WTAnF6hhy/su?wd=${encodeURIComponent(q)}`;
    },
    async fetchResponse(url, signal) {
      // 百度返回 JSONP: window.baidu.sug({...})，需要剥离回调
      const res = await fetch(url, {
        signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NavServer/1.0)', Accept: 'text/javascript' },
      });
      const text = await res.text();
      const match = text.match(/window\.baidu\.sug\(([\s\S]+)\)/);
      if (!match) return [];
      try {
        const parsed = JSON.parse(match[1]);
        if (Array.isArray(parsed.s)) {
          return parsed.s.filter((s: unknown): s is string => typeof s === 'string' && s.length > 0);
        }
      } catch {
        // ignore parse errors
      }
      return [];
    },
  },

  google: {
    name: 'google',
    buildUrl(q: string) {
      return `https://suggestqueries.google.com/complete/search?client=chrome&q=${encodeURIComponent(q)}`;
    },
    async fetchResponse(url, signal) {
      const res = await fetch(url, {
        signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NavServer/1.0)' },
      });
      const data: unknown = await res.json();
      if (!Array.isArray(data) || data.length < 2) return [];
      const list = data[1];
      if (!Array.isArray(list)) return [];
      return list.filter((s): s is string => typeof s === 'string' && s.length > 0);
    },
  },
};

// ===== Main =====

const REQUEST_TIMEOUT = 3_000;

export async function getSuggestions(
  query: string,
  sourceName: string = 'duckduckgo',
): Promise<SuggestionResult> {
  const source = sources[sourceName];
  if (!source) {
    throw new Error(`不支持的搜索来源: ${sourceName}，可选: ${Object.keys(sources).join(', ')}`);
  }

  const url = source.buildUrl(query);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const suggestions = await source.fetchResponse(url, controller.signal);
    return { source: source.name, suggestions };
  } catch (e: unknown) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error('搜索服务请求超时');
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
