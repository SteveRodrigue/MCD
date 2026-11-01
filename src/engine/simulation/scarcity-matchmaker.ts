import {
  CardType,
  FactionCode,
  type AlterEgoCard,
  type CardRepository,
  type HeroCard,
  type NormalizedCard,
} from '../models';
import { matchesCardFilter } from '../filters/card-filter';
import {
  abilityKey,
  fnv1a,
  scarcityOf,
  untestedWeight,
  type ScarcityLedger,
} from './ability-coverage';

export const DECK_SIZE = 40;

const ASPECTS = [
  FactionCode.AGGRESSION,
  FactionCode.JUSTICE,
  FactionCode.LEADERSHIP,
  FactionCode.PROTECTION,
] as const;

/** Types that make up a deck; identities, obligations and encounter cards never do. */
const DECK_TYPES = new Set([
  CardType.ALLY,
  CardType.EVENT,
  CardType.RESOURCE,
  CardType.SUPPORT,
  CardType.UPGRADE,
]);

export interface DraftOptions {
  catalog: CardRepository;
  allCards: readonly NormalizedCard[];
  heroSetCode: string;
  /** What is already tested: the deck leans toward what is not. */
  ledger: ScarcityLedger;
  seed: string;
  /** Force the aspect instead of choosing the one with the most to test. */
  aspect?: FactionCode;
}

export interface DraftedDeck {
  heroSetCode: string;
  aspect: FactionCode;
  hero: HeroCard;
  alterEgo: AlterEgoCard;
  deckCards: NormalizedCard[];
  obligation: NormalizedCard;
  nemesisCards: NormalizedCard[];
}

/** A small seeded generator (mulberry32 over an FNV hash of the seed), so a draft replays exactly. */
function seededRandom(seed: string): () => number {
  const h = fnv1a(seed);
  let a = h;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The triggers a card reacts to (CONSTANT and action abilities have none). */
function triggersOf(card: NormalizedCard): string[] {
  return (card.enrichment?.abilities ?? []).flatMap((a) => (a.trigger ? [a.trigger] : []));
}

/**
 * Cards that share a trigger window with many others collide there: two interrupts on one damage,
 * a response and a forced response on one defeat. Drafting them together puts those rules in play.
 */
function collisionBonus(card: NormalizedCard, triggerCounts: Map<string, number>): number {
  const shared = triggersOf(card).map((t) => (triggerCounts.get(t) ?? 1) - 1);
  return shared.length === 0 ? 0 : Math.min(1, Math.max(...shared) / 4);
}

interface Candidate {
  card: NormalizedCard;
  score: number;
}

/** The legal cards of one aspect plus the basic cards, one entry per card (copies come later). */
function aspectPool(allCards: readonly NormalizedCard[], aspect: FactionCode): NormalizedCard[] {
  return allCards.filter(
    (c) => DECK_TYPES.has(c.type) && (c.faction === aspect || c.faction === FactionCode.BASIC),
  );
}

/** The aspect with the most untested content (its own cards, the basics being shared by all). */
export function chooseAspect(
  allCards: readonly NormalizedCard[],
  ledger: ScarcityLedger,
): FactionCode {
  const total = (aspect: FactionCode) =>
    allCards
      .filter((c) => DECK_TYPES.has(c.type) && c.faction === aspect)
      .reduce((sum, c) => sum + untestedWeight(ledger, c), 0);
  return [...ASPECTS].sort((a, b) => total(b) - total(a))[0];
}

/** The hero sets, those with the most untested identity abilities first. */
export function rankHeroSets(
  catalog: CardRepository,
  allCards: readonly NormalizedCard[],
  ledger: ScarcityLedger,
): string[] {
  const heroes = allCards.filter((c) => c.type === CardType.HERO);
  const untested = (hero: NormalizedCard) =>
    catalog
      .getCardsBySet(hero.setCode ?? '')
      .flatMap((c) =>
        (c.enrichment?.abilities ?? []).map((a) => scarcityOf(ledger, abilityKey(c.code, a.id))),
      )
      .reduce((sum, n) => sum + n, 0);
  return heroes
    .map((h) => ({ set: h.setCode ?? '', score: untested(h) }))
    .sort((a, b) => b.score - a.score || a.set.localeCompare(b.set))
    .map((h) => h.set);
}

/**
 * Drafts a legal 40-card deck for a hero: every signature card, then aspect and basic cards by how
 * untested they are and how many trigger windows they share, with a setup partner for each payoff.
 */
export function draftDeck(options: DraftOptions): DraftedDeck {
  const { catalog, allCards, heroSetCode, ledger } = options;
  const identity = catalog.getCardsBySet(heroSetCode);
  const hero = identity.find((c) => c.type === CardType.HERO) as HeroCard | undefined;
  const alterEgo = identity.find((c) => c.type === CardType.ALTER_EGO) as AlterEgoCard | undefined;
  const obligation = identity.find((c) => c.type === CardType.OBLIGATION);
  if (!hero || !alterEgo || !obligation) {
    throw new Error(`[Matchmaker] '${heroSetCode}' is not a complete hero set.`);
  }

  const aspect = options.aspect ?? chooseAspect(allCards, ledger);
  const random = seededRandom(options.seed);
  const deckCards: NormalizedCard[] = [];
  const copies = new Map<string, number>();
  const add = (card: NormalizedCard, times = 1): void => {
    const room = card.deckLimit - (copies.get(card.code) ?? 0);
    for (let i = 0; i < Math.min(times, room) && deckCards.length < DECK_SIZE; i++) {
      deckCards.push(card);
      copies.set(card.code, (copies.get(card.code) ?? 0) + 1);
    }
  };

  // Signature cards always come, in the quantity the set prints
  for (const card of identity.filter((c) => DECK_TYPES.has(c.type))) add(card, card.quantity);

  const pool = aspectPool(allCards, aspect);
  const triggerCounts = new Map<string, number>();
  for (const card of [...pool, ...deckCards]) {
    for (const trigger of new Set(triggersOf(card))) {
      triggerCounts.set(trigger, (triggerCounts.get(trigger) ?? 0) + 1);
    }
  }
  const ranked: Candidate[] = pool
    .map((card) => ({
      card,
      score:
        untestedWeight(ledger, card) + 0.5 * collisionBonus(card, triggerCounts) + 0.1 * random(),
    }))
    .sort((a, b) => b.score - a.score || a.card.code.localeCompare(b.card.code));

  for (const { card } of ranked) {
    if (deckCards.length >= DECK_SIZE) break;
    add(card, card.deckLimit);
    // A payoff needs its setup piece in the deck
    const needs = card.enrichment?.playRequirements?.controlFilter;
    if (needs && !deckCards.some((c) => c !== card && matchesCardFilter(c, needs))) {
      const partner = ranked.find((r) => r.card !== card && matchesCardFilter(r.card, needs));
      if (partner) add(partner.card, partner.card.deckLimit);
    }
  }

  return {
    heroSetCode,
    aspect,
    hero,
    alterEgo,
    deckCards,
    obligation,
    nemesisCards: catalog.getNemesisCardsForHero(heroSetCode),
  };
}
