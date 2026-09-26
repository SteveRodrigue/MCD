import { GameState, VillainPhaseStep } from '@engine/models';
import { dispatchTrigger } from '../triggers';
import { startPlayerPhase } from './player-phase';
import { discardHostAttachmentsAndTuckedCards } from '../effects';

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
    for (const ally of player.allies) {
      ally.activeStatModifiers = (ally.activeStatModifiers || []).filter(
        (m) => m.duration !== 'ROUND' && m.duration !== 'PHASE',
      );
      if (ally.tokens) {
        delete (ally.tokens as any).thwBonus;
        delete (ally.tokens as any).atkBonus;
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

  // Step 6b: Discard allies with round-end forced discard abilities (e.g. Nick Fury 01084 - ADR-0018)
  for (const player of state.players) {
    const endRoundAllies = player.allies.filter((a) => {
      const abilities = a.card.enrichment?.abilities || [];
      return abilities.some(
        (ab) =>
          (ab.trigger === 'ROUND_ENDED' || ab.timing === 'FORCED_RESPONSE') &&
          ab.steps?.some(
            (s) =>
              s.effect === 'DISCARD_SELF' ||
              (s.effect === 'DISCARD' && s.effectParams?.source === 'SELF'),
          ),
      );
    });
    for (const ally of endRoundAllies) {
      const idx = player.allies.indexOf(ally);
      if (idx !== -1) {
        player.allies.splice(idx, 1);
        discardHostAttachmentsAndTuckedCards(state, ally, player.id);
        const owner =
          (ally.ownerId ? state.players.find((p) => p.id === ally.ownerId) : undefined) || player;
        owner.discard.push(ally);
        state.log.push({
          id: `log_${Date.now()}_${ally.instanceId}`,
          timestamp: Date.now(),
          key: 'ally.round_end.discarded',
          params: { ally: ally.card.name, player: player.name },
          onomatopoeia: 'DISMISSED!',
        });
      }
    }
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
