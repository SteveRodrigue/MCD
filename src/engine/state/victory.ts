import type { GameState } from '@engine/models';

/**
 * The players win (RR v1.8 Villain Defeat: the last stage is defeated). The game is over, so no
 * decision stays pending and no trigger fires afterwards (`dispatchTrigger` stops on a winner).
 */
export function declareVictory(state: GameState): void {
  state.winner = 'HEROES';
  state.pendingDecisionQueue = [];
}
