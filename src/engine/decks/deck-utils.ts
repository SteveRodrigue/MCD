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
      const suffix = uniqueIdSuffix || Math.random().toString(36).substring(2, 6);
      return `user_${heroSlug.replace(/-/g, '_')}_${titleSlug}_${suffix}.json`;
    }
  }
}
