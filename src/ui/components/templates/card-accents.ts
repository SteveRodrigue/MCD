import { cardCatalog } from '../../../data/importer/card-loader';
import { isValidHexColor } from '../../utils/hero-theme';

/**
 * Card accent layer of the theme engine: a coloured edge that tells the player whose card a
 * modal row, tile or slot is about. Independent of the style and of the verb colour.
 */
export type AccentKind =
  | 'aggression'
  | 'justice'
  | 'leadership'
  | 'protection'
  | 'basic'
  | 'hero'
  | 'villain'
  | 'encounter';

export interface AccentSpec {
  label: string;
  /** One to three flat colours, drawn as equal stripes. */
  colors: readonly string[];
}

export const ACCENT_KINDS: readonly AccentKind[] = [
  'aggression',
  'justice',
  'leadership',
  'protection',
  'basic',
  'hero',
  'villain',
  'encounter',
];

/** Aspect colours follow the Marvel Champions aspect identity; hero/villain are fallbacks. */
export const ACCENT_PALETTE: Record<AccentKind, AccentSpec> = {
  aggression: { label: 'Aggression', colors: ['#ED1D24'] },
  justice: { label: 'Justice', colors: ['#FFDE00'] },
  leadership: { label: 'Leadership', colors: ['#0284C7'] },
  protection: { label: 'Protection', colors: ['#16A34A'] },
  basic: { label: 'Basic', colors: ['#94A3B8'] },
  hero: { label: 'Hero', colors: ['#1D4ED8', '#D97706'] },
  villain: { label: 'Villain', colors: ['#7F1D1D', '#111111'] },
  encounter: { label: 'Encounter', colors: ['#C2410C'] },
};

export interface CardAccent extends AccentSpec {
  kind: AccentKind;
}

const ASPECTS: readonly string[] = ['aggression', 'justice', 'leadership', 'protection', 'basic'];

const VILLAIN_SIDE_TYPES: readonly string[] = [
  'villain',
  'minion',
  'main_scheme',
  'side_scheme',
  'attachment',
  'treachery',
  'obligation',
];

const metaColors = (meta: unknown): string[] => {
  const raw = (meta as { colors?: unknown } | undefined)?.colors;
  return Array.isArray(raw) ? raw.filter(isValidHexColor).map((c) => c.trim()) : [];
};

/**
 * Heroes carry their own colours in the upstream pack (`meta.colors`); every card of a hero set
 * (signature upgrades, allies, events) shares the hero's colours. Villain side cards use the
 * villain accent (no upstream colours exist), aspects use the aspect palette.
 */
export const getCardAccent = (code: string): CardAccent | null => {
  const card = cardCatalog.getCard(code);
  if (!card) return null;

  const type = String(card.type);
  const faction = String(card.faction);

  if (faction === 'encounter' || type === 'villain') {
    const kind: AccentKind = type === 'villain' ? 'villain' : 'encounter';
    return { kind, ...ACCENT_PALETTE[kind] };
  }

  const identity = card.setCode ? cardCatalog.getHeroIdentity(card.setCode) : undefined;
  const colors = metaColors(identity?.hero.meta ?? card.meta).slice(0, 3);
  if (colors.length > 0 && (faction === 'hero' || card.belongsToHeroSet)) {
    return { kind: 'hero', label: ACCENT_PALETTE.hero.label, colors };
  }

  if (ASPECTS.includes(faction)) {
    const kind = faction as AccentKind;
    return { kind, ...ACCENT_PALETTE[kind] };
  }
  if (VILLAIN_SIDE_TYPES.includes(type)) return { kind: 'encounter', ...ACCENT_PALETTE.encounter };
  return { kind: 'hero', ...ACCENT_PALETTE.hero };
};

/** Hard-stop CSS gradient splitting the accent colours into equal bands along `direction`. */
export const accentGradient = (colors: readonly string[], direction: string): string =>
  `linear-gradient(${direction}, ${colors
    .map((c, i) => `${c} ${(i * 100) / colors.length}% ${((i + 1) * 100) / colors.length}%`)
    .join(', ')})`;
