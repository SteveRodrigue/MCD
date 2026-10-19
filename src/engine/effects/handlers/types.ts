import type { EffectType } from '../../../data/supplemental/runtime';
import type { AbilityStep, GameState, PlayerState } from '../../models';
import type { EffectExecutionContext, EffectResult } from '../index';

export type TypedStep<E extends EffectType = EffectType> = AbilityStep & { effect: E };

/**
 * Keys the engine writes into `effectParams` while resolving a step (target choice, distribution
 * prompts). They are not card data, so the supplemental schemas do not declare them.
 */
export interface EffectRuntimeParams {
  targetInstanceId?: string;
  targetPlayerId?: string;
  isAttack?: boolean;
  canCancel?: boolean;
  exactMatchRequired?: boolean;
  budgetLabel?: string;
  unitSingular?: string;
  unitPlural?: string;
}

export function getRuntimeParams(step: AbilityStep): EffectRuntimeParams {
  return (step.effectParams ?? {}) as EffectRuntimeParams;
}

/** Narrows a step to one effect so its `effectParams` take that effect's schema type. */
export function isStep<E extends EffectType>(step: AbilityStep, effect: E): step is TypedStep<E> {
  return step.effect === effect;
}

/** Executes one ability step of a given effect (AUD-20261017-232534 F010-A, R5). */
export type StepHandler<E extends EffectType = EffectType> = (
  state: GameState,
  step: TypedStep<E>,
  context: EffectExecutionContext,
  player: PlayerState,
) => EffectResult;

export type StepHandlerMap = {
  [E in EffectType]: StepHandler<E>;
};
