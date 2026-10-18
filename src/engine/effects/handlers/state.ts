/** Statuses, exhaustion, counters, traits, stats and form (step handlers, AUD-20261017-232534 F010-A). */
import {
  GameState,
  CardInstance,
  StatusCard,
  AbilityStep,
  CardType,
  PlayerState,
  VillainState,
  getActiveVillain,
} from '@engine/models';
import { getStepEffectParams } from '../../../data/supplemental/runtime';
import { enqueueDecisionPrompt } from '../../pipeline/prompt-queue';
import { hasEntityKeyword } from '../../pipeline/stat-calculator';
import { dispatchTrigger } from '../../triggers/trigger-dispatcher';
import { nextEngineId } from '../../state/rng';
import {
  resolveTargets,
  resolveCharacterTargets,
  resolveEntityByInstanceId,
  type EffectContext,
} from '../target-resolver';
import { checkAndDiscardZeroCounterCard } from '../../pipeline/cost-engine';
import { appendLog } from '../../state/game-log';
import {
  EffectExecutionContext,
  EffectResult,
  filterResolvedTargets,
  resolveNumericAmount,
} from '../index';
import type { StepHandler } from './types';
import type { EffectType } from '../../../data/supplemental/runtime';

function handleAddStatus(
  state: GameState,
  step: AbilityStep,
  context: EffectExecutionContext,
  player: PlayerState,
): EffectResult {
  let status: StatusCard = StatusCard.STUNNED;
  const statusParam = step.effectParams?.status;
  if (statusParam === 'TOUGH' || statusParam === StatusCard.TOUGH) status = StatusCard.TOUGH;
  if (statusParam === 'CONFUSED' || statusParam === StatusCard.CONFUSED)
    status = StatusCard.CONFUSED;
  if (statusParam === 'STUNNED' || statusParam === StatusCard.STUNNED) status = StatusCard.STUNNED;

  let mutatedState = false;
  let alreadyHadStatus = false;
  let isImmune = false;

  // Helper to apply status to a target entity considering Stalwart and Steady
  const applyStatusToEntity = (entity: any) => {
    if (!entity) return;
    if (!entity.statusCards) entity.statusCards = [];

    // Stalwart check (RR v1.8 p. 28)
    if (
      (status === StatusCard.STUNNED || status === StatusCard.CONFUSED) &&
      hasEntityKeyword(entity, 'Stalwart')
    ) {
      isImmune = true;
      return;
    }

    // Steady check (RR v1.8 p. 28)
    const isSteady = hasEntityKeyword(entity, 'Steady');
    const maxLimit =
      isSteady && (status === StatusCard.STUNNED || status === StatusCard.CONFUSED) ? 2 : 1;
    const currentCount = entity.statusCards.filter((s: StatusCard) => s === status).length;

    if (currentCount < maxLimit) {
      entity.statusCards.push(status);
      mutatedState = true;
    } else {
      alreadyHadStatus = true;
    }
  };

  const targetParam = (step.effectParams?.target as string) || 'VILLAIN';
  const targetContext: EffectContext = {
    ...context,
    chosenTargetInstanceId:
      (step.effectParams?.targetInstanceId as string) || context.chosenTargetInstanceId,
  };
  const targetCharacters = resolveCharacterTargets(state, targetParam as any, targetContext);
  for (const targetChar of targetCharacters) {
    applyStatusToEntity(targetChar.entity);
  }

  // Nothing to apply the status to (e.g. the damaged ally has left play): no effect, no log.
  if (targetCharacters.length === 0) {
    return {
      state,
      success: true,
      mutatedState: false,
      value: 0,
      facts: {
        statusApplied: false,
        alreadyHadStatus: false,
      },
    };
  }

  const firstTarget = targetCharacters[0];
  let targetName: string =
    targetParam === 'VILLAIN'
      ? getActiveVillain(state).card.name
      : String(targetParam || 'Villain');
  if (firstTarget) {
    if (firstTarget.entityType === 'villain') {
      targetName = getActiveVillain(state).card.name;
    } else if (firstTarget.entityType === 'hero' || firstTarget.entityType === 'alter_ego') {
      const p = firstTarget.entity as PlayerState;
      targetName = p.hero?.name || p.name;
    } else if ('card' in firstTarget.entity) {
      targetName = (firstTarget.entity as CardInstance).card.name;
    }
  }

  const sourceCardName = context.sourceCardInstance?.card.name;
  const actorName = sourceCardName || player.hero?.name || player.name;
  const actorType =
    context.sourceCardInstance?.card.type === CardType.ALLY
      ? 'ally'
      : context.sourceCardInstance?.card.type === CardType.MINION
        ? 'minion'
        : player.currentForm === 'hero'
          ? 'hero'
          : 'alter_ego';

  const onomatopoeia = isImmune
    ? 'IMMUNE! (STALWART)'
    : mutatedState
      ? status === StatusCard.STUNNED
        ? 'STUNNED!'
        : status === StatusCard.CONFUSED
          ? 'CONFUSED!'
          : 'TOUGH!'
      : `${status} ALREADY APPLIED!`;

  appendLog(state, {
    actor: {
      name: actorName,
      type: actorType,
    },
    key: 'card.effect.addStatus',
    params: {
      who: actorName,
      card: sourceCardName || 'Card',
      status,
      target: targetName,
      who_is_taking_damage: targetName,
      mutatedState,
      alreadyHadStatus,
      isImmune,
    },
    onomatopoeia,
  });

  return {
    state,
    success: true,
    mutatedState,
    value: mutatedState ? 1 : 0,
    facts: {
      statusApplied: mutatedState,
      statusAdded: mutatedState,
      alreadyHadStatus,
    },
    onomatopoeia,
  };
}

function handleRemoveStatus(
  state: GameState,
  step: AbilityStep,
  context: EffectExecutionContext,
  player: PlayerState,
): EffectResult {
  const requestedStatus = String(step.effectParams?.status || 'ALL');
  const normalizedStatus =
    requestedStatus === 'STUNNED'
      ? StatusCard.STUNNED
      : requestedStatus === 'CONFUSED'
        ? StatusCard.CONFUSED
        : requestedStatus === 'TOUGH'
          ? StatusCard.TOUGH
          : requestedStatus;
  const statuses =
    normalizedStatus === 'ALL'
      ? [StatusCard.STUNNED, StatusCard.CONFUSED, StatusCard.TOUGH]
      : [normalizedStatus as StatusCard];
  const target = String(step.effectParams?.target || 'VILLAIN');
  const targetPlayer =
    state.players.find((candidate) => candidate.id === context.targetPlayerId) || player;
  const targets: any[] = [];
  const resolved = resolveTargets(state, target as any, context);
  for (const r of resolved) {
    targets.push(r.entity);
  }
  if (targets.length === 0 && context.chosenTargetInstanceId) {
    const fallback = resolveEntityByInstanceId(state, context.chosenTargetInstanceId);
    if (fallback) targets.push(fallback.entity);
  }

  let removedCount = 0;
  for (const entity of targets) {
    if (!Array.isArray(entity?.statusCards)) continue;
    const removedStatuses = statuses.filter((status) => entity.statusCards.includes(status));
    const before = entity.statusCards.length;
    entity.statusCards = entity.statusCards.filter(
      (status: StatusCard) => !statuses.includes(status),
    );
    if (removedStatuses.length > 0) {
      removedCount += before - entity.statusCards.length;
      for (const status of removedStatuses) {
        dispatchTrigger(state, 'STATUS_REMOVED', {
          targetPlayerId: targetPlayer.id,
          targetInstanceId: entity.instanceId,
          status,
        });
      }
    }
  }

  return {
    state,
    success: true,
    mutatedState: removedCount > 0,
    value: removedCount,
    facts: {
      statusRemoved: removedCount > 0,
    },
    onomatopoeia: removedCount > 0 ? 'STATUS REMOVED!' : 'NO STATUS TO REMOVE',
  };
}

function handleAddTrait(
  state: GameState,
  step: AbilityStep,
  context: EffectExecutionContext,
  player: PlayerState,
): EffectResult {
  // A CONSTANT ADD_TRAIT is evaluated by the stat calculator. As an effect step it grants the
  // trait to the resolving player's identity for `duration`, or while the source card stays
  // in play when no duration is given (#131).
  const stepParams = getStepEffectParams(step);
  const trait = (stepParams.trait as string | undefined)?.trim();
  if (!trait) return { state, success: false, error: 'ADD_TRAIT requires a trait' };
  const targetParam = (stepParams.target as string) || 'SELF_IDENTITY';
  if (targetParam !== 'SELF_IDENTITY') {
    return {
      state,
      success: false,
      error: `ADD_TRAIT as an effect step supports target SELF_IDENTITY only (got ${targetParam})`,
    };
  }
  const duration = stepParams.duration as 'PHASE' | 'ROUND' | 'TURN' | undefined;
  const sourceInstanceId = context.sourceCardInstance?.instanceId;
  if (!player.activeTraitModifiers) player.activeTraitModifiers = [];
  const alreadyGranted = player.activeTraitModifiers.some(
    (m) => m.trait === trait && m.duration === duration && m.sourceInstanceId === sourceInstanceId,
  );
  if (!alreadyGranted) {
    player.activeTraitModifiers.push({
      trait,
      duration,
      sourceInstanceId,
      sourceCardName: context.sourceCardInstance?.card.name,
      sourceCardCode: context.sourceCardInstance?.card.code,
    });
  }
  appendLog(state, {
    category: 'status',
    key: 'card.effect.addTrait',
    params: { player: player.name, trait, duration: duration ?? 'WHILE_SOURCE_IN_PLAY' },
    onomatopoeia: 'POWER UP!',
  });
  return { state, success: true, mutatedState: true, onomatopoeia: 'POWER UP!' };
}

function handleModifyStat(
  state: GameState,
  step: AbilityStep,
  context: EffectExecutionContext,
  player: PlayerState,
): EffectResult {
  const stepParams = getStepEffectParams(step);
  const targetParam =
    (stepParams.target as string) || (step.effectParams?.target as string) || 'SELF';
  const duration =
    (stepParams.duration as 'PHASE' | 'ROUND') ||
    (step.effectParams?.duration as 'PHASE' | 'ROUND') ||
    'PHASE';
  const sourceCardName =
    context.sourceCardInstance?.card.name || player.activeFormCard?.name || 'Stat Modifier';
  const sourceCardCode = context.sourceCardInstance?.card.code;

  if (
    targetParam === 'ALL_CONTROLLED_CHARACTERS' ||
    stepParams.atkBonus !== undefined ||
    stepParams.thwBonus !== undefined
  ) {
    const atkBonus =
      (stepParams.atkBonus as number) ||
      (step.effectParams?.atkBonus as number) ||
      (stepParams.stat === 'ATTACK'
        ? resolveNumericAmount(stepParams.amount, context, 0, { state, player })
        : 0) ||
      0;
    const thwBonus =
      (stepParams.thwBonus as number) ||
      (step.effectParams?.thwBonus as number) ||
      (stepParams.stat === 'THWART'
        ? resolveNumericAmount(stepParams.amount, context, 0, { state, player })
        : 0) ||
      0;

    // "Choose a player": the characters that player controls get the bonus
    const chosenPlayerId =
      (stepParams.targetPlayerId as string) ||
      context.targetPlayerId ||
      (stepParams.targetPlayer === 'CHOSEN_PLAYER' && state.players.length > 1
        ? undefined
        : player.id);
    if (!chosenPlayerId) {
      const promptId = `prompt_${nextEngineId(state, 'id')}_choose_player`;
      state = enqueueDecisionPrompt(state, {
        promptId,
        playerId: player.id,
        title: 'Choose a Player',
        description: 'Choose a player. Each character that player controls gets the bonus:',
        sourceCardName,
        sourceCardCode,
        options: state.players.map((p) => ({
          id: `modify_stat_${p.id}`,
          label: `${p.name} (${p.hero?.name || 'Hero'})`,
          description: `+${atkBonus} ATK / +${thwBonus} THW to ${p.name}'s hero and ${p.allies.length} ally(ies)`,
          effect: 'MODIFY_STAT',
          params: { ...stepParams, targetPlayerId: p.id },
        })),
      });
      appendLog(state, {
        category: 'ability',
        key: 'decision.prompt.opened',
        params: { player: player.name, promptId, source: sourceCardName },
        onomatopoeia: 'CHOOSE PLAYER!',
      });
      return { state, success: true, onomatopoeia: 'CHOOSE PLAYER!' };
    }
    const recipient = state.players.find((p) => p.id === chosenPlayerId) || player;

    const pushBonuses = (mods: { stat: 'ATTACK' | 'THWART'; amount: number }[], into: any) => {
      if (!into.activeStatModifiers) into.activeStatModifiers = [];
      for (const m of mods) {
        into.activeStatModifiers.push({ ...m, duration, sourceCardName, sourceCardCode });
      }
    };
    const mods: { stat: 'ATTACK' | 'THWART'; amount: number }[] = [];
    if (atkBonus) mods.push({ stat: 'ATTACK', amount: atkBonus });
    if (thwBonus) mods.push({ stat: 'THWART', amount: thwBonus });

    // The recipient's identity (hero or alter-ego) and allies
    pushBonuses(mods, recipient);
    for (const a of recipient.allies) pushBonuses(mods, a);

    return {
      state,
      success: true,
      mutatedState: true,
      onomatopoeia: `+${atkBonus} ATK / +${thwBonus} THW TO ${recipient.name.toUpperCase()}'S CHARACTERS!`,
    };
  }

  if (
    targetParam === 'SELF' ||
    targetParam === 'TRIGGERING_HERO' ||
    targetParam === 'CHOSEN_CHARACTER' ||
    targetParam === 'CHOSEN_ALLY'
  ) {
    const stat = (stepParams.stat as any) || (step.effectParams?.stat as any) || 'ATTACK';
    const amount = (stepParams.amount as number) || (step.effectParams?.amount as number) || 1;

    // Resolve target card instance
    let targetCard = context.sourceCardInstance;
    if (!targetCard && context.sourceCardId) {
      targetCard =
        player.allies.find(
          (a) => a.instanceId === context.sourceCardId || a.card.code === context.sourceCardId,
        ) ||
        player.tableau.find(
          (t) => t.instanceId === context.sourceCardId || t.card.code === context.sourceCardId,
        );
    }

    if (targetCard) {
      if (!targetCard.activeStatModifiers) targetCard.activeStatModifiers = [];
      targetCard.activeStatModifiers.push({
        stat,
        amount,
        duration,
        sourceCardName,
        sourceCardCode,
      });

      return {
        state,
        success: true,
        mutatedState: true,
        onomatopoeia: `+${amount} ${stat}!`,
      };
    } else {
      // If target is player/hero identity
      if (!player.activeStatModifiers) player.activeStatModifiers = [];
      player.activeStatModifiers.push({
        stat,
        amount,
        duration,
        sourceCardName,
        sourceCardCode,
      });

      return {
        state,
        success: true,
        mutatedState: true,
        onomatopoeia: `+${amount} ${stat}!`,
      };
    }
  }

  // These are declarative constant/trigger primitives evaluated dynamically by stat-calculator and combat pipelines
  return { state, success: true };
}

function handleReady(
  state: GameState,
  step: AbilityStep,
  context: EffectExecutionContext,
  player: PlayerState,
): EffectResult {
  const targetParam = (step.effectParams?.target as string) || 'SELF_IDENTITY';

  const readyFilter = step.effectParams?.filter as Record<string, any> | undefined;
  const targets = filterResolvedTargets(
    state,
    resolveTargets(state, targetParam as any, context),
    readyFilter,
    player,
  );
  if (targets.length === 0) {
    // No target is a no-op, never an identity fallback
    return { state, success: true, mutatedState: false, onomatopoeia: 'NOTHING TO READY' };
  }
  const names: string[] = [];
  for (const t of targets) {
    if (t.kind === 'character') {
      if (t.entityType === 'hero' || t.entityType === 'alter_ego') {
        (t.entity as PlayerState).exhausted = false;
        names.push(
          (t.entity as PlayerState).activeFormCard?.name || (t.entity as PlayerState).name,
        );
      } else if (t.entityType === 'villain') {
        (t.entity as VillainState).exhausted = false;
        names.push((t.entity as VillainState).card?.name || 'Villain');
      } else {
        (t.entity as CardInstance).exhausted = false;
        names.push((t.entity as CardInstance).card?.name || 'Character');
      }
    } else if (t.kind === 'card') {
      t.entity.exhausted = false;
      names.push(t.entity.card?.name || 'Card');
    } else if (t.kind === 'player') {
      t.entity.exhausted = false;
      names.push(t.entity.activeFormCard?.name || t.entity.name);
    }
  }
  const readyTargetName = names.join(', ');

  appendLog(state, {
    category: 'ability',
    key: 'card.effect.readyCharacter',
    params: { player: player.name, target: readyTargetName },
    onomatopoeia: 'READY!',
  });
  return {
    state,
    success: true,
    mutatedState: true,
    onomatopoeia: 'READY!',
  };
}

function handleExhaust(
  state: GameState,
  step: AbilityStep,
  context: EffectExecutionContext,
  player: PlayerState,
): EffectResult {
  const targetParam = (step.effectParams?.target as string) || 'SELF_IDENTITY';
  let exhaustTargetName = player.name;

  const exhaustFilter = step.effectParams?.filter as Record<string, any> | undefined;
  const targets = filterResolvedTargets(
    state,
    resolveTargets(state, targetParam as any, context),
    exhaustFilter,
    player,
  );
  if (targets.length === 0 && exhaustFilter) {
    // A filter that matches nothing is a no-op, never an identity fallback
    return { state, success: true, mutatedState: false, onomatopoeia: 'NOTHING TO EXHAUST' };
  }
  if (targets.length === 0) {
    player.exhausted = true;
    exhaustTargetName = player.activeFormCard?.name || player.name;
  } else {
    const names: string[] = [];
    for (const t of targets) {
      if (t.kind === 'character') {
        if (t.entityType === 'hero' || t.entityType === 'alter_ego') {
          (t.entity as PlayerState).exhausted = true;
          names.push(
            (t.entity as PlayerState).activeFormCard?.name || (t.entity as PlayerState).name,
          );
        } else if (t.entityType === 'villain') {
          (t.entity as VillainState).exhausted = true;
          names.push((t.entity as VillainState).card?.name || 'Villain');
        } else {
          (t.entity as CardInstance).exhausted = true;
          names.push((t.entity as CardInstance).card?.name || 'Character');
        }
      } else if (t.kind === 'card') {
        t.entity.exhausted = true;
        names.push(t.entity.card?.name || 'Card');
      } else if (t.kind === 'player') {
        t.entity.exhausted = true;
        names.push(t.entity.activeFormCard?.name || t.entity.name);
      }
    }
    exhaustTargetName = names.join(', ') || player.name;
  }

  appendLog(state, {
    category: 'status',
    key: 'card.state.exhausted',
    params: { card: exhaustTargetName, player: player.name },
    onomatopoeia: 'EXHAUST',
  });
  return {
    state,
    success: true,
    mutatedState: true,
    onomatopoeia: 'EXHAUSTED!',
  };
}

function handleFlipForm(
  state: GameState,
  step: AbilityStep,
  context: EffectExecutionContext,
  player: PlayerState,
): EffectResult {
  const nextFormCard = player.availableForms.find((f) => f.code !== player.activeFormCard.code);
  const requestedForm = (step.effectParams?.form as string | undefined)
    ?.toLowerCase()
    .replace('-', '_');
  // A requested form the identity is already in is a no-op (e.g. "you may flip to alter-ego form")
  if (requestedForm && requestedForm === player.currentForm) {
    return { state, success: true, mutatedState: false, value: 0 };
  }
  // Optional flip: offer a voluntary choice instead of flipping immediately
  if (step.effectParams?.optional && nextFormCard) {
    enqueueDecisionPrompt(state, {
      promptId: nextEngineId(state, 'prompt_optional_flip'),
      playerId: context.playerId || player.id,
      title: `Flip to ${nextFormCard.name}?`,
      description: `You may flip to ${nextFormCard.name}.`,
      sourceCardName: context.sourceCardInstance?.card.name || 'Card Ability',
      sourceCardCode: context.sourceCardInstance?.card.code,
      sourceCardInstanceId: context.sourceCardInstance?.instanceId,
      isVoluntary: true,
      options: [
        {
          id: 'flip',
          label: `Flip to ${nextFormCard.name}`,
          description: `Change to ${nextFormCard.name}.`,
          effect: 'CHANGE_FORM',
          params: { form: requestedForm },
        },
      ],
    });
    return { state, success: true, mutatedState: false, onomatopoeia: 'FLIP OPTIONAL!' };
  }
  if (nextFormCard) {
    player.activeFormCard = nextFormCard;
    player.currentForm = nextFormCard.type === CardType.HERO ? 'hero' : 'alter_ego';
  }
  const onomatopoeia = 'FLIP FORM!';
  appendLog(state, {
    key: 'card.effect.flipForm',
    params: { player: player.name, form: player.activeFormCard.name },
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

function handleAddCounters(
  state: GameState,
  step: AbilityStep,
  context: EffectExecutionContext,
  player: PlayerState,
): EffectResult {
  const targetParam = (step.effectParams?.target as string) || 'SELF';
  const counterType = (step.effectParams?.counterType as string) || 'all_purpose';
  const amount = resolveNumericAmount(step.effectParams?.amount, context, 1, { state, player });

  if (targetParam === 'IDENTITY') {
    player.counters = player.counters || {};
    player.counters[counterType] = (player.counters[counterType] || 0) + amount;
  } else if (context.sourceCardInstance) {
    context.sourceCardInstance.counters = context.sourceCardInstance.counters || {};
    context.sourceCardInstance.counters[counterType] =
      (context.sourceCardInstance.counters[counterType] || 0) + amount;
    if (!context.sourceCardInstance.tokens) {
      context.sourceCardInstance.tokens = {
        damage: 0,
        threat: 0,
        counters: 0,
      };
    }
    context.sourceCardInstance.tokens.counters =
      (context.sourceCardInstance.tokens.counters || 0) + amount;
  }
  return {
    state,
    success: true,
    mutatedState: true,
    value: amount,
    onomatopoeia: `+${amount} ${counterType.toUpperCase()} COUNTERS!`,
  };
}

function handleSpendCounters(
  state: GameState,
  step: AbilityStep,
  context: EffectExecutionContext,
  player: PlayerState,
): EffectResult {
  const targetParam = (step.effectParams?.target as string) || 'SELF';
  const counterType = (step.effectParams?.counterType as string) || 'all_purpose';
  const amount = resolveNumericAmount(step.effectParams?.amount, context, 1, { state, player });

  if (targetParam === 'IDENTITY') {
    player.counters = player.counters || {};
    const current = player.counters[counterType] || 0;
    player.counters[counterType] = Math.max(0, current - amount);
  } else if (context.sourceCardInstance) {
    context.sourceCardInstance.counters = context.sourceCardInstance.counters || {};
    const current =
      context.sourceCardInstance.counters[counterType] ??
      context.sourceCardInstance.tokens?.counters ??
      0;
    context.sourceCardInstance.counters[counterType] = Math.max(0, current - amount);
    if (context.sourceCardInstance.tokens) {
      context.sourceCardInstance.tokens.counters = Math.max(
        0,
        (context.sourceCardInstance.tokens.counters || 0) - amount,
      );
    }

    // Check and discard if Uses counters reached 0 per RR v1.8 p. 30
    checkAndDiscardZeroCounterCard(state, player, context.sourceCardInstance, counterType);
  }
  return {
    state,
    success: true,
    mutatedState: true,
    value: amount,
    onomatopoeia: `-${amount} ${counterType.toUpperCase()} COUNTERS!`,
  };
}

function handleRemoveCountersMatchingFilter(
  state: GameState,
  step: AbilityStep,
  _context: EffectExecutionContext,
  player: PlayerState,
): EffectResult {
  const targetZone = (step.effectParams?.targetZone as string) || 'TABLEAU';
  const traitFilter = step.effectParams?.traitFilter as string | undefined;
  const counterType = step.effectParams?.counterType as string | undefined;
  const amountParam = step.effectParams?.amount;

  let targetCards: CardInstance[] = [];
  if (targetZone === 'TABLEAU' || targetZone === 'ALL_CONTROLLED') {
    targetCards = [...player.tableau, ...player.allies];
  }

  if (traitFilter) {
    targetCards = targetCards.filter((c) =>
      (c.card.traits || []).some(
        (t) => t.toLowerCase().trim() === traitFilter.toLowerCase().trim(),
      ),
    );
  }

  let totalRemoved = 0;
  for (const cardInst of targetCards) {
    if (cardInst.counters) {
      for (const [k, count] of Object.entries(cardInst.counters)) {
        if (
          !counterType ||
          counterType === 'ALL' ||
          counterType.toLowerCase() === k.toLowerCase()
        ) {
          if (amountParam === 'ALL') {
            totalRemoved += count;
            cardInst.counters[k] = 0;
          } else if (typeof amountParam === 'number') {
            const toRemove = Math.min(count, amountParam);
            totalRemoved += toRemove;
            cardInst.counters[k] = count - toRemove;
          }
        }
      }
    }
    if (cardInst.tokens?.counters) {
      if (amountParam === 'ALL') {
        totalRemoved += cardInst.tokens.counters;
        cardInst.tokens.counters = 0;
      } else if (typeof amountParam === 'number') {
        const toRemove = Math.min(cardInst.tokens.counters, amountParam);
        totalRemoved += toRemove;
        cardInst.tokens.counters -= toRemove;
      }
    }
    checkAndDiscardZeroCounterCard(state, player, cardInst, counterType);
  }

  return {
    state,
    success: true,
    mutatedState: totalRemoved > 0,
    value: totalRemoved,
    onomatopoeia: `PURGED ${totalRemoved} COUNTERS!`,
  };
}

export const STATE_HANDLERS = {
  ADD_STATUS: handleAddStatus,
  REMOVE_STATUS: handleRemoveStatus,
  ADD_TRAIT: handleAddTrait,
  MODIFY_STAT: handleModifyStat,
  READY: handleReady,
  EXHAUST: handleExhaust,
  FLIP_FORM: handleFlipForm,
  CHANGE_FORM: handleFlipForm,
  ADD_COUNTERS: handleAddCounters,
  SPEND_COUNTERS: handleSpendCounters,
  REMOVE_COUNTERS: handleSpendCounters,
  REMOVE_COUNTERS_MATCHING_FILTER: handleRemoveCountersMatchingFilter,
} satisfies Partial<Record<EffectType, StepHandler>>;
