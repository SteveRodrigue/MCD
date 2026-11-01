/**
 * Marvel Champions Digital - Card Art Caching Service
 * Implements a local-first CacheStorage & in-memory Blob caching mechanism. Names and URLs of the
 * art come from `src/data/content/card-art.ts`.
 */

import { NormalizedCard } from '../../engine/models';
import { CardArtIdentifier, CardBackType, localArtUrl } from '../../data/content/card-art';

const CACHE_NAME = 'mcd-card-art-v2';

// In-memory runtime Object URL cache to avoid re-generating blob URLs
const objectUrlMemoryCache = new Map<string, string>();

// In-flight download promises map to deduplicate concurrent requests for the same card art
const inFlightCardArtRequests = new Map<string, Promise<string>>();

/**
 * Checks if the browser supports the CacheStorage API.
 */
function isCacheStorageAvailable(): boolean {
  return typeof window !== 'undefined' && 'caches' in window;
}

/**
 * Checks if a specific card's art is currently present in the cache (memory or CacheStorage).
 */
export async function isCardArtCached(card: CardArtIdentifier | string): Promise<boolean> {
  const requestUrl = localArtUrl(card);
  if (!requestUrl) return false;
  if (objectUrlMemoryCache.has(requestUrl)) return true;

  if (isCacheStorageAvailable()) {
    try {
      const cache = await caches.open(CACHE_NAME);
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
 * 2. If not in cache, downloads the image through the server route and saves it into CacheStorage.
 * 3. Returns the image directly from the cache.
 */
export async function getCardArtUrl(card: CardArtIdentifier | string): Promise<string> {
  const localUrl = localArtUrl(card);
  if (!localUrl) return '';

  // 1. Check in-memory object URL cache (fastest, 0ms)
  if (objectUrlMemoryCache.has(localUrl)) {
    return objectUrlMemoryCache.get(localUrl)!;
  }

  // Deduplicate concurrent in-flight requests for the exact same card art
  const existingRequest = inFlightCardArtRequests.get(localUrl);
  if (existingRequest) {
    return existingRequest;
  }

  const artPromise = (async () => {
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
        objectUrlMemoryCache.set(localUrl, objectUrl);
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

      if (response && response.ok) {
        // Put the downloaded image into the cache
        await cache.put(localUrl, response.clone());
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        objectUrlMemoryCache.set(localUrl, objectUrl);
        // 3. Display the image from the cache
        return objectUrl;
      }
    } catch {
      // Fallback on error
    }

    return localUrl;
  })().finally(() => {
    inFlightCardArtRequests.delete(localUrl);
  });

  inFlightCardArtRequests.set(localUrl, artPromise);
  return artPromise;
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

/**
 * Returns the primary fallback hex color when a card back image cannot be loaded.
 */
export function getCardBackFallbackColor(type: CardBackType): string {
  switch (type) {
    case 'player':
      return '#0284c7';
    case 'encounter':
      return '#ea580c';
    case 'villain':
      return '#7c3aed';
    default:
      return '#0284c7';
  }
}

/**
 * Determines the appropriate card back type for a normalized card.
 */
export function getCardBackTypeForCard(card?: NormalizedCard | null): CardBackType {
  if (!card) return 'player';
  const type = (card.type || '').toLowerCase();
  const faction = (card.faction || '').toLowerCase();

  if (type === 'villain' || type === 'main_scheme') {
    return 'villain';
  }
  if (
    faction === 'encounter' ||
    type === 'minion' ||
    type === 'treachery' ||
    type === 'side_scheme' ||
    type === 'attachment' ||
    type === 'obligation' ||
    type === 'environment'
  ) {
    return 'encounter';
  }
  return 'player';
}
