import { AllyCard, StatusCard } from '../../models';
import { getPlayer, canAttack, canThwart, HERO_ACTOR } from '../legality-checker';
import {
  getEffectiveHeroStats,
  getEffectiveAllyStats,
  consumeEntityStatusCards,
} from '../stat-calculator';
import { applyDamageToTarget } from '../damage-pipeline';
import { applyThwart } from '../threat-pipeline';
import { recordBasicAction } from '../stats';
import { appendLog } from '../../state/game-log';
import { dispatchTrigger } from '../../triggers/trigger-dispatcher';
import { resolveDefenderDeclaration } from '../combat-pipeline';
import { applyConsequentialDamage } from '../consequential-damage';
import { resolveAttackedVillain } from './shared';
import type { ActionHandler } from './types';

export const handleBasicAttack: ActionHandler<'BASIC_ATTACK'> = (nextState, state, action) => {
  const check = canAttack(
    nextState,
    action.playerId,
    HERO_ACTOR,
    action.targetType,
    action.targetInstanceId,
  );
  if (!check.allowed) {
    return { state, result: { success: false, error: check.reason } };
  }

  const player = getPlayer(nextState, action.playerId)!;
  player.exhausted = true;

  // 1. Stunned Status Replacement Check (RR v1.8 p. 28, taking into account Steady)
  if (consumeEntityStatusCards(player, StatusCard.STUNNED)) {
    const onomatopoeia = 'STUN CLEARED!';
    appendLog(nextState, {
      key: 'status.stunned.cleared',
      params: { actor: player.name },
      onomatopoeia,
    });
    return { state: nextState, result: { success: true, onomatopoeia } };
  }

  recordBasicAction(nextState, 'heroAttack', player.activeFormCard?.code);
  const heroStats = getEffectiveHeroStats(nextState, player);
  const attackDamage = heroStats.attack;

  // 2. Resolve Attack on Target
  if (action.targetType === 'villain') {
    const targetVillain = resolveAttackedVillain(nextState, action.targetInstanceId);
    if (!targetVillain) return { state, result: { success: false, error: 'Villain not found' } };
    const damageRes = applyDamageToTarget(nextState, {
      target: {
        type: 'villain',
        entity: targetVillain,
        name: targetVillain.card?.name || (targetVillain as { name?: string }).name || 'Villain',
        attachments: targetVillain.attachments,
        statusCards: targetVillain.statusCards,
      },
      amount: attackDamage,
      sourceType: 'HERO',
      sourcePlayerId: player.id,
      isAttack: true,
    });

    appendLog(nextState, {
      category: 'status',
      key: 'card.state.exhausted',
      params: { card: player.activeFormCard.name },
      onomatopoeia: 'EXHAUST',
    });

    dispatchTrigger(nextState, 'BASIC_ATTACK_PERFORMED', { targetPlayerId: player.id });
    dispatchTrigger(nextState, 'ATTACK_RESOLVED', {
      targetPlayerId: player.id,
      targetType: 'villain',
      attackSource: { kind: 'HERO', playerId: player.id },
    });

    const onomatopoeia = damageRes.result.onomatopoeia || 'POW!';
    return { state: nextState, result: { success: true, onomatopoeia } };
  }

  if (action.targetType === 'minion' && action.targetInstanceId) {
    const targetMinionPlayer = nextState.players.find((p) =>
      p.engagedMinions.some((m) => m.instanceId === action.targetInstanceId),
    );

    if (!targetMinionPlayer) {
      return { state, result: { success: false, error: 'Minion not found' } };
    }

    const minionIndex = targetMinionPlayer.engagedMinions.findIndex(
      (m) => m.instanceId === action.targetInstanceId,
    );
    const minion = targetMinionPlayer.engagedMinions[minionIndex];

    const damageRes = applyDamageToTarget(nextState, {
      target: {
        type: 'minion',
        entity: minion,
        instanceId: minion.instanceId,
        name: minion.card.name,
        targetPlayerId: targetMinionPlayer.id,
        attachments: minion.attachments,
        statusCards: minion.statusCards,
      },
      amount: attackDamage,
      sourceType: 'HERO',
      sourcePlayerId: player.id,
      isAttack: true,
    });

    appendLog(nextState, {
      category: 'status',
      key: 'card.state.exhausted',
      params: { card: player.activeFormCard.name },
      onomatopoeia: 'EXHAUST',
    });

    dispatchTrigger(nextState, 'BASIC_ATTACK_PERFORMED', { targetPlayerId: player.id });
    dispatchTrigger(nextState, 'ATTACK_RESOLVED', {
      targetPlayerId: player.id,
      targetType: 'minion',
      targetInstanceId: action.targetInstanceId,
      attackSource: { kind: 'HERO', playerId: player.id },
    });

    const onomatopoeia = damageRes.result.onomatopoeia || 'POW!';
    return { state: nextState, result: { success: true, onomatopoeia } };
  }

  return { state: nextState, result: { success: true } };
};

export const handleAllyAttack: ActionHandler<'ALLY_ATTACK'> = (nextState, state, action) => {
  const check = canAttack(
    nextState,
    action.playerId,
    { kind: 'ally', instanceId: action.allyInstanceId },
    action.targetType,
    action.targetInstanceId,
  );
  if (!check.allowed) {
    return { state, result: { success: false, error: check.reason } };
  }

  const player = getPlayer(nextState, action.playerId)!;
  const allyIdx = player.allies.findIndex((a) => a.instanceId === action.allyInstanceId);
  const ally = player.allies[allyIdx];
  ally.exhausted = true;
  recordBasicAction(nextState, 'allyAttack', ally.card.code);
  const allyCard = ally.card as AllyCard;
  const allyStats = getEffectiveAllyStats(nextState, ally);
  const attackDmg = allyStats.attack;

  appendLog(nextState, {
    key: 'player.action.allyAttack',
    params: {
      actor: player.name,
      card: allyCard.name,
      amount: attackDmg,
      target: action.targetType,
    },
    onomatopoeia: 'ALLY ATTACK!',
  });

  appendLog(nextState, {
    category: 'status',
    key: 'card.state.exhausted',
    params: { card: allyCard.name },
    onomatopoeia: 'EXHAUST',
  });

  // Deal damage to target
  if (action.targetType === 'villain') {
    const targetVillain = resolveAttackedVillain(nextState, action.targetInstanceId);
    if (!targetVillain) return { state, result: { success: false, error: 'Villain not found' } };
    applyDamageToTarget(nextState, {
      target: {
        type: 'villain',
        entity: targetVillain,
        name: targetVillain.card?.name || (targetVillain as { name?: string }).name || 'Villain',
        attachments: targetVillain.attachments,
        statusCards: targetVillain.statusCards,
      },
      amount: attackDmg,
      sourceType: 'ALLY',
      sourceCardInstance: ally,
      sourcePlayerId: player.id,
      isAttack: true,
    });
  } else if (action.targetType === 'minion' && action.targetInstanceId) {
    const targetMinionPlayer = nextState.players.find((p) =>
      p.engagedMinions.some((m) => m.instanceId === action.targetInstanceId),
    );

    if (targetMinionPlayer) {
      const minionIndex = targetMinionPlayer.engagedMinions.findIndex(
        (m) => m.instanceId === action.targetInstanceId,
      );
      const minion = targetMinionPlayer.engagedMinions[minionIndex];

      applyDamageToTarget(nextState, {
        target: {
          type: 'minion',
          entity: minion,
          instanceId: minion.instanceId,
          name: minion.card.name,
          targetPlayerId: targetMinionPlayer.id,
          attachments: minion.attachments,
          statusCards: minion.statusCards,
        },
        amount: attackDmg,
        sourceType: 'ALLY',
        sourceCardInstance: ally,
        sourcePlayerId: player.id,
        isAttack: true,
      });
    }
  }

  dispatchTrigger(nextState, 'ATTACK_RESOLVED', {
    targetPlayerId: player.id,
    targetType: action.targetType,
    targetInstanceId: action.targetInstanceId,
    sourceInstanceId: action.allyInstanceId,
    sourceCardCode: ally.card.code,
    attackerCard: ally,
    attackSource: { kind: 'ALLY', playerId: player.id, instanceId: ally.instanceId },
  });

  // Consequential damage to ally per RR v1.8 (after resolving abilities triggered by the ally attacking)
  const consequential = allyCard.attackCost ?? 1;
  applyConsequentialDamage(nextState, player.id, ally.instanceId, consequential);

  const onomatopoeia = 'ALLY ATTACK!';
  return { state: nextState, result: { success: true, onomatopoeia } };
};

export const handleAllyThwart: ActionHandler<'ALLY_THWART'> = (nextState, state, action) => {
  const check = canThwart(
    nextState,
    action.playerId,
    { kind: 'ally', instanceId: action.allyInstanceId },
    action.targetType,
    action.targetInstanceId,
  );
  if (!check.allowed) {
    return { state, result: { success: false, error: check.reason } };
  }

  const player = getPlayer(nextState, action.playerId)!;
  const allyIdx = player.allies.findIndex((a) => a.instanceId === action.allyInstanceId);
  const ally = player.allies[allyIdx];

  ally.exhausted = true;
  recordBasicAction(nextState, 'allyThwart', ally.card.code);
  const allyCard = ally.card as AllyCard;
  const allyStats = getEffectiveAllyStats(nextState, ally);
  const thwValue = allyStats.thwart;

  const thwartRes = applyThwart(nextState, {
    thwarterType: 'ALLY',
    thwarterEntity: ally,
    playerId: player.id,
    targetType: action.targetType,
    targetInstanceId: action.targetInstanceId,
    thwartValue: thwValue,
  });

  appendLog(nextState, {
    category: 'status',
    key: 'card.state.exhausted',
    params: { card: allyCard.name },
    onomatopoeia: 'EXHAUST',
  });

  // Consequential damage to ally per RR v1.8 (after resolving abilities triggered by the ally thwarting)
  const consequential = allyCard.thwartCost ?? 1;
  applyConsequentialDamage(nextState, player.id, ally.instanceId, consequential);

  const onomatopoeia = thwartRes.result.onomatopoeia || 'ALLY THWART!';
  return { state: nextState, result: { success: true, onomatopoeia } };
};

export const handleBasicThwart: ActionHandler<'BASIC_THWART'> = (nextState, state, action) => {
  const check = canThwart(
    nextState,
    action.playerId,
    HERO_ACTOR,
    action.targetType,
    action.targetInstanceId,
  );
  if (!check.allowed) {
    return { state, result: { success: false, error: check.reason } };
  }

  const player = getPlayer(nextState, action.playerId)!;
  player.exhausted = true;
  recordBasicAction(nextState, 'heroThwart', player.activeFormCard?.code);

  const heroStats = getEffectiveHeroStats(nextState, player);
  const thwartValue = heroStats.thwart;

  const thwartRes = applyThwart(nextState, {
    thwarterType: 'HERO',
    thwarterEntity: player,
    playerId: player.id,
    targetType: action.targetType,
    targetInstanceId: action.targetInstanceId,
    thwartValue,
  });

  appendLog(nextState, {
    category: 'status',
    key: 'card.state.exhausted',
    params: { card: player.activeFormCard.name },
    onomatopoeia: 'EXHAUST',
  });

  const onomatopoeia = thwartRes.result.onomatopoeia || 'FOILED!';
  return { state: nextState, result: { success: true, onomatopoeia } };
};

export const handleDeclareDefender: ActionHandler<'DECLARE_DEFENDER'> = (
  nextState,
  state,
  action,
) => {
  const player = getPlayer(nextState, action.playerId);
  if (!player) return { state, result: { success: false, error: 'Player not found' } };

  if (action.defenderType === 'HERO') {
    recordBasicAction(nextState, 'heroDefense', player.activeFormCard?.code);
  }

  const updatedState = resolveDefenderDeclaration(nextState, {
    type: action.defenderType,
    playerId: action.playerId,
    allyInstanceId: action.allyInstanceId,
  });

  return {
    state: updatedState,
    result: { success: true, onomatopoeia: 'DEFENSE RESOLVED!' },
  };
};

export const COMBAT_HANDLERS = {
  BASIC_ATTACK: handleBasicAttack,
  ALLY_ATTACK: handleAllyAttack,
  BASIC_THWART: handleBasicThwart,
  ALLY_THWART: handleAllyThwart,
  DECLARE_DEFENDER: handleDeclareDefender,
};
