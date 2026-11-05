/**
 * Marvel Champions Digital (MCD) - Card art naming and URLs (ADR-0092, decision 8).
 *
 * Pure and environment-neutral: the dev server, the cache script and the UI all build the same
 * names and URLs here. The art of a card is found by the pack that owns the card; the file name
 * follows the pack's own declared convention, never a card-code prefix.
 */

import type { CardType } from '../../engine/models/enums.ts';
import type { ArtPackCredit, ArtPackImage, ArtPackManifest } from '../packs/art-pack.ts';
import { getArtPackVersion, getDisabledArtPacks, getLoadedContent } from './store.ts';
import type { LoadedContent, LoadedPack } from './types.ts';

/** Route served by the dev and preview servers: `/card-art/<packId>/<file>.png`. */
export const CARD_ART_ROUTE = '/card-art';

/** Pseudo pack that holds the three generic card backs; no pack id can start with `_`. */
export const CARD_BACKS_DIR = '_backs';

/** Route folder of an art pack: `/card-art/_art-<id>/<file>.png` (ADR-0093). */
export const ART_PACK_DIR_PREFIX = '_art-';

/** File names are `<code>.png` for codes made of letters, digits, `_` and `-`. */
export const CARD_ART_FILE_PATTERN = /^[a-zA-Z0-9_-]+\.png$/;

const MARVELCDB_CDN_BASE = 'https://marvelcdb.com/bundles/cards';

export type CardBackType = 'player' | 'encounter' | 'villain';

/** A card's current values, which select among an art pack's stat images. */
export interface CardArtStats {
  attack: number;
  hitPoints: number;
}

export interface CardArtIdentifier {
  code: string;
  type?: CardType | string;
  stage?: string;
  artStats?: CardArtStats;
  /** Ignore art packs: the Card Editor, and the fallback when an art pack image fails to load. */
  officialArt?: boolean;
}

export interface ArtPackArt {
  url: string;
  packName: string;
  credit: ArtPackCredit;
}

function isMainScheme(type: string | undefined, stage: string | undefined): boolean {
  return (
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
let indexedArtPackVersion = -1;
let packByCode = new Map<string, LoadedPack>();
let artPackByCode = new Map<string, ArtPackManifest>();

function refreshCardArtIndex(): void {
  const content = getLoadedContent();
  const version = getArtPackVersion();
  if (content === indexedContent && version === indexedArtPackVersion) return;
  packByCode = new Map();
  artPackByCode = new Map();
  for (const pack of content.packs) {
    for (const card of pack.cards) if (!packByCode.has(card.code)) packByCode.set(card.code, pack);
  }
  // Art packs are ordered by folder name, so the first one that is switched on and lists a card
  // is the one used. A pack the player switched off shows nothing.
  const disabled = getDisabledArtPacks();
  for (const artPack of content.artPacks) {
    if (disabled.has(artPack.id)) continue;
    for (const code of Object.keys(artPack.cards)) {
      if (!artPackByCode.has(code)) artPackByCode.set(code, artPack);
    }
  }
  indexedContent = content;
  indexedArtPackVersion = version;
}

/** The loaded pack that owns a card code (its cards file sits in that pack). */
function ownerPack(code: string): LoadedPack | undefined {
  refreshCardArtIndex();
  return packByCode.get(code.trim());
}

function artPackFor(code: string): ArtPackManifest | undefined {
  refreshCardArtIndex();
  return artPackByCode.get(code.trim());
}

/** The route URL of one image of an art pack (ADR-0093). */
export function artPackImageUrl(artPack: ArtPackManifest, image: ArtPackImage): string {
  return `${CARD_ART_ROUTE}/${ART_PACK_DIR_PREFIX}${artPack.id}/${image.file}`;
}

/**
 * The image a card shows from its art pack, if it has one. Among stat images it is the highest one
 * whose printed ATK and hit points are both at or below the card's current values, otherwise the
 * lowest one. A card with no known stats shows the lowest one.
 */
export function artPackArt(code: string, stats?: CardArtStats): ArtPackArt | undefined {
  const artPack = artPackFor(code);
  if (!artPack) return undefined;
  const lowestFirst = [...artPack.cards[code.trim()]].sort(
    (a, b) => (a.attack ?? 0) + (a.hitPoints ?? 0) - ((b.attack ?? 0) + (b.hitPoints ?? 0)),
  );
  const reached = stats
    ? lowestFirst.filter(
        (image) =>
          (image.attack ?? 0) <= stats.attack && (image.hitPoints ?? 0) <= stats.hitPoints,
      )
    : [];
  const image = reached[reached.length - 1] ?? lowestFirst[0];
  return {
    url: artPackImageUrl(artPack, image),
    packName: artPack.name,
    credit: artPack.credit,
  };
}

/** Whether the card's art pack image changes with its current stats. */
export function artPackHasStatImages(code: string): boolean {
  const artPack = artPackFor(code);
  return artPack !== undefined && artPack.cards[code.trim()][0].attack !== undefined;
}

/** Every image a card can show from its art pack, for preloading. */
export function artPackImageUrls(code: string): string[] {
  const artPack = artPackFor(code);
  if (!artPack) return [];
  return artPack.cards[code.trim()].map((image) => artPackImageUrl(artPack, image));
}

/** Id of the pack that owns a card code, or `undefined` when no loaded pack has it. */
export function artPackId(code: string): string | undefined {
  return ownerPack(code)?.id;
}

/**
 * The local URL of a card's art: its art pack image when it has one, otherwise
 * `/card-art/<packId>/<file>.png` for a card of a loaded pack, otherwise an empty string.
 */
export function localArtUrl(card: CardArtIdentifier | string): string {
  const { code, artStats, officialArt } = typeof card === 'string' ? ({ code: card } as CardArtIdentifier) : card;
  const art = officialArt ? undefined : artPackArt(code ?? '', artStats);
  if (art) return art.url;
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
