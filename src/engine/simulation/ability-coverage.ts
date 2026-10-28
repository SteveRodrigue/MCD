import type { CardAbility, GameState, NormalizedCard } from '../models';

type AbilityTimingName = CardAbility['timing'];

/** What has to be observed for an ability of a given timing to count as covered. */
export type CoverageObservable =
  /** `stats.cards[code].abilitiesUsed[abilityId] >= 1` after the ability resolves. */
  | 'USED'
  /** The ability's modifier is seen in a before/after digest while its source card is in play. */
  | 'CONSTANT_EFFECT'
  /** A resource is generated or paid through the card in a real payment step. */
  | 'RESOURCE_PAID'
  /** The effect is applied by `setupGame`. */
  | 'SETUP_APPLIED'
  /** Defined per ability by the Stage-Setter (each one is listed by the coverage test). */
  | 'SPECIAL_DEFINED';

/** The "covered" rule for every timing; exhaustive, so a new timing fails the build until it has one. */
export const COVERAGE_RULE_BY_TIMING: Record<AbilityTimingName, CoverageObservable> = {
  FORCED_INTERRUPT: 'USED',
  INTERRUPT: 'USED',
  HERO_INTERRUPT: 'USED',
  ALTER_EGO_INTERRUPT: 'USED',
  HERO_ACTION: 'USED',
  ALTER_EGO_ACTION: 'USED',
  ACTION: 'USED',
  FORCED_RESPONSE: 'USED',
  RESPONSE: 'USED',
  HERO_RESPONSE: 'USED',
  ALTER_EGO_RESPONSE: 'USED',
  WHEN_REVEALED: 'USED',
  BOOST: 'USED',
  CONSTANT: 'CONSTANT_EFFECT',
  RESOURCE: 'RESOURCE_PAID',
  HERO_RESOURCE: 'RESOURCE_PAID',
  ALTER_EGO_RESOURCE: 'RESOURCE_PAID',
  SETUP: 'SETUP_APPLIED',
  SPECIAL: 'SPECIAL_DEFINED',
};

export interface AbilityTarget {
  cardCode: string;
  abilityId: string;
  ability: CardAbility;
  card: NormalizedCard;
  observable: CoverageObservable;
}

export interface AbilityInventoryFilter {
  /** Restrict to these pack codes (default: `core`). */
  packCodes?: readonly string[];
  /** Restrict to these card codes (e.g. the `--card` CLI target). */
  cardCodes?: readonly string[];
}

/** Every `(cardCode, abilityId)` the card data declares in scope, derived from enrichment only. */
export function buildAbilityInventory(
  cards: readonly NormalizedCard[],
  filter: AbilityInventoryFilter = {},
): AbilityTarget[] {
  const packCodes = filter.packCodes ?? ['core'];
  const targets: AbilityTarget[] = [];
  for (const card of cards) {
    if (!packCodes.includes(card.packCode)) continue;
    if (filter.cardCodes && !filter.cardCodes.includes(card.code)) continue;
    for (const ability of card.enrichment?.abilities ?? []) {
      targets.push({
        cardCode: card.code,
        abilityId: ability.id,
        ability,
        card,
        observable: COVERAGE_RULE_BY_TIMING[ability.timing],
      });
    }
  }
  return targets;
}

export type CoverageEvidence = 'used-counter' | 'digest-delta' | 'resource' | 'setup' | 'special';

export interface CoverageFailure {
  cardCode: string;
  abilityId: string;
  /** The precondition the Stage-Setter could not satisfy, or the verification failure. */
  reason: string;
}

const keyOf = (cardCode: string, abilityId: string) => `${cardCode}#${abilityId}`;

/** Which abilities have been observed, and which could not be driven. */
export class CoverageLedger {
  private readonly covered = new Map<string, CoverageEvidence>();
  private readonly failures = new Map<string, CoverageFailure>();

  constructor(readonly inventory: readonly AbilityTarget[]) {}

  markCovered(cardCode: string, abilityId: string, evidence: CoverageEvidence): void {
    this.covered.set(keyOf(cardCode, abilityId), evidence);
    this.failures.delete(keyOf(cardCode, abilityId));
  }

  markFailed(failure: CoverageFailure): void {
    if (!this.covered.has(keyOf(failure.cardCode, failure.abilityId))) {
      this.failures.set(keyOf(failure.cardCode, failure.abilityId), failure);
    }
  }

  isCovered(cardCode: string, abilityId: string): boolean {
    return this.covered.has(keyOf(cardCode, abilityId));
  }

  untested(): AbilityTarget[] {
    return this.inventory.filter((t) => !this.isCovered(t.cardCode, t.abilityId));
  }

  failureList(): CoverageFailure[] {
    return this.untested().map(
      (t) =>
        this.failures.get(keyOf(t.cardCode, t.abilityId)) ?? {
          cardCode: t.cardCode,
          abilityId: t.abilityId,
          reason: 'never exercised',
        },
    );
  }

  get coveredCount(): number {
    return this.inventory.length - this.untested().length;
  }

  get percent(): number {
    return this.inventory.length === 0 ? 100 : (this.coveredCount / this.inventory.length) * 100;
  }
}

/** The ability use counter the engine records when an ability resolves (`pipeline/stats.ts`). */
export function abilityUseCount(state: GameState, cardCode: string, abilityId: string): number {
  return state.stats?.cards[cardCode]?.abilitiesUsed?.[abilityId] ?? 0;
}

/** A self-contained, replayable description of one simulated scenario. */
export interface SimulationRecipe {
  id: string;
  /** Engine RNG seed (shuffles, setup). */
  seed: string;
  /** Bot RNG seed, a separate stream so bot-policy changes never shift engine shuffles. */
  botSeed: string;
  players: { heroSetCode: string; deckCardCodes: string[] }[];
  scenarioId: string;
  difficulty: 'STANDARD' | 'EXPERT';
  playerCount: number;
  /** Which ability the Stage-Setter targeted, when the recipe came from a sweep or `--card`. */
  target?: { cardCode: string; abilityId: string; variant: string };
  /** Per-match scarcity snapshot, frozen so bot decisions replay identically (Phase 2 reads it). */
  ledgerSnapshot: ScarcityLedger;
  /** Hash of the card data the recipe was recorded against; replay warns when it differs. */
  cardDataHash: string;
}

/** FNV-1a over a string: cheap and stable across runs; the one hash of the simulation. */
export function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

/** Hash of the ability definitions of the inventory; a recipe records it to flag stale replays. */
export function hashCardData(inventory: readonly AbilityTarget[]): string {
  const text = JSON.stringify(inventory.map((t) => [t.cardCode, t.ability]));
  return fnv1a(text).toString(16).padStart(8, '0');
}

/**
 * How often each card was played and each ability or prompt choice used. One flat record so a match
 * can freeze it in its `SimulationRecipe` and replay the same bot decisions. Keys: `card:<code>`,
 * `ability:<code>#<id>`, `choice:<source>#<optionId>`.
 */
export type ScarcityLedger = Record<string, number>;

export const cardKey = (cardCode: string) => `card:${cardCode}`;
export const abilityKey = (cardCode: string, abilityId: string) =>
  `ability:${cardCode}#${abilityId}`;
export const choiceKey = (source: string, optionId: string) => `choice:${source}#${optionId}`;

/** An ability or card used `n` times weighs `1 / (1 + n)`: untouched content weighs 1. */
export const scarcityOf = (ledger: ScarcityLedger, key: string): number =>
  1 / (1 + (ledger[key] ?? 0));

/** The statistics file shape the game writes (`stats/card_play_stats.json`). */
export interface StatsFileShape {
  cards?: Record<string, { played?: number; abilitiesUsed?: Record<string, number> }>;
}

/** Adds the card plays and ability uses of a stats record into a ledger (a file or a finished match). */
export function addStatsToLedger(ledger: ScarcityLedger, stats: StatsFileShape | undefined): void {
  for (const [code, card] of Object.entries(stats?.cards ?? {})) {
    if (card.played) ledger[cardKey(code)] = (ledger[cardKey(code)] ?? 0) + card.played;
    for (const [id, uses] of Object.entries(card.abilitiesUsed ?? {})) {
      ledger[abilityKey(code, id)] = (ledger[abilityKey(code, id)] ?? 0) + uses;
    }
  }
}

/** The weight of a card with abilities still to test: the scarcest of its ability weights. */
export function untestedWeight(ledger: ScarcityLedger, card: NormalizedCard): number {
  const abilities = (card.enrichment?.abilities ?? []).filter(
    (a) => a.timing !== 'CONSTANT' && a.timing !== 'SETUP',
  );
  if (abilities.length === 0) return scarcityOf(ledger, cardKey(card.code));
  return Math.max(...abilities.map((a) => scarcityOf(ledger, abilityKey(card.code, a.id))));
}
