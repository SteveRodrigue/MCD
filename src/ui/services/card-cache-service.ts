/**
 * Marvel Champions Digital - Card Art Caching & Multi-Sided Asset Service
 * Implements a local-first CacheStorage & in-memory Blob caching mechanism.
 */

const CACHE_NAME = 'mcd-card-art-v1';
const MARVELCDB_CDN_BASE = 'https://marvelcdb.com/bundles/cards';

// In-memory runtime Object URL cache to avoid re-generating blob URLs
const objectUrlMemoryCache = new Map<string, string>();

// In-flight download promises map to deduplicate concurrent requests for the same card art
const inFlightCardArtRequests = new Map<string, Promise<string>>();

import { CardType } from '../../engine/models';

export interface CardArtIdentifier {
  code: string;
  type?: CardType | string;
  stage?: string;
}

/**
 * Resolves the image asset file name for Main Scheme cards, handling
 * the inverted naming quirk in the upstream Core Set (01xxx) encounter data:
 *
 * - Core Set Main Schemes (pack "01", e.g. Rhino 01097, Klaw 01116/01117, Ultron 01137/01138/01139):
 *   - Stage 'A' (Setup face): maps to `${baseCode}b.png` (e.g. "01097b.png")
 *   - Stage 'B' (Active threat face): maps to `${baseCode}.png` (e.g. "01097.png")
 *
 * - All other expansion sets (Green Goblin, The Hood, Galaxy's Most Wanted, Mutant Genesis, etc.):
 *   - Stage 'A' (Setup face): maps to `${baseCode}.png` (e.g. "02004.png", "24004.png", "16061.png")
 *   - Stage 'B' (Active threat face): maps to `${baseCode}b.png` (e.g. "02004b.png", "24004b.png", "16061b.png")
 */
export function resolveMainSchemeArtFileName(code: string, stage?: string): string {
  const trimmedCode = (code || '').trim().toLowerCase();
  if (!trimmedCode) return '';

  const baseCode = trimmedCode.replace(/[ab]$/i, '');
  const isCoreSet = baseCode.startsWith('01');

  const normalizedStage = (stage || '').toUpperCase();
  const isSideA = normalizedStage.endsWith('A') || (!normalizedStage && trimmedCode.endsWith('a'));

  if (isCoreSet) {
    // Core set inverted image asset quirk
    return isSideA ? `${baseCode}b.png` : `${baseCode}.png`;
  }

  // Standard expansion set convention
  return isSideA ? `${baseCode}.png` : `${baseCode}b.png`;
}

/**
 * Returns the exact image asset filename for any card based on its code, type, and stage.
 */
export function getCardArtFileName(card: CardArtIdentifier | string): string {
  if (!card) return '';
  if (typeof card === 'string') {
    const trimmed = card.trim().toLowerCase();
    return `${trimmed}.png`;
  }

  const { code, type, stage } = card;
  const trimmedCode = (code || '').trim().toLowerCase();
  if (!trimmedCode) return '';

  const isMainScheme =
    type === CardType.MAIN_SCHEME ||
    type === 'main_scheme' ||
    (stage !== undefined && /^[0-9]+[ab]$/i.test(stage));

  if (isMainScheme) {
    return resolveMainSchemeArtFileName(trimmedCode, stage);
  }

  return `${trimmedCode}.png`;
}

/**
 * Legacy compatibility alias for getCardArtFileName (without extension).
 */
export function normalizeCardCodeForArt(card: CardArtIdentifier | string): string {
  const fileName = getCardArtFileName(card);
  return fileName.replace(/\.png$/i, '');
}

/**
 * Returns the local static URL for a cached card image (e.g. "/cards/01097.png").
 */
export function getLocalCardArtUrl(card: CardArtIdentifier | string): string {
  const fileName = getCardArtFileName(card);
  if (!fileName) return '';
  return `/cards/${fileName}`;
}

/**
 * Returns the remote MarvelCDB image CDN URL for a given card object or code.
 */
export function getRemoteMarvelCdbUrl(card: CardArtIdentifier | string): string {
  const fileName = getCardArtFileName(card);
  if (!fileName) return '';
  return `${MARVELCDB_CDN_BASE}/${fileName}`;
}

/**
 * Checks if the browser supports the CacheStorage API.
 */
export function isCacheStorageAvailable(): boolean {
  return typeof window !== 'undefined' && 'caches' in window;
}

/**
 * Checks if a specific card's art is currently present in the cache (memory or CacheStorage).
 */
export async function isCardArtCached(card: CardArtIdentifier | string): Promise<boolean> {
  const fileName = getCardArtFileName(card);
  if (!fileName) return false;
  if (objectUrlMemoryCache.has(fileName)) return true;

  if (isCacheStorageAvailable()) {
    try {
      const cache = await caches.open(CACHE_NAME);
      const requestUrl = getLocalCardArtUrl(card);
      const match = await cache.match(requestUrl);
      return Boolean(match);
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * Retrieves card art with a Read-Through On-Demand Caching strategy:
 * 1. Checks if the image is in cache (memory or CacheStorage).
 * 2. If not in cache, downloads the image (via local endpoint or MarvelCDB CDN) and saves it into CacheStorage.
 * 3. Returns the image directly from the cache.
 */
export async function getCardArtUrl(card: CardArtIdentifier | string): Promise<string> {
  const fileName = getCardArtFileName(card);
  if (!fileName) return '';

  // 1. Check in-memory object URL cache (fastest, 0ms)
  if (objectUrlMemoryCache.has(fileName)) {
    return objectUrlMemoryCache.get(fileName)!;
  }

  // Deduplicate concurrent in-flight requests for the exact same card art
  const existingRequest = inFlightCardArtRequests.get(fileName);
  if (existingRequest) {
    return existingRequest;
  }

  const artPromise = (async () => {
    const localUrl = getLocalCardArtUrl(card);
    const remoteUrl = getRemoteMarvelCdbUrl(card);

    // If CacheStorage is unavailable (e.g. Node/test environment without mock), return local URL
    if (!isCacheStorageAvailable()) {
      return localUrl;
    }

    try {
      const cache = await caches.open(CACHE_NAME);

      // 1. Check if the image is in CacheStorage
      const cachedResponse = await cache.match(localUrl);
      if (cachedResponse && cachedResponse.ok) {
        const blob = await cachedResponse.blob();
        const objectUrl = URL.createObjectURL(blob);
        objectUrlMemoryCache.set(fileName, objectUrl);
        return objectUrl;
      }

      // 2. If not in cache, download the image and put it in the cache
      let response: Response | null = null;
      try {
        const localResp = await fetch(localUrl);
        if (localResp.ok) {
          response = localResp;
        }
      } catch {
        // Local server unavailable or failed
      }

      // If local server endpoint didn't provide image, fetch directly from remote CDN
      if (!response && remoteUrl) {
        try {
          const remoteResp = await fetch(remoteUrl);
          if (remoteResp.ok) {
            response = remoteResp;
          }
        } catch {
          // Remote CDN fetch failed
        }
      }

      if (response && response.ok) {
        // Put the downloaded image into the cache
        await cache.put(localUrl, response.clone());
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        objectUrlMemoryCache.set(fileName, objectUrl);
        // 3. Display the image from the cache
        return objectUrl;
      }
    } catch {
      // Fallback on error
    }

    return localUrl;
  })().finally(() => {
    inFlightCardArtRequests.delete(fileName);
  });

  inFlightCardArtRequests.set(fileName, artPromise);
  return artPromise;
}

/**
 * Preloads a list of card arts into CacheStorage in the background.
 */
export async function preloadCardArts(cards: (CardArtIdentifier | string)[]): Promise<void> {
  if (!cards || cards.length === 0) return;
  await Promise.allSettled(cards.map((card) => getCardArtUrl(card)));
}

/**
 * Clears the persistent and in-memory card art caches.
 */
export async function clearCardArtCache(): Promise<void> {
  objectUrlMemoryCache.forEach((url) => {
    try {
      URL.revokeObjectURL(url);
    } catch {
      // Ignore revocation failure in headless/unsupported test environments
    }
  });
  objectUrlMemoryCache.clear();
  inFlightCardArtRequests.clear();

  if (isCacheStorageAvailable()) {
    try {
      await caches.delete(CACHE_NAME);
    } catch {
      // Ignore cache deletion failure in restricted environments
    }
  }
}
