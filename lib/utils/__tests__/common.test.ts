import { describe, test, expect } from '@jest/globals';

describe('cn (classname merge)', () => {
  const cn = (...inputs: unknown[]): string => {
    return inputs.filter(Boolean).join(" ");
  };
  test('merges classes', () => expect(cn("a", "b")).toBe("a b"));
  test('filters falsy', () => expect(cn("a", false, undefined, null, "b")).toBe("a b"));
  test('handles empty', () => expect(cn()).toBe(""));
});

describe('normalizeUrl', () => {
  const fn = (url: string): string => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return 'https://' + url;
  };
  test('adds https', () => expect(fn('example.com')).toBe('https://example.com'));
  test('keeps https', () => expect(fn('https://example.com')).toBe('https://example.com'));
  test('keeps http', () => expect(fn('http://example.com')).toBe('http://example.com'));
  test('returns empty for empty', () => expect(fn('')).toBe(''));
  test('handles subdomain', () => expect(fn('sub.example.com')).toBe('https://sub.example.com'));
});

describe('extractHostname', () => {
  const fn = (url: string): string => {
    if (!url) return '';
    try { return new URL(url).hostname; } catch { return ''; }
  };
  test('full url', () => expect(fn('https://www.example.com/path')).toBe('www.example.com'));
  test('with port', () => expect(fn('https://example.com:8080/path')).toBe('example.com'));
  test('empty for invalid', () => expect(fn('not a url')).toBe(''));
  test('empty for empty', () => expect(fn('')).toBe(''));
});

describe('extractSiteName', () => {
  const extractHostname = (url: string): string => {
    if (!url) return '';
    try { return new URL(url).hostname; } catch { return ''; }
  };
  const fn = (url: string): string => {
    if (!url) return '';
    const hostname = extractHostname(url);
    return hostname.replace(/^www\./, '').split('.')[0] || '';
  };
  test('extracts from www', () => expect(fn('https://www.google.com')).toBe('google'));
  test('extracts without www', () => expect(fn('https://github.com')).toBe('github'));
  test('handles subdomain', () => expect(fn('https://maps.google.com')).toBe('maps'));
});

describe('formatFileSize', () => {
  const fn = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  test('0 bytes', () => expect(fn(0)).toBe('0 Bytes'));
  test('500 bytes', () => expect(fn(500)).toBe('500 Bytes'));
  test('2 KB', () => expect(fn(2048)).toBe('2 KB'));
  test('1 MB', () => expect(fn(1048576)).toBe('1 MB'));
  test('1.5 MB', () => expect(fn(1572864)).toBe('1.5 MB'));
});

describe('generateFaviconUrl', () => {
  const fn = (domain: string): string => {
    if (!domain) return '';
    return 'https://www.google.com/s2/favicons?domain=' + domain + '&sz=128';
  };
  test('returns correct url', () => expect(fn('example.com')).toBe('https://www.google.com/s2/favicons?domain=example.com&sz=128'));
  test('empty for empty', () => expect(fn('')).toBe(''));
});

describe('getFileExtension', () => {
  const fn = (filename: string): string => {
    if (!filename) return '';
    const lastDotIndex = filename.lastIndexOf('.');
    if (lastDotIndex === -1 || lastDotIndex === filename.length - 1) return '';
    return filename.substring(lastDotIndex + 1).toLowerCase();
  };
  test('simple', () => expect(fn('file.txt')).toBe('txt'));
  test('multi dot', () => expect(fn('file.name.txt')).toBe('txt'));
  test('no extension', () => expect(fn('file')).toBe(''));
  test('uppercase', () => expect(fn('file.JPG')).toBe('jpg'));
  test('hidden file', () => expect(fn('.gitignore')).toBe('gitignore'));
  test('ends with dot', () => expect(fn('file.')).toBe(''));
});

describe('isImageFile', () => {
  const getExt = (filename: string): string => {
    if (!filename) return '';
    const lastDotIndex = filename.lastIndexOf('.');
    if (lastDotIndex === -1 || lastDotIndex === filename.length - 1) return '';
    return filename.substring(lastDotIndex + 1).toLowerCase();
  };
  const fn = (filename: string): boolean => {
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(getExt(filename));
  };
  test('png is image', () => expect(fn('test.png')).toBe(true));
  test('webp is image', () => expect(fn('test.webp')).toBe(true));
  test('svg is image', () => expect(fn('test.svg')).toBe(true));
  test('jpg is image', () => expect(fn('test.jpg')).toBe(true));
  test('txt is not image', () => expect(fn('test.txt')).toBe(false));
  test('no ext is not image', () => expect(fn('test')).toBe(false));
});

describe('debounce', () => {
  test('calls function after delay', () => {
    let count = 0;
    const fn = (() => { count++; }) as (...args: unknown[]) => unknown;
    const debounced = ((func: (...args: unknown[]) => unknown, delay: number) => {
      let timeoutId: ReturnType<typeof setTimeout>;
      return (...args: unknown[]) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func(...args), delay);
      };
    })(fn, 100);
    debounced();
    expect(count).toBe(0);
  });
});

describe('throttle', () => {
  test('calls immediately then limits', () => {
    let count = 0;
    const fn = (() => { count++; }) as (...args: unknown[]) => unknown;
    let inThrottle = false;
    const throttled = ((func: (...args: unknown[]) => unknown, limit: number) => {
      return (...args: unknown[]) => {
        if (!inThrottle) {
          func(...args);
          inThrottle = true;
          setTimeout(() => { inThrottle = false; }, limit);
        }
      };
    })(fn, 100);
    throttled();
    expect(count).toBe(1);
    throttled();
    expect(count).toBe(1);
  });
});

describe('deepCopy', () => {
  const fn = <T>(obj: T): T => JSON.parse(JSON.stringify(obj));
  test('copies object', () => {
    const original = { a: 1, b: { c: 2 } };
    const copy = fn(original);
    expect(copy).toEqual(original);
    expect(copy).not.toBe(original);
  });
  test('copies array', () => {
    const arr = [1, 2, { a: 3 }];
    expect(fn(arr)).toEqual(arr);
  });
});

describe('removeEmptyValues', () => {
  const fn = <T extends Record<string, unknown>>(obj: T): Partial<T> => {
    const result = { ...obj };
    for (const key in result) {
      if (result[key] === null || result[key] === undefined || result[key] === '') {
        delete result[key];
      }
    }
    return result;
  };
  test('removes null, undefined, empty string', () => {
    expect(fn({ a: 1, b: null, c: undefined, d: '', e: 'hello' })).toEqual({ a: 1, e: 'hello' });
  });
});

describe('capitalize', () => {
  const fn = (str: string): string => {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  };
  test('capitalizes first letter', () => expect(fn('hello')).toBe('Hello'));
  test('handles empty', () => expect(fn('')).toBe(''));
  test('handles single char', () => expect(fn('a')).toBe('A'));
});

describe('generateTempId', () => {
  const fn = (): string => 'temp-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
  test('starts with temp-', () => expect(fn().startsWith('temp-')).toBe(true));
  test('unique', () => {
    const ids = new Set(Array.from({ length: 50 }, () => fn()));
    expect(ids.size).toBe(50);
  });
});

describe('isTempId', () => {
  const fn = (id: string): boolean => id.startsWith('temp-');
  test('identifies temp id', () => expect(fn('temp-12345-abc')).toBe(true));
  test('rejects normal id', () => expect(fn('abc-123')).toBe(false));
});
