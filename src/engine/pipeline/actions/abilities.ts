import { AlterEgoCard, CardType, PendingDecisionPrompt } from '../../models';
import { getPlayer, canChangeForm, canBasicRecover, canInitiateAbility } from '../legality-checker';
import { getEffectiveMaxHealth } from '../stat-calculator';
import { executeAbilityCost, checkAndDiscardZeroCounterCard } from '../cost-engine';
import { executeEffect } from '../../effects';
import { findInPlayCardInstance } from '../../state/state-validator';
import { recordBasicAction } from '../stats';
import { appendLog } from '../../state/game-log';
import { dispatchTrigger } from '../../triggers/trigger-dispatcher';
import { nextEngineId } from '../../state/rng';
import { chooseInitialTarget, targetChoiceOptions } from '../../effects/target-choice';
import { enqueueDecisionPrompt } from '../prompt-queue';
import type { ActionHandler } from './types';

export const handleChangeForm: ActionHandler<'CHANGE_FORM'> = (nextState, state, action) => {
  const check = canChangeForm(nextState, action.playerId, action.targetFormCode);
  if (!check.allowed) {
    return { state, result: { success: false, error: check.reason } };
  }

  const player = getPlayer(nextState, action.playerId)!;
  let nextFormCard = player.availableForms.find((f) => f.code !== player.activeFormCard.code);

  if (action.targetFormCode) {
    nextFormCard = player.availableForms.find((f) => f.code === action.targetFormCode);
  }

  if (!nextFormCard) {
    return { state, result: { success: false, error: 'Could not determine next form' } };
  }

  player.activeFormCard = nextFormCard;
  player.currentForm = nextFormCard.type === CardType.HERO ? 'hero' : 'alter_ego';
  player.basicChangeFormUsedThisRound = true;
  player.formChangedThisRound = true;
  recordBasicAction(nextState, 'changeForm', player.activeFormCard.code);
  dispatchTrigger(nextState, 'FORM_CHANGED', {
    targetPlayerId: player.id,
    targetType: player.currentForm,
    sourceInstanceId: player.activeFormCard.code,
  });

  const onomatopoeia = player.currentForm === 'hero' ? 'SUIT UP!' : 'IDENTITY FLIP!';

  appendLog(nextState, {
    key: 'player.action.changeForm',
    params: {
      actor: player.name,
      form: nextFormCard.name,
    },
    onomatopoeia,
  });

  return { state: nextState, result: { success: true, onomatopoeia } };
};

export const handleBasicRecover: ActionHandler<'BASIC_RECOVER'> = (nextState, state, action) => {
  const check = canBasicRecover(nextState, action.playerId);
  if (!check.allowed) {
    return { state, result: { success: false, error: check.reason } };
  }

  const player = getPlayer(nextState, action.playerId)!;
  const recValue = (player.activeFormCard as AlterEgoCard).recover || 0;
  const maxHp = getEffectiveMaxHealth(player, nextState);
  const healedAmount = Math.min(maxHp - player.health, recValue);

  player.health += healedAmount;
  player.exhausted = true;
  player.recoveryUsedThisRound = true;
  recordBasicAction(nextState, 'alterEgoRecover', player.activeFormCard?.code);

  const onomatopoeia = 'REST & RECOVER!';

  appendLog(nextState, {
    key: 'player.action.recover',
    params: {
      actor: player.name,
      amount: healedAmount,
      health: player.health,
    },
    onomatopoeia,
  });

  appendLog(nextState, {
    category: 'status',
    key: 'card.state.exhausted',
    params: { card: player.activeFormCard.name },
    onomatopoeia: 'EXHAUST',
  });

  return { state: nextState, result: { success: true, onomatopoeia } };
};

export const handleUseCardAbility: ActionHandler<'USE_CARD_ABILITY'> = (
  nextState,
  state,
  action,
) => {
  const player = getPlayer(nextState, action.playerId);
  if (!player) return { state, result: { success: false, error: 'Player not found' } };

  // Find card in all in-play zones or identity (ADR-0055)
  const targetCardInst = findInPlayCardInstance(nextState, action.cardInstanceId);
  const isIdentity = player.activeFormCard.code === action.cardInstanceId;

  const enrichment = isIdentity
    ? player.activeFormCard.enrichment
    : targetCardInst?.card.enrichment;

  if (!enrichment || !enrichment.abilities) {
    return { state, result: { success: false, error: 'Card has no registered abilities' } };
  }

  const ability = enrichment.abilities.find((a) => a.id === action.abilityId);
  if (!ability) {
    return { state, result: { success: false, error: 'Ability not found on card' } };
  }

  // Timing / Form validation
  if (ability.timing.startsWith('HERO_') && player.currentForm !== 'hero') {
    return {
      state,
      result: { success: false, error: 'Can only use this ability in Hero form' },
    };
  }
  if (ability.timing.startsWith('ALTER_EGO_') && player.currentForm !== 'alter_ego') {
    return {
      state,
      result: { success: false, error: 'Can only use this ability in Alter-Ego form' },
    };
  }

  // Limit validation (e.g. ONCE_PER_ROUND, ONCE_PER_PHASE)
  const abilityKey = targetCardInst ? `${targetCardInst.instanceId}_${ability.id}` : ability.id;
  if (
    ability.limit === 'ONCE_PER_ROUND' &&
    (player.usedAbilitiesThisRound?.[abilityKey] || 0) >= 1
  ) {
    return {
      state,
      result: {
        success: false,
        error: `Ability '${ability.id}' has already been used this round (Limit: once per round)`,
      },
    };
  }
  if (
    ability.limit === 'ONCE_PER_PHASE' &&
    (player.usedAbilitiesThisPhase?.[abilityKey] || 0) >= 1
  ) {
    return {
      state,
      result: {
        success: false,
        error: `Ability '${ability.id}' has already been used this phase (Limit: once per phase)`,
      },
    };
  }

  // Resource payment validation: Player must explicitly select payment cards or generators (RR v1.8 p. 25 / ADR-0055)
  if (ability.cost?.resourceCost) {
    const hasPaymentCards = (action.paymentCardInstanceIds?.length || 0) > 0;
    const hasGenerators = (action.generatorInstanceIds?.length || 0) > 0;
    if (!hasPaymentCards && !hasGenerators) {
      return {
        state,
        result: {
          success: false,
          error:
            'Payment cards or resource generators must be selected to satisfy the resource cost.',
        },
      };
    }
  }

  if (ability.cost?.discardCard?.from === 'HAND' && ability.cost.discardCard.mode !== 'RANDOM') {
    const requiredCount = ability.cost.discardCard.count || 1;
    if (!action.discardCardInstanceIds || action.discardCardInstanceIds.length < requiredCount) {
      return {
        state,
        result: {
          success: false,
          error: 'Discard cards must be selected from hand to satisfy the discard cost.',
        },
      };
    }
  }

  // Ability initiation & target validity check (RR v1.8 p. 15-16, 29, 30; Issue #101)
  const initCheck = canInitiateAbility(nextState, action.playerId, ability, targetCardInst, {
    discardCardInstanceIds: action.discardCardInstanceIds,
    paymentCardInstanceIds: action.paymentCardInstanceIds,
    generatorInstanceIds: action.generatorInstanceIds,
    targetInstanceId: action.targetInstanceId,
  });
  if (!initCheck.allowed) {
    return { state, result: { success: false, error: initCheck.reason } };
  }

  // Snapshot pre-cost transient state (tokens, counters) if ability discards self as cost (e.g. Energy Channel 01018)
  const sourceCardSnapshot =
    targetCardInst && ability.cost?.discardSelf
      ? {
          ...targetCardInst,
          tokens: { ...(targetCardInst.tokens || {}) },
          counters: { ...(targetCardInst.counters || {}) },
          activeStatModifiers: [...(targetCardInst.activeStatModifiers || [])],
        }
      : targetCardInst;

  // Execute cost payment
  const { discardedCards, resourcesSpent } = executeAbilityCost(
    nextState,
    player,
    ability,
    targetCardInst,
    {
      discardCardInstanceIds: action.discardCardInstanceIds,
      paymentCardInstanceIds: action.paymentCardInstanceIds,
      generatorInstanceIds: action.generatorInstanceIds,
      targetInstanceId: action.targetInstanceId,
    },
  );

  // Discard on empty counters if Uses counters exhausted (RR v1.8 p. 30)
  if (targetCardInst) {
    checkAndDiscardZeroCounterCard(nextState, player, targetCardInst);
  }

  // The cost results feed the steps' dynamic amounts (`DISCARDED_CARDS`, `RESOURCES_SPENT`).
  const costContext = { discardedCards, resourcesSpent };

  let abilityTargetId = action.targetInstanceId;
  const initial = chooseInitialTarget(
    nextState,
    player,
    [ability],
    targetCardInst,
    abilityTargetId,
  );
  if (initial.kind === 'CHOSEN') {
    abilityTargetId = initial.target.id;
  } else if (initial.kind === 'CHOICES') {
    const sourceName = targetCardInst?.card.name || 'Ability';
    const prompt: PendingDecisionPrompt = {
      promptId: `prompt_ability_target_${nextEngineId(nextState, 'id')}`,
      playerId: action.playerId,
      title: `Choose Target for ${sourceName}`,
      description: `Select target for ${sourceName}:`,
      sourceCardName: sourceName,
      options: targetChoiceOptions(initial.targets, sourceName, 'ABILITY_CHOSEN_TARGET', {
        isAbilityTargetChoice: true,
        ability,
        sourceCardInst: sourceCardSnapshot || targetCardInst,
        abilityKey,
        playerId: action.playerId,
        ...costContext,
      }),
      isVoluntary: false,
    };

    return {
      state: enqueueDecisionPrompt(nextState, prompt),
      result: { success: true, onomatopoeia: 'CHOOSE TARGET!' },
    };
  }

  // Execute effect primitive
  const effectRes = executeEffect(nextState, ability, {
    playerId: action.playerId,
    sourceCardInstance: sourceCardSnapshot || targetCardInst,
    // An identity card has no instance; its code names the source so its ability use is counted
    ...(isIdentity && { sourceCardId: player.activeFormCard.code }),
    chosenTargetInstanceId: abilityTargetId,
    ...costContext,
  });

  if (effectRes.success) {
    if (!player.usedAbilitiesThisRound) player.usedAbilitiesThisRound = {};
    player.usedAbilitiesThisRound[abilityKey] =
      (player.usedAbilitiesThisRound[abilityKey] || 0) + 1;
    if (!player.usedAbilitiesThisPhase) player.usedAbilitiesThisPhase = {};
    player.usedAbilitiesThisPhase[abilityKey] =
      (player.usedAbilitiesThisPhase[abilityKey] || 0) + 1;
  }

  return {
    state: effectRes.state,
    result: {
      success: effectRes.success,
      error: effectRes.error,
      onomatopoeia: effectRes.onomatopoeia || 'ABILITY ACTIVATED!',
    },
  };
};

export const ABILITIES_HANDLERS = {
  CHANGE_FORM: handleChangeForm,
  BASIC_RECOVER: handleBasicRecover,
  USE_CARD_ABILITY: handleUseCardAbility,
};
