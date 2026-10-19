import {
  GameState,
  CardInstance,
  PlayerState,
  VillainState,
  getActiveVillain,
  getVillainsInPlay,
  getVillainById,
} from '@engine/models';
import { executeAbilityCost, getEventAbilityExtraCost } from '../cost-engine';
import { executeEffect } from '../../effects';

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
