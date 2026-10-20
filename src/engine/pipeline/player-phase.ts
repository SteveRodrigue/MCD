import { GameState, GamePhase, PlayerState, Duration } from '@engine/models';
import { dispatchTrigger } from '../triggers';
import { appendLog } from '../state/game-log';

/**
 * Initiates the Player Phase (RR v1.8 p. 22).
 * 1. Sets state.phase to PLAYER_PHASE.
 * 2. Resets usedAbilitiesThisPhase for all players (enforcing ONCE_PER_PHASE limits).
 * 3. Dispatches PLAYER_PHASE_BEGAN lifecycle trigger.
 */
export function startPlayerPhase(state: GameState): GameState {
  state.phase = GamePhase.PLAYER_PHASE;
  state.activePlayerIndex = state.firstPlayerIndex;
  delete state.villainPhaseStep;
  delete state.villainPhaseStepEvent;
  delete state.lastCombatOutcome;
  delete state.activeAttackContext;
  delete state.activeEncounterContext;
  delete state.activeBoostCard;
  delete state.pendingActivations;
  delete state.pendingThreatPlacements;

  // Phase-level ability limits start over (PHASE effects already ended with the previous phase)
  for (const player of state.players) {
    player.usedAbilitiesThisPhase = {};
  }

  appendLog(state, {
    phase: GamePhase.PLAYER_PHASE,
    key: 'phase.player_phase.start',
    params: { round: state.roundNumber, actor: state.players[state.firstPlayerIndex]?.name },
    onomatopoeia: 'HEROES ASSEMBLE!',
  });

  // Dispatch Player Phase Began triggers across all players
  for (const player of state.players) {
    dispatchTrigger(state, 'PLAYER_PHASE_BEGAN', { targetPlayerId: player.id });
  }

  return state;
}

/**
 * Ends the lasting effects of the given durations on these players and the cards they control
 * (RR v1.8 "Lasting Effects"): cost reductions, stat modifiers and granted traits.
 */
export function expireLastingEffects(players: PlayerState[], durations: readonly Duration[]): void {
  const lasts = (effect: { duration?: Duration }) =>
    !effect.duration || !durations.includes(effect.duration);
  for (const player of players) {
    player.activeCostReductions = (player.activeCostReductions || []).filter(lasts);
    player.costReductions = player.activeCostReductions.reduce((sum, r) => sum + r.amount, 0);
    player.activeStatModifiers = (player.activeStatModifiers || []).filter(lasts);
    player.activeTraitModifiers = (player.activeTraitModifiers || []).filter(lasts);
    for (const card of [...player.allies, ...player.tableau, ...(player.attachments || [])]) {
      card.activeStatModifiers = (card.activeStatModifiers || []).filter(lasts);
    }
  }
}

/**
 * End of Player Phase steps 4 and 5 (RR v1.8 "End of Player Phase"), after the clean-up discard,
 * draw and ready: effects lasting until the end of the phase end, then "when/after the player
 * phase ends" abilities resolve in player order. The villain phase starts from here.
 */
export function endPlayerPhase(state: GameState): GameState {
  expireLastingEffects(state.players, ['PHASE']);
  for (const player of state.players) {
    player.usedAbilitiesThisPhase = {};
  }

  appendLog(state, {
    key: 'phase.player_phase.end',
    params: { round: state.roundNumber },
    onomatopoeia: 'PLAYERS PASS!',
  });

  for (let i = 0; i < state.players.length; i++) {
    const player = state.players[(state.firstPlayerIndex + i) % state.players.length];
    dispatchTrigger(state, 'PLAYER_PHASE_ENDED', { targetPlayerId: player.id });
  }

  delete state.pendingCleanUpPlayerIds;
  state.phase = GamePhase.VILLAIN_PHASE;
  return state;
}
