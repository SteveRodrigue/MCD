import { GameState, GamePhase } from '@engine/models';
import { dispatchTrigger } from '../triggers';

/**
 * Initiates the Player Phase (RR v1.8 p. 22).
 * 1. Sets state.phase to PLAYER_PHASE.
 * 2. Resets usedAbilitiesThisPhase for all players (enforcing ONCE_PER_PHASE limits).
 * 3. Dispatches PLAYER_PHASE_BEGAN lifecycle trigger.
 */
export function startPlayerPhase(state: GameState): GameState {
  state.phase = GamePhase.PLAYER_PHASE;
  delete state.villainPhaseStep;

  // Reset phase-level ability limits for all players
  for (const player of state.players) {
    player.usedAbilitiesThisPhase = {};
  }

  state.log.push({
    id: `log_${Date.now()}`,
    timestamp: Date.now(),
    round: state.roundNumber,
    phase: GamePhase.PLAYER_PHASE,
    key: 'phase.player_phase.start',
    params: { round: state.roundNumber, firstPlayer: state.players[state.firstPlayerIndex]?.name },
    onomatopoeia: 'HEROES ASSEMBLE!',
  });

  // Dispatch Player Phase Began triggers across all players
  for (const player of state.players) {
    dispatchTrigger(state, 'PLAYER_PHASE_BEGAN', { targetPlayerId: player.id });
  }

  return state;
}

/**
 * Concludes the Player Phase (RR v1.8 p. 22).
 * 1. Dispatches PLAYER_PHASE_ENDED lifecycle trigger.
 * 2. Transitions state.phase to VILLAIN_PHASE.
 */
export function endPlayerPhase(state: GameState): GameState {
  state.log.push({
    id: `log_${Date.now()}`,
    timestamp: Date.now(),
    round: state.roundNumber,
    phase: state.phase,
    key: 'phase.player_phase.end',
    params: { round: state.roundNumber },
    onomatopoeia: 'PLAYERS PASS!',
  });

  // Dispatch Player Phase Ended triggers across all players
  for (const player of state.players) {
    dispatchTrigger(state, 'PLAYER_PHASE_ENDED', { targetPlayerId: player.id });
  }

  state.phase = GamePhase.VILLAIN_PHASE;
  return state;
}

/**
 * Advances the active player pointer during Player Phase.
 * When all players have taken their turns, concludes the Player Phase.
 */
export function passActivePlayer(state: GameState): GameState {
  const playerCount = state.players.length;
  if (playerCount === 0) return endPlayerPhase(state);

  const nextActiveIndex = (state.activePlayerIndex + 1) % playerCount;

  // If we wrapped back to the First Player, all players have completed their turns
  if (nextActiveIndex === state.firstPlayerIndex) {
    return endPlayerPhase(state);
  }

  state.activePlayerIndex = nextActiveIndex;
  state.log.push({
    id: `log_${Date.now()}`,
    timestamp: Date.now(),
    key: 'player.turn.passed',
    params: { nextPlayer: state.players[nextActiveIndex]?.name },
  });

  return state;
}
