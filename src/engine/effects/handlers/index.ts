import type { AbilityStep, GameState, PlayerState } from '../../models';
import type { EffectExecutionContext, EffectResult } from '../index';
import type { StepHandler, StepHandlerMap } from './types';
import { DAMAGE_HANDLERS } from './damage';
import { CARDS_HANDLERS } from './cards';
import { ENCOUNTER_HANDLERS } from './encounter';
import { COMBAT_HANDLERS } from './combat';
import { STATE_HANDLERS } from './state';
import { RESOURCES_HANDLERS } from './resources';
import { CHOICE_HANDLERS } from './choice';

/** One handler per effect; `satisfies` fails the build when an effect has none. */
export const EFFECT_HANDLERS = {
  ...DAMAGE_HANDLERS,
  ...CARDS_HANDLERS,
  ...ENCOUNTER_HANDLERS,
  ...COMBAT_HANDLERS,
  ...STATE_HANDLERS,
  ...RESOURCES_HANDLERS,
  ...CHOICE_HANDLERS,
} satisfies StepHandlerMap;

/**
 * Runs the handler registered for `step.effect`. This is the one place the handler's effect is
 * asserted: TypeScript cannot correlate a runtime `step.effect` with its handler across the union.
 */
export function runStepHandler(
  state: GameState,
  step: AbilityStep,
  context: EffectExecutionContext,
  player: PlayerState,
): EffectResult {
  const handler = EFFECT_HANDLERS[step.effect] as StepHandler | undefined;
  // An effect without a handler must fail loudly, never resolve as a silent no-op
  if (!handler) throw new Error(`executeStep: no handler for effect '${String(step.effect)}'`);
  return handler(state, step, context, player);
}
