import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getCachedFavicon, setCachedFavicon } from '../icon-cache';

describe('icon-cache', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('setCachedFavicon + getCachedFavicon', () => {
    it('should store and retrieve a favicon URL', () => {
      setCachedFavicon('example.com', 'https://example.com/favicon.ico');
      const result = getCachedFavicon('example.com');
      expect(result).toBe('https://example.com/favicon.ico');
    });

    it('should return null for uncached domain', () => {
      const result = getCachedFavicon('unknown.com');
      expect(result).toBeNull();
    });

    it('should update existing cache entry', () => {
      setCachedFavicon('example.com', 'https://example.com/old.ico');
      setCachedFavicon('example.com', 'https://example.com/new.ico');
      const result = getCachedFavicon('example.com');
      expect(result).toBe('https://example.com/new.ico');
    });

    it('should return null when localStorage throws (private mode)', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });
      expect(getCachedFavicon('example.com')).toBeNull();
    });

    it('should handle corrupt cache entry gracefully', () => {
      localStorage.setItem('favicon_cache_example.com', 'not-json');
      expect(getCachedFavicon('example.com')).toBeNull();
    });

    it('should handle expired cache entry', () => {
      const past = Date.now() - 1000000;
      localStorage.setItem(
        'favicon_cache_example.com',
        JSON.stringify({ url: 'https://example.com/favicon.ico', expiresAt: past })
      );
      expect(getCachedFavicon('example.com')).toBeNull();
    });

    it('should not throw when localStorage.setItem fails', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('Quota exceeded');
      });
      expect(() => setCachedFavicon('example.com', 'https://example.com/favicon.ico')).not.toThrow();
    });
  });
});
