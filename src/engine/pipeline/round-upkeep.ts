import { GameState, VillainPhaseStep } from '@engine/models';
import { dispatchTrigger } from '../triggers';
import { startPlayerPhase } from './player-phase';

/**
 * Step 6: Pass First Player Token & End of Round Upkeep (RR v1.8 p. 32)
 * 1. Dispatches ROUND_ENDED and ROUND_END triggers.
 * 2. Discards allies with round-end forced discard abilities (e.g. Nick Fury 01084).
 * 3. Readies all player cards (identities, allies, tableau upgrades/supports).
 * 4. Resets once-per-round limits and form change flags.
 * 5. Refills player hands up to effective hand size, handling player deck recycling.
 * 6. Passes the First Player token clockwise.
 * 7. Increments roundNumber, dispatches ROUND_BEGAN, and starts the new Player Phase.
 */
export function step6_passFirstPlayerAndRoundUpkeep(state: GameState): GameState {
  state.villainPhaseStep = VillainPhaseStep.PASS_FIRST_PLAYER;

  // 1. Dispatch Round Ended triggers across players
  for (const player of state.players) {
    dispatchTrigger(state, 'ROUND_ENDED', { targetPlayerId: player.id });
    dispatchTrigger(state, 'ROUND_END', { targetPlayerId: player.id });
  }

  // 2. Pass First Player Token
  state.firstPlayerIndex = (state.firstPlayerIndex + 1) % state.players.length;
  state.activePlayerIndex = state.firstPlayerIndex;

  // 3. Ready all player cards & reset round flags
  for (const player of state.players) {
    // Discard allies with ROUND_END / DISCARD_SELF abilities (e.g. Nick Fury - ADR-0018)
    const endRoundAllies = player.allies.filter((a) => {
      const abilities = a.card.enrichment?.abilities || [];
      return abilities.some(
        (ab) =>
          (ab.trigger === 'ROUND_END' ||
            ab.trigger === 'ROUND_ENDED' ||
            ab.timing === 'FORCED_RESPONSE') &&
          ab.steps?.some((s) => s.effect === 'DISCARD_SELF'),
      );
    });
    for (const ally of endRoundAllies) {
      const idx = player.allies.indexOf(ally);
      if (idx !== -1) {
        player.allies.splice(idx, 1);
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

    // Reset round-level ability and form change limits
    player.basicChangeFormUsedThisRound = false;
    player.formChangedThisRound = false;
    player.recoveryUsedThisRound = false;
    player.usedAbilitiesThisRound = {};
  }

  // 5. Increment Round Number
  state.roundNumber += 1;

  state.log.push({
    id: `log_${Date.now()}`,
    timestamp: Date.now(),
    key: 'round.upkeep.complete',
    params: { round: state.roundNumber },
    onomatopoeia: 'NEW ROUND!',
  });

  // 6. Dispatch Round Began triggers
  for (const player of state.players) {
    dispatchTrigger(state, 'ROUND_BEGAN', { targetPlayerId: player.id });
  }

  // 7. Transition to and initialize the new Player Phase
  return startPlayerPhase(state);
}
