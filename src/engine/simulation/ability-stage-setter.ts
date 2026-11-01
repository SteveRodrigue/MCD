import '../boot';
import {
  CardType,
  type CardAbility,
  GameState,
  HeroCard,
  AlterEgoCard,
  NormalizedCard,
  PendingDecisionPrompt,
  PlayerState,
  type CardInstance,
  type GameAction,
  type CardRepository,
  type SideSchemeState,
} from '../models';
import { setupGame, resetInstanceCounter } from '../state/game-setup';
import { createCardInstance } from '../state/card-instance';
import { dispatchAction } from '../pipeline';
import {
  step4_revealEncounterCards,
  executeVillainAttackAgainstPlayer,
  executeVillainSchemeAgainstPlayer,
  executeMinionAttackAgainstPlayer,
} from '../pipeline/villain-phase';
import {
  canInitiateAbility,
  canPlayCard,
  evaluateCardPlayability,
} from '../pipeline/legality-checker';
import type { UniversalCardFilter } from '../../data/supplemental/schema';
import { attachStepOf } from '../../data/supplemental/runtime';
import { isImmuneToDamage } from '../pipeline/damage-immunity';
import { getDefenderRestriction } from '../pipeline/target-restrictions';
import { applyThreatPlacement } from '../pipeline/threat-pipeline';
import { namedSchemeCode } from '../effects/step-selection';
import { matchesCardFilter } from '../filters/card-filter';
import { findInPlayCardInstance } from '../state/state-validator';
import {
  getEffectiveAllyLimit,
  getEffectiveAllyStats,
  getEffectiveCardTraits,
  getEffectiveHandSize,
  getEffectiveHeroStats,
  getEffectiveMaxHealth,
  getEffectiveMinionAttack,
  getEffectiveMinionHitPoints,
  getEffectiveMinionScheme,
  getEffectivePlayerTraits,
  getEffectiveRetaliate,
  hasEntityKeyword,
  getEffectiveVillainMaxHealth,
  getEffectiveVillainStats,
} from '../pipeline/stat-calculator';
import { drainPrompts, type PromptOptionPicker } from './match-simulator';
import {
  abilityUseCount,
  fnv1a,
  type AbilityTarget,
  type CoverageLedger,
  type CoverageEvidence,
} from './ability-coverage';
import {
  digestState,
  verifyAbilityExecution,
  type AbilityVerification,
} from './effect-delta-verifier';

export interface StageOptions {
  catalog: CardRepository;
  /** Every card the stage may pick fixtures from (payers, minions, allies, side schemes). */
  allCards: readonly NormalizedCard[];
  seed?: string;
  playerCount?: 1 | 2;
  /** Which `PLAYER_CHOICE` option index to take first (each branch is its own run). */
  branch?: number;
}

export interface StageOutcome {
  ok: boolean;
  /** The unmet precondition or verification failure when `ok` is false. */
  reason?: string;
  evidence?: CoverageEvidence;
  variant: string;
  verification?: AbilityVerification;
  /** Hash of the final state digest; a replay of the same recipe must reproduce it. */
  fingerprint?: string;
  /** The last log keys of a failed run, to see what the engine did instead. */
  trace?: string[];
  /** Every distinct log key an `ok` run wrote, sorted: the rule-coverage evidence. */
  logKeys?: string[];
}

const PLAYER_ID = 'p1';
const PAYER_RESOURCES = 4;
const PAYER_COUNT = 3;
const PAYER_CODE = 'sim_payer';

/** The setup a repair adds when the legality gate refuses; each one is generic, never card-named. */
interface Repair {
  name: string;
  apply: (stage: Stage) => void;
}

export interface Stage {
  state: GameState;
  options: StageOptions;
  fixtures: Fixtures;
}

interface Fixtures {
  filler: NormalizedCard;
  minion?: NormalizedCard;
  ally?: NormalizedCard;
  /** A second ability-free ally, so a discard fixture never shares a code with the one in play. */
  discardAlly?: NormalizedCard;
  sideScheme?: NormalizedCard;
  treachery?: NormalizedCard;
}

const bare = (card: NormalizedCard) => (card.enrichment?.abilities ?? []).length === 0;

function pickFixtures(cards: readonly NormalizedCard[]): Fixtures {
  const firstBare = (type: CardType) => cards.find((c) => c.type === type && bare(c));
  const filler =
    firstBare(CardType.RESOURCE) ?? cards.find((c) => c.packCode === 'core' && bare(c));
  if (!filler) throw new Error('[StageSetter] no ability-free filler card in the catalog.');
  return {
    filler,
    // Toughness would absorb the one hit that has to defeat it; Guard stops attacks against the villain
    minion: cards.find(
      (c) =>
        c.type === CardType.MINION &&
        bare(c) &&
        !(c.keywords ?? []).some(
          (k) => String(k).toLowerCase() === 'toughness' || String(k).toLowerCase() === 'guard',
        ),
    ),
    ally: firstBare(CardType.ALLY),
    discardAlly: cards.filter((c) => c.type === CardType.ALLY)[1],
    sideScheme: firstBare(CardType.SIDE_SCHEME),
    treachery: firstBare(CardType.TREACHERY),
  };
}

/** A hand card that pays `PAYER_RESOURCES` of every resource type; fixture data, not a catalog card. */
function createPayer(filler: NormalizedCard): CardInstance {
  const card: NormalizedCard = {
    ...filler,
    code: PAYER_CODE,
    resources: {
      physical: PAYER_RESOURCES,
      energy: PAYER_RESOURCES,
      mental: PAYER_RESOURCES,
      wild: PAYER_RESOURCES,
      total: PAYER_RESOURCES * 4,
    },
  };
  return createCardInstance(card, PLAYER_ID);
}

/** The hero set of the card under test, else the default stage hero. */
function heroSetFor(card: NormalizedCard, catalog: CardRepository): string {
  const set = card.setCode ?? '';
  const hero = catalog.getCardsBySet(set).find((c) => c.type === CardType.HERO);
  return hero ? set : 'spider_man';
}

/** What a stage is built around: the card whose hero set seats the player, and how the game starts. */
export interface StageSubject {
  card: NormalizedCard;
  seed: string;
  /** Setup abilities run before the mulligan, so the stage stops at the freshly set-up game. */
  setup: boolean;
  scenarioId?: string;
}

export const subjectOf = (target: AbilityTarget): StageSubject => ({
  card: target.card,
  seed: `stage:${target.cardCode}:${target.abilityId}`,
  setup: target.ability.timing === 'SETUP',
});

export function createStage(
  subject: StageSubject,
  options: StageOptions,
  deckExtras: readonly NormalizedCard[] = [],
): Stage {
  const { catalog, allCards } = options;
  // Instance ids are part of the state digest, so each stage starts the counter from zero
  resetInstanceCounter();
  const fixtures = pickFixtures(allCards);
  const scenarioId = subject.scenarioId ?? 'rhino';
  const setCode = heroSetFor(subject.card, catalog);
  const setCards = catalog.getCardsBySet(setCode);
  const hero = setCards.find((c) => c.type === CardType.HERO) as HeroCard;
  const alterEgo = setCards.find((c) => c.type === CardType.ALTER_EGO) as AlterEgoCard;
  const secondSet = setCode === 'spider_man' ? 'iron_man' : 'spider_man';
  const second = catalog.getCardsBySet(secondSet);

  const players = [
    {
      id: PLAYER_ID,
      name: 'P1',
      hero,
      alterEgo,
      deckCards: [...Array.from({ length: 15 }, () => fixtures.filler), ...deckExtras],
    },
  ];
  if (options.playerCount === 2) {
    players.push({
      id: 'p2',
      name: 'P2',
      hero: second.find((c) => c.type === CardType.HERO) as HeroCard,
      alterEgo: second.find((c) => c.type === CardType.ALTER_EGO) as AlterEgoCard,
      deckCards: Array.from({ length: 15 }, () => fixtures.filler),
    });
  }

  const state = setupGame({
    catalog,
    scenarioId,
    players,
    encounterCards: catalog.getCardsBySet(scenarioId),
    skipMulligan: !subject.setup,
    seed: options.seed ?? subject.seed,
    shuffleFn: (arr) => arr,
  });
  const stage: Stage = { state, options, fixtures };
  if (subject.setup) return stage;
  const player = state.players[0];
  player.hand = [];
  for (let i = 0; i < PAYER_COUNT; i++) player.hand.push(createPayer(fixtures.filler));
  // Plain cards the player can discard as a declared cost without spending a payer
  for (let i = 0; i < 2; i++) player.hand.push(createCardInstance(fixtures.filler, PLAYER_ID));
  return stage;
}

/** Card definitions and the setup options are shared, immutable data; everything else is copied. */
const SHARED_KEYS = new Set([
  'card',
  'hero',
  'alterEgo',
  'activeFormCard',
  'availableForms',
  'options',
]);

/** A mutable deep copy of a (frozen) dispatch result, so the stage can keep sculpting it. */
export function thaw<T>(value: T, key?: string): T {
  if (value === null || typeof value !== 'object' || (key && SHARED_KEYS.has(key))) return value;
  if (Array.isArray(value)) return value.map((v) => thaw(v)) as unknown as T;
  const copy: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) copy[k] = thaw(v, k);
  return copy as T;
}

export function player1(stage: Stage): PlayerState {
  return stage.state.players[0];
}

export function setForm(player: PlayerState, form: 'hero' | 'alter_ego'): void {
  player.currentForm = form;
  player.activeFormCard = form === 'hero' ? player.hero : player.alterEgo;
}

/** Every card filter the ability or its card declares (play requirements, step filters). */
function declaredFilters(target: AbilityTarget): UniversalCardFilter[] {
  const filters: UniversalCardFilter[] = [];
  const control = target.card.enrichment?.playRequirements?.controlFilter;
  if (control) filters.push(control);
  const collect = (value: unknown): void => {
    if (!value || typeof value !== 'object') return;
    for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
      if ((key === 'filter' || key === 'cardFilter') && inner && typeof inner === 'object') {
        filters.push(inner as UniversalCardFilter);
      } else {
        collect(inner);
      }
    }
  };
  for (const step of target.ability.steps) collect(step.effectParams);
  return filters;
}

/** Zones the plan may put a witness card in, from where the declared requirement looks. */
const WITNESS_ZONES = ['tableau', 'allies', 'discard', 'deck', 'hand'] as const;

function placeWitness(stage: Stage, witness: NormalizedCard, zone: (typeof WITNESS_ZONES)[number]) {
  const p = player1(stage);
  const inst = createCardInstance(witness, PLAYER_ID);
  const holders: Record<string, CardInstance[]> = {
    tableau: p.tableau,
    allies: p.allies,
    discard: p.discard,
    deck: p.deck,
    hand: p.hand,
  };
  holders[zone].push(inst);
}

/** Effect-driven priming: make the state one in which the declared effect has something to do. */
function primeForEffects(stage: Stage, target: AbilityTarget, source?: CardInstance): void {
  const effects = new Set(target.ability.steps.map((s) => s.effect));
  const p = player1(stage);
  // Removing threat needs threat to remove, placed the way the game places it
  if (effects.has('REMOVE_THREAT')) {
    applyThreatPlacement(stage.state, {
      targetType: 'main_scheme',
      amount: 3,
      sourceType: 'CARD_EFFECT',
    });
  }
  // Adding threat to a named side scheme needs that scheme in play
  if (effects.has('ADD_THREAT')) {
    const namedScheme = target.ability.steps.map(namedSchemeCode).find(Boolean);
    if (namedScheme && !stage.state.sideSchemes.some((s) => s.card?.code === namedScheme)) {
      const schemeCard = stage.options.allCards.find((c) => c.code === namedScheme);
      if (schemeCard) {
        stage.state.sideSchemes.push({
          instanceId: `sim_side_${stage.state.sideSchemes.length}`,
          card: schemeCard as SideSchemeState['card'],
          threat: 2,
        });
      }
    }
  }
  // Adding status needs the target to not already carry that status
  if (effects.has('ADD_STATUS')) {
    const statusesToAdd = target.ability.steps
      .map((s) => (s.effectParams?.status as string | undefined)?.toUpperCase())
      .filter((s): s is string => Boolean(s));
    if (source?.statusCards) {
      source.statusCards = source.statusCards.filter(
        (s) => !statusesToAdd.includes(s.toUpperCase()),
      );
    }
    for (const v of stage.state.villains) {
      if (v.statusCards) {
        v.statusCards = v.statusCards.filter((s) => !statusesToAdd.includes(s.toUpperCase()));
      }
    }
    if (p.statusCards) {
      p.statusCards = p.statusCards.filter((s) => !statusesToAdd.includes(s.toUpperCase()));
    }
  }
  // Healing the card itself needs it to carry damage
  if (effects.has('HEAL_DAMAGE') && source) source.tokens = { ...source.tokens, damage: 1 };
  if (effects.has('HEAL_DAMAGE') || target.ability.cost?.heal || effects.has('MODIFY_MAX_HEALTH')) {
    p.health = Math.max(1, p.maxHealth - 3);
  }
  // A form flip is only observable from the form it flips away from
  if (effects.has('CHANGE_FORM') || effects.has('FLIP_FORM')) setForm(p, 'hero');
  if (effects.has('READY')) {
    // A triggered ready follows an action that exhausts the identity itself
    if (target.ability.trigger === undefined) p.exhausted = true;
    // Something other than the source has to be exhausted for READY to do anything
    if (p.allies.length === 0 && stage.fixtures.ally) {
      p.allies.push(createCardInstance(stage.fixtures.ally, PLAYER_ID));
    }
    for (const c of [...p.tableau, ...p.allies]) {
      if (c.card.code !== target.cardCode) c.exhausted = true;
    }
  }
}

/** Generic preconditions, applied one at a time until the legality gate lets the action through. */
function buildRepairs(target: AbilityTarget): Repair[] {
  const { ability, card } = target;
  const form: 'hero' | 'alter_ego' | undefined =
    card.type === CardType.HERO || ability.timing.startsWith('HERO_')
      ? 'hero'
      : card.type === CardType.ALTER_EGO ||
          ability.timing.startsWith('ALTER_EGO_') ||
          card.enrichment?.playRequirements?.identityForm === 'ALTER_EGO'
        ? 'alter_ego'
        : undefined;
  const repairs: Repair[] = [
    {
      name: 'counters on the source',
      apply: ({ state }) => {
        const counterType = card.enrichment?.uses?.counterType ?? 'all_purpose';
        const need = Math.max(3, ability.cost?.spendCounters?.amount ?? 0);
        for (const c of state.players[0].tableau) {
          if (c.card.code !== card.code) continue;
          c.counters = { ...c.counters, [counterType]: need };
          c.tokens = { ...c.tokens, counters: need };
        }
      },
    },
  ];
  if (form) {
    repairs.unshift({
      name: 'identity form',
      apply: ({ state }) => setForm(state.players[0], form),
    });
  }
  repairs.push(
    {
      name: 'damaged identity',
      apply: ({ state }) => {
        const p = state.players[0];
        p.health = Math.max(1, p.maxHealth - 3);
      },
    },
    {
      name: 'engaged minion',
      apply: (stage) => {
        const minion = stage.fixtures.minion;
        if (minion) player1(stage).engagedMinions.push(createCardInstance(minion, PLAYER_ID));
      },
    },
    {
      name: 'side scheme',
      apply: (stage) => {
        const sideScheme = stage.fixtures.sideScheme;
        if (!sideScheme) return;
        stage.state.sideSchemes.push({
          instanceId: `sim_side_${stage.state.sideSchemes.length}`,
          card: sideScheme as SideSchemeState['card'],
          threat: 3,
        });
      },
    },
    {
      name: 'ally in play',
      apply: (stage) => {
        const ally = stage.fixtures.ally;
        if (!ally) return;
        const inst = createCardInstance(ally, PLAYER_ID);
        inst.tokens = { ...inst.tokens, damage: 1 };
        player1(stage).allies.push(inst);
      },
    },
    {
      name: 'cards in discard',
      apply: (stage) => {
        const p = player1(stage);
        const { ally, discardAlly, filler } = stage.fixtures;
        p.discard.push(createCardInstance(discardAlly ?? ally ?? filler, PLAYER_ID));
        p.discard.push(createCardInstance(filler, PLAYER_ID));
      },
    },
    {
      name: 'damaged villain',
      apply: ({ state }) => {
        state.villains[0].health = Math.max(1, state.villains[0].health - 3);
      },
    },
  );
  // One witness card per declared filter, tried in each zone a requirement can look at
  for (const filter of declaredFilters(target)) {
    for (const zone of WITNESS_ZONES) {
      repairs.push({
        name: `witness in ${zone}`,
        apply: (stage) => {
          const witness = stage.options.allCards.find(
            (c) => c.code !== card.code && c.packCode === 'core' && matchesCardFilter(c, filter),
          );
          if (witness) placeWitness(stage, witness, zone);
        },
      });
    }
  }
  return repairs;
}

export function paymentIds(stage: Stage, exceptId?: string): string[] {
  return player1(stage)
    .hand.filter((c) => c.card.code === PAYER_CODE && c.instanceId !== exceptId)
    .map((c) => c.instanceId);
}

function discardIds(stage: Stage, count: number, exceptId?: string): string[] {
  return player1(stage)
    .hand.filter((c) => c.card.code !== PAYER_CODE && c.instanceId !== exceptId)
    .slice(0, count)
    .map((c) => c.instanceId);
}

/** Keeps the hand stocked with payers and plain discardable cards after a card was played. */
export function restock(stage: Stage): void {
  const p = player1(stage);
  while (p.hand.filter((c) => c.card.code === PAYER_CODE).length < PAYER_COUNT) {
    p.hand.push(createPayer(stage.fixtures.filler));
  }
  while (p.hand.filter((c) => c.card.code !== PAYER_CODE).length < 2) {
    p.hand.push(createCardInstance(stage.fixtures.filler, PLAYER_ID));
  }
}

function abilityOptions(stage: Stage, ability: CardAbility, exceptId?: string) {
  return {
    paymentCardInstanceIds: paymentIds(stage, exceptId),
    ...(ability.cost?.discardCard && {
      discardCardInstanceIds: discardIds(stage, ability.cost.discardCard.count || 1, exceptId),
    }),
  };
}

function branchPicker(branch: number | undefined): PromptOptionPicker | undefined {
  if (branch === undefined) return undefined;
  return (prompt: PendingDecisionPrompt) => {
    const enabled = prompt.options.filter((o) => !o.disabled);
    return enabled[branch % Math.max(1, enabled.length)]?.id;
  };
}

type Plan =
  { kind: 'PLAY'; card: CardInstance } | { kind: 'USE'; ref: string; instance?: CardInstance };

/** Puts the source card where its ability can fire and says how to fire it. */
function placeSource(stage: Stage, target: AbilityTarget): Plan | { error: string } {
  const p = player1(stage);
  const { card } = target;
  if (card.type === CardType.HERO || card.type === CardType.ALTER_EGO) {
    return { kind: 'USE', ref: card.code };
  }
  const instance = createCardInstance(card, PLAYER_ID);
  if (card.type === CardType.ATTACHMENT) {
    installInPlay(stage, instance, card.type);
    return { kind: 'USE', ref: instance.instanceId, instance };
  }
  const isEvent = card.type === CardType.EVENT;
  if (isEvent) {
    p.hand.push(instance);
    return { kind: 'PLAY', card: instance };
  }
  // In-play card: play it through the real pipeline, then use its ability
  p.hand.push(instance);
  return { kind: 'PLAY', card: instance };
}

function playAction(stage: Stage, card: CardInstance, ability: CardAbility): GameAction {
  return {
    type: 'PLAY_CARD',
    playerId: PLAYER_ID,
    cardInstanceId: card.instanceId,
    ...abilityOptions(stage, ability, card.instanceId),
  };
}

const isAttachOnPlay = (target: AbilityTarget) => attachStepOf(target.ability) !== undefined;

const TRIGGERED_TIMINGS = new Set([
  'FORCED_INTERRUPT',
  'INTERRUPT',
  'HERO_INTERRUPT',
  'ALTER_EGO_INTERRUPT',
  'FORCED_RESPONSE',
  'RESPONSE',
  'HERO_RESPONSE',
  'ALTER_EGO_RESPONSE',
]);

const RESOURCE_TIMINGS = new Set(['RESOURCE', 'HERO_RESOURCE', 'ALTER_EGO_RESOURCE']);

const ACTION_TIMINGS = new Set(['ACTION', 'HERO_ACTION', 'ALTER_EGO_ACTION']);

/** A hash of the final state digest: the same staged run must reproduce it. */
function fingerprintOf(state: GameState): string {
  return fnv1a(JSON.stringify(digestState(state)))
    .toString(16)
    .padStart(8, '0');
}

/** The distinct log keys a state holds, sorted, so the same run always reports the same evidence. */
export function logKeysOf(state: GameState): string[] {
  return [...new Set(state.log.map((entry) => entry.key))].sort();
}

/** Verifies a finished run and decides what evidence covers the ability. */
function conclude(
  target: AbilityTarget,
  variant: string,
  before: ReturnType<typeof digestState>,
  usedBefore: number,
  state: GameState,
): StageOutcome {
  const verification = verifyAbilityExecution(target.ability, before, state);
  const trace = state.log.slice(-10).map((entry) => entry.key);
  if (!verification.ok) {
    return { ok: false, variant, reason: verification.failures.join('; '), verification, trace };
  }
  if (abilityUseCount(state, target.cardCode, target.abilityId) > usedBefore) {
    return {
      ok: true,
      variant,
      evidence: 'used-counter',
      verification,
      fingerprint: fingerprintOf(state),
      logKeys: logKeysOf(state),
    };
  }
  // An "Attach to ..." ability runs as the card is played and records no use of its own
  if (isAttachOnPlay(target) && verification.changed.includes('ZONES')) {
    return {
      ok: true,
      variant,
      evidence: 'digest-delta',
      verification,
      fingerprint: fingerprintOf(state),
      logKeys: logKeysOf(state),
    };
  }
  return { ok: false, variant, reason: 'abilitiesUsed did not increment', verification, trace };
}

/**
 * Exercises one player-initiated ability: stages the card, repairs preconditions the legality gate
 * names, fires through `dispatchAction`, drains prompts and verifies the result.
 */
function exercisePlayerAbility(
  target: AbilityTarget,
  options: StageOptions,
  variant: string,
): StageOutcome {
  const stage = createStage(subjectOf(target), options);
  const placed = placeSource(stage, target);
  if ('error' in placed) return { ok: false, variant, reason: placed.error };

  const repairs = buildRepairs(target);
  primeForEffects(stage, target);
  // The form is a plain precondition of the source, so it is set before the first legality check
  if (repairs[0]?.name === 'identity form') repairs.shift()!.apply(stage);
  const seed = options.seed ?? target.cardCode;
  const pick = branchPicker(options.branch);
  const isPlayOnly =
    placed.kind === 'PLAY' && (target.card.type === CardType.EVENT || isAttachOnPlay(target));

  const legality = (): { allowed: boolean; reason?: string } => {
    const p = player1(stage);
    if (placed.kind === 'PLAY') {
      const inHand = p.hand.find((c) => c.instanceId === placed.card.instanceId);
      if (!inHand) return { allowed: false, reason: 'source card left the hand' };
      const playable = evaluateCardPlayability(stage.state, PLAYER_ID, inHand);
      if (!playable.isPlayable) return { allowed: false, reason: playable.reasons?.join('; ') };
      return canPlayCard(
        stage.state,
        PLAYER_ID,
        inHand.instanceId,
        paymentIds(stage, inHand.instanceId),
      );
    }
    return canInitiateAbility(
      stage.state,
      PLAYER_ID,
      target.ability,
      placed.instance,
      abilityOptions(stage, target.ability),
    );
  };

  let applied = 0;
  let verdict = legality();
  while (!verdict.allowed && applied < repairs.length) {
    repairs[applied++].apply(stage);
    verdict = legality();
  }
  if (!verdict.allowed) {
    return { ok: false, variant, reason: verdict.reason ?? 'illegal for an unnamed reason' };
  }

  const before = digestState(stage.state);
  const usedBefore = abilityUseCount(stage.state, target.cardCode, target.abilityId);

  const fire = (s: GameState, action: GameAction) => {
    const out = dispatchAction(s, action);
    return out;
  };

  let state = stage.state;
  if (placed.kind === 'PLAY') {
    const out = fire(state, playAction(stage, placed.card, target.ability));
    if (!out.result.success)
      return { ok: false, variant, reason: `play rejected: ${out.result.error}` };
    state = drainPrompts(out.state, seed, pick);
    if (!isPlayOnly) {
      // The card is in play: now use its ability
      stage.state = thaw(state);
      restock(stage);
      state = stage.state;
      const inPlay = findInPlayCardInstance(state, placed.card.instanceId);
      if (!inPlay) {
        return { ok: false, variant, reason: 'card did not enter play' };
      }
      let reason = canInitiateAbility(
        state,
        PLAYER_ID,
        target.ability,
        inPlay,
        abilityOptions(stage, target.ability),
      ).reason;
      let allowed = reason === undefined;
      while (!allowed && applied < repairs.length) {
        repairs[applied++].apply(stage);
        state = stage.state;
        const check = canInitiateAbility(
          state,
          PLAYER_ID,
          target.ability,
          inPlay,
          abilityOptions(stage, target.ability),
        );
        allowed = check.allowed;
        reason = check.reason;
      }
      if (!allowed) return { ok: false, variant, reason: reason ?? 'ability illegal' };
      const use = fire(state, {
        type: 'USE_CARD_ABILITY',
        playerId: PLAYER_ID,
        cardInstanceId: inPlay.instanceId,
        abilityId: target.abilityId,
        ...abilityOptions(stage, target.ability),
      });
      if (!use.result.success)
        return { ok: false, variant, reason: `use rejected: ${use.result.error}` };
      state = drainPrompts(use.state, seed, pick);
    }
  } else {
    const use = fire(state, {
      type: 'USE_CARD_ABILITY',
      playerId: PLAYER_ID,
      cardInstanceId: placed.ref,
      abilityId: target.abilityId,
      ...abilityOptions(stage, target.ability),
    });
    if (!use.result.success)
      return { ok: false, variant, reason: `use rejected: ${use.result.error}` };
    state = drainPrompts(use.state, seed, pick);
  }

  return conclude(target, variant, before, usedBefore, state);
}

/** Reveals the card from the encounter path (RR v1.8 "When Revealed") and resolves what follows. */
function exerciseReveal(
  target: AbilityTarget,
  options: StageOptions,
  variant: string,
): StageOutcome {
  const stage = createStage(subjectOf(target), options);
  primeForEffects(stage, target);
  const p = player1(stage);
  p.dealtEncounterCards.push(createCardInstance(target.card, PLAYER_ID));
  const before = digestState(stage.state);
  const usedBefore = abilityUseCount(stage.state, target.cardCode, target.abilityId);
  const seed = options.seed ?? target.cardCode;
  const revealed = step4_revealEncounterCards(stage.state);
  const state = drainPrompts(revealed, seed, branchPicker(options.branch));
  return conclude(target, variant, before, usedBefore, state);
}

/** Turns the card up as the boost card of a villain attack and resolves its boost star ability. */
function exerciseBoost(
  target: AbilityTarget,
  options: StageOptions,
  variant: string,
): StageOutcome {
  const stage = createStage(subjectOf(target), options);
  primeForEffects(stage, target);
  const villain = stage.state.villains[0];
  villain.facedownBoostCards = [createCardInstance(target.card)];
  const before = digestState(stage.state);
  const usedBefore = abilityUseCount(stage.state, target.cardCode, target.abilityId);
  const seed = options.seed ?? target.cardCode;
  const attacked = executeVillainAttackAgainstPlayer(stage.state, player1(stage));
  const state = drainPrompts(attacked, seed, branchPicker(options.branch));
  return conclude(target, variant, before, usedBefore, state);
}

/** Exercises one ability through the driver its timing names; unsupported timings fail by name. */
export function exerciseAbility(target: AbilityTarget, options: StageOptions): StageOutcome {
  const variant = `p${options.playerCount ?? 1}${options.branch === undefined ? '' : `:b${options.branch}`}`;
  const timing = target.ability.timing;
  try {
    if (ACTION_TIMINGS.has(timing)) return exercisePlayerAbility(target, options, variant);
    if (timing === 'WHEN_REVEALED') return exerciseReveal(target, options, variant);
    if (timing === 'BOOST') return exerciseBoost(target, options, variant);
    if (TRIGGERED_TIMINGS.has(timing)) return exerciseTriggered(target, options, variant);
    if (timing === 'CONSTANT') return exerciseConstant(target, options, variant);
    if (RESOURCE_TIMINGS.has(timing)) return exerciseResource(target, options, variant);
    if (timing === 'SETUP') return exerciseSetup(target, options, variant);
    if (timing === 'SPECIAL') return exerciseSpecial(target, options, variant);
  } catch (error) {
    return {
      ok: false,
      variant,
      reason: `threw: ${error instanceof Error ? error.message : error}`,
    };
  }
  return { ok: false, variant, reason: `no driver for timing ${timing}` };
}

/** A real engine action that opens a trigger window; the source card must react to it. */
interface ScenarioContext {
  target: AbilityTarget;
  /** The staged instance of the card under test, once it is in play. */
  source: CardInstance;
}

type Scenario = (stage: Stage, ctx: ScenarioContext) => GameState;

export const dispatchOrThrow = (state: GameState, action: GameAction): GameState => {
  const out = dispatchAction(state, action);
  if (!out.result.success) {
    throw new Error(`scenario action ${action.type} rejected: ${out.result.error}`);
  }
  return out.state;
};

/** Reveals a fixture card as the next encounter card of the stage player. */
export function revealFixture(stage: Stage, card: NormalizedCard | undefined): GameState {
  if (!card) throw new Error('no fixture card for the reveal scenario');
  player1(stage).dealtEncounterCards.push(createCardInstance(card, PLAYER_ID));
  return step4_revealEncounterCards(stage.state);
}

export function basicAttack(
  stage: Stage,
  targetType: 'villain' | 'minion',
  targetInstanceId?: string,
) {
  setForm(player1(stage), 'hero');
  return dispatchOrThrow(stage.state, {
    type: 'BASIC_ATTACK',
    playerId: PLAYER_ID,
    targetType,
    ...(targetInstanceId && { targetInstanceId }),
  });
}

/**
 * An engaged enemy one hit from defeat, defeated by the attack the trigger filter names: the card's
 * own attack ("this card"), a side scheme thwarted to zero, or otherwise the hero's basic attack.
 */
function defeatEnemy(stage: Stage, ctx: ScenarioContext): GameState {
  const p = player1(stage);
  if (ctx.target.card.type === CardType.SIDE_SCHEME) {
    setForm(p, 'hero');
    stage.state.sideSchemes = stage.state.sideSchemes.map((s) =>
      s.instanceId === ctx.source.instanceId ? { ...s, threat: 1 } : s,
    );
    return dispatchOrThrow(stage.state, {
      type: 'BASIC_THWART',
      playerId: PLAYER_ID,
      targetType: 'side_scheme',
      targetInstanceId: ctx.source.instanceId,
    });
  }
  const minion = stage.fixtures.minion;
  if (!minion) throw new Error('no minion fixture');
  const inst =
    p.engagedMinions.find((m) =>
      m.attachments?.some((a) => a.instanceId === ctx.source.instanceId),
    ) ??
    p.engagedMinions[0] ??
    createCardInstance(minion, PLAYER_ID);
  if (!inst.tokens?.damage) {
    inst.tokens = {
      ...inst.tokens,
      damage: Math.max(1, getEffectiveMinionHitPoints(stage.state, inst) - 1),
    };
  }
  if (!p.engagedMinions.includes(inst)) p.engagedMinions.push(inst);
  const filter = ctx.target.ability.triggerFilter as { defeatedByAttackOf?: string } | undefined;
  if (filter?.defeatedByAttackOf === 'THIS_CARD') {
    return dispatchOrThrow(stage.state, {
      type: 'ALLY_ATTACK',
      playerId: PLAYER_ID,
      allyInstanceId: ctx.source.instanceId,
      targetType: 'minion',
      targetInstanceId: inst.instanceId,
    });
  }
  return basicAttack(stage, 'minion', inst.instanceId);
}

export function endRound(stage: Stage): GameState {
  let state = stage.state;
  for (const p of state.players) {
    state = dispatchOrThrow(state, { type: 'END_PLAYER_TURN', playerId: p.id });
    state = drainPrompts(state, 'round');
  }
  return state;
}

const villainAttack: Scenario = (stage) =>
  executeVillainAttackAgainstPlayer(stage.state, player1(stage));

/** The engine action that opens each trigger window (generic, never card-named). */
/** A villain attack on a player-side target; otherwise a basic attack on the villain. */
function damageTarget(stage: Stage, ctx: ScenarioContext): GameState {
  return isPlayerCard(ctx.target.card.type) || ctx.target.card.type === CardType.HERO
    ? villainAttack(stage, ctx)
    : basicAttack(stage, 'villain');
}

const SCENARIOS: Record<string, Scenario> = {
  CARD_PLAYED: (stage) => {
    const ally = createCardInstance(stage.fixtures.ally ?? stage.fixtures.filler, PLAYER_ID);
    player1(stage).hand.push(ally);
    return dispatchOrThrow(stage.state, {
      type: 'PLAY_CARD',
      playerId: PLAYER_ID,
      cardInstanceId: ally.instanceId,
      paymentCardInstanceIds: paymentIds(stage, ally.instanceId),
    });
  },
  ATTACK_RESOLVED: (stage, ctx) => {
    const filter = ctx.target.ability.triggerFilter as { sourceCardCode?: string } | undefined;
    if (filter?.sourceCardCode === ctx.target.cardCode && ctx.target.card.type === CardType.ALLY) {
      return dispatchOrThrow(stage.state, {
        type: 'ALLY_ATTACK',
        playerId: PLAYER_ID,
        allyInstanceId: ctx.source.instanceId,
        targetType: 'villain',
      });
    }
    return basicAttack(stage, 'villain');
  },
  BASIC_ATTACK_PERFORMED: (stage) => basicAttack(stage, 'villain'),
  DEFEATED: defeatEnemy,
  CHARACTER_DEFEATED: defeatEnemy,
  CHARACTER_WOULD_BE_DEFEATED: defeatEnemy,
  THWART_RESOLVED: (stage, ctx) => {
    setForm(player1(stage), 'hero');
    // Threat reaches the scheme only through the threat pipeline (Crisis and Patrol apply)
    applyThreatPlacement(stage.state, {
      targetType: 'main_scheme',
      amount: 3,
      sourceType: 'CARD_EFFECT',
    });
    if (ctx.target.card.type === CardType.ALLY) {
      return dispatchOrThrow(stage.state, {
        type: 'ALLY_THWART',
        playerId: PLAYER_ID,
        allyInstanceId: ctx.source.instanceId,
        targetType: 'main_scheme',
      });
    }
    return dispatchOrThrow(stage.state, {
      type: 'BASIC_THWART',
      playerId: PLAYER_ID,
      targetType: 'main_scheme',
    });
  },
  FORM_CHANGED: (stage) =>
    dispatchOrThrow(stage.state, { type: 'CHANGE_FORM', playerId: PLAYER_ID }),
  ROUND_ENDED: endRound,
  MINION_ATTACKED: (stage, ctx) => {
    setForm(player1(stage), 'hero');
    return executeMinionAttackAgainstPlayer(stage.state, ctx.source, player1(stage));
  },
  MINION_SCHEMED: (stage) => {
    setForm(player1(stage), 'alter_ego');
    return endRound(stage);
  },
  MINION_ENTERS_PLAY: (stage) => revealFixture(stage, stage.fixtures.minion),
  ENCOUNTER_CARD_REVEALED: (stage) => revealFixture(stage, stage.fixtures.treachery),
  THREAT_WOULD_BE_PLACED: (stage) => {
    executeVillainSchemeAgainstPlayer(stage.state, player1(stage));
    return stage.state;
  },
  DAMAGE_WOULD_BE_TAKEN: damageTarget,
  DAMAGE_TAKEN: damageTarget,
  ENEMY_INITIATES_ATTACK: (stage, ctx) => {
    setForm(player1(stage), 'hero');
    if (stage.state.players[1]) setForm(stage.state.players[1], 'hero');
    return ctx.target.card.type === CardType.MINION
      ? executeMinionAttackAgainstPlayer(stage.state, ctx.source, player1(stage))
      : villainAttack(stage, ctx);
  },
  HOST_WOULD_ATTACK: villainAttack,
  HOST_ATTACK_ENDED: villainAttack,
  ATTACK_DEFENDED: villainAttack,
};

/** The triggers a real engine action can open; the rule-coverage table may only name these. */
export const STAGED_TRIGGERS: readonly string[] = Object.keys(SCENARIOS);

const isPlayerCard = (type: CardType) =>
  [CardType.ALLY, CardType.UPGRADE, CardType.SUPPORT, CardType.EVENT, CardType.RESOURCE].includes(
    type,
  );

/** Sculpts the source card into the zone its type lives in (events wait in hand). */
export function installInPlay(stage: Stage, inst: CardInstance, type: CardType): void {
  const p = player1(stage);
  const villain = stage.state.villains[0];
  switch (type) {
    case CardType.ALLY:
      p.allies.push(inst);
      break;
    case CardType.UPGRADE:
    case CardType.SUPPORT:
      p.tableau.push(inst);
      break;
    case CardType.EVENT:
      p.hand.push(inst);
      break;
    case CardType.MINION:
      p.engagedMinions.push(inst);
      break;
    case CardType.ATTACHMENT: {
      if (inst.card.enrichment?.attachTo?.host?.type === 'MINION') {
        const minion = stage.fixtures.minion;
        const hostMinion =
          p.engagedMinions[0] ?? (minion ? createCardInstance(minion, PLAYER_ID) : undefined);
        if (hostMinion) {
          hostMinion.tokens = {
            ...hostMinion.tokens,
            damage: Math.max(1, getEffectiveMinionHitPoints(stage.state, hostMinion) - 1),
          };
          if (!p.engagedMinions.includes(hostMinion)) p.engagedMinions.push(hostMinion);
          if (!hostMinion.attachments) hostMinion.attachments = [];
          hostMinion.attachments.push({ ...inst, hostInstanceId: hostMinion.instanceId });
          break;
        }
      }
      villain.attachments.push({ ...inst, hostInstanceId: villain.instanceId });
      break;
    }
    case CardType.SIDE_SCHEME:
      stage.state.sideSchemes.push({
        instanceId: inst.instanceId,
        card: inst.card as SideSchemeState['card'],
        threat: 3,
      });
      break;
    default:
      break; // identity cards are always in play
  }
}

const attachesWhenPlayed = (card: NormalizedCard) =>
  (card.enrichment?.abilities ?? []).some((a) => attachStepOf(a) !== undefined);

/** Plays a card that attaches onto a staged minion and ally, and returns the attached instance. */
function attachToHost(
  stage: Stage,
  inst: CardInstance,
  seed: string,
): { source: CardInstance } | { error: string } {
  const p = player1(stage);
  const { minion, ally } = stage.fixtures;
  if (minion) p.engagedMinions.push(createCardInstance(minion, PLAYER_ID));
  if (ally) p.allies.push(createCardInstance(ally, PLAYER_ID));
  setForm(p, 'hero');
  restock(stage);
  p.hand.push(inst);
  const out = dispatchAction(stage.state, {
    type: 'PLAY_CARD',
    playerId: PLAYER_ID,
    cardInstanceId: inst.instanceId,
    paymentCardInstanceIds: paymentIds(stage, inst.instanceId),
  });
  if (!out.result.success) return { error: `play rejected: ${out.result.error}` };
  stage.state = thaw(drainPrompts(out.state, seed));
  restock(stage);
  const source = findInPlayCardInstance(stage.state, inst.instanceId);
  return source ? { source } : { error: 'card did not attach to a host' };
}

/** Exercises an ability that reacts to a trigger by staging its source and opening the window. */
function exerciseTriggered(
  target: AbilityTarget,
  options: StageOptions,
  variant: string,
): StageOutcome {
  const trigger = target.ability.trigger;
  if (!trigger) return { ok: false, variant, reason: 'triggered ability declares no trigger' };
  const { card } = target;
  const revealsItself =
    trigger === 'WHEN_REVEALED' ||
    (trigger === 'ENTERS_PLAY' &&
      (card.type === CardType.OBLIGATION || card.type === CardType.TREACHERY));
  if (revealsItself) return exerciseReveal(target, options, variant);

  const stage = createStage(subjectOf(target), options);
  primeForEffects(stage, target);
  const p = player1(stage);
  const ownForm: 'hero' | 'alter_ego' | undefined =
    card.type === CardType.HERO || target.ability.timing.startsWith('HERO_')
      ? 'hero'
      : card.type === CardType.ALTER_EGO
        ? 'alter_ego'
        : undefined;
  if (ownForm) {
    const changesForm =
      trigger === 'FORM_CHANGED' &&
      (card.type === CardType.HERO || card.type === CardType.ALTER_EGO);
    setForm(p, changesForm ? (ownForm === 'hero' ? 'alter_ego' : 'hero') : ownForm);
  }

  const playsItself =
    (trigger === 'ENTERS_PLAY' || trigger === 'CARD_PLAYED') && isPlayerCard(card.type);
  const seed = options.seed ?? target.cardCode;
  const defends = trigger === 'ATTACK_DEFENDED';
  if (defends) setForm(p, 'hero');
  const pick: PromptOptionPicker | undefined = defends
    ? (prompt) => prompt.options.find((o) => o.id === 'defend_hero' && !o.disabled)?.id
    : branchPicker(options.branch);

  try {
    const inst = createCardInstance(card, PLAYER_ID);
    let state: GameState;
    let before: ReturnType<typeof digestState>;
    let usedBefore: number;
    if (playsItself) {
      p.hand.push(inst);
      before = digestState(stage.state);
      usedBefore = abilityUseCount(stage.state, target.cardCode, target.abilityId);
      state = dispatchOrThrow(stage.state, {
        type: 'PLAY_CARD',
        playerId: PLAYER_ID,
        cardInstanceId: inst.instanceId,
        paymentCardInstanceIds: paymentIds(stage, inst.instanceId),
      });
    } else {
      const scenario = SCENARIOS[trigger];
      if (!scenario) return { ok: false, variant, reason: `no scenario for trigger ${trigger}` };
      let source = inst;
      if (attachesWhenPlayed(card)) {
        // An attachment gets its host from the play itself, so the host has to exist first
        const attached = attachToHost(stage, inst, seed);
        if ('error' in attached) return { ok: false, variant, reason: attached.error };
        source = attached.source;
      } else {
        installInPlay(stage, inst, card.type);
      }
      primeForEffects(stage, target, source);
      before = digestState(stage.state);
      usedBefore = abilityUseCount(stage.state, target.cardCode, target.abilityId);
      state = scenario(stage, { target, source });
    }
    state = drainPrompts(state, seed, pick);
    return conclude(target, variant, before, usedBefore, state);
  } catch (error) {
    return {
      ok: false,
      variant,
      reason: `threw: ${error instanceof Error ? error.message : error}`,
    };
  }
}

const KEYWORDS = [
  'guard',
  'patrol',
  'retaliate',
  'toughness',
  'villainous',
  'piercing',
  'overkill',
  'quickstrike',
  'ranged',
  'aerial',
  'sentinel',
  'assault',
  'steady',
  'crisis',
  'immunity',
];

/**
 * The derived stats a CONSTANT ability can move, read through the engine's own calculators:
 * identity stats, hand size, health and ally limit, ally stats, and every enemy's stats.
 */
function digestDerivedStats(state: GameState): string {
  const attempt = <T>(read: () => T): T | string => {
    try {
      return read();
    } catch (error) {
      return `err:${error instanceof Error ? error.message : error}`;
    }
  };
  return JSON.stringify([
    state.players.map((p) => [
      attempt(() => getEffectiveHeroStats(state, p)),
      attempt(() => getEffectiveHandSize(p, state)),
      attempt(() => getEffectiveMaxHealth(p, state)),
      attempt(() => getEffectiveAllyLimit(p, state)),
      attempt(() => getEffectivePlayerTraits(p, state)),
      attempt(() => getEffectiveRetaliate(p, state)),
      p.allies.map((a) => attempt(() => getEffectiveAllyStats(state, a))),
      p.engagedMinions.map((m) => [
        attempt(() => getEffectiveMinionAttack(state, m)),
        attempt(() => getEffectiveMinionScheme(state, m)),
        attempt(() => getEffectiveMinionHitPoints(state, m)),
        attempt(() => getEffectiveCardTraits(m.card, m, { player: p, state })),
      ]),
    ]),
    state.players
      .flatMap((p) => p.engagedMinions)
      .map((m) => KEYWORDS.map((k) => hasEntityKeyword(m, k))),
    state.villains.map((v) => [
      attempt(() => getEffectiveVillainStats(state, v)),
      attempt(() => getEffectiveVillainMaxHealth(state, v)),
    ]),
  ]);
}

/** Replaces the ability-bearing card of the source with a copy that lacks the ability. */
function withoutAbility(card: NormalizedCard, abilityId: string): NormalizedCard {
  return {
    ...card,
    enrichment: {
      ...card.enrichment!,
      abilities: (card.enrichment?.abilities ?? []).filter((a) => a.id !== abilityId),
    },
  };
}

/** Whether every keyword a GRANT_KEYWORD constant names is effective on its entity, by the engine's reading. */
function grantedKeywordsEffective(stage: Stage, target: AbilityTarget): boolean {
  const p = player1(stage);
  const entity: unknown =
    target.card.type === CardType.HERO || target.card.type === CardType.ALTER_EGO
      ? p
      : [...p.engagedMinions, ...p.allies].find((c) => c.card.code === target.cardCode);
  if (!entity) return false;
  return target.ability.steps.every((step) => {
    const keyword = String((step.effectParams as { keyword?: string } | undefined)?.keyword ?? '');
    return (
      keyword !== '' && hasEntityKeyword(entity as Parameters<typeof hasEntityKeyword>[0], keyword)
    );
  });
}

/**
 * A CONSTANT ability is covered when the derived stats differ with and without it, the card being
 * in play: the digest is taken twice on the same staged state, the second time with the ability
 * removed from the source card.
 */
function exerciseConstant(
  target: AbilityTarget,
  options: StageOptions,
  variant: string,
): StageOutcome {
  const stage = createStage(subjectOf(target), options);
  primeForEffects(stage, target);
  const p = player1(stage);
  const { card } = target;
  const stripped = withoutAbility(card, target.abilityId);
  const state = stage.state;
  // A gated constant is only visible while its gate holds (for example "while in Hero form")
  const gatedForm = target.ability.steps.find((step) => step.gate === 'IF_FORM')?.gateParams
    ?.form as string | undefined;
  if (gatedForm) setForm(p, gatedForm === 'HERO' ? 'hero' : 'alter_ego');
  const gatedCardCode = target.ability.steps.find((step) => step.gate === 'IF_CARD_IN_PLAY')
    ?.gateParams?.cardCode as string | undefined;
  if (gatedCardCode && !state.sideSchemes.some((s) => s.card?.code === gatedCardCode)) {
    const witnessScheme = options.allCards.find((c) => c.code === gatedCardCode);
    if (witnessScheme)
      installInPlay(stage, createCardInstance(witnessScheme, PLAYER_ID), witnessScheme.type);
  }
  for (const filter of declaredFilters(target)) {
    const witness = options.allCards.find(
      (c) => c.code !== card.code && c.packCode === 'core' && matchesCardFilter(c, filter),
    );
    if (witness) installInPlay(stage, createCardInstance(witness, PLAYER_ID), witness.type);
  }

  let swap: (to: NormalizedCard) => void;
  let placedEntity: unknown;
  if (card.type === CardType.HERO || card.type === CardType.ALTER_EGO) {
    const isHero = card.type === CardType.HERO;
    setForm(p, isHero ? 'hero' : 'alter_ego');
    swap = (to) => {
      if (isHero) p.hero = to as HeroCard;
      else p.alterEgo = to as AlterEgoCard;
      p.activeFormCard = isHero ? p.hero : p.alterEgo;
    };
  } else {
    const inst = createCardInstance(card, PLAYER_ID);
    installInPlay(stage, inst, card.type);
    const placed = findInPlayCardInstance(state, inst.instanceId);
    if (!placed) return { ok: false, variant, reason: `a ${card.type} cannot be staged in play` };
    placedEntity = placed;
    swap = (to) => {
      placed.card = to as never;
    };
  }

  // A damage immunity shows only against the damage sources it names, so each one is probed
  const immunityProbe = (): string =>
    JSON.stringify(
      target.ability.steps
        .filter((step) => step.effect === 'CANNOT_TAKE_DAMAGE')
        .map((step) => {
          const params = (step.effectParams ?? {}) as {
            sourceCardType?: string;
            sourceTrait?: string;
          };
          const probe = options.allCards.find(
            (c) =>
              c.packCode === 'core' &&
              (!params.sourceCardType || c.type === params.sourceCardType.toLowerCase()) &&
              (!params.sourceTrait || (c.traits ?? []).includes(params.sourceTrait)),
          );
          return probe && placedEntity
            ? isImmuneToDamage(state, placedEntity, createCardInstance(probe, PLAYER_ID))
            : null;
        }),
    );
  const defenseRestrictionProbe = (): string => {
    const hasRestriction = target.ability.steps.some((step) => step.effect === 'RESTRICT_DEFENSE');
    if (!hasRestriction || !placedEntity) return '';
    return JSON.stringify(
      getDefenderRestriction(state, {
        attackId: 'probe',
        attackerType: 'MINION',
        attackerCard: placedEntity as CardInstance,
        targetPlayerId: PLAYER_ID,
        baseAttack: 1,
        totalBoostIcons: 0,
        phase: 'DECLARE_DEFENDER',
      }),
    );
  };
  const withAbility = digestDerivedStats(state) + immunityProbe() + defenseRestrictionProbe();
  const keywords = target.ability.steps.every((step) => step.effect === 'GRANT_KEYWORD');
  if (keywords && grantedKeywordsEffective(stage, target)) {
    // The printed card can state the same keyword, so removing the ability changes nothing: the
    // keyword being effective is the observable instead.
    return { ok: true, variant, evidence: 'digest-delta' };
  }
  swap(stripped);
  const withoutIt = digestDerivedStats(state) + immunityProbe() + defenseRestrictionProbe();
  swap(card);
  if (withAbility === withoutIt) {
    return { ok: false, variant, reason: 'derived stats do not change with the ability' };
  }
  return { ok: true, variant, evidence: 'digest-delta' };
}

/** The option count of every `PLAYER_CHOICE` step: each branch is its own run. */
function choiceBranchCount(target: AbilityTarget): number {
  const counts = target.ability.steps
    .filter((step) => step.effect === 'PLAYER_CHOICE')
    .map((step) => {
      const options = (step.effectParams as { options?: unknown[] } | undefined)?.options;
      return Array.isArray(options) ? options.length : 0;
    });
  return Math.max(0, ...counts);
}

/** Encounter-facing timings behave per player count, so they also run with two players. */
const TWO_PLAYER_TIMINGS = new Set([
  'WHEN_REVEALED',
  'BOOST',
  'FORCED_RESPONSE',
  'FORCED_INTERRUPT',
]);

/** Every run an ability gets: one player, plus two players and each choice branch where they apply. */
export function variantsFor(target: AbilityTarget): Pick<StageOptions, 'playerCount' | 'branch'>[] {
  const needsTwoPlayers = target.ability.steps?.some(
    (s) => s.effectParams?.target === 'ALL_OTHER_HEROES',
  );
  if (needsTwoPlayers) {
    return [{ playerCount: 2 }];
  }
  const variants: Pick<StageOptions, 'playerCount' | 'branch'>[] = [{ playerCount: 1 }];
  if (TWO_PLAYER_TIMINGS.has(target.ability.timing)) variants.push({ playerCount: 2 });
  const branches = choiceBranchCount(target);
  for (let branch = 0; branch < branches; branch++) variants.push({ playerCount: 1, branch });
  return variants;
}

export interface AbilitySweepResult {
  target: AbilityTarget;
  /** One outcome per variant, the first being the primary run that decides coverage. */
  outcomes: StageOutcome[];
}

/** Runs every ability of the inventory through the Stage-Setter and fills the ledger. */
export function sweepAbilities(
  ledger: CoverageLedger,
  options: Omit<StageOptions, 'playerCount' | 'branch'>,
  targets: readonly AbilityTarget[] = ledger.inventory,
): AbilitySweepResult[] {
  return targets.map((target) => {
    const outcomes = variantsFor(target).map((variant) =>
      exerciseAbility(target, { ...options, ...variant }),
    );
    const [primary] = outcomes;
    if (primary.ok && primary.evidence) {
      ledger.markCovered(target.cardCode, target.abilityId, primary.evidence);
    } else {
      ledger.markFailed({
        cardCode: target.cardCode,
        abilityId: target.abilityId,
        reason: primary.reason ?? 'unknown',
      });
    }
    return { target, outcomes };
  });
}

const IDENTITY_GENERATOR = 'identity_ability';

const isPaymentCandidate = (card: NormalizedCard) =>
  [CardType.ALLY, CardType.SUPPORT, CardType.EVENT, CardType.UPGRADE].includes(card.type);

/**
 * A resource ability is triggered only while paying for a card (RR v1.8 "Resource Ability"), so the
 * source pays alone: the hand holds only the card to play, and the play is accepted only if the
 * source (or, for "Power of ...", the doubled hand card) covers the cost.
 */
function exerciseResource(
  target: AbilityTarget,
  options: StageOptions,
  variant: string,
): StageOutcome {
  const stage = createStage(subjectOf(target), options);
  primeForEffects(stage, target);
  const p = player1(stage);
  p.hand = [];
  const { card, ability } = target;
  const doubled = ability.steps.find((step) => step.effect === 'DOUBLE_RESOURCE_FOR_ASPECT');
  const aspect = (doubled?.effectParams as { aspect?: string } | undefined)?.aspect;

  let generatorIds: string[] = [];
  let paymentIds: string[] = [];
  if (doubled) {
    const power = createCardInstance(card, PLAYER_ID);
    p.hand.push(power);
    paymentIds = [power.instanceId];
  } else if (card.type === CardType.HERO || card.type === CardType.ALTER_EGO) {
    setForm(p, card.type === CardType.HERO ? 'hero' : 'alter_ego');
    generatorIds = [IDENTITY_GENERATOR];
  } else {
    const source = createCardInstance(card, PLAYER_ID);
    p.tableau.push(source);
    if (card.type === CardType.UPGRADE) setForm(p, 'hero');
    // A generator that draws on the discard pile reads the top card's resources
    p.discard.push(createCardInstance(stage.fixtures.filler, PLAYER_ID));
    generatorIds = [source.instanceId];
  }

  const before = digestState(stage.state);
  const cost = (c: NormalizedCard) => (c as { cost?: number }).cost ?? 0;
  // Cheapest first: the source has to cover the whole cost on its own
  const candidates = options.allCards
    .filter(
      (c) =>
        isPaymentCandidate(c) &&
        (aspect === undefined || String(c.faction) === aspect) &&
        c.code !== card.code,
    )
    .sort((a, b) => cost(a) - cost(b));
  for (const candidate of candidates) {
    const inst = createCardInstance(candidate, PLAYER_ID);
    p.hand.push(inst);
    const verdict = canPlayCard(stage.state, PLAYER_ID, inst.instanceId, paymentIds, generatorIds);
    if (!verdict.allowed) {
      p.hand.pop();
      continue;
    }
    const out = dispatchAction(stage.state, {
      type: 'PLAY_CARD',
      playerId: PLAYER_ID,
      cardInstanceId: inst.instanceId,
      paymentCardInstanceIds: paymentIds,
      ...(generatorIds.length > 0 && { generatorInstanceIds: generatorIds }),
    });
    if (!out.result.success) {
      p.hand.pop();
      continue;
    }
    const state = drainPrompts(
      out.state,
      options.seed ?? target.cardCode,
      branchPicker(options.branch),
    );
    const verification = verifyAbilityExecution(ability, before, state, { checkDeltas: false });
    if (!verification.ok) {
      return { ok: false, variant, reason: verification.failures.join('; '), verification };
    }
    return {
      ok: true,
      variant,
      evidence: 'resource',
      verification,
      fingerprint: fingerprintOf(state),
      logKeys: logKeysOf(state),
    };
  }
  return { ok: false, variant, reason: 'no card could be played with only this resource source' };
}

/** A SETUP ability runs inside `setupGame`; a matching card is hidden at the deck's bottom for its search. */
function exerciseSetup(
  target: AbilityTarget,
  options: StageOptions,
  variant: string,
): StageOutcome {
  const filters = declaredFilters(target);
  const witness = filters
    .map((filter) =>
      options.allCards.find(
        (c) => c.packCode === 'core' && matchesCardFilter(c, filter) && c.code !== target.card.code,
      ),
    )
    .find(Boolean);
  const deckExtras = witness ? [witness] : [];
  const stage = createStage(subjectOf(target), options, deckExtras);
  const { state } = stage;
  const seed = options.seed ?? target.cardCode;
  // Setup abilities resolve once the opening hands are kept (the mulligan step)
  let started = state;
  for (const pl of state.players) {
    started = dispatchOrThrow(started, {
      type: 'RESOLVE_MULLIGAN',
      playerId: pl.id,
      discardCardInstanceIds: [],
    });
  }
  const settled = drainPrompts(started, seed, branchPicker(options.branch));
  const hand = settled.players[0].hand;
  const verification = verifyAbilityExecution(target.ability, digestState(settled), settled, {
    checkDeltas: false,
  });
  if (!verification.ok) {
    return { ok: false, variant, reason: verification.failures.join('; '), verification };
  }
  if (witness && !hand.some((c) => c.card.code === witness.code)) {
    return { ok: false, variant, reason: 'setup did not move the matching card to the hand' };
  }
  return {
    ok: true,
    variant,
    evidence: 'setup',
    verification,
    fingerprint: fingerprintOf(settled),
    logKeys: logKeysOf(settled),
  };
}

/**
 * A SPECIAL ability of an upgrade resolves when a card with a Special effect is played with the
 * upgrade in play; the play is the engine action that opens its window.
 */
function exerciseSpecial(
  target: AbilityTarget,
  options: StageOptions,
  variant: string,
): StageOutcome {
  const trigger = options.allCards.find((c) =>
    (c.enrichment?.abilities ?? []).some((a) =>
      a.steps.some((s) => s.effect === 'EXECUTE_SPECIAL'),
    ),
  );
  if (!trigger) return { ok: false, variant, reason: 'no card plays Special abilities' };
  const stage = createStage(subjectOf(target), options);
  primeForEffects(stage, target);
  for (const repair of buildRepairs(target)) repair.apply(stage);
  const p = player1(stage);
  setForm(p, 'hero');
  p.tableau.push(createCardInstance(target.card, PLAYER_ID));
  const play = createCardInstance(trigger, PLAYER_ID);
  p.hand.push(play);
  const before = digestState(stage.state);
  const out = dispatchAction(stage.state, {
    type: 'PLAY_CARD',
    playerId: PLAYER_ID,
    cardInstanceId: play.instanceId,
    paymentCardInstanceIds: paymentIds(stage, play.instanceId),
  });
  if (!out.result.success) {
    return { ok: false, variant, reason: `play rejected: ${out.result.error}` };
  }
  const state = drainPrompts(
    out.state,
    options.seed ?? target.cardCode,
    branchPicker(options.branch),
  );
  const verification = verifyAbilityExecution(target.ability, before, state);
  if (!verification.ok) {
    return { ok: false, variant, reason: verification.failures.join('; '), verification };
  }
  return {
    ok: true,
    variant,
    evidence: 'special',
    verification,
    fingerprint: fingerprintOf(state),
    logKeys: logKeysOf(state),
  };
}

const WINDOW_SOURCE_TYPES = new Set<CardType>([
  CardType.ALLY,
  CardType.UPGRADE,
  CardType.SUPPORT,
  CardType.EVENT,
  CardType.MINION,
]);

/** An ability that can share a trigger window with another: it reacts to an event, from a stageable card. */
const isWindowCandidate = (target: AbilityTarget): boolean =>
  TRIGGERED_TIMINGS.has(target.ability.timing) &&
  target.ability.trigger !== undefined &&
  SCENARIOS[target.ability.trigger] !== undefined &&
  WINDOW_SOURCE_TYPES.has(target.card.type) &&
  !attachesWhenPlayed(target.card);

export interface TriggerWindowResult {
  trigger: string;
  /** `cardCode#abilityId` of every ability staged in the window. */
  abilities: string[];
  ok: boolean;
  reason?: string;
  /**
   * `checked`: a forced and an optional ability both resolved, so their order was verified.
   * `unobserved`: one side never resolved in this window, so the order rule had nothing to judge.
   */
  order?: 'checked' | 'unobserved';
  /** Every distinct log key an `ok` window wrote, sorted: the rule-coverage evidence. */
  logKeys?: string[];
}

const isForced = (target: AbilityTarget) => target.ability.timing.startsWith('FORCED_');

/**
 * Forced abilities resolve before optional ones in the same window (RR v1.8 "Forced"). Judged from
 * the log keys the engine writes as each ability triggers; with only one side resolved there is no
 * order to judge and the window reports `checked: false`.
 */
export function windowOrder(
  logKeys: readonly string[],
  targets: readonly AbilityTarget[],
): { checked: boolean; violation?: string } {
  const position = (t: AbilityTarget) => logKeys.indexOf(`ability.${t.abilityId}.triggered`);
  const resolved = (forced: boolean) =>
    targets
      .filter((t) => isForced(t) === forced)
      .map(position)
      .filter((i) => i >= 0);
  const forced = resolved(true);
  const optional = resolved(false);
  if (forced.length === 0 || optional.length === 0) return { checked: false };
  return Math.max(...forced) > Math.min(...optional)
    ? { checked: true, violation: 'an optional ability resolved before a forced one' }
    : { checked: true };
}

/**
 * Stages every target in play and opens the trigger window they share through a real engine
 * action, then resolves each prompt. Returns the state before and after, for checking or reading.
 */
export function openTriggerWindow(
  targets: readonly AbilityTarget[],
  options: StageOptions,
): { before: ReturnType<typeof digestState>; state: GameState } {
  const trigger = targets[0].ability.trigger ?? '';
  const stage = createStage(subjectOf(targets[0]), options);
  const p = player1(stage);
  const wantsHero = targets.some((t) => t.ability.timing.startsWith('HERO_'));
  const wantsEgo = targets.some((t) => t.ability.timing.startsWith('ALTER_EGO_'));
  if (wantsHero || !wantsEgo) setForm(p, 'hero');
  else setForm(p, 'alter_ego');
  const staged: { target: AbilityTarget; inst: CardInstance }[] = [];
  for (const target of targets) {
    const inst = createCardInstance(target.card, PLAYER_ID);
    installInPlay(stage, inst, target.card.type);
    primeForEffects(stage, target, inst);
    staged.push({ target, inst });
  }
  const before = digestState(stage.state);
  const first = staged[0];
  const opened = SCENARIOS[trigger](stage, { target: first.target, source: first.inst });
  return { before, state: drainPrompts(opened, options.seed ?? trigger) };
}

/**
 * Stages several abilities that react to the same trigger, opens the window once through the real
 * engine action, and checks it resolves cleanly: no step error, no stuck prompt, invariants hold,
 * and a forced ability never resolves after an optional one (RR v1.8 "Forced" abilities go first).
 */
export function exerciseTriggerWindow(
  targets: readonly AbilityTarget[],
  options: StageOptions,
): TriggerWindowResult {
  const trigger = targets[0].ability.trigger ?? '';
  const abilities = targets.map((t) => `${t.cardCode}#${t.abilityId}`);
  const fail = (reason: string): TriggerWindowResult => ({ trigger, abilities, ok: false, reason });
  try {
    const { before, state } = openTriggerWindow(targets, options);
    const verification = verifyAbilityExecution({ id: trigger, steps: [] }, before, state, {
      checkDeltas: false,
    });
    if (!verification.ok) return fail(verification.failures.join('; '));

    const order = windowOrder(
      state.log.map((entry) => entry.key),
      targets,
    );
    if (order.violation) return fail(order.violation);
    return {
      trigger,
      abilities,
      ok: true,
      order: order.checked ? 'checked' : 'unobserved',
      logKeys: logKeysOf(state),
    };
  } catch (error) {
    return fail(`threw: ${error instanceof Error ? error.message : error}`);
  }
}

const WINDOW_PAIR_LIMIT = 8;

/** Every trigger shared by two or more stageable abilities, each staged as neighbouring pairs. */
export function sweepTriggerWindows(
  inventory: readonly AbilityTarget[],
  options: StageOptions,
): TriggerWindowResult[] {
  const byTrigger = new Map<string, AbilityTarget[]>();
  for (const target of inventory.filter(isWindowCandidate)) {
    const trigger = target.ability.trigger!;
    byTrigger.set(trigger, [...(byTrigger.get(trigger) ?? []), target]);
  }
  const results: TriggerWindowResult[] = [];
  for (const [, group] of [...byTrigger.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    // Forced abilities first so every window mixes forced with optional ones when it can
    const sorted = [...group].sort((a, b) => Number(isForced(b)) - Number(isForced(a)));
    const distinct = sorted.filter(
      (t, i) => sorted.findIndex((o) => o.cardCode === t.cardCode) === i,
    );
    for (let i = 0; i + 1 < distinct.length && i < WINDOW_PAIR_LIMIT; i++) {
      results.push(exerciseTriggerWindow([distinct[i], distinct[i + 1]], options));
    }
  }
  return results;
}
