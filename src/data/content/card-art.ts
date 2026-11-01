/**
 * Marvel Champions Digital (MCD) - Card art naming and URLs (ADR-0092, decision 8).
 *
 * Pure and environment-neutral: the dev server, the cache script and the UI all build the same
 * names and URLs here. The art of a card is found by the pack that owns the card; the file name
 * follows the pack's own declared convention, never a card-code prefix.
 */

import { CardType } from '../../engine/models';
import { getLoadedContent } from './store';
import type { LoadedContent, LoadedPack } from './types';

/** Route served by the dev and preview servers: `/card-art/<packId>/<file>.png`. */
export const CARD_ART_ROUTE = '/card-art';

/** Pseudo pack that holds the three generic card backs; no pack id can start with `_`. */
export const CARD_BACKS_DIR = '_backs';

/** File names are `<code>.png` for codes made of letters, digits, `_` and `-`. */
export const CARD_ART_FILE_PATTERN = /^[a-zA-Z0-9_-]+\.png$/;

const MARVELCDB_CDN_BASE = 'https://marvelcdb.com/bundles/cards';

export type CardBackType = 'player' | 'encounter' | 'villain';

export interface CardArtIdentifier {
  code: string;
  type?: CardType | string;
  stage?: string;
}

function isMainScheme(type: string | undefined, stage: string | undefined): boolean {
  return (
    type === CardType.MAIN_SCHEME ||
    type === 'main_scheme' ||
    (stage !== undefined && /^[0-9]+[ab]$/i.test(stage))
  );
}

/**
 * The art file of a card. A main scheme has one image per side (`<base>.png` for the first,
 * `<base>b.png` for the second); a pack whose upstream art has the two sides the other way round
 * declares `art.swapMainSchemeSides` in its manifest.
 */
export function artFileName(
  card: CardArtIdentifier | string,
  swapMainSchemeSides: boolean = false,
): string {
  const { code, type, stage } = typeof card === 'string' ? { code: card } : card;
  const trimmedCode = (code || '').trim().toLowerCase();
  if (!trimmedCode) return '';

  if (!isMainScheme(type, stage)) return `${trimmedCode}.png`;

  const baseCode = trimmedCode.replace(/[ab]$/i, '');
  const normalizedStage = (stage || '').toUpperCase();
  const isSideA = normalizedStage.endsWith('A') || (!normalizedStage && trimmedCode.endsWith('a'));
  return isSideA !== swapMainSchemeSides ? `${baseCode}.png` : `${baseCode}b.png`;
}

let indexedContent: LoadedContent | null = null;
let packByCode = new Map<string, LoadedPack>();

/** The loaded pack that owns a card code (its cards file sits in that pack). */
function ownerPack(code: string): LoadedPack | undefined {
  const content = getLoadedContent();
  if (content !== indexedContent) {
    packByCode = new Map();
    for (const pack of content.packs) {
      for (const card of pack.cards) if (!packByCode.has(card.code)) packByCode.set(card.code, pack);
    }
    indexedContent = content;
  }
  return packByCode.get(code.trim());
}

/** Id of the pack that owns a card code, or `undefined` when no loaded pack has it. */
export function artPackId(code: string): string | undefined {
  return ownerPack(code)?.id;
}

/** `/card-art/<packId>/<file>.png` for a card of a loaded pack, otherwise an empty string. */
export function localArtUrl(card: CardArtIdentifier | string): string {
  const code = typeof card === 'string' ? card : card.code;
  const pack = ownerPack(code ?? '');
  if (!pack) return '';
  const fileName = artFileName(card, pack.manifest.art?.swapMainSchemeSides);
  return fileName ? `${CARD_ART_ROUTE}/${pack.id}/${fileName}` : '';
}

/** The MarvelCDB image URL of a card, or an empty string for a user pack or an unknown card. */
export function remoteArtUrl(card: CardArtIdentifier | string): string {
  const code = typeof card === 'string' ? card : card.code;
  const pack = ownerPack(code ?? '');
  if (!pack || pack.manifest.origin === 'user') return '';
  return `${MARVELCDB_CDN_BASE}/${artFileName(card, pack.manifest.art?.swapMainSchemeSides)}`;
}

/** MarvelCDB image URL for a file name of an official pack. */
export function marvelCdbImageUrl(fileName: string): string {
  return `${MARVELCDB_CDN_BASE}/${fileName}`;
}

/** `/card-art/_backs/<type>.png`. */
export function cardBackUrl(type: CardBackType): string {
  return `${CARD_ART_ROUTE}/${CARD_BACKS_DIR}/${type}.png`;
}
