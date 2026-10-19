import type { GameAction, GameState, ActionResult } from '../../models';

export type TypedAction<T extends GameAction['type'] = GameAction['type']> = Extract<
  GameAction,
  { type: T }
>;

export type ActionHandler<T extends GameAction['type'] = GameAction['type']> = (
  nextState: GameState,
  state: GameState,
  action: TypedAction<T>,
) => { state: GameState; result: ActionResult };

export type ActionHandlerMap = {
  [T in GameAction['type']]: ActionHandler<T>;
};
