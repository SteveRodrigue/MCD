import { GameState, CardInstance, PlayerState } from '../models';
import { drawEncounterCard } from './deck-exhaustion';
import { dispatchTrigger } from '../triggers';
import { removeCardFromAllZones } from '../state/state-validator';

/**
 * Players whose hero or alter-ego belongs to the given card set.
 */
function findOwnerOfSet(state: GameState, setCode: string | undefined): PlayerState | undefined {
  if (!setCode) return undefined;
  return state.players.find((p) => p.hero?.setCode === setCode || p.alterEgo?.setCode === setCode);
}

/**
 * Resolves who receives a revealed obligation (RR v1.8 "Obligation", Issue #158).
 *
 * - Explicit `recipient` on the card enrichment wins.
 * - Otherwise: owner of the card's hero set when the card belongs to one (rule 1),
 *   else the revealing player (rule 3).
 * Returns undefined when the card cannot be given to anyone (rule 2).
 */
export function resolveObligationRecipient(
  state: GameState,
  card: CardInstance,
  revealingPlayer: PlayerState,
): PlayerState | undefined {
  const recipient = card.card.enrichment?.recipient;

  switch (recipient?.type) {
    case 'FIRST_PLAYER':
      return state.players[state.firstPlayerIndex] ?? state.players[0];
    case 'REVEALING_PLAYER':
      return revealingPlayer;
    case 'CARD_SET_OWNER':
      return findOwnerOfSet(state, card.card.setCode);
    case 'IDENTITY':
      return state.players.find(
        (p) => recipient.codes.includes(p.hero?.code) || recipient.codes.includes(p.alterEgo?.code),
      );
    default:
      return card.card.belongsToHeroSet
        ? findOwnerOfSet(state, card.card.setCode)
        : revealingPlayer;
  }
}

/**
 * Resolves a revealed obligation card: gives it to its recipient (placing it in the recipient's
 * obligations zone and firing ENTERS_PLAY so the card's own resolution ability runs), or applies
 * rule 2 when it cannot be given: ignore its ability, remove it from the game, and reveal an
 * additional encounter card.
 */
export function resolveRevealedObligation(
  state: GameState,
  card: CardInstance,
  revealingPlayer: PlayerState,
): void {
  const recipient = resolveObligationRecipient(state, card, revealingPlayer);

  if (!recipient) {
    removeCardFromAllZones(state, card.instanceId);
    state.removedFromGame.push(card);
    state.log.push({
      id: `log_${Date.now()}_obligation_removed`,
      timestamp: Date.now(),
      key: 'encounter.reveal.obligationRemoved',
      params: { obligation: card.card.name },
      onomatopoeia: 'REMOVED FROM THE GAME!',
    });
    const extra = drawEncounterCard(state);
    if (extra) revealingPlayer.dealtEncounterCards.push(extra);
    return;
  }

  removeCardFromAllZones(state, card.instanceId);
  (card as any).ownerId = recipient.id;
  if (!recipient.obligations) recipient.obligations = [];
  recipient.obligations.push(card);
  state.log.push({
    id: `log_${Date.now()}_obligation_given`,
    timestamp: Date.now(),
    key: 'encounter.reveal.obligation',
    params: { player: recipient.name, obligation: card.card.name },
    onomatopoeia: 'OBLIGATION!',
  });

  dispatchTrigger(state, 'ENTERS_PLAY', {
    targetPlayerId: recipient.id,
    sourceInstanceId: card.instanceId,
  });
}

/**
 * Completion default for obligations: once the chosen option has resolved, an obligation still in
 * its owner's obligations zone is discarded to the encounter discard (an option that removed it
 * from the game leaves nothing to discard).
 */
export function discardResolvedObligation(state: GameState, instanceId: string): void {
  for (const player of state.players) {
    const idx = (player.obligations || []).findIndex((c) => c.instanceId === instanceId);
    if (idx === -1) continue;
    const [card] = player.obligations.splice(idx, 1);
    state.encounterDiscard.push(card);
    state.log.push({
      id: `log_${Date.now()}_obligation_discarded`,
      timestamp: Date.now(),
      key: 'encounter.obligation.discarded',
      params: { player: player.name, obligation: card.card.name },
      onomatopoeia: 'OBLIGATION RESOLVED!',
    });
    return;
  }
}
