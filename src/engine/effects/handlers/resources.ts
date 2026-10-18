/** Resources and constant limits (step handlers, AUD-20261017-232534 F010-A). */
import { GameState, AbilityStep, PlayerState, ActiveCostReduction } from '@engine/models';
import { getStepEffectParams } from '../../../data/supplemental/runtime';
import { enqueueDecisionPrompt } from '../../pipeline/prompt-queue';
import { locateCard, readCardResources } from '../../queries/card-inspector';
import { nextEngineId } from '../../state/rng';
import { appendLog } from '../../state/game-log';
import { EffectExecutionContext, EffectResult } from '../index';
import type { StepHandler } from './types';
import type { EffectType } from '../../../data/supplemental/runtime';

function handleGenerateResource(
  state: GameState,
  step: AbilityStep,
  context: EffectExecutionContext,
  player: PlayerState,
): EffectResult {
  const fromCardSelector = step.effectParams?.fromCard;
  if (fromCardSelector) {
    const located = locateCard(state, fromCardSelector, {
      player,
      sourceCardInstance: context.sourceCardInstance,
      targetCardInstance: context.targetCardInstance,
    });

    if (!located) {
      return {
        state,
        success: false,
        value: 0,
        onomatopoeia: 'NO CARD LOCATED!',
      };
    }

    const resources = readCardResources(located);
    const resCount = resources.length;
    const resListStr = resources.map((r) => `[${r}]`).join(' ');

    return {
      state,
      success: true,
      mutatedState: true,
      value: resCount,
      onomatopoeia: `+${resCount} ${resListStr || '[wild]'} RESOURCES!`,
    };
  }

  const resourceType = (step.effectParams?.resource as string) || 'wild';
  const amount = (step.effectParams?.amount as number) || 1;

  return {
    state,
    success: true,
    value: amount,
    onomatopoeia: `+${amount} [${resourceType}] RESOURCE!`,
  };
}

function handleReduceNextCardCost(
  state: GameState,
  step: AbilityStep,
  context: EffectExecutionContext,
  player: PlayerState,
): EffectResult {
  const stepParams = getStepEffectParams(step);
  const amount = (stepParams.amount as number) || (step.effectParams?.amount as number) || 1;
  const targetParam =
    (stepParams.target as string) || (step.effectParams?.target as string) || 'CHOSEN_PLAYER';
  const duration = (stepParams.duration as 'PHASE' | 'ROUND' | 'TURN') || 'PHASE';
  const cardFilter = stepParams.cardFilter || (stepParams.filter as any);
  const targetPlayerId = (context.targetPlayerId ||
    context.chosenTargetInstanceId ||
    stepParams.targetPlayerId) as string | undefined;

  // In multiplayer mode, if targeting CHOSEN_PLAYER and no target player specified yet, prompt player to choose
  if (targetParam === 'CHOSEN_PLAYER' && state.players.length > 1 && !targetPlayerId) {
    const sourceCardName =
      context.sourceCardInstance?.card.name || player.activeFormCard?.name || 'Helicarrier';
    const promptId = `prompt_${nextEngineId(state, 'id')}_choose_cost_reduction_player`;
    state = enqueueDecisionPrompt(state, {
      promptId,
      playerId: player.id,
      title: 'Choose a Player',
      description: `Choose a player to reduce the resource cost of the next card they play this phase by ${amount}:`,
      sourceCardName,
      options: state.players.map((p) => ({
        id: `reduce_cost_${p.id}`,
        label: `${p.name} (${p.hero?.name || 'Hero'})`,
        description: `Give -${amount} cost reduction to ${p.name}`,
        effect: 'REDUCE_NEXT_CARD_COST',
        params: {
          amount,
          duration,
          cardFilter,
          targetPlayerId: p.id,
          target: 'CHOSEN_PLAYER',
        },
      })),
    });

    appendLog(state, {
      category: 'ability',
      key: 'decision.prompt.opened',
      params: { player: player.name, promptId, source: sourceCardName },
      onomatopoeia: 'CHOOSE PLAYER!',
    });

    return {
      state,
      success: true,
      onomatopoeia: 'CHOOSE PLAYER!',
    };
  }

  // Determine recipient player
  let targetPlayer = player;
  if (targetPlayerId) {
    const found = state.players.find((p) => p.id === targetPlayerId);
    if (found) targetPlayer = found;
  }

  const sourceCardName = context.sourceCardInstance?.card.name || 'Helicarrier';
  const sourceCardCode = context.sourceCardInstance?.card.code;

  const reduction: ActiveCostReduction = {
    id: nextEngineId(state, 'cost_red'),
    sourceCardName,
    sourceCardCode,
    amount,
    duration,
    cardFilter,
    appliesTo: 'NEXT_CARD',
  };

  if (!targetPlayer.activeCostReductions) {
    targetPlayer.activeCostReductions = [];
  }
  targetPlayer.activeCostReductions.push(reduction);
  targetPlayer.costReductions = targetPlayer.activeCostReductions.reduce(
    (sum, r) => sum + r.amount,
    0,
  );

  appendLog(state, {
    category: 'ability',
    key: 'cost.reduced',
    params: {
      player: targetPlayer.name,
      source: sourceCardName,
      amount,
    },
    onomatopoeia: `${sourceCardName.toUpperCase()} DISCOUNT! -${amount} COST`,
  });

  return {
    state,
    success: true,
    mutatedState: true,
    onomatopoeia: `${sourceCardName.toUpperCase()} DISCOUNT! -${amount} COST`,
  };
}

function handleModifyRestrictedLimit(
  state: GameState,
  _step: AbilityStep,
  _context: EffectExecutionContext,
  _player: PlayerState,
): EffectResult {
  // Constant effects: read where the rule applies (legality-checker limits, damage-immunity,
  // stat-calculator, cost-engine), never executed as a step
  return { state, success: true, mutatedState: false };
}

export const RESOURCES_HANDLERS = {
  GENERATE_RESOURCE: handleGenerateResource,
  REDUCE_NEXT_CARD_COST: handleReduceNextCardCost,
  MODIFY_RESTRICTED_LIMIT: handleModifyRestrictedLimit,
  MODIFY_ALLY_LIMIT: handleModifyRestrictedLimit,
  MODIFY_HAND_SIZE: handleModifyRestrictedLimit,
  MODIFY_MAX_HEALTH: handleModifyRestrictedLimit,
  CANNOT_TAKE_DAMAGE: handleModifyRestrictedLimit,
  DOUBLE_RESOURCE_FOR_ASPECT: handleModifyRestrictedLimit,
} satisfies Partial<Record<EffectType, StepHandler>>;
