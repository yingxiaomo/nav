import { describe, test, expect } from '@jest/globals';

describe('isEmptyString', () => {
  const isEmptyString = (str: string | undefined | null): boolean => {
    return !str || str.trim() === '';
  };
  test('returns true for empty', () => expect(isEmptyString('')).toBe(true));
  test('returns true for null', () => expect(isEmptyString(null)).toBe(true));
  test('returns false for non-empty', () => expect(isEmptyString('hello')).toBe(false));
});

describe('isValidUrl', () => {
  const isValidUrl = (url: string): boolean => {
    if (!url) return false;
    try { new URL(url); return true; } catch { return false; }
  };
  test('accepts https', () => expect(isValidUrl('https://example.com')).toBe(true));
  test('rejects plain text', () => expect(isValidUrl('not a url')).toBe(false));
  test('rejects empty', () => expect(isValidUrl('')).toBe(false));
});

describe('isValidFolderName', () => {
  const empty = (s: string | undefined | null) => !s || s.trim() === '';
  const fn = (name: string): boolean => {
    if (empty(name)) return false;
    if (name.length < 1 || name.length > 50) return false;
    return !/[<>:"\\/|?*]/.test(name);
  };
  test('rejects empty', () => expect(fn('')).toBe(false));
  test('rejects too long', () => expect(fn('a'.repeat(51))).toBe(false));
  test('rejects invalid chars', () => expect(fn('test<')).toBe(false));
  test('accepts normal', () => expect(fn('My Bookmarks')).toBe(true));
});

describe('isValidGithubToken', () => {
  const fn = (token: string): boolean => {
    if (!token) return false;
    return /^gh[psuor]_[a-zA-Z0-9]{36,}$/.test(token) || /^github_pat_[a-zA-Z0-9_]{36,}$/.test(token);
  };
  test('classic PAT ghp_', () => expect(fn('ghp_' + 'a'.repeat(36))).toBe(true));
  test('fine-grained github_pat_', () => expect(fn('github_pat_' + 'a'.repeat(36))).toBe(true));
  test('OAuth gho_', () => expect(fn('gho_' + 'a'.repeat(36))).toBe(true));
  test('user ghu_', () => expect(fn('ghu_' + 'a'.repeat(36))).toBe(true));
  test('SSH ghs_', () => expect(fn('ghs_' + 'a'.repeat(36))).toBe(true));
  test('refresh ghr_', () => expect(fn('ghr_' + 'a'.repeat(36))).toBe(true));
  test('rejects too short', () => expect(fn('ghp_' + 'a'.repeat(35))).toBe(false));
  test('rejects empty', () => expect(fn('')).toBe(false));
});

describe('isValidGistId', () => {
  const fn = (id: string): boolean => !id ? false : /^[a-f0-9]{32,}$/i.test(id);
  test('accepts 32 hex', () => expect(fn('a'.repeat(32))).toBe(true));
  test('accepts uppercase', () => expect(fn('A'.repeat(32))).toBe(true));
  test('rejects non-hex', () => expect(fn('z'.repeat(32))).toBe(false));
});

describe('normalizeUrl', () => {
  const fn = (url: string): string => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return 'https://' + url;
  };
  test('adds https', () => expect(fn('example.com')).toBe('https://example.com'));
  test('keeps https', () => expect(fn('https://x.com')).toBe('https://x.com'));
});

describe('generateId', () => {
  const fn = (): string => Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
  test('unique ids', () => {
    const ids = new Set(Array.from({ length: 100 }, () => fn()));
    expect(ids.size).toBe(100);
  });
  test('non-empty', () => expect(fn().length).toBeGreaterThan(0));
});
