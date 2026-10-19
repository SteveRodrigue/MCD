import { GameState, GameAction, ActionResult, GamePhase, cloneGameState } from '@engine/models';
import { hasPendingSequence, resumePendingSequence } from '../effects';
import { continueVillainPhase } from './villain-phase';
import { checkDeckExhaustionInvariants } from './deck-exhaustion';
import { peekDecisionPrompt } from './prompt-queue';
import { advancePlayerSetup } from '../state/game-setup';
// Import `./actions` after all other imports so module-load hook registrations stay unchanged (ADR-0085/ADR-0086)
import { runActionHandler } from './actions';

/**
 * A decision answered during the villain phase lets the phase continue once nothing waits.
 * A stepped phase stops instead to show a combat outcome or a placed threat (#266).
 */
export function resumeVillainPhaseAfterDecision(
  state: GameState,
  hadPausedThreatPlacement: boolean,
): GameState {
  if (state.phase !== GamePhase.VILLAIN_PHASE || state.winner) return state;
  if (peekDecisionPrompt(state) || hasPendingSequence(state)) return state;
  if (
    state.options?.villainPhaseStepping &&
    (state.lastCombatOutcome || hadPausedThreatPlacement)
  ) {
    return state;
  }
  return continueVillainPhase(state);
}

/**
 * Pure state reducer / action dispatcher executing player commands in accordance with RR v1.8.
 * After a successful action, an ability sequence that paused on a decision prompt resumes
 * as soon as the prompt queue is empty (#248).
 */
export function dispatchAction(
  state: GameState,
  action: GameAction,
): { state: GameState; result: ActionResult } {
  const hadPausedThreatPlacement = (state.pendingThreatPlacements?.length ?? 0) > 0;
  // The handler gets a clone to mutate and the original to return when it rejects the action.
  const outcome = runActionHandler(cloneGameState(state), state, action);
  if (!outcome.result.success) return outcome;

  let next = outcome.state;
  if (hasPendingSequence(next) && !peekDecisionPrompt(next)) {
    next = resumePendingSequence(next);
  }
  if (action.type === 'RESOLVE_DECISION_PROMPT' || action.type === 'DECLARE_DEFENDER') {
    next = resumeVillainPhaseAfterDecision(next, hadPausedThreatPlacement);
  }
  // Player Setup abilities (step 16) continue once the decision they waited for is answered.
  if (next.setupState?.stage === 'PLAYER_SETUP') {
    next = advancePlayerSetup(next);
  }
  checkDeckExhaustionInvariants(next);
  return next === outcome.state ? outcome : { state: next, result: outcome.result };
}
