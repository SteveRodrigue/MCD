/** Attacks, schemes, defenders and boosts (step handlers, AUD-20261017-232534 F010-A). */
import {
  GameState,
  PlayerState,
  getVillainsInPlay,
  getMinionsInPlay,
  PendingActivation,
  CardInstance,
} from '@engine/models';
import { matchesCardFilter } from '../../filters/card-filter';
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
import type { TypedStep, StepHandlerMap } from './types';
import { getStepEffectParams } from '../../../data/supplemental/runtime';

function handleGrantAttackKeyword(
  state: GameState,
  step: TypedStep<'GRANT_ATTACK_KEYWORD'>,
  context: EffectExecutionContext,
  _player: PlayerState,
): EffectResult {
  // "This attack gains <keyword>": kept on the running ability's context, so it ends with it.
  const params = getStepEffectParams(step);
  const keyword = params.keyword;
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
  _step: TypedStep<'CANCEL_ATTACK'>,
  context: EffectExecutionContext,
  _player: PlayerState,
): EffectResult {
  if (state.activeAttackContext) {
    state.activeAttackContext.isCancelled = true;
  }
  context.attackCancelled = true;
  const cancelledBy = context.sourceCardInstance?.card.name || 'Ability';
  appendLog(state, {
    category: 'combat',
    key: 'combat.attack.cancelled',
    params: {
      source: cancelledBy,
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
  _step: TypedStep<'GIVE_ADDITIONAL_BOOST_CARD'>,
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
  step: TypedStep<'DECLARE_DEFENDER'>,
  context: EffectExecutionContext,
  player: PlayerState,
): EffectResult {
  const params = getStepEffectParams(step);
  const defenderType = params.defenderType || 'UNDEFENDED';
  const allyInstanceId = params.allyInstanceId;
  const playerId = params.playerId || context.playerId || player.id;
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
  _step: TypedStep<'VILLAIN_SCHEMES'>,
  _context: EffectExecutionContext,
  player: PlayerState,
): EffectResult {
  executeVillainSchemeAgainstPlayer(state, player);
  return { state, success: true, onomatopoeia: 'VILLAIN SCHEMES!' };
}

function handleVillainAttacks(
  state: GameState,
  _step: TypedStep<'VILLAIN_ATTACKS'>,
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
  step: TypedStep<'ENEMY_ATTACKS'>,
  context: EffectExecutionContext,
  player: PlayerState,
): EffectResult {
  // A specific enemy (card code or SELF) attacks the resolving player's hero or identity,
  // with target ALL_OTHER_HEROES queues attacks against each other hero (Whirlwind 01130),
  // or with target ENGAGED_HERO activates each matching minion against its engaged hero (Masters of Mayhem 01133).
  const params = getStepEffectParams(step);
  const targetParam = params.target || 'SELF_HERO';

  if (targetParam === 'ENGAGED_HERO') {
    const filter = params.filter;
    const minions = getMinionsInPlay(state).filter((m) =>
      filter ? matchesCardFilter(m, filter, { state, player }) : true,
    );

    const eligibleActivations: { minion: CardInstance; targetPlayer: PlayerState }[] = [];
    for (const m of minions) {
      const engagedPlayer = state.players.find((p) =>
        p.engagedMinions.some((em) => em.instanceId === m.instanceId),
      );
      if (engagedPlayer && engagedPlayer.currentForm === 'hero') {
        eligibleActivations.push({ minion: m, targetPlayer: engagedPlayer });
      }
    }

    if (eligibleActivations.length === 0) {
      return {
        state,
        success: true,
        mutatedState: false,
        value: 0,
        facts: { attacksMadeCount: 0, amountZero: true },
        onomatopoeia: 'NO ATTACKS MADE!',
      };
    }

    let attacksMade = 0;
    let anyStunCleared = false;

    while (eligibleActivations.length > 0) {
      const nextAct = eligibleActivations.shift()!;
      const attacker = { type: 'MINION' as const, card: nextAct.minion };
      const begun = beginEnemyAttack(state, attacker, nextAct.targetPlayer.id);
      state = begun.state;
      if (begun.attacked) {
        attacksMade += 1;
        break;
      } else {
        anyStunCleared = true;
      }
    }

    if (eligibleActivations.length > 0) {
      const remaining: PendingActivation[] = eligibleActivations.map((act) => ({
        type: 'MINION' as const,
        playerId: act.targetPlayer.id,
        minionInstanceId: act.minion.instanceId,
        isSecondaryAttack: true,
      }));
      state.pendingActivations = [...(state.pendingActivations || []), ...remaining];
    }

    const hadAnySuccess = attacksMade > 0;
    return {
      state,
      success: true,
      mutatedState: hadAnySuccess || anyStunCleared,
      value: attacksMade,
      facts: { attacksMadeCount: attacksMade, amountZero: attacksMade === 0 },
      onomatopoeia: hadAnySuccess ? 'MINIONS ATTACK!' : 'ALL ATTACKS CANCELLED!',
      ...(hadAnySuccess ? attackOutcome(state, true) : {}),
    };
  }

  const enemyCode = params.enemy;
  const minion =
    enemyCode === 'SELF' && context.sourceCardInstance
      ? context.sourceCardInstance
      : getMinionsInPlay(state).find((m) => m.card.code === enemyCode);
  const villain =
    enemyCode === 'SELF' && context.sourceCardInstance
      ? undefined
      : getVillainsInPlay(state).find((v) => v.card.code === enemyCode);
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

  if (targetParam === 'ALL_OTHER_HEROES') {
    const otherHeroes = state.players.filter((p) => p.id !== player.id && p.currentForm === 'hero');
    if (otherHeroes.length === 0) {
      return {
        state,
        success: true,
        mutatedState: false,
        targetId: enemyId,
        onomatopoeia: 'NO OTHER HEROES!',
      };
    }
    const activations: PendingActivation[] = otherHeroes.map((h) => ({
      type: minion ? ('MINION' as const) : ('VILLAIN' as const),
      playerId: h.id,
      minionInstanceId: minion?.instanceId,
      isSecondaryAttack: true,
    }));
    state.pendingActivations = [...activations, ...(state.pendingActivations || [])];
    return {
      state,
      success: true,
      mutatedState: true,
      targetId: enemyId,
      onomatopoeia: 'ATTACK RESOLVES AGAINST EACH OTHER HERO!',
    };
  }

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
  _step: TypedStep<'VILLAIN_AND_ENGAGED_MINIONS_ATTACK'>,
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
  state.pendingActivations = [...(state.pendingActivations || []), ...activations];

  if (state.pendingActivations.length > 0) {
    const act = state.pendingActivations.shift()!;
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
} satisfies Partial<StepHandlerMap>;
