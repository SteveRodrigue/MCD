import type { NormalizedCard, PlayerState, GameState } from '../models';
import { hasKeyword } from '../models/keyword-helpers';
import type { UniversalCardFilter } from '../../data/supplemental/schema';

export interface FilterContext {
  player?: PlayerState;
  state?: GameState;
}

/** A card in play (card instance, villain): the in-play criteria read its exhaustion and status. */
export interface InPlayCard {
  card: NormalizedCard;
  exhausted?: boolean;
  statusCards?: string[];
}

/** What a filter is evaluated on: a card definition, or a card in play. */
export type FilterSubject = NormalizedCard | InPlayCard;

const normalize = (value: string) => value.toLowerCase().trim();
const alphanumeric = (value: string) => normalize(value).replace(/[^a-z0-9]/g, '');

/** "Avenger" matches "Avenger", "Avengers" and "S.H.I.E.L.D." matches "SHIELD". */
function hasMatchingTrait(cardTraits: string[], wanted: string): boolean {
  const target = normalize(wanted);
  const targetStripped = alphanumeric(wanted);
  return cardTraits.some((trait) => {
    const raw = normalize(trait);
    const stripped = alphanumeric(trait);
    return raw.includes(target) || (targetStripped.length > 0 && stripped.includes(targetStripped));
  });
}

/**
 * Universal declarative card filter evaluator (ADR-0046, RR v1.8 p. 19, 26, 28).
 * Pure, card-agnostic predicate evaluation on the normalized card fields; all listed criteria
 * must hold (logical AND).
 */
export function matchesCardFilter(
  subject: FilterSubject,
  filter?: UniversalCardFilter,
  context?: FilterContext,
): boolean {
  if (!filter) return true;
  const instance = 'card' in subject ? subject : undefined;
  const card: NormalizedCard = instance ? instance.card : (subject as NormalizedCard);

  // Boolean combinators
  if (filter.all?.length && !filter.all.every((f) => matchesCardFilter(subject, f, context))) {
    return false;
  }
  if (filter.any?.length && !filter.any.some((f) => matchesCardFilter(subject, f, context))) {
    return false;
  }
  if (filter.none?.length && filter.none.some((f) => matchesCardFilter(subject, f, context))) {
    return false;
  }

  if (filter.codes?.length && !filter.codes.includes(card.code)) return false;

  if (filter.names?.length && !filter.names.some((n) => normalize(n) === normalize(card.name))) {
    return false;
  }

  if (filter.types?.length && !filter.types.some((t) => normalize(t) === card.type)) return false;

  if (filter.traits?.length) {
    const cardTraits = card.traits || [];
    if (!filter.traits.some((trait) => hasMatchingTrait(cardTraits, trait))) return false;
  }

  if (filter.aspects?.length && !filter.aspects.some((a) => normalize(a) === card.faction)) {
    return false;
  }

  // Sets: PLAYER_NEMESIS is the nemesis set of the context player's hero
  if (filter.sets?.length) {
    const heroSetCode = context?.player?.hero.setCode;
    const matchesSet = filter.sets.some((set) => {
      const target = normalize(set);
      if (target === 'player_nemesis') {
        return Boolean(heroSetCode) && card.setCode === `${heroSetCode}_nemesis`;
      }
      return card.setCode === target;
    });
    if (!matchesSet) return false;
  }

  if (filter.isUnique !== undefined && Boolean(card.isUnique) !== filter.isUnique) return false;

  // Identity-specific: a card of the context player's hero set
  if (filter.isIdentitySpecific !== undefined) {
    const heroSetCode = context?.player?.hero.setCode;
    const identitySpecific =
      Boolean(card.belongsToHeroSet) && Boolean(heroSetCode) && card.setCode === heroSetCode;
    if (identitySpecific !== filter.isIdentitySpecific) return false;
  }

  if (filter.cost) {
    const cost = card.cost;
    if (typeof cost !== 'number') return false;
    if (filter.cost.min !== undefined && cost < filter.cost.min) return false;
    if (filter.cost.max !== undefined && cost > filter.cost.max) return false;
    if (filter.cost.equals !== undefined && cost !== filter.cost.equals) return false;
  }

  // Resource icons: a wild icon counts as any type
  if (filter.resourceIcons?.length) {
    const resources = card.resources as unknown as Record<string, number | undefined>;
    const matchesResource = filter.resourceIcons.some(
      (icon) => (resources[icon] || 0) > 0 || (icon !== 'wild' && (resources.wild || 0) > 0),
    );
    if (!matchesResource) return false;
  }

  if (filter.hasKeyword && !hasKeyword(card, filter.hasKeyword)) return false;

  // In-play criteria hold only for a card in play
  if (filter.isExhausted !== undefined) {
    if (!instance || Boolean(instance.exhausted) !== filter.isExhausted) return false;
  }
  if (filter.hasStatus?.length) {
    const statusCards: string[] = instance?.statusCards || [];
    if (!filter.hasStatus.every((status) => statusCards.includes(status))) return false;
  }

  return true;
}
