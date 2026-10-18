import type { AbilityStep, GameState, PlayerState } from '../../models';
import type { EffectExecutionContext, EffectResult } from '../index';

/** Executes one ability step of a given effect (AUD-20261017-232534 F010-A). */
export type StepHandler = (
  state: GameState,
  step: AbilityStep,
  context: EffectExecutionContext,
  player: PlayerState,
) => EffectResult;
