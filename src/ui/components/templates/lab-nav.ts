import { MODAL_STYLES, type ModalStyleId } from '../../theme/modal-styles';
import {
  ARCHETYPES,
  DEFAULT_ITEM,
  KITS,
  kitOfItem,
  type ItemId,
  type KitId,
} from './template-routes';

/**
 * Cycling through the lab's three choices, like the font test: a style (the gallery counts as one
 * stop), a kit, and a modal. Each wraps around. Keys: T (style), K (kit), P (modal); Shift goes back.
 */

export type NavTarget = 'style' | 'kit' | 'modal';

/** The gallery has no style: it is the stop before the first style and after the last one. */
export type StyleStop = ModalStyleId | null;

const STYLE_STOPS: readonly StyleStop[] = [null, ...MODAL_STYLES.map((s) => s.id)];

const wrap = (index: number, count: number): number => (index + count) % count;

export const cycleStyle = (current: StyleStop, direction: 1 | -1): StyleStop =>
  STYLE_STOPS[wrap(STYLE_STOPS.indexOf(current) + direction, STYLE_STOPS.length)];

/** The next kit, opened on its default item. */
export const cycleKit = (item: ItemId, direction: 1 | -1): ItemId => {
  const index = KITS.findIndex((k) => k.id === kitOfItem(item));
  const next: KitId = KITS[wrap(index + direction, KITS.length)].id;
  return DEFAULT_ITEM[next];
};

/** The next modal of the Modals kit. From another kit it opens the first (or last) modal. */
export const cycleModal = (item: ItemId, direction: 1 | -1): ItemId => {
  const index = ARCHETYPES.findIndex((a) => a.id === item);
  if (index < 0) return ARCHETYPES[direction === 1 ? 0 : ARCHETYPES.length - 1].id;
  return ARCHETYPES[wrap(index + direction, ARCHETYPES.length)].id;
};

export const navShortcut = (
  event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'>,
): { target: NavTarget; direction: 1 | -1 } | null => {
  if (event.ctrlKey || event.metaKey || event.altKey) return null;
  const key = event.key.toLowerCase();
  const target: NavTarget | null =
    key === 't' ? 'style' : key === 'k' ? 'kit' : key === 'p' ? 'modal' : null;
  return target ? { target, direction: event.shiftKey ? -1 : 1 } : null;
};
