import { kernel } from '../kernel';
import { CardInstance, CardType, GameState, MinionCard, PlayerState } from '@engine/models';

import { shuffleArray } from '../state/rng';
import { attachCardToHost } from '../state/state-validator';
import { appendLog } from '../state/game-log';
import { placeSideScheme } from '../state/side-scheme';
import { applyToughnessOnEntry } from '../state/card-instance';

/** Zone the cards came from: one for all of them, or looked up per card (multi-zone search). */
export type CardOrigin = string | ((card: CardInstance) => string);

/** Where ATTACH_TO_TARGET attaches the cards. Defaults to the villain, resolved for `player`. */
export interface AttachTarget {
  host?: string;
  targetId?: string;
}

/**
 * Universal Card Routing Helper for Search, Scry, Look and Mulligan Primitives (RR v1.8 p. 19, 26).
 * Cards from an encounter zone, or printed as encounter cards, go to the encounter piles; the
 * rest go to the player's. Each pile keeps the order of `cards`.
 */
export function routeCardInstances(
  state: GameState,
  player: PlayerState,
  cards: CardInstance[],
  destination: string | null | undefined,
  origin: CardOrigin,
  attach?: AttachTarget,
): void {
  if (cards.length === 0) return;
  const originOf = typeof origin === 'string' ? () => origin : origin;
  const isEncounter = (card: CardInstance) =>
    originOf(card).startsWith('ENCOUNTER') || card.card.faction === 'encounter';
  const encounterCards = cards.filter(isEncounter);
  const playerCards = cards.filter((card) => !isEncounter(card));

  if (!destination || destination === 'LEAVE_IN_PLACE') {
    const byOrigin = new Map<string, CardInstance[]>();
    for (const card of cards) {
      byOrigin.set(originOf(card), [...(byOrigin.get(originOf(card)) ?? []), card]);
    }
    for (const [zone, group] of byOrigin) {
      if (zone === 'PLAYER_DISCARD') player.discard.push(...group);
      else if (zone === 'PLAYER_HAND') player.hand.push(...group);
      else if (zone === 'ENCOUNTER_DECK') state.encounterDeck.unshift(...group);
      else if (zone === 'ENCOUNTER_DISCARD') state.encounterDiscard.push(...group);
      else player.deck.unshift(...group);
    }
  } else if (destination === 'REVEAL') {
    for (const card of cards) {
      kernel.resolveActiveEncounterCardAfterInterrupt(state, card, player, false);
    }
  } else if (destination === 'HAND') {
    player.hand.push(...cards);
  } else if (destination === 'TABLEAU') {
    for (const card of cards) {
      if (card.card.type === CardType.SIDE_SCHEME) {
        const baseThreat = placeSideScheme(state, card);
        appendLog(state, {
          key: 'encounter.reveal.sideScheme',
          params: { card: card.card.name, amount: baseThreat },
          onomatopoeia: 'SIDE SCHEME!',
        });
        const abilities = card.card.enrichment?.abilities || [];
        for (const ability of abilities) {
          if (ability.trigger === 'WHEN_REVEALED' || ability.timing === 'WHEN_REVEALED') {
            kernel.executeEffect(state, ability, {
              playerId: player.id,
              sourceCardInstance: card,
            });
          }
        }
      } else if (card.card.type === CardType.MINION) {
        applyToughnessOnEntry(card);
        player.engagedMinions.push(card as MinionCard & CardInstance);
        appendLog(state, {
          category: 'ability',
          key: 'encounter.reveal.minion',
          params: { actor: player.name, card: card.card.name },
          onomatopoeia: 'MINION SPAWNS!',
        });
        kernel.dispatchTrigger(state, 'MINION_ENTERS_PLAY', {
          targetPlayerId: player.id,
          sourceInstanceId: card.instanceId,
          targetInstanceId: card.instanceId,
          encounterCardInstance: card,
        });
      } else if (card.card.type === CardType.ALLY) {
        applyToughnessOnEntry(card);
        player.allies.push(card);
      } else {
        player.tableau.push(card);
      }
    }
  } else if (destination === 'DISCARD') {
    state.encounterDiscard.push(...encounterCards);
    player.discard.push(...playerCards);
  } else if (destination === 'DECK_TOP') {
    state.encounterDeck.unshift(...encounterCards);
    player.deck.unshift(...playerCards);
  } else if (destination === 'DECK_BOTTOM') {
    state.encounterDeck.push(...encounterCards);
    player.deck.push(...playerCards);
  } else if (destination === 'DECK_SHUFFLE') {
    if (encounterCards.length > 0) {
      state.encounterDeck.push(...encounterCards);
      state.encounterDeck = shuffleArray(state, state.encounterDeck);
    }
    if (playerCards.length > 0) {
      player.deck.push(...playerCards);
      player.deck = shuffleArray(state, player.deck);
    }
  } else if (destination === 'ATTACH_TO_TARGET') {
    for (const card of cards) {
      attachCardToHost(state, card, attach?.host || 'VILLAIN', attach?.targetId ?? player.id);
    }
  }
}
