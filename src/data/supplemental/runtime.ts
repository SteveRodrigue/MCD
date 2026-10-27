/**
 * The parts of the supplemental schema the engine needs at runtime, without Zod. The Zod schemas
 * (`schema-primitives.ts`, `gate-params.ts`) derive their enums from these lists, so each list
 * exists once and the game bundle does not load Zod (AUD-20261017-232534 F014-A).
 */

import type { EffectParamsMap } from './effect-params.ts';

/** Every effect a step can execute (ADR-0046). */
export const EFFECT_TYPES = [
  'DRAW',
  'ADD_ACCELERATION',
  'ADD_COUNTERS',
  'ADD_STATUS',
  'ADD_THREAT',
  'ADD_TRAIT',
  'ATTACHMENT_DAMAGE_SHIELD',
  'ATTACH_FACEDOWN_CARDS_FROM_HAND',
  'ATTACH_TO_HOST',
  'CANCEL_ATTACK',
  'CANCEL_WHEN_REVEALED',
  'CANCEL_WHEN_REVEALED_AND_REVEAL_ANOTHER',
  'CANNOT_TAKE_DAMAGE',
  'CHANGE_FORM',
  'DEAL_DAMAGE',
  'DECLARE_DEFENDER',
  'DISCARD',
  'DISTRIBUTE_AMOUNT',
  'DOUBLE_RESOURCE_FOR_ASPECT',
  'EXECUTE_SPECIAL',
  'EXHAUST',
  'FLIP_FORM',
  'GENERATE_RESOURCE',
  'GIVE_ADDITIONAL_BOOST_CARD',
  'GRANT_KEYWORD',
  'GRANT_ATTACK_KEYWORD',
  'HEAL_DAMAGE',
  'MODIFY_ALLY_LIMIT',
  'MODIFY_HAND_SIZE',
  'MODIFY_MAX_HEALTH',
  'MODIFY_RESTRICTED_LIMIT',
  'MODIFY_STAT',
  'PLACE_CARD_UNDER_HOST',
  'PLAYER_CHOICE',
  'PLAY_FROM_ZONE',
  'PREVENT_DAMAGE',
  'PREVENT_THREAT',
  'PUT_INTO_PLAY',
  'READY',
  'REDUCE_NEXT_CARD_COST',
  'REMOVE_COUNTERS',
  'REMOVE_COUNTERS_MATCHING_FILTER',
  'REMOVE_FROM_GAME',
  'REMOVE_THREAT',
  'RETURN_TO_HAND',
  'REVEAL_ENCOUNTER_CARD',
  'SEARCH',
  'SHUFFLE_INTO_DECK',
  'SPEND_COUNTERS',
  'SURGE',
  'TRANSFER_DAMAGE',
  'ENEMY_ATTACKS',
  'VILLAIN_AND_ENGAGED_MINIONS_ATTACK',
  'VILLAIN_ATTACKS',
  'VILLAIN_SCHEMES',
  'REMOVE_STATUS',
] as const;

export type EffectType = (typeof EFFECT_TYPES)[number];

/** True for an executable effect; prompt options also carry routing markers such as `PASS`. */
export function isEffectType(value: string): value is EffectType {
  return (EFFECT_TYPES as readonly string[]).includes(value);
}

/**
 * Step gates and what each reads: RESULT the previous step's result, STATE the game state,
 * CONTEXT the event that triggered the ability.
 */
export const GATE_KINDS = {
  THEN: 'RESULT',
  IF_RESULT: 'RESULT',
  IF_FORM: 'STATE',
  IF_PLAYER_HAS_TRAIT: 'STATE',
  IF_ZONE_EMPTY: 'STATE',
  IF_CARD_IN_PLAY: 'STATE',
  IF_RESOURCE_MATCH: 'CONTEXT',
  IF_UNDEFENDED_ATTACK: 'CONTEXT',
  IF_ACTIVATION_DEALT_DAMAGE: 'CONTEXT',
} as const;

export type StepGate = keyof typeof GATE_KINDS;
export type GateKind = (typeof GATE_KINDS)[StepGate];
export const STEP_GATES = Object.keys(GATE_KINDS) as [StepGate, ...StepGate[]];

/**
 * Params typed to the step's effect. A step whose effect is not narrowed (`AbilityStep`) gets
 * `Record<string, unknown>`, so each read must be checked; narrow with `isStep` for typed keys.
 */
export function getStepEffectParams<E extends EffectType>(step: {
  effect: E;
  effectParams?: Record<string, unknown>;
}): EffectType extends E ? Record<string, unknown> : EffectParamsMap[E] {
  return (step.effectParams ?? {}) as EffectType extends E
    ? Record<string, unknown>
    : EffectParamsMap[E];
}

export function getStepGateParams(step: { gateParams?: Record<string, any> }): Record<string, any> {
  return step.gateParams ?? {};
}

/** The "attach to" step of an ability: the one a played upgrade or support runs to pick its host. */
export function attachStepOf<S extends { effect: string }>(ability: {
  steps?: S[];
}): S | undefined {
  return ability.steps?.find((s) => s.effect === 'ATTACH_TO_HOST');
}

/** Whether an ability is an action the player takes on their turn. */
export const isActionTiming = (ability: { timing?: string }): boolean =>
  ability.timing === 'ACTION' ||
  ability.timing === 'HERO_ACTION' ||
  ability.timing === 'ALTER_EGO_ACTION';

/** The abilities a card runs when it is played: an event's actions, an attachment's "attach to". */
export function abilitiesRunOnPlay<
  A extends { timing?: string; steps?: { effect: string }[] },
>(card: { type: string; enrichment?: { abilities?: A[] } }): A[] {
  return (card.enrichment?.abilities ?? []).filter((ability) =>
    card.type === 'event'
      ? isActionTiming(ability) || !ability.timing
      : attachStepOf(ability) !== undefined,
  );
}
