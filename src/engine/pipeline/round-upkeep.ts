import { GameState, VillainPhaseStep } from '@engine/models';
import { dispatchTrigger } from '../triggers';
import { startPlayerPhase } from './player-phase';

/**
 * Step 5: Pass First Player Token (RR v1.8 p. 47)
 * Passes the first player token to the next clockwise player.
 */
export function step5_passFirstPlayerToken(state: GameState): GameState {
  state.villainPhaseStep = VillainPhaseStep.PASS_FIRST_PLAYER;
  state.firstPlayerIndex = (state.firstPlayerIndex + 1) % state.players.length;
  state.activePlayerIndex = state.firstPlayerIndex;

  state.log.push({
    id: `log_${Date.now()}`,
    timestamp: Date.now(),
    key: 'first_player.passed',
    params: { player: state.players[state.firstPlayerIndex]?.name },
    onomatopoeia: 'TOKEN PASS!',
  });

  return state;
}

/**
 * Step 6: End of Villain Phase and Round (RR v1.8 p. 47)
 * 6a. Any effects that last “until the end of the [villain] phase” or “until the end of the round” end.
 *     Reset phase & round limits (usedAbilitiesThisPhase, usedAbilitiesThisRound, form change flags).
 * 6b. Resolve any “when/after the [villain] phase ends” (VILLAIN_PHASE_ENDED) or “when/after the round ends”
 *     (ROUND_ENDED) effects in player turn order starting from the new First Player. Discard round-end allies.
 * Round Transition: Increment roundNumber, dispatch ROUND_BEGAN in player turn order, and call startPlayerPhase.
 */
export function step6_endVillainPhaseAndRound(state: GameState): GameState {
  // Step 6a: Expire PHASE & ROUND duration effects and limits across all players
  for (const player of state.players) {
    player.basicChangeFormUsedThisRound = false;
    player.formChangedThisRound = false;
    player.recoveryUsedThisRound = false;
    player.usedAbilitiesThisRound = {};
    player.usedAbilitiesThisPhase = {};

    player.activeCostReductions = (player.activeCostReductions || []).filter(
      (r) => r.duration !== 'ROUND' && r.duration !== 'PHASE',
    );
    player.costReductions = player.activeCostReductions.reduce((sum, r) => sum + r.amount, 0);

    player.activeStatModifiers = (player.activeStatModifiers || []).filter(
      (m) => m.duration !== 'ROUND' && m.duration !== 'PHASE',
    );
    player.activeTraitModifiers = (player.activeTraitModifiers || []).filter(
      (m) => m.duration !== 'ROUND' && m.duration !== 'PHASE',
    );
    for (const card of [...player.allies, ...player.tableau, ...(player.attachments || [])]) {
      card.activeStatModifiers = (card.activeStatModifiers || []).filter(
        (m) => m.duration !== 'ROUND' && m.duration !== 'PHASE',
      );
      if (card.tokens) {
        delete (card.tokens as any).thwBonus;
        delete (card.tokens as any).atkBonus;
      }
    }
  }

  // Step 6b: Dispatch VILLAIN_PHASE_ENDED triggers in player turn order starting from firstPlayerIndex
  for (let i = 0; i < state.players.length; i++) {
    const playerIdx = (state.firstPlayerIndex + i) % state.players.length;
    const player = state.players[playerIdx];
    dispatchTrigger(state, 'VILLAIN_PHASE_ENDED', { targetPlayerId: player.id });
  }

  // Step 6b: Dispatch ROUND_ENDED triggers in player turn order starting from firstPlayerIndex
  for (let i = 0; i < state.players.length; i++) {
    const playerIdx = (state.firstPlayerIndex + i) % state.players.length;
    const player = state.players[playerIdx];
    dispatchTrigger(state, 'ROUND_ENDED', { targetPlayerId: player.id });
  }

  // Round transition: Increment Round Number
  state.roundNumber += 1;

  state.log.push({
    id: `log_${Date.now()}`,
    timestamp: Date.now(),
    key: 'round.upkeep.complete',
    params: { round: state.roundNumber },
    onomatopoeia: 'NEW ROUND!',
  });

  // Dispatch Round Began triggers in player turn order
  for (let i = 0; i < state.players.length; i++) {
    const playerIdx = (state.firstPlayerIndex + i) % state.players.length;
    const player = state.players[playerIdx];
    dispatchTrigger(state, 'ROUND_BEGAN', { targetPlayerId: player.id });
  }

  // Transition to and initialize the new Player Phase
  return startPlayerPhase(state);
}

/**
 * Step 6: Pass First Player Token & End of Round Upkeep (RR v1.8 p. 32, p. 47)
 * Composite wrapper retaining backward compatibility. Sequentially calls Step 5 followed by Step 6.
 */
export function step6_passFirstPlayerAndRoundUpkeep(state: GameState): GameState {
  state = step5_passFirstPlayerToken(state);
  return step6_endVillainPhaseAndRound(state);
}
