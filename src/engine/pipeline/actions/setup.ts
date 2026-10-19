import { GamePhase } from '../../models';
import { getPlayer } from '../legality-checker';
import { collectPlayerSetupAbilities } from '../../state/game-setup';
import { appendLog } from '../../state/game-log';
import type { ActionHandler } from './types';

export const handleResolveMulligan: ActionHandler<'RESOLVE_MULLIGAN'> = (
  nextState,
  state,
  action,
) => {
  const player = getPlayer(nextState, action.playerId);
  if (!player) return { state, result: { success: false, error: 'Player not found' } };

  if (!nextState.setupState || nextState.setupState.stage !== 'MULLIGAN_PHASE') {
    return {
      state,
      result: { success: false, error: 'Game is not currently in the Mulligan Phase' },
    };
  }

  if (nextState.setupState.mulliganCompleted[action.playerId]) {
    return {
      state,
      result: { success: false, error: 'Player has already completed their mulligan' },
    };
  }

  // 1. Separate chosen discards from hand
  const discardIds = action.discardCardInstanceIds || [];
  const keptHand: typeof player.hand = [];
  const mulliganDiscards: typeof player.hand = [];

  for (const card of player.hand) {
    if (discardIds.includes(card.instanceId)) {
      mulliganDiscards.push(card);
    } else {
      keptHand.push(card);
    }
  }

  // 2. Draw replacements from top of player deck
  const replacementCount = mulliganDiscards.length;
  const drawnReplacements = player.deck.splice(0, replacementCount);
  player.hand = [...keptHand, ...drawnReplacements];

  // 3. Rejected cards move directly to the player discard pile (RR v1.8 p. 23 - NO DECK SHUFFLE)
  player.discard.push(...mulliganDiscards);

  // 4. Mark player mulligan complete
  nextState.setupState.mulliganCompleted[action.playerId] = true;

  const onomatopoeia = 'MULLIGAN RESOLVED!';
  appendLog(nextState, {
    phase: GamePhase.SETUP_PHASE,
    key: 'player.setup.mulligan',
    params: {
      player: player.name,
      discardedCount: replacementCount,
      handSize: player.hand.length,
    },
    onomatopoeia,
  });

  // 5. Check if all players have completed mulligan
  const allDone = nextState.players.every((p) => nextState.setupState?.mulliganCompleted[p.id]);
  if (allDone) {
    // Step 16 follows the mulligans; `dispatchAction` resolves the Setup abilities.
    nextState.setupState.stage = 'PLAYER_SETUP';
    nextState.setupState.pendingSetupAbilities = collectPlayerSetupAbilities(nextState);
  }

  return { state: nextState, result: { success: true, onomatopoeia } };
};

export const handleDevAddCardToHand: ActionHandler<'DEV_ADD_CARD_TO_HAND'> = (
  nextState,
  state,
  action,
) => {
  const player = nextState.players.find((p) => p.id === action.playerId);
  if (!player) {
    return { state, result: { success: false, error: 'Player not found' } };
  }

  const cardIdx = player.deck.findIndex((c) => c.instanceId === action.cardInstanceId);
  if (cardIdx === -1) {
    return { state, result: { success: false, error: 'Card not found in deck' } };
  }

  const [selectedCard] = player.deck.splice(cardIdx, 1);
  player.hand.push(selectedCard);

  appendLog(nextState, {
    category: 'ability',
    actor: { name: player.name, type: player.currentForm },
    key: 'dev.card.tutor',
    params: { card: selectedCard.card.name, hero: player.name },
    onomatopoeia: 'DEV TUTOR!',
  });

  return {
    state: nextState,
    result: {
      success: true,
      onomatopoeia: 'CARD ADDED!',
    },
  };
};

export const SETUP_HANDLERS = {
  RESOLVE_MULLIGAN: handleResolveMulligan,
  DEV_ADD_CARD_TO_HAND: handleDevAddCardToHand,
};
