/**
 * Official MarvelCDB Deck Data Structure
 * Matches public decklist & user deck JSON returned by https://marvelcdb.com/api/
 */
export interface MarvelCDBDeck {
  id: number | string;
  name: string;
  hero_code: string;
  hero_name: string;
  slots: Record<string, number>;
  ignoreDeckLimitSlots?: Record<string, number> | null;
  sideSlots?: Record<string, number> | null;
  meta?: string | MarvelCDBDeckMeta | null;
  description_md?: string;
  date_creation?: string;
  date_update?: string;
  user_id?: number | null;
  version?: string;
  tags?: string;
}

export interface MarvelCDBDeckMeta {
  aspect?: string;
  aspect_name?: string;
  extra_hero_cards?: string[];
  [key: string]: any;
}

/**
 * Helper to safely extract parsed metadata from MarvelCDB deck object.
 */
export function parseMarvelCDBDeckMeta(
  meta?: string | MarvelCDBDeckMeta | null,
): MarvelCDBDeckMeta {
  if (!meta) return {};
  if (typeof meta === 'object') return meta;
  try {
    return JSON.parse(meta);
  } catch {
    return {};
  }
}
