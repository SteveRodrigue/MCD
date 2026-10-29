/** Encounter reveals, surge and threat (step handlers, AUD-20261017-232534 F010-A). */
import { GameState, PlayerState, getActiveMainScheme, getPerPlayerCount } from '@engine/models';
import { drawEncounterCard } from '../../pipeline/deck-exhaustion';
import { dealSurgeCard } from '../../pipeline/surge';
import { applyThreatPlacement, applyThwart } from '../../pipeline/threat-pipeline';
import { kernel } from '../../kernel';
import { resolveSchemeTargets, type EffectContext, type SchemeTarget } from '../target-resolver';
import { appendLog } from '../../state/game-log';
import {
  EffectExecutionContext,
  EffectResult,
  cancelActiveEncounterReveal,
  resolveNumericAmount,
} from '../index';
import { getRuntimeParams, type TypedStep, type StepHandlerMap } from './types';
import { namedSchemeCode } from '../step-selection';
import { getStepEffectParams } from '../../../data/supplemental/runtime';

function handlePreventThreat(
  state: GameState,
  step: TypedStep<'PREVENT_THREAT'>,
  context: EffectExecutionContext,
  player: PlayerState,
): EffectResult {
  const params = getStepEffectParams(step);
  const currentVal =
    context.remainingInterceptedValue ?? context.threatAmount ?? context.interceptedValue ?? 0;

  const hasInterceptContext =
    context.remainingInterceptedValue !== undefined ||
    context.interceptedValue !== undefined ||
    context.threatAmount !== undefined;

  const amountToPrevent =
    params.amount !== undefined
      ? params.amount === 'ALL'
        ? currentVal
        : resolveNumericAmount(params.amount, context, currentVal)
      : hasInterceptContext
        ? currentVal
        : 1;

  const consumed = hasInterceptContext ? Math.min(currentVal, amountToPrevent) : amountToPrevent;
  const remaining = hasInterceptContext ? Math.max(0, currentVal - consumed) : 0;

  if (hasInterceptContext) {
    context.remainingInterceptedValue = remaining;
    if (context.threatAmount !== undefined) {
      context.threatAmount = remaining;
    }
  }

  const onomatopoeia =
    context.threatAmount !== undefined
      ? consumed === currentVal
        ? 'THREAT PREVENTED!'
        : `PREVENTED ${consumed} THREAT!`
      : `PREVENTED ${consumed} THREAT!`;

  appendLog(state, {
    category: 'ability',
    key: 'card.effect.preventThreat',
    params: {
      actor: player.name,
      amount: consumed,
      consumed,
      remaining,
    },
    onomatopoeia,
  });

  return {
    state,
    success: true,
    mutatedState: consumed > 0,
    value: consumed,
    onomatopoeia,
  };
}

function handleRemoveThreat(
  state: GameState,
  step: TypedStep<'REMOVE_THREAT'>,
  context: EffectExecutionContext,
  player: PlayerState,
): EffectResult {
  const params = getStepEffectParams(step);
  const runtime = getRuntimeParams(step);
  const targetInstanceId = runtime.targetInstanceId || context.chosenTargetInstanceId;
  let amount = resolveNumericAmount(params.amount, context, 1, { state, player });
  if (params.dynamicBonus) {
    const bonus = resolveNumericAmount(params.dynamicBonus, context, 0, {
      state,
      player,
      sourceCardInstance: context.sourceCardInstance,
      targetInstanceId,
    });
    amount += bonus;
  }
  if (context.isFinalStep && params.finisherBonus) {
    amount += params.finisherBonus || 0;
  }
  const targetParam =
    (params.target as string) || (targetInstanceId ? 'CHOSEN_SCHEME' : undefined) || 'MAIN_SCHEME';
  const targetContext: EffectContext = {
    ...context,
    chosenTargetInstanceId: targetInstanceId,
  };
  let removed = 0;
  let remainingThreat: number | undefined;
  let attempted = false;
  let blockOnomatopoeia: string | undefined;

  // Crisis and Patrol limit player cards only; encounter card abilities are not affected (RR v1.8
  // "Crisis Icon"). applyThwart blocks and announces them for the main scheme.
  const isPlayerSource = context.sourceCardInstance?.card?.faction !== 'encounter';

  const resolved = resolveSchemeTargets(state, targetParam, targetContext);
  const targetSchemes: SchemeTarget[] =
    resolved.length > 0
      ? resolved
      : [
          {
            kind: 'scheme' as const,
            entityType: 'main_scheme' as const,
            entity: getActiveMainScheme(state),
            id: getActiveMainScheme(state).instanceId || 'main_scheme',
          },
        ];

  for (const st of targetSchemes) {
    const isSide =
      st.entityType === 'side_scheme' ||
      (state.sideSchemes || []).some((s) => s.instanceId === st.id || s.card.code === st.id);

    const thwartRes = applyThwart(state, {
      thwarterType: context.labelledThwart ? 'HERO' : 'CARD_EFFECT',
      thwarterEntity: context.labelledThwart ? player : context.sourceCardInstance,
      playerId: player.id,
      targetType: isSide ? 'side_scheme' : 'main_scheme',
      targetInstanceId: isSide ? st.id : undefined,
      thwartValue: amount,
      isPlayerSource,
      ignoresCrisis: Boolean(params.ignoresCrisis),
      suppressTrigger: Boolean(context.labelledThwart),
      sourceName: context.sourceCardInstance?.card?.name,
    });

    removed += thwartRes.result.threatRemoved;
    if (thwartRes.result.thwartAttempted) {
      attempted = true;
      // A Confused thwart removes nothing: its 0 says nothing about the scheme.
      if (!thwartRes.result.confusedCleared) remainingThreat = thwartRes.result.remainingThreat;
    } else blockOnomatopoeia = thwartRes.result.onomatopoeia;

    if (context.labelledThwart && thwartRes.result.thwartAttempted && !context.thwartedScheme) {
      context.thwartedScheme = {
        targetType: isSide ? 'side_scheme' : 'main_scheme',
        instanceId: isSide ? st.id : undefined,
      };
    }
  }

  // Every scheme was blocked (applyThwart already logged each one): nothing was thwarted.
  if (!attempted) {
    return { state, success: true, mutatedState: false, value: 0, onomatopoeia: blockOnomatopoeia };
  }

  if (context.labelledThwart) {
    context.accumulatedThreatRemoved = (context.accumulatedThreatRemoved || 0) + removed;
  }

  const onomatopoeia = `-${removed} THREAT!`;
  return {
    state,
    success: true,
    mutatedState: removed > 0,
    value: removed,
    facts: {
      schemeEmpty: remainingThreat === 0,
      threatZero: remainingThreat === 0,
    },
    onomatopoeia,
    targetId: targetSchemes[0]?.id || targetSchemes[0]?.entity?.instanceId || 'main_scheme',
  };
}

function handleAddAcceleration(
  state: GameState,
  step: TypedStep<'ADD_ACCELERATION'>,
  context: EffectExecutionContext,
  player: PlayerState,
): EffectResult {
  // Acceleration tokens sit on the main scheme (RR v1.8 "Acceleration"): +1 threat per token each villain phase
  const params = getStepEffectParams(step);
  const amount = kernel.evaluateDynamicAmount(params.amount, context, {
    fallback: 1,
    state,
    player,
  });
  state.accelerationTokens = (state.accelerationTokens || 0) + amount;
  appendLog(state, {
    key: 'scheme.acceleration.added',
    params: { amount, card: context.sourceCardInstance?.card.name || 'Card' },
    onomatopoeia: `+${amount} ACCELERATION!`,
  });
  return {
    state,
    success: true,
    mutatedState: amount !== 0,
    value: amount,
    onomatopoeia: `+${amount} ACCELERATION!`,
  };
}

function handleSurge(
  state: GameState,
  _step: TypedStep<'SURGE'>,
  context: EffectExecutionContext,
  player: PlayerState,
): EffectResult {
  dealSurgeCard(state, player, context.sourceCardInstance?.card.name);
  const onomatopoeia = 'SURGE!';
  return {
    state,
    success: true,
    mutatedState: true,
    value: 1,
    onomatopoeia,
  };
}

function handleRevealEncounterCard(
  state: GameState,
  _step: TypedStep<'REVEAL_ENCOUNTER_CARD'>,
  _context: EffectExecutionContext,
  player: PlayerState,
): EffectResult {
  const extraCard = drawEncounterCard(state);
  if (extraCard) {
    player.dealtEncounterCards.push(extraCard);
  }
  const onomatopoeia = 'REVEAL ENCOUNTER CARD!';
  appendLog(state, {
    key: 'encounter.card.revealed',
    params: { actor: player.name },
    onomatopoeia,
  });
  return {
    state,
    success: true,
    mutatedState: true,
    value: 1,
    onomatopoeia,
  };
}

function handleDealFacedownEncounterCard(
  state: GameState,
  step: TypedStep<'DEAL_FACEDOWN_ENCOUNTER_CARD'>,
  context: EffectExecutionContext,
  player: PlayerState,
): EffectResult {
  const params = getStepEffectParams(step);
  const targetSelector = params.target ?? 'ENGAGED_PLAYER';
  const count =
    typeof params.count === 'number'
      ? params.count
      : params.count
        ? resolveNumericAmount(params.count, context, 1)
        : 1;

  let targetPlayers: PlayerState[] = [];
  if (targetSelector === 'ALL_PLAYERS') {
    targetPlayers = state.players;
  } else if (targetSelector === 'FIRST_PLAYER') {
    const fp = state.players[state.firstPlayerIndex] ?? state.players[0];
    if (fp) targetPlayers = [fp];
  } else {
    const p =
      (context.playerId ? state.players.find((pl) => pl.id === context.playerId) : undefined) ??
      player ??
      state.players[0];
    if (p) targetPlayers = [p];
  }

  let totalDealt = 0;
  for (const targetPlayer of targetPlayers) {
    for (let i = 0; i < count; i++) {
      const card = drawEncounterCard(state);
      if (card) {
        targetPlayer.dealtEncounterCards.push(card);
        totalDealt++;
      }
    }
    appendLog(state, {
      key: 'encounter.card.revealed',
      params: { actor: targetPlayer.name },
      onomatopoeia: 'DEALT ENCOUNTER CARD!',
    });
  }

  return {
    state,
    success: totalDealt > 0,
    mutatedState: totalDealt > 0,
    value: totalDealt,
    onomatopoeia: 'DEALT ENCOUNTER CARD!',
  };
}

function handleAddThreat(
  state: GameState,
  step: TypedStep<'ADD_THREAT'>,
  context: EffectExecutionContext,
  player: PlayerState,
): EffectResult {
  const params = getStepEffectParams(step);
  const runtime = getRuntimeParams(step);
  const baseAmount = resolveNumericAmount(params.amount, context, 1, {
    state,
    player,
  });
  const isPerPlayer = Boolean(params.perPlayer);
  const amount = isPerPlayer ? baseAmount * getPerPlayerCount(state) : baseAmount;
  const targetInstanceId = runtime.targetInstanceId as string | undefined;
  const targetParam =
    (params.target as string) || (targetInstanceId ? 'CHOSEN_SCHEME' : undefined) || 'MAIN_SCHEME';
  const targetContext: EffectContext = {
    ...context,
    chosenTargetInstanceId: targetInstanceId || context?.chosenTargetInstanceId,
  };

  if (targetParam === 'ALL_SIDE_SCHEMES') {
    if (state.sideSchemes.length > 0) {
      let totalPlaced = 0;
      let paused = false;
      for (const s of state.sideSchemes) {
        const { result } = applyThreatPlacement(state, {
          targetType: 'side_scheme',
          targetInstanceId: s.instanceId,
          amount,
          sourceType: 'CARD_EFFECT',
          sourceEntityName: context.sourceCardInstance?.card?.name,
          sourcePlayerId: player.id,
        });
        totalPlaced += result.threatPlaced;
        paused ||= result.paused === true;
      }
      return {
        state,
        success: true,
        mutatedState: totalPlaced > 0 || paused,
        value: totalPlaced,
        onomatopoeia: `+${amount} THREAT TO SIDE SCHEMES!`,
      };
    }
    return { state, success: true, mutatedState: false, onomatopoeia: 'NO SIDE SCHEMES' };
  }
  const cardCode = namedSchemeCode(step);
  if (cardCode) {
    const sideScheme = (state.sideSchemes || []).find((s) => s.card?.code === cardCode);
    if (sideScheme) {
      const { result } = applyThreatPlacement(state, {
        targetType: 'side_scheme',
        targetInstanceId: sideScheme.instanceId,
        amount,
        sourceType: 'CARD_EFFECT',
        sourceEntityName: context.sourceCardInstance?.card?.name,
        sourcePlayerId: player.id,
      });
      return {
        state,
        success: true,
        mutatedState: result.threatPlaced > 0 || result.paused === true,
        value: result.threatPlaced,
        onomatopoeia: result.onomatopoeia,
      };
    }

    if (getActiveMainScheme(state)?.card?.code === cardCode) {
      const { result } = applyThreatPlacement(state, {
        targetType: 'main_scheme',
        amount,
        sourceType: 'CARD_EFFECT',
        sourceEntityName: context.sourceCardInstance?.card?.name,
        sourcePlayerId: player.id,
      });
      return {
        state,
        success: true,
        mutatedState: result.threatPlaced > 0 || result.paused === true,
        value: result.threatPlaced,
        onomatopoeia: result.onomatopoeia,
      };
    }

    // Targeted scheme is not in play: effect fizzles per RR v1.8 p. 29
    appendLog(state, {
      key: 'scheme.threat.target_missing',
      params: { card: cardCode, amount },
    });
    return {
      state,
      success: true,
      mutatedState: false,
      value: 0,
    };
  }

  const targetSchemes = resolveSchemeTargets(state, targetParam, targetContext);
  if (targetSchemes.length > 0) {
    let totalPlaced = 0;
    let paused = false;
    let lastResult: { onomatopoeia?: string } | undefined;
    for (const st of targetSchemes) {
      const isSide =
        st.entityType === 'side_scheme' ||
        (state.sideSchemes || []).some((s) => s.instanceId === st.id || s.card.code === st.id);

      const { result } = applyThreatPlacement(state, {
        targetType: isSide ? 'side_scheme' : 'main_scheme',
        targetInstanceId: isSide ? st.id : undefined,
        amount,
        sourceType: 'CARD_EFFECT',
        sourceEntityName: context.sourceCardInstance?.card?.name,
        sourcePlayerId: player.id,
      });
      totalPlaced += result.threatPlaced;
      paused ||= result.paused === true;
      lastResult = result;
    }
    return {
      state,
      success: true,
      mutatedState: totalPlaced > 0 || paused,
      value: totalPlaced,
      onomatopoeia: lastResult?.onomatopoeia || `SCHEME THREAT +${totalPlaced}!`,
    };
  }

  appendLog(state, {
    key: 'scheme.threat.target_missing',
    params: { target: targetParam, amount },
  });
  return {
    state,
    success: true,
    mutatedState: false,
    value: 0,
  };
}

function handleCancelWhenRevealed(
  state: GameState,
  _step: TypedStep<'CANCEL_WHEN_REVEALED'>,
  _context: EffectExecutionContext,
  player: PlayerState,
): EffectResult {
  const cancelRes = cancelActiveEncounterReveal(state, false);
  if (cancelRes) return cancelRes;
  const onomatopoeia = 'CANCELLED!';
  appendLog(state, {
    key: 'encounter.whenRevealed.cancelled',
    params: { actor: player.name },
    onomatopoeia,
  });
  return {
    state,
    success: true,
    mutatedState: true,
    value: 1,
    onomatopoeia,
  };
}

function handleCancelWhenRevealedAndRevealAnother(
  state: GameState,
  _step: TypedStep<'CANCEL_WHEN_REVEALED_AND_REVEAL_ANOTHER'>,
  _context: EffectExecutionContext,
  player: PlayerState,
): EffectResult {
  const cancelRes = cancelActiveEncounterReveal(state, true);
  if (cancelRes) return cancelRes;
  // The active player does not change: the replacement goes to the player resolving the
  // cancelled card, whoever controls the card that cancelled it.
  const revealingPlayer =
    state.players.find((p) => p.id === state.activeEncounterContext?.targetPlayerId) ?? player;
  const replacement = drawEncounterCard(state);
  if (replacement) {
    revealingPlayer.dealtEncounterCards.push(replacement);
  }
  return {
    state,
    success: true,
    mutatedState: true,
    onomatopoeia: 'CANCELLED & REVEALED ANOTHER!',
  };
}

export const ENCOUNTER_HANDLERS = {
  PREVENT_THREAT: handlePreventThreat,
  REMOVE_THREAT: handleRemoveThreat,
  ADD_ACCELERATION: handleAddAcceleration,
  SURGE: handleSurge,
  REVEAL_ENCOUNTER_CARD: handleRevealEncounterCard,
  DEAL_FACEDOWN_ENCOUNTER_CARD: handleDealFacedownEncounterCard,
  ADD_THREAT: handleAddThreat,
  CANCEL_WHEN_REVEALED: handleCancelWhenRevealed,
  CANCEL_WHEN_REVEALED_AND_REVEAL_ANOTHER: handleCancelWhenRevealedAndRevealAnother,
} satisfies Partial<StepHandlerMap>;
