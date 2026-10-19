import type { EffectType } from '../../../data/supplemental/runtime';
import type { AbilityStep, GameState, PlayerState } from '../../models';
import type { EffectExecutionContext, EffectResult } from '../index';

export type TypedStep<E extends EffectType = EffectType> = AbilityStep & { effect: E };

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
