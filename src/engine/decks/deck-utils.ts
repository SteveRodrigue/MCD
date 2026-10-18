import { MarvelCDBDeck, parseMarvelCDBDeckMeta } from '../models';

/**
 * Sanitizes a string into a safe, lowercase ASCII URL/filesystem slug.
 * Strips out illegal characters for Windows/macOS/Linux filesystems.
 */
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphens
    .replace(/^-+|-+$/g, '') // Trim leading/trailing hyphens
    .slice(0, 50);
}

/**
 * Generates a collision-resistant, domain-namespaced filename according to ADR-0016.
 */
let deckFileCounter = 0;

export function generateDeckFilename(
  deck: MarvelCDBDeck,
  domain: 'prebuilt' | 'marvelcdb' | 'user' = 'user',
  uniqueIdSuffix?: string,
): string {
  const meta = parseMarvelCDBDeckMeta(deck.meta);
  const aspect = meta.aspect ? slugify(meta.aspect) : 'custom';
  const heroSlug = slugify(deck.hero_name);
  const titleSlug = slugify(deck.name);

  switch (domain) {
    case 'prebuilt': {
      const pack = 'core';
      return `${pack}_${heroSlug.replace(/-/g, '_')}_${aspect}.json`;
    }
    case 'marvelcdb': {
      const deckId = deck.id;
      return `mcdb_${deckId}_${titleSlug}.json`;
    }
    case 'user':
    default: {
      const suffix = uniqueIdSuffix || (++deckFileCounter).toString(36).padStart(4, '0');
      return `user_${heroSlug.replace(/-/g, '_')}_${titleSlug}_${suffix}.json`;
    }
  }
}
