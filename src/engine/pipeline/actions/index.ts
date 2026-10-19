import type { GameAction, GameState, ActionResult } from '../../models';
import type { ActionHandler, ActionHandlerMap } from './types';
import { SETUP_HANDLERS } from './setup';
import { COMBAT_HANDLERS } from './combat';
import { PLAY_HANDLERS } from './play';
import { ABILITIES_HANDLERS } from './abilities';
import { PROMPT_HANDLERS } from './prompts';
import { PHASE_HANDLERS } from './phase';

export * from './types';

/** One handler per action; `satisfies` fails the build when an action has none. */
export const ACTION_HANDLERS = {
  ...SETUP_HANDLERS,
  ...COMBAT_HANDLERS,
  ...PLAY_HANDLERS,
  ...ABILITIES_HANDLERS,
  ...PROMPT_HANDLERS,
  ...PHASE_HANDLERS,
} satisfies ActionHandlerMap;

/**
 * Runs the handler registered for `action.type`. This is the one place the handler's action is
 * asserted: TypeScript cannot correlate a runtime `action.type` with its handler across the union.
 */
export function runActionHandler(
  nextState: GameState,
  state: GameState,
  action: GameAction,
): { state: GameState; result: ActionResult } {
  const handler = ACTION_HANDLERS[action.type] as ActionHandler | undefined;
  if (!handler) throw new Error(`dispatchAction: no handler for action '${String(action.type)}'`);
  return handler(nextState, state, action);
}
