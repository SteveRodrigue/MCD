import type { AbilityStep, CardAbility, CardInstance, GameState } from '../models';
import { EFFECT_TYPES, type EffectType } from '../../data/supplemental/runtime';
import { assertGameStateInvariants, getAllCardInstances } from '../state/state-validator';
import { peekDecisionPrompt } from '../pipeline';

/** A part of the game state an effect can change; the unit the Effect-Delta Registry speaks in. */
export type DeltaDomain =
  | 'HEALTH'
  | 'THREAT'
  | 'ZONES'
  | 'STATUS'
  | 'COUNTERS'
  | 'MODIFIERS'
  | 'READINESS'
  | 'FORM'
  | 'PROMPT'
  | 'LOG';

export type StateDigest = Record<DeltaDomain, string>;

/**
 * The Effect-Delta Registry: for every effect, the state domains in which its resolution must be
 * observable (any one of them). Typed over the full effect list, so a new effect without a contract
 * does not compile. Effects that only set an engine-side flag (cancel, keyword grants) are observable
 * through the log; for those the check is deliberately soft (the log also records the ability use).
 */
export const EFFECT_DELTA_CONTRACTS: Record<EffectType, readonly DeltaDomain[]> = {
  DEAL_DAMAGE: ['HEALTH', 'ZONES', 'PROMPT'],
  DISTRIBUTE_AMOUNT: ['HEALTH', 'THREAT', 'COUNTERS', 'PROMPT'],
  HEAL_DAMAGE: ['HEALTH', 'PROMPT'],
  PREVENT_DAMAGE: ['MODIFIERS', 'HEALTH', 'PROMPT', 'LOG'],
  GRANT_KEYWORD: ['MODIFIERS', 'LOG'],
  ATTACHMENT_DAMAGE_SHIELD: ['COUNTERS', 'MODIFIERS', 'HEALTH'],
  TRANSFER_DAMAGE: ['HEALTH', 'PROMPT'],
  DISCARD: ['ZONES', 'PROMPT'],
  DRAW: ['ZONES'],
  ATTACH_TO_HOST: ['ZONES', 'PROMPT'],
  PLACE_CARD_UNDER_HOST: ['ZONES', 'PROMPT'],
  PUT_INTO_PLAY: ['ZONES', 'PROMPT'],
  SHUFFLE_INTO_DECK: ['ZONES'],
  REMOVE_FROM_GAME: ['ZONES', 'PROMPT'],
  RETURN_TO_HAND: ['ZONES', 'PROMPT'],
  SEARCH: ['ZONES', 'PROMPT'],
  ATTACH_FACEDOWN_CARDS_FROM_HAND: ['ZONES', 'PROMPT'],
  PLAY_FROM_ZONE: ['ZONES', 'PROMPT'],
  PREVENT_THREAT: ['MODIFIERS', 'THREAT', 'PROMPT', 'LOG'],
  REMOVE_THREAT: ['THREAT', 'PROMPT'],
  ADD_ACCELERATION: ['THREAT', 'COUNTERS'],
  SURGE: ['ZONES'],
  REVEAL_ENCOUNTER_CARD: ['ZONES', 'THREAT', 'HEALTH', 'PROMPT'],
  ADD_THREAT: ['THREAT', 'PROMPT'],
  CANCEL_WHEN_REVEALED: ['LOG', 'ZONES'],
  CANCEL_WHEN_REVEALED_AND_REVEAL_ANOTHER: ['ZONES'],
  GRANT_ATTACK_KEYWORD: ['MODIFIERS', 'LOG'],
  CANCEL_ATTACK: ['LOG', 'MODIFIERS'],
  GIVE_ADDITIONAL_BOOST_CARD: ['ZONES'],
  DECLARE_DEFENDER: ['HEALTH', 'READINESS', 'PROMPT'],
  VILLAIN_SCHEMES: ['THREAT', 'PROMPT'],
  VILLAIN_ATTACKS: ['HEALTH', 'PROMPT'],
  ENEMY_ATTACKS: ['HEALTH', 'PROMPT'],
  VILLAIN_AND_ENGAGED_MINIONS_ATTACK: ['HEALTH', 'PROMPT'],
  ADD_STATUS: ['STATUS', 'PROMPT'],
  REMOVE_STATUS: ['STATUS', 'PROMPT'],
  ADD_TRAIT: ['MODIFIERS'],
  MODIFY_STAT: ['MODIFIERS'],
  READY: ['READINESS', 'PROMPT'],
  EXHAUST: ['READINESS', 'PROMPT'],
  FLIP_FORM: ['FORM'],
  CHANGE_FORM: ['FORM'],
  ADD_COUNTERS: ['COUNTERS', 'PROMPT'],
  SPEND_COUNTERS: ['COUNTERS', 'PROMPT'],
  REMOVE_COUNTERS: ['COUNTERS', 'PROMPT'],
  REMOVE_COUNTERS_MATCHING_FILTER: ['COUNTERS', 'PROMPT'],
  GENERATE_RESOURCE: ['MODIFIERS', 'ZONES'],
  REDUCE_NEXT_CARD_COST: ['MODIFIERS'],
  MODIFY_RESTRICTED_LIMIT: ['MODIFIERS'],
  MODIFY_ALLY_LIMIT: ['MODIFIERS'],
  MODIFY_HAND_SIZE: ['MODIFIERS'],
  MODIFY_MAX_HEALTH: ['HEALTH', 'MODIFIERS'],
  CANNOT_TAKE_DAMAGE: ['MODIFIERS', 'LOG'],
  DOUBLE_RESOURCE_FOR_ASPECT: ['MODIFIERS'],
  PLAYER_CHOICE: ['PROMPT', 'LOG', 'HEALTH', 'THREAT', 'ZONES', 'STATUS', 'COUNTERS', 'MODIFIERS'],
  EXECUTE_SPECIAL: [
    'HEALTH',
    'THREAT',
    'ZONES',
    'STATUS',
    'COUNTERS',
    'MODIFIERS',
    'PROMPT',
    'LOG',
  ],
};

/** Effects in the registry that the supplemental effect list no longer declares (guards drift). */
export function effectsMissingContract(): EffectType[] {
  return EFFECT_TYPES.filter((e) => !(e in EFFECT_DELTA_CONTRACTS));
}

function zoneIds(cards: readonly CardInstance[] | undefined): string {
  return (cards ?? []).map((c) => c.instanceId).join(',');
}

/** A comparable fingerprint of the state, one string per delta domain. */
export function digestState(state: GameState): StateDigest {
  const all = getAllCardInstances(state);
  const players = state.players;
  return {
    HEALTH: JSON.stringify([
      players.map((p) => p.health),
      state.villains.map((v) => v.health),
      all.map((c) => c.tokens?.damage ?? 0),
    ]),
    THREAT: JSON.stringify([
      state.mainSchemes.map((m) => m.threat),
      state.sideSchemes.map((s) => [s.instanceId, s.threat]),
      state.accelerationTokens,
      all.map((c) => c.tokens?.threat ?? 0),
    ]),
    ZONES: JSON.stringify([
      players.map((p) => [
        zoneIds(p.hand),
        zoneIds(p.deck),
        zoneIds(p.discard),
        zoneIds(p.tableau),
        zoneIds(p.allies),
        zoneIds(p.engagedMinions),
        zoneIds(p.obligations),
        zoneIds(p.attachments),
        zoneIds(p.cardsUnderneath),
      ]),
      zoneIds(state.encounterDeck),
      zoneIds(state.encounterDiscard),
      zoneIds(state.victoryDisplay),
      zoneIds(state.removedFromGame),
      zoneIds(state.environments),
      state.sideSchemes.map((s) => s.instanceId),
      state.villains.map((v) => zoneIds(v.attachments)),
    ]),
    STATUS: JSON.stringify([
      players.map((p) => p.statusCards),
      state.villains.map((v) => v.statusCards),
      all.map((c) => c.statusCards ?? []),
    ]),
    COUNTERS: JSON.stringify([
      players.map((p) => p.counters),
      all.map((c) => [c.counters, c.tokens?.counters ?? 0]),
    ]),
    MODIFIERS: JSON.stringify([
      players.map((p) => [
        p.activeStatModifiers,
        p.activeTraitModifiers,
        p.costReductions,
        p.activeCostReductions,
        p.maxHealth,
      ]),
      all.map((c) => c.activeStatModifiers),
    ]),
    READINESS: JSON.stringify([
      // A ready that undoes an exhaust (attack, defend) leaves the flags equal; the exhaust log shows it
      state.log.filter(
        (entry) => entry.key === 'card.state.exhausted' || entry.key === 'combat.hero.defended',
      ).length,
      players.map((p) => p.exhausted),
      state.villains.map((v) => v.exhausted),
      all.map((c) => c.exhausted ?? false),
    ]),
    FORM: JSON.stringify(players.map((p) => [p.currentForm, p.activeFormCard?.code])),
    PROMPT: JSON.stringify([
      state.pendingDecisionQueue.length,
      state.pendingSequences?.length ?? 0,
    ]),
    LOG: String(state.log.length),
  };
}

export function changedDomains(before: StateDigest, after: StateDigest): DeltaDomain[] {
  return (Object.keys(before) as DeltaDomain[]).filter((d) => before[d] !== after[d]);
}

/** Every `engine.stepError` entry in the log, as `card effect: error` strings. */
export function collectStepErrors(state: GameState): string[] {
  return state.log
    .filter((entry) => entry.key === 'engine.stepError')
    .map((entry) => entry.text ?? JSON.stringify(entry.params));
}

/** Throws when the log recorded an `engine.stepError`; a step that fails must never go unnoticed. */
export function assertNoStepErrors(state: GameState, context: string): void {
  const errors = collectStepErrors(state);
  if (errors.length > 0) {
    throw new Error(`[StepError] ${context}: ${errors.join(' | ')}`);
  }
}

/** A step whose resolution depends on a gate, a choice or a limit may legitimately change nothing. */
function mayNoOp(step: AbilityStep): boolean {
  return Boolean(step.gate) || step.effect === 'PLAYER_CHOICE';
}

export interface AbilityVerification {
  ok: boolean;
  failures: string[];
  changed: DeltaDomain[];
}

export interface VerifyAbilityOptions {
  /** Require that the ability's unconditional steps each changed a domain their contract names. */
  checkDeltas?: boolean;
}

/**
 * Verifies one ability resolution against the digest taken before it: no step errors, no stuck
 * prompt, the state invariants hold, and every unconditional step left its declared mark.
 */
export function verifyAbilityExecution(
  ability: Pick<CardAbility, 'id' | 'steps'>,
  before: StateDigest,
  after: GameState,
  options: VerifyAbilityOptions = {},
): AbilityVerification {
  const failures: string[] = [];
  const afterDigest = digestState(after);
  const changed = changedDomains(before, afterDigest);

  const errors = collectStepErrors(after);
  if (errors.length > 0) failures.push(`engine.stepError: ${errors.join(' | ')}`);

  if (peekDecisionPrompt(after)) failures.push('a decision prompt is still pending');
  if (after.pendingSequences && after.pendingSequences.length > 0) {
    failures.push(`${after.pendingSequences.length} pending sequence(s) left dangling`);
  }

  try {
    assertGameStateInvariants(after);
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error));
  }

  if (options.checkDeltas !== false) {
    for (const step of ability.steps) {
      if (mayNoOp(step)) continue;
      const expected = EFFECT_DELTA_CONTRACTS[step.effect];
      if (!expected.some((d) => changed.includes(d))) {
        failures.push(
          `step '${step.effect}' changed none of its declared domains [${expected.join(', ')}]`,
        );
      }
    }
  }

  return { ok: failures.length === 0, failures, changed };
}
