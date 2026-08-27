import {
  GameState,
  GamePhase,
} from '@engine/models';
import { dispatchAction, executeVillainPhase } from '../pipeline';
import { chooseBotAction } from './player-bot';

export interface MatchSimulationOptions {
  maxRounds?: number;
  maxActionsPerTurn?: number;
}

export interface MatchSimulationResult {
  winner: 'HEROES' | 'VILLAIN' | 'TIMEOUT';
  roundsPlayed: number;
  totalActionsExecuted: number;
  finalState: GameState;
  logSummary: string[];
}

/**
 * Runs a complete headless match simulation from the given starting GameState.
 */
export function runMatch(
  initialState: GameState,
  options: MatchSimulationOptions = {},
): MatchSimulationResult {
  const maxRounds = options.maxRounds || 30;
  const maxActionsPerTurn = options.maxActionsPerTurn || 15;

  let state: GameState = JSON.parse(JSON.stringify(initialState));
  let totalActions = 0;

  while (!state.winner && state.roundNumber <= maxRounds) {
    state.phase = GamePhase.PLAYER_PHASE;

    // 1. PLAYER PHASE: Execute each player's turn in order
    for (let pIdx = 0; pIdx < state.players.length; pIdx++) {
      const activeIdx = (state.firstPlayerIndex + pIdx) % state.players.length;
      state.activePlayerIndex = activeIdx;
      const player = state.players[activeIdx];

      let actionCountForTurn = 0;

      while (actionCountForTurn < maxActionsPerTurn) {
        if (state.winner) break;

        const botAction = chooseBotAction({ state, playerId: player.id });
        if (botAction.type === 'END_PLAYER_TURN') {
          break;
        }

        const dispatchResult = dispatchAction(state, botAction);
        if (!dispatchResult.result.success) {
          // If bot chose an illegal action, stop turn
          break;
        }

        state = dispatchResult.state;
        totalActions += 1;
        actionCountForTurn += 1;
      }

      if (state.winner) break;
    }

    if (state.winner) break;

    // 2. VILLAIN PHASE: Complete 6-step automation
    state = executeVillainPhase(state);
  }

  const finalWinner = state.winner || 'TIMEOUT';

  return {
    winner: finalWinner,
    roundsPlayed: state.roundNumber,
    totalActionsExecuted: totalActions,
    finalState: state,
    logSummary: state.log.map((l) => `[Round ${state.roundNumber}] ${l.onomatopoeia ? l.onomatopoeia + ' ' : ''}${l.key}`),
  };
}
