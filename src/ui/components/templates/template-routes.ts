import { getModalStyle, type ModalStyleId } from '../../theme/modal-styles';

/** The modals the lab renders with the real game components: three archetypes, then the rest. */
export type ArchetypeId =
  | 'decision'
  | 'sequence'
  | 'select'
  | 'attack-target'
  | 'thwart-target'
  | 'ally-menu'
  | 'tableau-menu'
  | 'identity-menu'
  | 'combat-boost'
  | 'distribute'
  | 'simultaneous'
  | 'payment'
  | 'pile-viewer'
  | 'options'
  | 'report'
  | 'card-stats'
  | 'reset-stats'
  | 'game-over'
  | 'infinite-loop';

/** Kits that are not modals: whole-surface mock-ups drawn on the theme's table. */
export type KitSurfaceId = 'elements' | 'board' | 'newspaper' | 'setup';

export type ItemId = ArchetypeId | KitSurfaceId;

export type KitId = 'modals' | 'elements' | 'board' | 'newspaper' | 'setup';

export type ArchetypeGroup = 'Prompts' | 'Targets and menus' | 'Dialogs';

export const ARCHETYPE_GROUPS: readonly ArchetypeGroup[] = [
  'Prompts',
  'Targets and menus',
  'Dialogs',
];

export interface ArchetypeMeta {
  id: ArchetypeId;
  label: string;
  description: string;
  group: ArchetypeGroup;
}

export const ARCHETYPES: readonly ArchetypeMeta[] = [
  {
    id: 'decision',
    label: 'Decision',
    description: 'Forced or optional prompt: trigger card, threat showcase, one row per choice.',
    group: 'Prompts',
  },
  {
    id: 'sequence',
    label: 'Sequence',
    description: 'Wakanda Forever: reorder real cards, finisher highlight, execute.',
    group: 'Prompts',
  },
  {
    id: 'select',
    label: 'Select',
    description: 'Pick N of M cards from a grid with a live counter and confirm.',
    group: 'Prompts',
  },
  {
    id: 'distribute',
    label: 'Distribute',
    description: 'Spread damage, threat or healing among targets within a budget.',
    group: 'Prompts',
  },
  {
    id: 'simultaneous',
    label: 'Order',
    description: 'Several abilities trigger at once: choose the order they resolve in.',
    group: 'Prompts',
  },
  {
    id: 'payment',
    label: 'Payment',
    description: 'Pay a card cost with hand cards and resource generators.',
    group: 'Prompts',
  },
  {
    id: 'combat-boost',
    label: 'Boost',
    description: 'The villain attack summary: boost cards, defense, final damage.',
    group: 'Prompts',
  },
  {
    id: 'attack-target',
    label: 'Attack target',
    description: 'Pick the enemy to attack; guard and tough shown.',
    group: 'Targets and menus',
  },
  {
    id: 'thwart-target',
    label: 'Thwart target',
    description: 'Pick the scheme to thwart; crisis, hazard and acceleration shown.',
    group: 'Targets and menus',
  },
  {
    id: 'identity-menu',
    label: 'Identity menu',
    description: 'The hero or alter-ego action list.',
    group: 'Targets and menus',
  },
  {
    id: 'ally-menu',
    label: 'Ally menu',
    description: 'Actions of an ally in play.',
    group: 'Targets and menus',
  },
  {
    id: 'tableau-menu',
    label: 'Tableau menu',
    description: 'Abilities of an upgrade or support in play.',
    group: 'Targets and menus',
  },
  {
    id: 'pile-viewer',
    label: 'Pile viewer',
    description: 'Deck, discard, removed or set-aside cards.',
    group: 'Dialogs',
  },
  {
    id: 'options',
    label: 'Options',
    description: 'Game settings and the theme picker (changes stay in the lab).',
    group: 'Dialogs',
  },
  {
    id: 'report',
    label: 'Report',
    description: 'Report a problem. Submitting files a real report in dev mode.',
    group: 'Dialogs',
  },
  {
    id: 'card-stats',
    label: 'Card stats',
    description: 'Per-card and all-time usage.',
    group: 'Dialogs',
  },
  {
    id: 'reset-stats',
    label: 'Reset stats',
    description: 'Confirm before resetting card statistics.',
    group: 'Dialogs',
  },
  {
    id: 'game-over',
    label: 'Game over',
    description: 'Victory screen for the whole group.',
    group: 'Dialogs',
  },
  {
    id: 'infinite-loop',
    label: 'Infinite loop',
    description: 'Engine safeguard when forced abilities recurse.',
    group: 'Dialogs',
  },
];

export interface KitMeta {
  id: KitId;
  label: string;
  description: string;
}

export const KITS: readonly KitMeta[] = [
  {
    id: 'modals',
    label: 'Modals',
    description: 'Real game modals with sample prompts.',
  },
  {
    id: 'elements',
    label: 'Elements',
    description: 'Buttons, badges, counters, gauges, forms, menu, toast.',
  },
  {
    id: 'board',
    label: 'Board',
    description: 'Side dock (quick-menu rail, log), villain, scheme, hero zone, hand tray.',
  },
  {
    id: 'newspaper',
    label: 'Newspaper',
    description: 'Daily Bugle: action sheet, broadsheet, log wire.',
  },
  { id: 'setup', label: 'Setup', description: 'Scenario spread and mulligan.' },
];

export const DEFAULT_ARCHETYPE: ArchetypeId = 'sequence';

/** The item a kit opens on. */
export const DEFAULT_ITEM: Record<KitId, ItemId> = {
  modals: DEFAULT_ARCHETYPE,
  elements: 'elements',
  board: 'board',
  newspaper: 'newspaper',
  setup: 'setup',
};

export const kitOfItem = (item: ItemId): KitId =>
  item === 'elements' || item === 'board' || item === 'newspaper' || item === 'setup'
    ? item
    : 'modals';

/** `style` is null on the gallery (`/templates/`). */
export interface TemplatesRoute {
  style: ModalStyleId | null;
  item: ItemId;
}

const ROOT = '/templates';

const ITEM_IDS: readonly ItemId[] = [
  ...ARCHETYPES.map((a) => a.id),
  'elements',
  'board',
  'newspaper',
  'setup',
];

/** `/templates/<style>/<item>`. An unknown style falls back to the gallery, an unknown item to the default. */
export const parseTemplatesPath = (pathname: string): TemplatesRoute => {
  const rest = pathname.toLowerCase().replace(/^\/templates\/?/, '');
  const [styleSlug, itemSlug] = rest.split('/').filter(Boolean);
  const style = getModalStyle(styleSlug)?.id ?? null;
  const item = ITEM_IDS.find((id) => id === itemSlug) ?? DEFAULT_ARCHETYPE;
  return { style, item };
};

export const buildTemplatesPath = ({ style, item }: TemplatesRoute): string =>
  style ? `${ROOT}/${style}/${item}` : `${ROOT}/`;
