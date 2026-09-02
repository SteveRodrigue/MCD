import { GameState, DecisionPromptOption, PendingDecisionPrompt } from '@engine/models';
import { getEffectiveHandSize } from './stat-calculator';
import { drawPlayerCard } from './deck-exhaustion';
import { enqueueDecisionPrompt } from './prompt-queue';
import { executeVillainPhase } from './villain-phase';

export interface PlayerPhaseCleanupOptions {
  autoDiscardNone?: boolean;
}

/**
 * Initiates the End of Player Phase Clean-Up sequence (RR v1.8 p. 23).
 * In player order starting from firstPlayerIndex, each player performs:
 * 1. Discard (Optional): May discard any number of cards from hand.
 * 2. Draw: Refills hand to printed/effective hand size.
 * 3. Ready: Readies identity, allies, upgrades, and supports.
 * Once all players have completed clean-up, transitions to the Villain Phase.
 */
export function initiatePlayerPhaseCleanup(
  state: GameState,
  options?: PlayerPhaseCleanupOptions,
): GameState {
  const nextState: GameState = JSON.parse(JSON.stringify(state));

  // Initialize player-by-player cleanup queue in player order starting from firstPlayerIndex
  const queue: string[] = [];
  for (let i = 0; i < nextState.players.length; i++) {
    const idx = (nextState.firstPlayerIndex + i) % nextState.players.length;
    queue.push(nextState.players[idx].id);
  }

  (nextState as any).pendingCleanUpPlayerIds = queue;

  return processNextPlayerInCleanupQueue(nextState, options);
}

/**
 * Processes the next player in the clean-up queue.
 */
export function processNextPlayerInCleanupQueue(
  state: GameState,
  options?: PlayerPhaseCleanupOptions,
): GameState {
  const queue = (state as any).pendingCleanUpPlayerIds as string[] | undefined;

  if (!queue || queue.length === 0) {
    delete (state as any).pendingCleanUpPlayerIds;
    // All players cleaned up -> proceed to Villain Phase!
    return executeVillainPhase(state);
  }

  const nextPlayerId = queue[0];
  const player = state.players.find((p) => p.id === nextPlayerId);
  if (!player) {
    queue.shift();
    return processNextPlayerInCleanupQueue(state, options);
  }

  // If player has cards in hand and not auto-passing, prompt for voluntary discard
  if (player.hand.length > 0 && !options?.autoDiscardNone) {
    const promptOptions: DecisionPromptOption[] = player.hand.map((c) => ({
      id: `discard_${c.instanceId}`,
      label: `Discard ${c.card.name}`,
      description: `Discard ${c.card.name} to discard pile`,
      effect: 'PLAYER_PHASE_DISCARD_CARD',
      params: { cardInstanceId: c.instanceId, playerId: player.id },
    }));

    promptOptions.push({
      id: 'done_cleanup',
      label: 'Done / Keep Remaining Cards',
      description: 'Proceed to refill hand and ready all cards',
      effect: 'FINISH_PLAYER_CLEANUP',
      params: { playerId: player.id },
    });

    const prompt: PendingDecisionPrompt = {
      promptId: `prompt_cleanup_${player.id}_${Date.now()}`,
      playerId: player.id,
      title: 'End of Player Phase: Voluntary Discard',
      description: `${player.name}: Select any cards in your hand you wish to discard before drawing up to hand size:`,
      sourceCardName: player.hero?.name || player.name,
      options: promptOptions,
      isVoluntary: true,
    };

    return enqueueDecisionPrompt(state, prompt);
  }

  // If hand is already empty or auto-pass enabled, execute clean-up directly
  return executePlayerCleanup(state, nextPlayerId, [], options);
}

/**
 * Executes the clean-up steps for a single player (RR v1.8 p. 23):
 * 1. Discards specified cards from hand.
 * 2. Draws up to effective hand size.
 * 3. Readies identity, allies, upgrades, and supports.
 * 4. Advances to the next pending player in queue or launches the Villain Phase.
 */
export function executePlayerCleanup(
  state: GameState,
  playerId: string,
  discardedCardInstanceIds: string[],
  options?: PlayerPhaseCleanupOptions,
): GameState {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return state;

  // 1. Discard chosen cards from hand
  for (const cardId of discardedCardInstanceIds) {
    const cardIdx = player.hand.findIndex((c) => c.instanceId === cardId);
    if (cardIdx !== -1) {
      const [discarded] = player.hand.splice(cardIdx, 1);
      player.discard.push(discarded);
    }
  }

  // 2. Draw up to effective hand size
  const targetHandSize = getEffectiveHandSize(player, state);
  const cardsToDraw = Math.max(0, targetHandSize - player.hand.length);

  for (let i = 0; i < cardsToDraw; i++) {
    const drawn = drawPlayerCard(state, player.id);
    if (drawn) {
      player.hand.push(drawn);
    }
  }

  // 3. Ready all cards controlled by player
  player.exhausted = false;
  player.basicChangeFormUsedThisRound = false;
  player.formChangedThisRound = false;
  player.recoveryUsedThisRound = false;

  for (const ally of player.allies) {
    ally.exhausted = false;
  }

  for (const tableauCard of player.tableau) {
    tableauCard.exhausted = false;
  }

  state.log.push({
    id: `log_${Date.now()}_cleanup_${player.id}`,
    timestamp: Date.now(),
    round: state.roundNumber,
    phase: state.phase,
    category: 'phase',
    actor: { name: player.name, type: player.currentForm },
    key: 'player.phase.cleanup.complete',
    params: {
      player: player.name,
      discardedCount: discardedCardInstanceIds.length,
      drawnCount: cardsToDraw,
      handSize: player.hand.length,
    },
    onomatopoeia: 'CLEAN-UP COMPLETE!',
  });

  // Remove player from pending clean-up queue
  const queue = (state as any).pendingCleanUpPlayerIds as string[] | undefined;
  if (queue) {
    const pIdx = queue.indexOf(playerId);
    if (pIdx !== -1) {
      queue.splice(pIdx, 1);
    }
  }

  // Process next player or transition to Villain Phase
  return processNextPlayerInCleanupQueue(state, options);
}
