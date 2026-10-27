/** Player choices and special handlers (step handlers, AUD-20261017-232534 F010-A). */
import { kernel } from '../../kernel';
import { GameState, CardType, PlayerState, DecisionPromptOption } from '@engine/models';
import { getSpecialHandler } from '../../specials/special-registry';
import { nextEngineId } from '../../state/rng';
import { appendLog } from '../../state/game-log';
import { EffectExecutionContext, EffectResult, resolveNumericAmount } from '../index';
import type { TypedStep, StepHandlerMap } from './types';
import { getStepEffectParams } from '../../../data/supplemental/runtime';

function handlePlayerChoice(
  state: GameState,
  step: TypedStep<'PLAYER_CHOICE'>,
  context: EffectExecutionContext,
  player: PlayerState,
): EffectResult {
  const params = getStepEffectParams(step);
  let resolvedX: number | undefined;
  const options: DecisionPromptOption[] = (
    (params.options as unknown as DecisionPromptOption[]) || []
  ).map((opt) => {
    const optionCopy = { ...opt };
    const optParams = optionCopy.params as Record<string, unknown> | undefined;
    const amountVal =
      optParams?.amount ??
      (optionCopy.steps?.[0]?.effectParams as Record<string, unknown> | undefined)?.amount;
    if (
      amountVal &&
      typeof amountVal === 'object' &&
      (amountVal as Record<string, unknown>).from === 'DISCARDED_CARDS' &&
      context.discardedCards !== undefined
    ) {
      const resolvedAmount = resolveNumericAmount(amountVal, context, 0, { state, player });
      resolvedX = resolvedAmount;
      if (optionCopy.label.includes('X')) {
        optionCopy.label = optionCopy.label.replace(/\bX\b/g, String(resolvedAmount));
      }
      if (optionCopy.description && optionCopy.description.includes('X')) {
        if (!optionCopy.description.includes(`(X = ${resolvedAmount})`)) {
          optionCopy.description = `${optionCopy.description} (X = ${resolvedAmount})`;
        }
      }
    }
    return optionCopy;
  });
  const title = params.title || 'Choose an Option';
  let description = params.description || '';
  if (
    resolvedX !== undefined &&
    description.includes('X is 1 more than') &&
    !description.includes('currently X =')
  ) {
    description = description.replace('):', `; currently X = ${resolvedX}):`);
  }
  const sourceCardName = context.sourceCardInstance?.card.name || step.id || 'Card Ability';
  const promptId = `prompt_${nextEngineId(state, 'id')}_${step.id || 'choice'}`;
  state = kernel.enqueueDecisionPrompt(state, {
    promptId,
    playerId: context.playerId || player.id,
    title,
    description,
    sourceCardName,
    sourceCardCode: context.sourceCardInstance?.card.code,
    sourceCardInstanceId: context.sourceCardInstance?.instanceId,
    triggerSourceCard: context.sourceCardInstance?.card,
    options,
    checkOptionTargets: true,
    discardedCards: context.discardedCards,
    isVoluntary: params.isVoluntary ?? false,
    completion:
      context.sourceCardInstance?.card.type === CardType.OBLIGATION
        ? 'DISCARD_SOURCE_OBLIGATION'
        : undefined,
  });

  appendLog(state, {
    category: 'ability',
    key: 'decision.prompt.opened',
    params: { actor: player.name, promptId, source: sourceCardName },
    onomatopoeia: 'CHOICE REQUIRED!',
  });

  return { state, success: true, onomatopoeia: 'CHOOSE AN OPTION!' };
}

function handleExecuteSpecial(
  state: GameState,
  step: TypedStep<'EXECUTE_SPECIAL'>,
  context: EffectExecutionContext,
  _player: PlayerState,
): EffectResult {
  const params = getStepEffectParams(step);
  const specialId = params.specialId;
  if (!specialId) {
    return { state, success: false, error: 'EXECUTE_SPECIAL requires effectParams.specialId' };
  }
  const handler = getSpecialHandler(specialId);
  if (!handler) {
    return {
      state,
      success: false,
      error: `Special handler not found for ${specialId}`,
    };
  }
  return handler.execute(state, context, params);
}

export const CHOICE_HANDLERS = {
  PLAYER_CHOICE: handlePlayerChoice,
  EXECUTE_SPECIAL: handleExecuteSpecial,
} satisfies Partial<StepHandlerMap>;
