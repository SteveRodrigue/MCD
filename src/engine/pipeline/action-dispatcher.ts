import { bindKernel, kernel } from '../kernel';
import { GameState, GameAction, ActionResult, GamePhase, updateGameState } from '@engine/models';
import { continueVillainPhase } from './villain-phase';
import { checkDeckExhaustionInvariants } from './deck-exhaustion';
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
  if (kernel.peekDecisionPrompt(state) || kernel.hasPendingSequence(state)) return state;
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
  let result: ActionResult | undefined;
  try {
    const next = updateGameState(state, (draft) => {
      // The handler mutates the draft and gets the original to return when it rejects the action.
      const outcome = runActionHandler(draft, state, action);
      // A rejected action discards the draft, whatever the handler changed before rejecting.
      if (!outcome.result.success) throw new ActionRejected(outcome.result);
      result = outcome.result;

      let next = outcome.state;
      if (kernel.hasPendingSequence(next) && !kernel.peekDecisionPrompt(next)) {
        next = kernel.resumePendingSequence(next);
      }
      if (action.type === 'RESOLVE_DECISION_PROMPT' || action.type === 'DECLARE_DEFENDER') {
        next = resumeVillainPhaseAfterDecision(next, hadPausedThreatPlacement);
      }
      // Player Setup abilities (step 16) continue once the decision they waited for is answered.
      if (next.setupState?.stage === 'PLAYER_SETUP') {
        next = advancePlayerSetup(next);
      }
      checkDeckExhaustionInvariants(next);
      return next;
    });
    return { state: next, result: result! };
  } catch (error) {
    if (error instanceof ActionRejected) return { state, result: error.result };
    throw error;
  }
}

class ActionRejected {
  constructor(readonly result: ActionResult) {}
}

bindKernel({ dispatchAction });
