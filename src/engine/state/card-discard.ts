import { CardInstance, GameState, NormalizedCard } from '@engine/models';
import { removeCardFromAllZones } from './state-validator';
import { exhaustPlayerDeck } from '../pipeline/deck-exhaustion';
import { kernel } from '../kernel';

/**
 * Universal helper to reset transient gameplay state when a card leaves play or is discarded (RR v1.8 p. 15).
 * Resets exhausted, tokens, counters, statusCards, activeStatModifiers, attachments, and cardsUnderneath
 * while strictly preserving immutable identity attributes (instanceId, card, ownerId).
 */
export function resetCardState(card: CardInstance): void {
  if (!card) return;
  card.exhausted = false;
  card.tokens = {};
  card.counters = {};
  card.statusCards = [];
  card.activeStatModifiers = [];
  card.attachments = [];
  card.cardsUnderneath = [];
}

/**
 * Checks whether a card is an encounter card based on type or set code.
 */
export function isEncounterCard(card: NormalizedCard): boolean {
  if (!card) return false;
  const t = card.type?.toLowerCase();
  return (
    t === 'attachment' ||
    t === 'minion' ||
    t === 'treachery' ||
    t === 'main_scheme' ||
    t === 'side_scheme' ||
    t === 'villain' ||
    t === 'obligation' ||
    t === 'environment' ||
    Boolean((card.raw as unknown as Record<string, unknown> | undefined)?.card_set_code)
  );
}

/**
 * Universal helper to cleanly discard all attachments and cards underneath when a host leaves play (RR v1.8 p. 5, 6).
 */
export function discardHostAttachmentsAndTuckedCards(
  state: GameState,
  host: { attachments?: CardInstance[]; cardsUnderneath?: CardInstance[] },
  ownerPlayerId?: string,
): void {
  if (!host) return;

  // 1. Discard all active attachments to appropriate discard piles
  if (host.attachments && host.attachments.length > 0) {
    for (const attachment of host.attachments) {
      resetCardState(attachment);
      if (isEncounterCard(attachment.card)) {
        state.encounterDiscard.push(attachment);
      } else {
        const ownerId = attachment.ownerId || ownerPlayerId;
        const targetP = state.players.find((p) => p.id === ownerId) || state.players[0];
        targetP.discard.push(attachment);
      }
    }
    host.attachments = [];
  }

  // 2. Discard all face-down/out-of-play cards placed underneath
  if (host.cardsUnderneath && host.cardsUnderneath.length > 0) {
    for (const tucked of host.cardsUnderneath) {
      resetCardState(tucked);
      if (isEncounterCard(tucked.card)) {
        state.encounterDiscard.push(tucked);
      } else {
        const ownerId = tucked.ownerId || ownerPlayerId;
        const targetP = state.players.find((p) => p.id === ownerId) || state.players[0];
        targetP.discard.push(tucked);
      }
    }
    host.cardsUnderneath = [];
  }
}

/**
 * Universal helper to cleanly discard a card instance respecting persistent ownership invariants (RR v1.8 p. 11, 23, ADR-0040, ADR-0068).
 */
export function discardCardInstance(
  state: GameState,
  card: CardInstance,
  fallbackPlayerId?: string,
): void {
  if (!card) return;

  // 1. Cascade host attachments and tucked cards
  discardHostAttachmentsAndTuckedCards(state, card, fallbackPlayerId);

  // 2. Atomic remove from all zones
  removeCardFromAllZones(state, card.instanceId);

  // 3. Reset card state (leaves play / discard invariant per RR v1.8 p. 15)
  resetCardState(card);

  // A hit point bonus that left with the card may leave a minion with damage at its new maximum.
  kernel.defeatMinionsBeyondHitPoints(state);

  // 4. Proper destination routing based on encounter vs. player card ownership
  if (isEncounterCard(card.card)) {
    state.encounterDiscard.push(card);
  } else {
    const targetPlayer =
      (card.ownerId ? state.players.find((p) => p.id === card.ownerId) : undefined) ||
      (fallbackPlayerId ? state.players.find((p) => p.id === fallbackPlayerId) : undefined) ||
      state.players[0];

    if (targetPlayer) {
      targetPlayer.discard.push(card);
      if (targetPlayer.deckEmptiedWithEmptyDiscard && targetPlayer.discard.length > 0) {
        targetPlayer.deckEmptiedWithEmptyDiscard = false;
        exhaustPlayerDeck(state, targetPlayer.id);
      }
    }
  }
}
