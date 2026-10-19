/** Player choices and special handlers (step handlers, AUD-20261017-232534 F010-A). */
import { GameState, CardType, PlayerState, DecisionPromptOption } from '@engine/models';
import { enqueueDecisionPrompt } from '../../pipeline/prompt-queue';
import { getSpecialHandler } from '../../specials/special-registry';
import { nextEngineId } from '../../state/rng';
import { appendLog } from '../../state/game-log';
import { EffectExecutionContext, EffectResult } from '../index';
import type { TypedStep, StepHandlerMap } from './types';
import { getStepEffectParams } from '../../../data/supplemental/runtime';

function handlePlayerChoice(
  state: GameState,
  step: TypedStep<'PLAYER_CHOICE'>,
  context: EffectExecutionContext,
  player: PlayerState,
): EffectResult {
  const params = getStepEffectParams(step);
  const options: DecisionPromptOption[] = (
    (params.options as unknown as DecisionPromptOption[]) || []
  ).map((opt) => ({ ...opt }));
  const title = params.title || 'Choose an Option';
  const description = params.description || '';
  const sourceCardName = context.sourceCardInstance?.card.name || step.id || 'Card Ability';
  const promptId = `prompt_${nextEngineId(state, 'id')}_${step.id || 'choice'}`;
  state = enqueueDecisionPrompt(state, {
    promptId,
    playerId: context.playerId || player.id,
    title,
    description,
    sourceCardName,
    sourceCardCode: context.sourceCardInstance?.card.code,
    sourceCardInstanceId: context.sourceCardInstance?.instanceId,
    triggerSourceCard: context.sourceCardInstance?.card,
    options,
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
    params: { player: player.name, promptId, source: sourceCardName },
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
