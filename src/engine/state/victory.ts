import type { GameState } from '@engine/models';

/**
 * The game is over (RR v1.8 Villain Defeat: the players win; the last hero is eliminated or the
 * last main scheme completes: the villain wins). The only writer of `state.winner`. Nothing stays
 * pending and no trigger fires afterwards (`dispatchTrigger` stops on a winner). The last combat
 * outcome and the villain phase step event are results, not pending work, so they stay.
 */
export function endGame(state: GameState, winner: 'HEROES' | 'VILLAIN'): void {
  state.winner = winner;
  state.pendingDecisionQueue = [];
  delete state.pendingDamagePlacements;
  delete state.pendingThreatPlacements;
  delete state.pendingCleanUpPlayerIds;
  delete state.pendingActivations;
  delete state.activeBoostCard;
  delete state.activeBoostResolution;
  delete state.activeAttackContext;
  delete state.activeEncounterContext;
}
