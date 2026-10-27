import type { EffectType } from '../../data/supplemental/runtime';
import type { UniversalCardFilter } from '../../data/supplemental/schema';
import {
  StatusCard,
  getActiveMainScheme,
  getActiveVillain,
  type AbilityStep,
  type CardInstance,
  type GameState,
  type PlayerState,
} from '../models';
import { matchesCardFilter } from '../filters/card-filter';
import { checkUniqueCardPlayable } from '../pipeline/legality-checker';

/**
 * What a step acts on when its params name it, read in one place for the handler and for the
 * legality gate's rule (ADR-0090). Each helper is what the handler does to choose its cards, so the
 * gate cannot call an ability playable that the handler would then skip, and the reverse.
 */

/** The target an effect acts on when the card names none: the handler's default, shared with the gate. */
export const DEFAULT_STEP_TARGET: Partial<Record<EffectType, string>> = {
  REMOVE_STATUS: 'VILLAIN',
};

/** The selector or code a step names, or the effect's default. */
export const stepTarget = (step: AbilityStep): string | undefined => {
  const target = step.effectParams?.target ?? DEFAULT_STEP_TARGET[step.effect as EffectType];
  return typeof target === 'string' ? target : undefined;
};

/** The status cards a REMOVE_STATUS step removes (`ALL`, or none named, means every kind). */
export function requestedStatuses(step: AbilityStep): StatusCard[] {
  const requested = String(step.effectParams?.status || 'ALL');
  if (requested === 'STUNNED') return [StatusCard.STUNNED];
  if (requested === 'CONFUSED') return [StatusCard.CONFUSED];
  if (requested === 'TOUGH') return [StatusCard.TOUGH];
  return [StatusCard.STUNNED, StatusCard.CONFUSED, StatusCard.TOUGH];
}

/** Counters of `counterType` on a card: the typed counter, else its all-purpose token count. */
export const cardCounterCount = (card: CardInstance, counterType: string): number =>
  card.counters?.[counterType] ?? card.tokens?.counters ?? 0;

/** Counters of `counterType` on a player's identity. */
export const playerCounterCount = (player: PlayerState, counterType: string): number =>
  player.counters?.[counterType] ?? 0;

/** The cards a REMOVE_COUNTERS_MATCHING_FILTER step looks at: the player's allies and tableau. */
export function counterFilterCards(
  player: PlayerState,
  params: { targetZone?: string; traitFilter?: string },
): CardInstance[] {
  const zone = params.targetZone ?? 'TABLEAU';
  const cards =
    zone === 'TABLEAU' || zone === 'ALL_CONTROLLED' ? [...player.tableau, ...player.allies] : [];
  const trait = params.traitFilter?.toLowerCase().trim();
  return trait
    ? cards.filter((c) => (c.card.traits || []).some((t) => t.toLowerCase().trim() === trait))
    : cards;
}

/** Whether a card holds a counter the step's `counterType` names (any type when none or `ALL`). */
export function holdsMatchingCounter(card: CardInstance, counterType: string | undefined): boolean {
  const any = !counterType || counterType === 'ALL';
  const typed = Object.entries(card.counters ?? {}).some(
    ([kind, count]) => count > 0 && (any || kind.toLowerCase() === counterType.toLowerCase()),
  );
  return typed || (card.tokens?.counters ?? 0) > 0;
}

/**
 * The cards a PUT_INTO_PLAY step can put into play: the source card itself for target `SELF`,
 * otherwise the cards of its source zone that match the filter and the Unique Card rule.
 */
export function putIntoPlayCandidates(
  state: GameState,
  player: PlayerState,
  params: { from?: string; target?: string; filter?: UniversalCardFilter },
  sourceCard: CardInstance | undefined,
): CardInstance[] {
  const zone = params.from ?? 'SET_ASIDE';
  const pile =
    zone === 'SET_ASIDE'
      ? player.setAsideCards
      : zone === 'DISCARD'
        ? player.discard
        : zone === 'DECK'
          ? player.deck
          : zone === 'HAND'
            ? player.hand
            : [];
  const cards =
    params.target === 'SELF' && sourceCard
      ? [sourceCard]
      : (pile || []).filter((c) => matchesCardFilter(c, params.filter, { player, state }));
  return cards.filter((c) => !c.card.isUnique || checkUniqueCardPlayable(state, c.card).allowed);
}

/** The cards a DISCARD from hand may take from `player`'s hand. */
export const discardableHandCards = (
  player: PlayerState,
  filter: UniversalCardFilter | undefined,
): CardInstance[] =>
  filter ? player.hand.filter((c) => matchesCardFilter(c, filter, { player })) : [...player.hand];

/** The cards a DISCARD from the tableau may take. */
export const discardableTableauCards = (
  state: GameState,
  player: PlayerState,
  filter: UniversalCardFilter | undefined,
): CardInstance[] =>
  player.tableau.filter((c) => !filter || matchesCardFilter(c, filter, { player, state }));

/** The host whose cards underneath a DISCARD from CARDS_UNDER_HOST takes: the villain or the main scheme. */
export function cardsUnderneathHost(
  state: GameState,
  target: string | undefined,
): { cardsUnderneath?: CardInstance[] } | undefined {
  const host = target ?? 'VILLAIN';
  if (host === 'VILLAIN') return getActiveVillain(state);
  if (host === 'MAIN_SCHEME') return getActiveMainScheme(state);
  return undefined;
}

/** Whether the card is attached to the villain or to a player (a DISCARD from HOST takes it off). */
export const isAttachedAnywhere = (state: GameState, card: CardInstance): boolean =>
  (getActiveVillain(state).attachments || []).includes(card) ||
  state.players.some((p) => (p.attachments || []).includes(card));

/**
 * The card code of the scheme an ADD_THREAT step names: `cardCode`, or a `target` that is a code
 * (Yon-Rogg 01177 names the Psyche-Magnitron 01176). `undefined` when the step uses a selector.
 */
export function namedSchemeCode(step: AbilityStep): string | undefined {
  const cardCode = step.effectParams?.cardCode;
  if (typeof cardCode === 'string' && cardCode) return cardCode;
  const target = step.effectParams?.target;
  return typeof target === 'string' && /^\d{5}$/.test(target) ? target : undefined;
}

/** Whether the main scheme or a side scheme with this card code is in play. */
export const isSchemeInPlay = (state: GameState, code: string): boolean =>
  getActiveMainScheme(state)?.card?.code === code ||
  (state.sideSchemes || []).some((s) => s.card?.code === code);
