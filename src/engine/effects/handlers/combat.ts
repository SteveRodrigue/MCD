/** Attacks, schemes, defenders and boosts (step handlers, AUD-20261017-232534 F010-A). */
import {
  GameState,
  PlayerState,
  getVillainsInPlay,
  getMinionsInPlay,
  PendingActivation,
  CardInstance,
} from '@engine/models';
import { kernel } from '../../kernel';
import {
  executeVillainAttackAgainstPlayer,
  executeVillainSchemeAgainstPlayer,
  executeMinionAttackAgainstPlayer,
  executeMinionActivationAgainstPlayer,
  engageMinion,
} from '../../pipeline/villain-phase';
import { drawEncounterCard } from '../../pipeline/deck-exhaustion';
import { dealSurgeCard } from '../../pipeline/surge';
import {
  beginEnemyAttack,
  grantKeywordToAttack,
  resolveDefenderDeclaration,
} from '../../pipeline/combat-pipeline';
import { matchesCardFilter } from '../../filters/card-filter';
import { recordBasicAction } from '../../pipeline/stats';
import { appendLog } from '../../state/game-log';
import { EffectExecutionContext, EffectResult, attackOutcome } from '../index';
import { resolveTargets } from '../target-resolver';
import type { TargetSelector } from '../../../data/supplemental/schema-primitives';
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
  // A boost card joins the running enemy attack ("if the villain is attacking, this attack gains
  // overkill"); during a scheme there is no attack to gain it.
  if (context.ability?.timing === 'BOOST') {
    grantKeywordToAttack(state.activeAttackContext, keyword);
    return { state, success: true };
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
  step: TypedStep<'GIVE_ADDITIONAL_BOOST_CARD'>,
  context: EffectExecutionContext,
  player: PlayerState,
): EffectResult {
  // Adds cards to the boost queue of the running activation: an attack or a scheme.
  const boostResolution = state.activeBoostResolution;
  if (boostResolution) {
    const params = getStepEffectParams(step);
    const rawCount = params.count;
    const count =
      rawCount !== undefined
        ? kernel.evaluateDynamicAmount(rawCount, context, { state, player })
        : 1;
    for (let i = 0; i < count; i++) {
      const extraCard = drawEncounterCard(state);
      if (!extraCard) break;
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
  step: TypedStep<'VILLAIN_SCHEMES'>,
  _context: EffectExecutionContext,
  player: PlayerState,
): EffectResult {
  state.lastSchemeThreatPlaced = 0;
  executeVillainSchemeAgainstPlayer(state, player, {
    schemeBonus: getStepEffectParams(step).schemeBonus,
  });
  // A boost reveal or a threat interrupt can pause the scheme: the amount joins the result on resume
  const paused = Boolean(state.activeSchemeContext || state.pendingThreatPlacements?.length);
  return {
    state,
    success: true,
    onomatopoeia: 'VILLAIN SCHEMES!',
    ...(paused ? { attackPending: true } : { value: state.lastSchemeThreatPlaced }),
  };
}

const FEWEST_HIT_POINTS = 'HERO_WITH_FEWEST_HIT_POINTS';

/**
 * Tied heroes for "the hero with the fewest hit points": the first player selects among the
 * eligible targets of an encounter card (RR v1.8 First Player). Opens a prompt that re-runs the step
 * for the chosen hero, and returns true when it did. The re-run carries `tiedPlayerId`.
 */
function promptFewestHitPointsTie(
  state: GameState,
  step: { effect: string; effectParams?: unknown },
  context: EffectExecutionContext,
): boolean {
  const params = (step.effectParams ?? {}) as Record<string, unknown>;
  if (params.tiedPlayerId) return false;
  const heroes = state.players.filter((p) => p.currentForm === 'hero');
  const fewest = Math.min(...heroes.map((p) => p.health));
  const tied = heroes.filter((p) => p.health === fewest);
  if (tied.length < 2) return false;

  const source = context.sourceCardInstance;
  const firstPlayer = state.players[state.firstPlayerIndex] ?? state.players[0];
  kernel.enqueueDecisionPrompt(state, {
    promptId: `prompt_fewest_hit_points_${source?.instanceId ?? step.effect}`,
    playerId: firstPlayer.id,
    title: 'Choose a Hero',
    description: `These heroes are tied for the fewest hit points. Choose one for ${source?.card.name ?? 'this effect'}:`,
    sourceCardName: source?.card.name ?? 'Fewest Hit Points',
    sourceCardCode: source?.card.code,
    sourceCardInstanceId: source?.instanceId,
    isVoluntary: false,
    options: tied.map((p) => ({
      id: `choose_player_${p.id}`,
      label: `${p.name} (${p.hero?.name ?? 'Hero'})`,
      cardCode: p.activeFormCard?.code ?? p.hero?.code,
      cardName: p.hero?.name,
      description: `Choose ${p.name}`,
      effect: step.effect,
      params: { ...params, tiedPlayerId: p.id },
    })),
  });
  return true;
}

/** The hero a fewest-hit-points step resolves to: the one the first player chose, or the only one. */
function fewestHitPointsHero(
  state: GameState,
  step: { effectParams?: unknown },
  context: EffectExecutionContext,
): PlayerState | undefined {
  const tiedPlayerId = (step.effectParams as { tiedPlayerId?: string } | undefined)?.tiedPlayerId;
  if (tiedPlayerId) return state.players.find((p) => p.id === tiedPlayerId);
  return resolveTargets(state, FEWEST_HIT_POINTS, context).find((r) => r.kind === 'player')
    ?.entity as PlayerState | undefined;
}

function handleEngageMinion(
  state: GameState,
  step: TypedStep<'ENGAGE_MINION'>,
  context: EffectExecutionContext,
  _player: PlayerState,
): EffectResult {
  const minion = context.sourceCardInstance;
  const { engagePlayer } = getStepEffectParams(step);
  if (engagePlayer === FEWEST_HIT_POINTS && promptFewestHitPointsTie(state, step, context)) {
    return { state, success: true, mutatedState: false, onomatopoeia: 'CHOOSE PLAYER!' };
  }
  const target = fewestHitPointsHero(state, step, context);
  const isEngagedWithTarget = target?.engagedMinions.some(
    (m) => m.instanceId === minion?.instanceId,
  );
  if (!minion || !target || isEngagedWithTarget) {
    return { state, success: true, mutatedState: false };
  }
  const updated = engageMinion(state, minion, target);
  return { state: updated ?? state, success: true, mutatedState: true, onomatopoeia: 'ENGAGED!' };
}

function handleVillainAttacks(
  state: GameState,
  step: TypedStep<'VILLAIN_ATTACKS'>,
  context: EffectExecutionContext,
  player: PlayerState,
): EffectResult {
  const params = getStepEffectParams(step);
  const targetSelector = ((params as Record<string, unknown> | undefined)?.targetPlayer ??
    (params as Record<string, unknown> | undefined)?.target) as string | undefined;
  let targetPlayer: PlayerState | undefined = player;
  if (targetSelector === FEWEST_HIT_POINTS) {
    if (promptFewestHitPointsTie(state, step, context)) {
      return { state, success: true, mutatedState: false, onomatopoeia: 'CHOOSE PLAYER!' };
    }
    targetPlayer = fewestHitPointsHero(state, step, context);
  } else if (targetSelector) {
    const resolved = resolveTargets(state, targetSelector as TargetSelector, context);
    targetPlayer = resolved.find((r) => r.kind === 'player')?.entity as PlayerState | undefined;
  }
  if (!targetPlayer || targetPlayer.currentForm !== 'hero') {
    if (params?.surgeIfNoAttack) {
      dealSurgeCard(state, player, context.sourceCardInstance?.card.name);
      return {
        state,
        success: true,
        mutatedState: true,
        onomatopoeia: 'SURGE!',
      };
    }
    return {
      state,
      success: true,
      mutatedState: false,
      onomatopoeia: 'NO ATTACK MADE',
    };
  }
  const begun = beginEnemyAttack(state, { type: 'VILLAIN' }, targetPlayer.id, {
    grantedKeywords: context.grantedAttackKeywords,
  });
  if (!begun.attacked && params?.surgeIfNoAttack) {
    dealSurgeCard(state, player, context.sourceCardInstance?.card.name);
  }
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
      if (params.engagedWith === 'SELF' && engagedPlayer?.id !== player.id) continue;
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

/**
 * "Each nemesis minion activates against you" or "against the player it is engaged with" (RR v1.8
 * Activation): an attack for a hero, a scheme for an alter-ego.
 */
function handleActivateMinions(
  state: GameState,
  step: TypedStep<'ACTIVATE_MINIONS'>,
  _context: EffectExecutionContext,
  player: PlayerState,
): EffectResult {
  const { filter, against } = getStepEffectParams(step);
  const activations = state.players.flatMap((engaged) =>
    engaged.engagedMinions
      .filter((m) => !filter || matchesCardFilter(m, filter, { player, state }))
      .map((minion) => ({ minion, target: against === 'ENGAGED_PLAYER' ? engaged : player })),
  );
  const minions = activations.map((a) => a.minion);
  if (minions.length === 0) return { state, success: true, mutatedState: false, value: 0 };
  let current = state;
  for (const [index, { minion, target }] of activations.entries()) {
    current = executeMinionActivationAgainstPlayer(current, minion, target);
    // An attack that stops at a decision holds the others; they resume when it ends.
    if (current.activeAttackContext || current.activeSchemeContext) {
      current.pendingActivations = [
        ...(current.pendingActivations ?? []),
        ...activations.slice(index + 1).map((a) => ({
          type: 'MINION' as const,
          playerId: a.target.id,
          minionInstanceId: a.minion.instanceId,
        })),
      ];
      return {
        state: current,
        success: true,
        mutatedState: true,
        value: minions.length,
        onomatopoeia: 'ACTIVATE!',
        attackPending: true,
      };
    }
  }
  return {
    state: current,
    success: true,
    mutatedState: true,
    value: minions.length,
    onomatopoeia: 'ACTIVATE!',
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
  ACTIVATE_MINIONS: handleActivateMinions,
  ENGAGE_MINION: handleEngageMinion,
  GRANT_ATTACK_KEYWORD: handleGrantAttackKeyword,
  CANCEL_ATTACK: handleCancelAttack,
  GIVE_ADDITIONAL_BOOST_CARD: handleGiveAdditionalBoostCard,
  DECLARE_DEFENDER: handleDeclareDefender,
  VILLAIN_SCHEMES: handleVillainSchemes,
  VILLAIN_ATTACKS: handleVillainAttacks,
  ENEMY_ATTACKS: handleEnemyAttacks,
  VILLAIN_AND_ENGAGED_MINIONS_ATTACK: handleVillainAndEngagedMinionsAttack,
} satisfies Partial<StepHandlerMap>;
