import { GameState, PlayerState } from '../models';
import { drawEncounterCard } from './deck-exhaustion';

/**
 * Surge (RR v1.8): the player resolving the card deals themself 1 facedown encounter card from the
 * top of the encounter deck. The card is only dealt here; the reveal loop reveals it after the
 * current card has fully resolved. The deck-exhaustion rules (reshuffle, acceleration) apply
 * through `drawEncounterCard`.
 *
 * A card surges at most once per reveal: the flag on the active encounter context stops the
 * printed keyword from stacking on a "gains surge" effect.
 */
export function dealSurgeCard(state: GameState, player: PlayerState, cardName?: string): boolean {
  const surgeCard = drawEncounterCard(state);
  if (state.activeEncounterContext) {
    state.activeEncounterContext.surged = true;
  }
  if (surgeCard) {
    player.dealtEncounterCards.push(surgeCard);
  }
  state.log.push({
    id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    timestamp: Date.now(),
    round: state.roundNumber,
    phase: state.phase,
    key: 'encounter.surge.triggered',
    params: { card: cardName || 'Encounter', player: player.name },
    onomatopoeia: 'SURGE!',
  });
  return Boolean(surgeCard);
}
