/** Resources and constant limits (step handlers, AUD-20261017-232534 F010-A). */
import { kernel } from '../../kernel';
import { GameState, PlayerState, ActiveCostReduction } from '@engine/models';
import { getStepEffectParams } from '../../../data/supplemental/runtime';
import { locateCard, readCardResources } from '../../queries/card-inspector';
import { nextEngineId } from '../../state/rng';
import { appendLog } from '../../state/game-log';
import { EffectExecutionContext, EffectResult, resolveNumericAmount } from '../index';
import { getRuntimeParams, type TypedStep, type StepHandlerMap } from './types';

function handleGenerateResource(
  state: GameState,
  step: TypedStep<'GENERATE_RESOURCE'>,
  context: EffectExecutionContext,
  player: PlayerState,
): EffectResult {
  const params = getStepEffectParams(step);
  const fromCardSelector = params.fromCard;
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

  const resourceType = params.resource || 'wild';
  const amount = resolveNumericAmount(params.amount, context, 1, { state, player }) || 1;

  return {
    state,
    success: true,
    value: amount,
    onomatopoeia: `+${amount} [${resourceType}] RESOURCE!`,
  };
}

function handleReduceNextCardCost(
  state: GameState,
  step: TypedStep<'REDUCE_NEXT_CARD_COST'>,
  context: EffectExecutionContext,
  player: PlayerState,
): EffectResult {
  const stepParams = getStepEffectParams(step);
  const runtime = getRuntimeParams(step);
  const amount = stepParams.amount || 1;
  const targetParam = stepParams.target || 'CHOSEN_PLAYER';
  const duration = stepParams.duration || 'PHASE';
  const cardFilter = stepParams.cardFilter;
  const targetPlayerId =
    context.targetPlayerId || context.chosenTargetInstanceId || runtime.targetPlayerId;

  // In multiplayer mode, if targeting CHOSEN_PLAYER and no target player specified yet, prompt player to choose
  if (targetParam === 'CHOSEN_PLAYER' && state.players.length > 1 && !targetPlayerId) {
    const sourceCardName =
      context.sourceCardInstance?.card.name || player.activeFormCard?.name || 'Helicarrier';
    const promptId = `prompt_${nextEngineId(state, 'id')}_choose_cost_reduction_player`;
    state = kernel.enqueueDecisionPrompt(state, {
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
      params: { actor: player.name, promptId, source: sourceCardName },
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
      actor: targetPlayer.name,
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
  _step: TypedStep,
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
  RESTRICT_DEFENSE: handleModifyRestrictedLimit,
} satisfies Partial<StepHandlerMap>;
