import {
  GameState,
  CardInstance,
  PlayerState,
  VillainState,
  getActiveVillain,
  getVillainById,
} from '@engine/models';
import { executeAbilityCost, getEventAbilityExtraCost } from '../cost-engine';
import { executeEffect } from '../../effects';
import { resolveEntityByInstanceId } from '../../effects/target-resolver';

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
  return getVillainById(state, targetInstanceId);
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

/** What a chosen target is, for the `chosenTargetType` of the effects an event runs. */
export type ChosenTargetType =
  'villain' | 'minion' | 'main_scheme' | 'side_scheme' | 'character' | 'identity' | 'ally' | 'hero';

/** The type of the entity a player chose; `fallback` when the id names nothing in play. */
export function chosenTargetTypeOf(
  state: GameState,
  targetId: string,
  fallback: ChosenTargetType = 'villain',
): ChosenTargetType {
  const resolved = resolveEntityByInstanceId(state, targetId);
  if (!resolved) return fallback;
  if (resolved.kind === 'scheme') return resolved.entityType;
  if (resolved.kind === 'player') return 'identity';
  if (resolved.kind !== 'character') return fallback;
  if (resolved.entityType === 'villain') return 'villain';
  if (resolved.entityType === 'minion') return 'minion';
  if (resolved.entityType === 'ally') return 'ally';
  return 'character';
}
