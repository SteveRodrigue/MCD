import {
  GameState,
  GameAction,
  ActionResult,
  CardType,
  SideSchemeCard,
  CardInstance,
  GamePhase,
  PlayerState,
  VillainState,
  cloneGameState,
  getActiveVillain,
  getVillainsInPlay,
  getVillainById,
  getPerPlayerCount,
} from '@engine/models';
import { executeAbilityCost, getEventAbilityExtraCost } from './cost-engine';
import { executeEffect, hasPendingSequence, resumePendingSequence } from '../effects';
import { shuffleArray } from '../state/rng';
import { continueVillainPhase, resolveActiveEncounterCardAfterInterrupt } from './villain-phase';
import { checkDeckExhaustionInvariants } from './deck-exhaustion';
import { peekDecisionPrompt } from './prompt-queue';
import { attachCardToHost } from '../state/state-validator';
import { advancePlayerSetup } from '../state/game-setup';
import { appendLog } from '../state/game-log';
// Import `./actions` after all other imports so module-load hook registrations stay unchanged (ADR-0085/ADR-0086)
import { runActionHandler } from './actions';

/**
 * Universal Card Routing Helper for Search, Scry, Look and Mulligan Primitives (RR v1.8 p. 19, 26).
 */
export function routeCardInstances(
  state: GameState,
  player: PlayerState,
  cards: CardInstance[],
  destination: string | null | undefined,
  sourceZone: string,
  targetHost?: string,
): void {
  if (cards.length === 0) return;

  if (!destination || destination === 'LEAVE_IN_PLACE') {
    if (sourceZone === 'PLAYER_DISCARD') {
      player.discard.push(...cards);
    } else if (sourceZone === 'PLAYER_HAND') {
      player.hand.push(...cards);
    } else if (sourceZone === 'ENCOUNTER_DECK') {
      state.encounterDeck.unshift(...cards);
    } else if (sourceZone === 'ENCOUNTER_DISCARD') {
      state.encounterDiscard.push(...cards);
    } else {
      player.deck.unshift(...cards);
    }
    return;
  }

  if (destination === 'REVEAL') {
    for (const card of cards) {
      resolveActiveEncounterCardAfterInterrupt(state, card, player, false);
    }
    return;
  }

  if (destination === 'HAND') {
    player.hand.push(...cards);
  } else if (destination === 'TABLEAU') {
    for (const card of cards) {
      if (card.card.type === CardType.SIDE_SCHEME) {
        const sideSchemeCard = card.card as SideSchemeCard;
        const baseThreat =
          sideSchemeCard.baseThreat *
          (sideSchemeCard.baseThreatFixed ? 1 : getPerPlayerCount(state));
        state.sideSchemes.push({
          instanceId: card.instanceId,
          card: sideSchemeCard,
          threat: baseThreat,
        });
        appendLog(state, {
          key: 'encounter.reveal.sideScheme',
          params: { sideScheme: card.card.name, threat: baseThreat },
          onomatopoeia: 'SIDE SCHEME!',
        });
        const abilities = card.card.enrichment?.abilities || [];
        for (const ability of abilities) {
          if (ability.trigger === 'WHEN_REVEALED' || ability.timing === 'WHEN_REVEALED') {
            executeEffect(state, ability, {
              playerId: player.id,
              sourceCardInstance: card,
            });
          }
        }
      } else {
        player.tableau.push(card);
      }
    }
  } else if (destination === 'DISCARD') {
    if (sourceZone.startsWith('ENCOUNTER')) {
      state.encounterDiscard.push(...cards);
    } else {
      player.discard.push(...cards);
    }
  } else if (destination === 'DECK_TOP') {
    if (sourceZone === 'ENCOUNTER_DECK') {
      state.encounterDeck.unshift(...cards);
    } else {
      player.deck.unshift(...cards);
    }
  } else if (destination === 'DECK_BOTTOM') {
    if (sourceZone === 'ENCOUNTER_DECK') {
      state.encounterDeck.push(...cards);
    } else {
      player.deck.push(...cards);
    }
  } else if (destination === 'DECK_SHUFFLE') {
    if (sourceZone === 'ENCOUNTER_DECK') {
      state.encounterDeck.push(...cards);
      state.encounterDeck = shuffleArray(state, state.encounterDeck);
    } else {
      player.deck.push(...cards);
      player.deck = shuffleArray(state, player.deck);
    }
  } else if (destination === 'ATTACH_TO_TARGET') {
    for (const card of cards) {
      attachCardToHost(state, card, targetHost || 'VILLAIN', player.id);
    }
  }
}

/**
 * Resolves the villain a player attacks or attaches to: the one named by `targetInstanceId`
 * (any villain in play may be targeted, MC03 rules insert p.6), else the active villain.
 * Returns undefined when an id is given that matches none of the villains in play.
 */
export function resolveAttackedVillain(
  state: GameState,
  targetInstanceId?: string,
): VillainState | undefined {
  if (!targetInstanceId) return getActiveVillain(state);
  const found = getVillainById(state, targetInstanceId);
  if (found) return found;
  // States without a villains collection only have the legacy pointer (#215).
  return getVillainsInPlay(state).length === 0 ? getActiveVillain(state) : undefined;
}

/**
 * Resolves the abilities of an event that was just played: pays the declared extra cost first
 * (so its results feed the steps), then executes the effects.
 */
export function resolveEventAbilities(
  state: GameState,
  player: PlayerState,
  playedCardInstance: CardInstance,
  context: {
    chosenTargetType?: Parameters<typeof executeEffect>[2]['chosenTargetType'];
    chosenTargetInstanceId?: string;
    resourcesSpent?: string[];
    discardCardInstanceIds?: string[];
  },
): void {
  for (const ability of playedCardInstance.card.enrichment?.abilities || []) {
    const extraCost = getEventAbilityExtraCost(ability);
    const discardedCards = extraCost
      ? executeAbilityCost(state, player, extraCost, playedCardInstance, {
          discardCardInstanceIds: context.discardCardInstanceIds,
        }).discardedCards
      : undefined;
    executeEffect(state, ability, {
      playerId: player.id,
      chosenTargetType: context.chosenTargetType,
      chosenTargetInstanceId: context.chosenTargetInstanceId,
      sourceCardInstance: playedCardInstance,
      resourcesSpent: context.resourcesSpent,
      discardedCards,
    });
  }
}

/**
 * A decision answered during the villain phase lets the phase continue once nothing waits.
 * A stepped phase stops instead to show a combat outcome or a placed threat (#266).
 */
export function resumeVillainPhaseAfterDecision(
  state: GameState,
  hadPausedThreatPlacement: boolean,
): GameState {
  if (state.phase !== GamePhase.VILLAIN_PHASE || state.winner) return state;
  if (peekDecisionPrompt(state) || hasPendingSequence(state)) return state;
  if (
    state.options?.villainPhaseStepping &&
    (state.lastCombatOutcome || hadPausedThreatPlacement)
  ) {
    return state;
  }
  return continueVillainPhase(state);
}

/**
 * Pure state reducer / action dispatcher executing player commands in accordance with RR v1.8.
 * After a successful action, an ability sequence that paused on a decision prompt resumes
 * as soon as the prompt queue is empty (#248).
 */
export function dispatchAction(
  state: GameState,
  action: GameAction,
): { state: GameState; result: ActionResult } {
  const hadPausedThreatPlacement = (state.pendingThreatPlacements?.length ?? 0) > 0;
  const outcome = dispatchSingleAction(state, action);
  if (!outcome.result.success) return outcome;

  let next = outcome.state;
  if (hasPendingSequence(next) && !peekDecisionPrompt(next)) {
    next = resumePendingSequence(next);
  }
  if (action.type === 'RESOLVE_DECISION_PROMPT' || action.type === 'DECLARE_DEFENDER') {
    next = resumeVillainPhaseAfterDecision(next, hadPausedThreatPlacement);
  }
  // Player Setup abilities (step 16) continue once the decision they waited for is answered.
  if (next.setupState?.stage === 'PLAYER_SETUP') {
    next = advancePlayerSetup(next);
  }
  checkDeckExhaustionInvariants(next);
  return next === outcome.state ? outcome : { state: next, result: outcome.result };
}

function dispatchSingleAction(
  state: GameState,
  action: GameAction,
): { state: GameState; result: ActionResult } {
  // Clone state immutably for pure state transition
  const nextState: GameState = cloneGameState(state);

  return runActionHandler(nextState, state, action);
}
