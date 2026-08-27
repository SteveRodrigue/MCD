/**
 * Marvel Champions Digital - Card Art Caching & Multi-Sided Asset Service
 * Implements a local-first CacheStorage & in-memory Blob caching mechanism.
 */

const CACHE_NAME = 'mcd-card-art-v1';
const MARVELCDB_CDN_BASE = 'https://marvelcdb.com/bundles/cards';

// In-memory runtime Object URL cache to avoid re-generating blob URLs
const objectUrlMemoryCache = new Map<string, string>();

/**
 * Normalizes card codes, ensuring multi-sided cards retain their exact sub-identifier.
 * e.g. "01001a" (Spider-Man), "01001b" (Peter Parker), "01097b" (The Break-In 1B), "01006" (Swinging Web Kick).
 */
export function normalizeCardCodeForArt(code: string): string {
  if (!code) return '';
  return code.trim().toLowerCase();
}

/**
 * Returns the remote MarvelCDB image CDN URL for a given card code.
 */
export function getRemoteMarvelCdbUrl(code: string): string {
  const normalized = normalizeCardCodeForArt(code);
  return `${MARVELCDB_CDN_BASE}/${normalized}.png`;
}

/**
 * Checks if the browser supports the CacheStorage API.
 */
function isCacheStorageAvailable(): boolean {
  return typeof window !== 'undefined' && 'caches' in window;
}

/**
 * Retrieves card art with a strict Cache-First strategy:
 * 1. Returns in-memory object URL if already created.
 * 2. Checks browser persistent CacheStorage ('mcd-card-art-v1').
 * 3. On cache miss: Fetches from MarvelCDB CDN, caches the response, and returns an Object URL.
 * 4. Falls back to direct CDN URL if Blob creation or Cache API fails.
 */
export async function getCardArtUrl(code: string): Promise<string> {
  const normalizedCode = normalizeCardCodeForArt(code);
  if (!normalizedCode) return '';

  // 1. Check in-memory cache
  if (objectUrlMemoryCache.has(normalizedCode)) {
    return objectUrlMemoryCache.get(normalizedCode)!;
  }

  const remoteUrl = getRemoteMarvelCdbUrl(normalizedCode);

  // If running in environment without CacheStorage, return remote URL
  if (!isCacheStorageAvailable()) {
    return remoteUrl;
  }

  try {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(remoteUrl);

    if (cachedResponse) {
      const blob = await cachedResponse.blob();
      const objectUrl = URL.createObjectURL(blob);
      objectUrlMemoryCache.set(normalizedCode, objectUrl);
      return objectUrl;
    }

    // 2. Fetch from MarvelCDB
    const response = await fetch(remoteUrl, { mode: 'cors' });
    if (!response.ok) {
      throw new Error(`Failed to fetch card art: HTTP ${response.status}`);
    }

    // Clone response before consuming it to store in CacheStorage
    await cache.put(remoteUrl, response.clone());

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    objectUrlMemoryCache.set(normalizedCode, objectUrl);
    return objectUrl;
  } catch (err) {
    // Graceful fallback to direct remote CDN URL
    console.warn(`[CardCacheService] Falling back to direct CDN for card ${normalizedCode}:`, err);
    return remoteUrl;
  }
}

/**
 * Preloads a list of card arts into CacheStorage in the background.
 */
export async function preloadCardArts(codes: string[]): Promise<void> {
  if (!codes || codes.length === 0) return;
  await Promise.allSettled(codes.map((code) => getCardArtUrl(code)));
}

/**
 * Clears the persistent and in-memory card art caches.
 */
export async function clearCardArtCache(): Promise<void> {
  objectUrlMemoryCache.forEach((url) => URL.revokeObjectURL(url));
  objectUrlMemoryCache.clear();

  if (isCacheStorageAvailable()) {
    await caches.delete(CACHE_NAME);
  }
}
