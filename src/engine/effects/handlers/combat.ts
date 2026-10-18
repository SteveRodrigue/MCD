/** Attacks, schemes, defenders and boosts (step handlers, AUD-20261017-232534 F010-A). */
import { GameState, AbilityStep, PlayerState, getVillainsInPlay } from '@engine/models';
import {
  executeVillainAttackAgainstPlayer,
  executeVillainSchemeAgainstPlayer,
  executeMinionAttackAgainstPlayer,
} from '../../pipeline/villain-phase';
import { drawEncounterCard } from '../../pipeline/deck-exhaustion';
import { beginEnemyAttack, resolveDefenderDeclaration } from '../../pipeline/combat-pipeline';
import { recordBasicAction } from '../../pipeline/stats';
import { appendLog } from '../../state/game-log';
import { EffectExecutionContext, EffectResult, attackOutcome } from '../index';
import type { StepHandler } from './types';
import type { EffectType } from '../../../data/supplemental/runtime';

function handleGrantAttackKeyword(
  state: GameState,
  step: AbilityStep,
  context: EffectExecutionContext,
  _player: PlayerState,
): EffectResult {
  // "This attack gains <keyword>": kept on the running ability's context, so it ends with it.
  const keyword = step.effectParams?.keyword as string | undefined;
  if (!keyword) {
    return {
      state,
      success: false,
      error: 'GRANT_ATTACK_KEYWORD requires effectParams.keyword',
    };
  }
  context.grantedAttackKeywords = [...(context.grantedAttackKeywords ?? []), keyword];
  return { state, success: true };
}

function handleCancelAttack(
  state: GameState,
  _step: AbilityStep,
  context: EffectExecutionContext,
  _player: PlayerState,
): EffectResult {
  if (state.activeAttackContext) {
    (state.activeAttackContext as any).isCancelled = true;
  }
  (context as any).attackCancelled = true;
  const cancelledBy = context.sourceCardInstance?.card.name || 'Ability';
  appendLog(state, {
    category: 'combat',
    key: 'combat.attack.cancelled',
    params: {
      cancelledBy,
    },
    onomatopoeia: 'ATTACK CANCELLED!',
  });
  return {
    state,
    success: true,
    mutatedState: true,
    onomatopoeia: 'ATTACK CANCELLED!',
  };
}

function handleGiveAdditionalBoostCard(
  state: GameState,
  _step: AbilityStep,
  _context: EffectExecutionContext,
  _player: PlayerState,
): EffectResult {
  // Adds a card to the boost queue of the running activation: an attack or a scheme.
  const boostResolution = state.activeBoostResolution;
  if (boostResolution) {
    const extraCard = drawEncounterCard(state);
    if (extraCard) {
      boostResolution.queue.push(extraCard);
      appendLog(state, {
        category: state.activeAttackContext ? 'combat' : 'scheme',
        key: 'villain.boost.added',
        params: { card: extraCard.card.name },
        onomatopoeia: 'CHAIN BOOST ADDED!',
      });
    }
  }
  return { state, success: true, onomatopoeia: 'CHAIN BOOST ADDED!' };
}

function handleDeclareDefender(
  state: GameState,
  step: AbilityStep,
  context: EffectExecutionContext,
  player: PlayerState,
): EffectResult {
  const defenderType =
    (step.effectParams?.defenderType as 'HERO' | 'ALLY' | 'UNDEFENDED') || 'UNDEFENDED';
  const allyInstanceId = step.effectParams?.allyInstanceId as string | undefined;
  const playerId = (step.effectParams?.playerId as string) || context.playerId || player.id;
  if (defenderType === 'HERO') {
    const defendingPlayer = state.players.find((p) => p.id === playerId) || player;
    recordBasicAction(state, 'heroDefense', defendingPlayer.activeFormCard?.code);
  }
  const resState = resolveDefenderDeclaration(state, {
    type: defenderType,
    playerId,
    allyInstanceId,
  });
  return {
    state: resState,
    success: true,
    onomatopoeia: 'DEFENSE RESOLVED!',
  };
}

function handleVillainSchemes(
  state: GameState,
  _step: AbilityStep,
  _context: EffectExecutionContext,
  player: PlayerState,
): EffectResult {
  executeVillainSchemeAgainstPlayer(state, player);
  return { state, success: true, onomatopoeia: 'VILLAIN SCHEMES!' };
}

function handleVillainAttacks(
  state: GameState,
  _step: AbilityStep,
  _context: EffectExecutionContext,
  player: PlayerState,
): EffectResult {
  const begun = beginEnemyAttack(state, { type: 'VILLAIN' }, player.id);
  return {
    state: begun.state,
    success: true,
    onomatopoeia: 'VILLAIN ATTACKS!',
    ...attackOutcome(begun.state, begun.attacked),
  };
}

function handleEnemyAttacks(
  state: GameState,
  step: AbilityStep,
  _context: EffectExecutionContext,
  player: PlayerState,
): EffectResult {
  // A specific enemy (card code) attacks the resolving player's hero or identity. The result
  // is `success` and `mutatedState` only when the attack happened, so a later step can gate
  // on "if it did not attack" with `IF_FAILED`; `targetId` is the enemy, attacked or not.
  const enemyCode = step.effectParams?.enemy as string | undefined;
  const targetParam = (step.effectParams?.target as string) || 'SELF_HERO';
  const minion = state.players
    .flatMap((p) => p.engagedMinions)
    .find((m) => m.card.code === enemyCode);
  const villain = getVillainsInPlay(state).find((v) => v.card.code === enemyCode);
  const enemy = minion ?? villain;
  const noAttack = (targetId?: string): EffectResult => ({
    state,
    success: false,
    mutatedState: false,
    targetId,
    onomatopoeia: 'NO ATTACK!',
  });
  if (!enemy) return noAttack();
  const enemyId = enemy.instanceId;
  if (targetParam === 'SELF_HERO' && player.currentForm !== 'hero') {
    // "Your hero" in alter-ego form: there is no hero to attack.
    return noAttack(enemyId);
  }
  const attacker = minion
    ? { type: 'MINION' as const, card: minion }
    : { type: 'VILLAIN' as const, villainId: villain!.instanceId };
  const begun = beginEnemyAttack(state, attacker, player.id);
  return {
    state: begun.state,
    success: begun.attacked,
    mutatedState: begun.attacked,
    targetId: enemyId,
    onomatopoeia: begun.attacked ? 'ENEMY ATTACKS!' : 'NO ATTACK!',
    ...attackOutcome(begun.state, begun.attacked),
  };
}

function handleVillainAndEngagedMinionsAttack(
  state: GameState,
  _step: AbilityStep,
  _context: EffectExecutionContext,
  player: PlayerState,
): EffectResult {
  const activations: {
    type: 'VILLAIN' | 'MINION';
    playerId: string;
    minionInstanceId?: string;
  }[] = [
    { type: 'VILLAIN', playerId: player.id },
    ...player.engagedMinions.map((m) => ({
      type: 'MINION' as const,
      playerId: player.id,
      minionInstanceId: m.instanceId,
    })),
  ];
  (state as any).pendingActivations = [
    ...((state as any).pendingActivations || []),
    ...activations,
  ];

  if ((state as any).pendingActivations.length > 0) {
    const act = (state as any).pendingActivations.shift()!;
    if (act.type === 'VILLAIN') {
      executeVillainAttackAgainstPlayer(state, player);
    } else {
      const minion = player.engagedMinions.find((m) => m.instanceId === act.minionInstanceId);
      if (minion) executeMinionAttackAgainstPlayer(state, minion, player);
    }
  }
  return { state, success: true, onomatopoeia: 'GANG UP!' };
}

export const COMBAT_HANDLERS = {
  GRANT_ATTACK_KEYWORD: handleGrantAttackKeyword,
  CANCEL_ATTACK: handleCancelAttack,
  GIVE_ADDITIONAL_BOOST_CARD: handleGiveAdditionalBoostCard,
  DECLARE_DEFENDER: handleDeclareDefender,
  VILLAIN_SCHEMES: handleVillainSchemes,
  VILLAIN_ATTACKS: handleVillainAttacks,
  ENEMY_ATTACKS: handleEnemyAttacks,
  VILLAIN_AND_ENGAGED_MINIONS_ATTACK: handleVillainAndEngagedMinionsAttack,
} satisfies Partial<Record<EffectType, StepHandler>>;
