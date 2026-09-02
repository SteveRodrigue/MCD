/**
 * Marvel Champions Digital - Card Art Caching & Multi-Sided Asset Service
 * Implements a local-first CacheStorage & in-memory Blob caching mechanism.
 */

const CACHE_NAME = 'mcd-card-art-v1';
const MARVELCDB_CDN_BASE = 'https://marvelcdb.com/bundles/cards';

// In-memory runtime Object URL cache to avoid re-generating blob URLs
const objectUrlMemoryCache = new Map<string, string>();

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
 * Retrieves card art with a strict Local-First offline strategy:
 * 1. Resolves immediately to the local static asset endpoint (`/cards/${fileName}`).
 * 2. If running outside the local dev/prod server or missing on disk, CardView automatically
 *    falls back to getRemoteMarvelCdbUrl.
 */
export async function getCardArtUrl(card: CardArtIdentifier | string): Promise<string> {
  return getLocalCardArtUrl(card);
}

/**
 * Preloads a list of card arts into CacheStorage in the background.
 */
export async function preloadCardArts(cards: (CardArtIdentifier | string)[]): Promise<void> {
  if (!cards || cards.length === 0) return;
  await Promise.allSettled(cards.map((card) => getCardArtUrl(card)));
}

/**
 * Checks if the browser supports the CacheStorage API.
 */
function isCacheStorageAvailable(): boolean {
  return typeof window !== 'undefined' && 'caches' in window;
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
