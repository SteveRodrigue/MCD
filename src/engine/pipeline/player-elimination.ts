import type { CardInstance, GameState, PlayerState } from '../models';
import { isEncounterCard, resetCardState } from '../effects';

/** The card lists of a player's play area that hold cards in play (the identity's attachments, the tableau, allies, obligations). */
function playAreaHosts(player: PlayerState): CardInstance[][] {
  return [player.tableau, player.allies, player.attachments ?? [], player.obligations];
}

/** True when the card belongs to the player: a player card with no recorded owner is the controller's. */
function isOwnedBy(card: CardInstance, playerId: string): boolean {
  return card.ownerId === playerId || (!card.ownerId && !isEncounterCard(card.card));
}

/**
 * Puts a card controlled by the eliminated player in its owner's discard pile: the owning player
 * for a player card, the encounter discard pile otherwise (RR v1.8 Player Elimination step 3). A
 * permanent card is not handled yet (#274).
 */
function discardToOwner(state: GameState, card: CardInstance): void {
  resetCardState(card);
  const owner = card.ownerId ? state.players.find((p) => p.id === card.ownerId) : undefined;
  (owner ? owner.discard : state.encounterDiscard).push(card);
}

/** Removes from `cards` every card owned by `ownerId`, returning them. */
function takeOwnedBy(cards: CardInstance[] | undefined, ownerId: string): CardInstance[] {
  if (!cards) return [];
  const taken = cards.filter((c) => c.ownerId === ownerId);
  if (taken.length > 0) {
    const kept = cards.filter((c) => c.ownerId !== ownerId);
    cards.splice(0, cards.length, ...kept);
  }
  return taken;
}

function rebaseIndex(current: number, removed: number, length: number): number {
  const shifted = current > removed ? current - 1 : current;
  return shifted % length;
}

/**
 * Eliminates a player whose identity was defeated (RR v1.8 Player Elimination). In order: the
 * first player token passes clockwise, engaged minions engage the next clockwise player, cards
 * the player controls but does not own go to their owner's discard pile, the player's own cards
 * go to the player's discard pile, and the player's play area leaves the game. The remaining
 * players continue; when none is left the players lose.
 *
 * The player is removed from `state.players`, so every effect that reads "the players" ignores
 * them. Loops that can eliminate a player while running iterate a snapshot of player ids.
 */
export function eliminatePlayer(state: GameState, playerId: string): void {
  const index = state.players.findIndex((p) => p.id === playerId);
  if (index === -1) return;
  const player = state.players[index];

  state.players.splice(index, 1);
  state.eliminatedPlayers = [...(state.eliminatedPlayers ?? []), player];

  state.log.push({
    id: `log_${Date.now()}_${playerId}`,
    timestamp: Date.now(),
    round: state.roundNumber,
    phase: state.phase,
    category: 'combat',
    key: 'player.eliminated',
    params: { player: player.name, remaining: state.players.length },
    onomatopoeia: 'HERO DOWN!',
  });

  if (state.players.length === 0) {
    state.firstPlayerIndex = 0;
    state.activePlayerIndex = 0;
    state.winner = 'VILLAIN';
    return;
  }

  // Step 1: the token passes to the next clockwise player, who now sits at the removed index.
  state.firstPlayerIndex = rebaseIndex(state.firstPlayerIndex, index, state.players.length);
  state.activePlayerIndex = rebaseIndex(state.activePlayerIndex, index, state.players.length);

  // Step 2: engaged minions engage the next clockwise player with everything they carry.
  const next = state.players[index % state.players.length];
  next.engagedMinions.push(...player.engagedMinions.splice(0));

  // Step 3: cards in the play area the player does not own.
  for (const host of playAreaHosts(player)) {
    const foreign = host.filter((c) => !isOwnedBy(c, playerId));
    host.splice(0, host.length, ...host.filter((c) => isOwnedBy(c, playerId)));
    for (const card of foreign) discardToOwner(state, card);
  }
  for (const card of player.dealtEncounterCards.splice(0)) discardToOwner(state, card);

  // Step 4: cards the player owns that sit in another play area join the player's discard pile.
  for (const other of state.players) {
    for (const host of playAreaHosts(other)) {
      player.discard.push(...takeOwnedBy(host, playerId));
      for (const card of host) {
        player.discard.push(...takeOwnedBy(card.attachments, playerId));
      }
    }
    for (const minion of other.engagedMinions) {
      player.discard.push(...takeOwnedBy(minion.attachments, playerId));
    }
  }
  // Step 5: the play area leaves the game with the eliminated player (kept for the game-over screen).
}
