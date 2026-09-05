import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getCardArtFileName,
  normalizeCardCodeForArt,
  getLocalCardArtUrl,
  getRemoteMarvelCdbUrl,
  getCardArtUrl,
  isCardArtCached,
  clearCardArtCache,
} from '../../src/ui/services/card-cache-service';
import { CardType } from '../../src/engine/models';

describe('Card Art Caching & Multi-Sided Asset Resolution Service', () => {
  it('correctly normalizes card codes for legacy callers', () => {
    expect(
      normalizeCardCodeForArt({ code: '01097a', type: CardType.MAIN_SCHEME, stage: '1A' }),
    ).toBe('01097b');
    expect(
      normalizeCardCodeForArt({ code: '01097b', type: CardType.MAIN_SCHEME, stage: '1B' }),
    ).toBe('01097');
    expect(normalizeCardCodeForArt({ code: '01001a', type: CardType.HERO })).toBe('01001a');
  });

  it('correctly resolves card image file names handling Core Set exceptions and standard expansions', () => {
    // --- Core Set Inverted Exception (Pack 01xxx) ---
    // Rhino 1A (Setup face -> 01097b.png)
    expect(
      getCardArtFileName({
        code: '01097a',
        type: CardType.MAIN_SCHEME,
        stage: '1A',
      }),
    ).toBe('01097b.png');

    // Rhino 1B (Active threat face -> 01097.png)
    expect(
      getCardArtFileName({
        code: '01097b',
        type: CardType.MAIN_SCHEME,
        stage: '1B',
      }),
    ).toBe('01097.png');

    // Klaw 2A (Setup face -> 01117b.png)
    expect(
      getCardArtFileName({
        code: '01117a',
        type: 'main_scheme',
        stage: '2A',
      }),
    ).toBe('01117b.png');

    // Klaw 2B (Active threat face -> 01117.png)
    expect(
      getCardArtFileName({
        code: '01117b',
        type: 'main_scheme',
        stage: '2B',
      }),
    ).toBe('01117.png');

    // --- Standard Expansions Convention (All other packs) ---
    // Green Goblin: Risky Business 1A -> 02004.png
    expect(
      getCardArtFileName({
        code: '02004a',
        type: CardType.MAIN_SCHEME,
        stage: '1A',
      }),
    ).toBe('02004.png');

    // Green Goblin: Risky Business 1B -> 02004b.png
    expect(
      getCardArtFileName({
        code: '02004b',
        type: CardType.MAIN_SCHEME,
        stage: '1B',
      }),
    ).toBe('02004b.png');

    // The Hood 1A -> 24004.png
    expect(
      getCardArtFileName({
        code: '24004a',
        type: CardType.MAIN_SCHEME,
        stage: '1A',
      }),
    ).toBe('24004.png');

    // The Hood 1B -> 24004b.png
    expect(
      getCardArtFileName({
        code: '24004b',
        type: CardType.MAIN_SCHEME,
        stage: '1B',
      }),
    ).toBe('24004b.png');

    // Drang 1A -> 16061.png
    expect(
      getCardArtFileName({
        code: '16061a',
        type: CardType.MAIN_SCHEME,
        stage: '1A',
      }),
    ).toBe('16061.png');

    // Drang 1B -> 16061b.png
    expect(
      getCardArtFileName({
        code: '16061b',
        type: CardType.MAIN_SCHEME,
        stage: '1B',
      }),
    ).toBe('16061b.png');

    // Hero identity (01001a.png)
    expect(
      getCardArtFileName({
        code: '01001a',
        type: CardType.HERO,
      }),
    ).toBe('01001a.png');

    // Alter-Ego identity (01001b.png)
    expect(
      getCardArtFileName({
        code: '01001b',
        type: CardType.ALTER_EGO,
      }),
    ).toBe('01001b.png');

    // Villain (01094.png)
    expect(
      getCardArtFileName({
        code: '01094',
        type: CardType.VILLAIN,
        stage: 'I',
      }),
    ).toBe('01094.png');

    // Event card (01006.png)
    expect(
      getCardArtFileName({
        code: '01006',
        type: CardType.EVENT,
      }),
    ).toBe('01006.png');
  });

  it('constructs correct MarvelCDB CDN endpoints for multi-sided identity and scheme cards', () => {
    // Spider-Man Hero side (A -> 01001a.png)
    expect(getRemoteMarvelCdbUrl({ code: '01001a', type: CardType.HERO })).toBe(
      'https://marvelcdb.com/bundles/cards/01001a.png',
    );

    // Peter Parker Alter-Ego side (B -> 01001b.png)
    expect(getRemoteMarvelCdbUrl({ code: '01001b', type: CardType.ALTER_EGO })).toBe(
      'https://marvelcdb.com/bundles/cards/01001b.png',
    );

    // Rhino Villain Stage I
    expect(getRemoteMarvelCdbUrl({ code: '01094', type: CardType.VILLAIN })).toBe(
      'https://marvelcdb.com/bundles/cards/01094.png',
    );

    // The Break-In! Main Scheme 1A (Core Set Setup face -> 01097b.png)
    expect(getRemoteMarvelCdbUrl({ code: '01097a', type: CardType.MAIN_SCHEME, stage: '1A' })).toBe(
      'https://marvelcdb.com/bundles/cards/01097b.png',
    );

    // The Break-In! Main Scheme 1B (Core Set Active threat face -> 01097.png)
    expect(getRemoteMarvelCdbUrl({ code: '01097b', type: CardType.MAIN_SCHEME, stage: '1B' })).toBe(
      'https://marvelcdb.com/bundles/cards/01097.png',
    );

    // Standard expansion: Green Goblin Main Scheme 1A -> 02004.png, 1B -> 02004b.png
    expect(getRemoteMarvelCdbUrl({ code: '02004a', type: CardType.MAIN_SCHEME, stage: '1A' })).toBe(
      'https://marvelcdb.com/bundles/cards/02004.png',
    );
    expect(getRemoteMarvelCdbUrl({ code: '02004b', type: CardType.MAIN_SCHEME, stage: '1B' })).toBe(
      'https://marvelcdb.com/bundles/cards/02004b.png',
    );

    // Swinging Web Kick Player Event
    expect(getRemoteMarvelCdbUrl('01006')).toBe('https://marvelcdb.com/bundles/cards/01006.png');
  });

  it('constructs correct local static paths for offline card assets', () => {
    expect(getLocalCardArtUrl({ code: '01001a', type: CardType.HERO })).toBe('/cards/01001a.png');
    expect(getLocalCardArtUrl({ code: '01001b', type: CardType.ALTER_EGO })).toBe(
      '/cards/01001b.png',
    );
    expect(getLocalCardArtUrl({ code: '01097a', type: CardType.MAIN_SCHEME, stage: '1A' })).toBe(
      '/cards/01097b.png',
    );
    expect(getLocalCardArtUrl({ code: '01097b', type: CardType.MAIN_SCHEME, stage: '1B' })).toBe(
      '/cards/01097.png',
    );
    expect(getLocalCardArtUrl({ code: '02004a', type: CardType.MAIN_SCHEME, stage: '1A' })).toBe(
      '/cards/02004.png',
    );
    expect(getLocalCardArtUrl({ code: '02004b', type: CardType.MAIN_SCHEME, stage: '1B' })).toBe(
      '/cards/02004b.png',
    );
  });

  it('returns valid local-first URL string from getCardArtUrl when CacheStorage is unavailable', async () => {
    const url = await getCardArtUrl({ code: '01001a', type: CardType.HERO });
    expect(url).toBe('/cards/01001a.png');
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
      mockStorage.set('/cards/01006.png', { ok: true });
      expect(await isCardArtCached('01006')).toBe(true);
    });

    it('Step 1 (Hit): serves image from cache when already present', async () => {
      const mockBlob = new Blob(['mock-image-data'], { type: 'image/png' });
      mockStorage.set('/cards/01006.png', {
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
      expect(mockStorage.has('/cards/01001a.png')).toBe(true);
      expect(await isCardArtCached('01001a')).toBe(true);
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
      mockStorage.set('/cards/01015.png', { ok: true });
      expect(await isCardArtCached('01015')).toBe(true);

      await clearCardArtCache();
      expect(mockStorage.size).toBe(0);
      expect(await isCardArtCached('01015')).toBe(false);
    });
  });
});
