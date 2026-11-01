import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getCardArtUrl,
  isCardArtCached,
  clearCardArtCache,
} from '../../src/ui/services/card-cache-service';
import { CardType } from '../../src/engine/models';

describe('Card Art Caching & Multi-Sided Asset Resolution Service', () => {
  it('returns valid local-first URL string from getCardArtUrl when CacheStorage is unavailable', async () => {
    const url = await getCardArtUrl({ code: '01001a', type: CardType.HERO });
    expect(url).toBe('/card-art/core/01001a.png');
  });

  describe('Read-Through On-Demand CacheStorage Lifecycle', () => {
    const mockStorage = new Map<string, any>();
    let originalWindow: any;
    let originalFetch: any;

    beforeEach(async () => {
      mockStorage.clear();
      await clearCardArtCache();

      const mockCache = {
        match: async (key: string) => mockStorage.get(key) || null,
        put: async (key: string, resp: any) => {
          mockStorage.set(key, resp);
        },
        delete: async (key: string) => mockStorage.delete(key),
      };

      originalWindow = globalThis.window;
      originalFetch = globalThis.fetch;

      // Mock window and caches API
      (globalThis as any).window = {
        caches: {
          open: async () => mockCache,
          delete: async () => {
            mockStorage.clear();
            return true;
          },
        },
      };
      (globalThis as any).caches = (globalThis as any).window.caches;

      // Mock URL.createObjectURL and revokeObjectURL
      if (!globalThis.URL.createObjectURL) {
        globalThis.URL.createObjectURL = (_blob: any) => `blob:mock-url-${Math.random()}`;
      }
      if (!globalThis.URL.revokeObjectURL) {
        globalThis.URL.revokeObjectURL = () => {};
      }
    });

    afterEach(async () => {
      await clearCardArtCache();
      if (originalWindow === undefined) {
        delete (globalThis as any).window;
        delete (globalThis as any).caches;
      } else {
        (globalThis as any).window = originalWindow;
        (globalThis as any).caches = originalWindow?.caches;
      }
      globalThis.fetch = originalFetch;
    });

    it('reports correct cached status via isCardArtCached', async () => {
      expect(await isCardArtCached('01006')).toBe(false);

      // Pre-populate mock cache
      mockStorage.set('/card-art/core/01006.png', { ok: true });
      expect(await isCardArtCached('01006')).toBe(true);
    });

    it('Step 1 (Hit): serves image from cache when already present', async () => {
      const mockBlob = new Blob(['mock-image-data'], { type: 'image/png' });
      mockStorage.set('/card-art/core/01006.png', {
        ok: true,
        blob: async () => mockBlob,
      });

      const url = await getCardArtUrl('01006');
      expect(url).toMatch(/^blob:/);
      expect(await isCardArtCached('01006')).toBe(true);
    });

    it('Step 2 & 3 (Miss -> Download -> Cache -> Display): downloads and caches when missing', async () => {
      const mockBlob = new Blob(['downloaded-image-data'], { type: 'image/png' });
      let fetchCalled = false;

      globalThis.fetch = async (_input: any) => {
        fetchCalled = true;
        return {
          ok: true,
          clone: function () {
            return this;
          },
          blob: async () => mockBlob,
        } as any;
      };

      const url = await getCardArtUrl('01001a');
      expect(fetchCalled).toBe(true);
      expect(url).toMatch(/^blob:/);
      expect(mockStorage.has('/card-art/core/01001a.png')).toBe(true);
      expect(await isCardArtCached('01001a')).toBe(true);
    });

    it('returns the local URL and never fetches the remote CDN when the local endpoint fails', async () => {
      const fetched: string[] = [];

      globalThis.fetch = async (input: any) => {
        fetched.push(String(input));
        return { ok: false } as any;
      };

      const url = await getCardArtUrl('01002');
      expect(fetched).toEqual(['/card-art/core/01002.png']);
      expect(url).toBe('/card-art/core/01002.png');
      expect(mockStorage.has('/card-art/core/01002.png')).toBe(false);
    });

    it('deduplicates concurrent in-flight requests for identical card art', async () => {
      let fetchCount = 0;
      const mockBlob = new Blob(['data'], { type: 'image/png' });

      globalThis.fetch = async () => {
        fetchCount++;
        await new Promise((r) => setTimeout(r, 10));
        return {
          ok: true,
          clone: function () {
            return this;
          },
          blob: async () => mockBlob,
        } as any;
      };

      const [url1, url2] = await Promise.all([getCardArtUrl('01008'), getCardArtUrl('01008')]);

      expect(fetchCount).toBe(1);
      expect(url1).toBe(url2);
    });

    it('clears cache and revokes object URLs via clearCardArtCache', async () => {
      mockStorage.set('/card-art/core/01015.png', { ok: true });
      expect(await isCardArtCached('01015')).toBe(true);

      await clearCardArtCache();
      expect(mockStorage.size).toBe(0);
      expect(await isCardArtCached('01015')).toBe(false);
    });
  });
});
