/** Damage, healing and damage prevention (step handlers, AUD-20261017-232534 F010-A). */
import {
  GameState,
  CardInstance,
  PendingDecisionPrompt,
  DistributionPromptConfig,
  PlayerState,
  VillainState,
  Keyword,
  hasKeyword,
  getActiveVillain,
  getActiveMainScheme,
  getFirstPlayer,
} from '@engine/models';
import { getStepEffectParams } from '../../../data/supplemental/runtime';
import { enqueueDecisionPrompt, enqueueDistributionPrompt } from '../../pipeline/prompt-queue';
import { isImmuneToDamage } from '../../pipeline/damage-immunity';
import { getEffectiveMaxHealth, getEffectiveMinionHitPoints } from '../../pipeline/stat-calculator';
import { dispatchTrigger } from '../../triggers/trigger-dispatcher';
import { nextEngineId } from '../../state/rng';
import { resolveCharacterTargets } from '../target-resolver';
import { appendLog } from '../../state/game-log';
import {
  executeStep,
  AbilityDamageOptions,
  EffectExecutionContext,
  EffectResult,
  allyTargetRef,
  applyAbilityDamage,
  applyDistributedDamage,
  compileDistributionTargets,
  dealDamageToEnemies,
  dealDamageToIdentity,
  defeatSideScheme,
  isEncounterCard,
  minionTargetRef,
  playerTargetRef,
  recordAttackedEnemy,
  resolveNumericAmount,
  villainTargetRef,
} from '../index';
import { getRuntimeParams, type TypedStep, type StepHandlerMap } from './types';

function handleDealDamage(
  state: GameState,
  step: TypedStep<'DEAL_DAMAGE'>,
  context: EffectExecutionContext,
  player: PlayerState,
): EffectResult {
  const params = getStepEffectParams(step);
  const runtime = getRuntimeParams(step);
  const targetInstanceId = runtime.targetInstanceId || context.chosenTargetInstanceId;
  let amount = resolveNumericAmount(params.amount, context, 0, {
    state,
    player,
    sourceCardInstance: context.sourceCardInstance,
    targetInstanceId,
  });
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
  const targetParam = params.target;

  const isAttack = Boolean(runtime.isAttack || context.isAttack || context.labelledAttack);
  const hasPiercing = hasKeyword(context.sourceCardInstance, Keyword.PIERCING);
  const damageOpts: AbilityDamageOptions = {
    // A labelled "(attack)" ability is an attack by the player's identity (#247)
    sourceType: context.labelledAttack ? 'HERO' : undefined,
    sourcePlayerId: player.id,
    sourceCardInstance: context.sourceCardInstance,
    isAttack,
    hasPiercing,
    triggerChain: context.triggerChain,
  };

  if (targetParam === 'ALL_CHARACTERS') {
    // 1. Villain and minions
    state = dealDamageToEnemies(state, amount, state.players, damageOpts);

    // 2. Heroes. A snapshot: a hero eliminated by this damage leaves state.players (#246).
    for (const p of [...state.players]) {
      state = applyAbilityDamage(state, playerTargetRef(p), amount, damageOpts).state;
    }

    // 3. Allies
    for (const p of state.players) {
      for (const ally of [...p.allies].reverse()) {
        state = applyAbilityDamage(state, allyTargetRef(ally, p.id), amount, damageOpts).state;
      }
    }

    const onomatopoeia = `WHAM! ${amount} DAMAGE TO ALL CHARACTERS!`;
    appendLog(state, {
      key: 'card.effect.dealDamage',
      params: { player: player.name, target: 'all_characters', amount },
      onomatopoeia,
    });

    return { state, success: true, mutatedState: amount > 0, value: amount, onomatopoeia };
  }

  if (targetParam === 'ALL_HEROES_AND_ALLIES') {
    // The amount to each hero (alter-ego players are not heroes) and each ally. A snapshot: a
    // hero eliminated by this damage leaves state.players (#246). Splitting an amount among
    // them is DISTRIBUTE_AMOUNT, not this selector.
    for (const p of [...state.players].filter((pl) => pl.currentForm === 'hero')) {
      state = dealDamageToIdentity(state, p, amount, damageOpts);
    }
    for (const p of state.players) {
      for (const ally of [...p.allies].reverse()) {
        state = applyAbilityDamage(state, allyTargetRef(ally, p.id), amount, damageOpts).state;
      }
    }

    const onomatopoeia = `BOOM! ${amount} DAMAGE TO HEROES AND ALLIES!`;
    appendLog(state, {
      key: 'card.effect.dealDamage',
      params: { player: player.name, target: 'all_heroes_and_allies', amount },
      onomatopoeia,
    });

    return { state, success: true, mutatedState: amount > 0, value: amount, onomatopoeia };
  }

  if (targetParam === 'ALL_ENEMIES') {
    state = dealDamageToEnemies(state, amount, state.players, damageOpts);

    const onomatopoeia = `BOOM! ${amount} DAMAGE TO ALL ENEMIES!`;
    appendLog(state, {
      key: 'card.effect.dealDamage',
      params: { player: player.name, target: 'all_enemies', amount },
      onomatopoeia,
    });

    return { state, success: true, onomatopoeia };
  }

  if (targetParam === 'ENGAGED_ENEMIES') {
    const targetPlayerParam = step.effectParams?.targetPlayer as string | undefined;
    const chosenPlayerId =
      (step.effectParams?.targetPlayerId as string) ||
      context.targetPlayerId ||
      (targetPlayerParam === 'CHOSEN_PLAYER' && state.players.length > 1 ? undefined : player.id);

    // Multiplayer "choose a player": defer the damage to the selected player's engaged enemies.
    // The amount (including any finisher bonus) is fixed now so resolution is order-independent.
    if (!chosenPlayerId) {
      const sourceCardName =
        context.sourceCardInstance?.card.name || player.activeFormCard?.name || 'Ability';
      const promptId = `prompt_${nextEngineId(state, 'id')}_choose_player`;
      state = enqueueDecisionPrompt(state, {
        promptId,
        playerId: player.id,
        title: 'Choose a Player',
        description: `Deal ${amount} damage to the villain and each enemy engaged with the chosen player:`,
        sourceCardName,
        options: state.players.map((p) => ({
          id: `engaged_enemies_${p.id}`,
          label: `${p.name} (${p.hero?.name || 'Hero'})`,
          description: `Deal ${amount} damage to the villain and to each enemy engaged with ${p.name} (${(p.engagedMinions || []).length} minion${(p.engagedMinions || []).length === 1 ? '' : 's'})`,
          effect: 'DEAL_DAMAGE',
          params: { amount, target: 'ENGAGED_ENEMIES', targetPlayerId: p.id },
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

    const chosenPlayer = state.players.find((p) => p.id === chosenPlayerId) || player;
    state = dealDamageToEnemies(state, amount, [chosenPlayer], damageOpts);

    const onomatopoeia = `BOOM! ${amount} DAMAGE TO ${chosenPlayer.name.toUpperCase()}'S ENGAGED ENEMIES!`;
    appendLog(state, {
      key: 'card.effect.dealDamage',
      params: { player: player.name, target: 'engaged_enemies', amount },
      onomatopoeia,
    });

    return { state, success: true, onomatopoeia };
  }

  const targetType =
    targetParam === 'ALL_HEROES' ||
    (targetParam as string) === 'HERO' ||
    targetParam === 'SELF_IDENTITY' ||
    targetParam === 'SELF_HERO' ||
    (targetParam as string) === 'IDENTITY' ||
    targetParam === 'SELF'
      ? 'hero'
      : context.chosenTargetType || 'villain';

  if (targetParam === 'SELF_HERO' && player.currentForm !== 'hero') {
    // "Your hero" while in alter-ego form: nothing to damage, never fall back to the alter-ego.
    return { state, success: true, mutatedState: false, value: 0 };
  }

  if (
    targetParam === 'SELF_IDENTITY' ||
    targetParam === 'SELF_HERO' ||
    (targetParam as string) === 'IDENTITY' ||
    targetParam === 'SELF'
  ) {
    state = dealDamageToIdentity(state, player, amount, damageOpts);
    return {
      state,
      success: true,
      mutatedState: amount > 0,
      value: amount,
      onomatopoeia: `OUCH! ${amount} DAMAGE!`,
    };
  }

  if (targetParam === 'ALL_HEROES' || (targetType === 'hero' && !context.chosenTargetInstanceId)) {
    for (const p of state.players.filter((pl) => pl.currentForm === 'hero')) {
      state = dealDamageToIdentity(state, p, amount, damageOpts);
    }
    return {
      state,
      success: true,
      onomatopoeia: `SHOCK! ${amount} DAMAGE TO HEROES!`,
    };
  }

  // 1. If targetInstanceId is specified, check engaged minions first
  const targetMinionId =
    step.effectParams?.target === 'TRIGGERING_MINION' ||
    step.effectParams?.target === 'TRIGGERING_ENEMY'
      ? context.eventTargetInstanceId || (step.effectParams?.targetInstanceId as string)
      : (step.effectParams?.targetInstanceId as string) ||
        context.chosenTargetInstanceId ||
        (typeof step.effectParams?.target === 'string' &&
        state.players.some((p) =>
          p.engagedMinions.some((m) => m.instanceId === step.effectParams?.target),
        )
          ? (step.effectParams?.target as string)
          : undefined);

  if (targetMinionId) {
    for (const p of state.players) {
      const minion = p.engagedMinions.find((m) => m.instanceId === targetMinionId);
      if (!minion) continue;

      // Overkill: excess damage over the minion goes to the villain (RR v1.8 glossary O)
      const hasOverkill = Boolean(
        context.grantedAttackKeywords?.some((k) => k.toLowerCase() === 'overkill') ||
        hasKeyword(context.sourceCardInstance, Keyword.OVERKILL),
      );

      const minionHp = getEffectiveMinionHitPoints(state, minion);
      const damageBefore = minion.tokens?.damage || 0;
      const damageRes = applyAbilityDamage(
        state,
        minionTargetRef(minion, p.id),
        amount,
        damageOpts,
        { hasOverkill },
      );
      state = damageRes.state;
      const res = damageRes.result;
      recordAttackedEnemy(context, 'minion', minion.instanceId);

      if (res.toughRemoved && res.damageTaken === 0) {
        const onomatopoeia = 'CLANG!';
        appendLog(state, {
          key: 'card.effect.dealDamage',
          params: {
            player: player.name,
            target: minion.card.name,
            amount: 0,
            toughAbsorbed: true,
          },
          onomatopoeia,
        });
        return {
          state,
          success: true,
          mutatedState: false,
          value: 0,
          facts: {
            targetDefeated: false,
            excessDamage: 0,
          },
          onomatopoeia,
        };
      }

      const onomatopoeia = res.targetDefeated ? 'SMASH! MINION DEFEATED!' : 'WHAM!';
      appendLog(state, {
        key: 'card.effect.dealDamage',
        params: {
          player: player.name,
          target: minion.card.name,
          amount,
          ...(res.targetDefeated
            ? { defeated: true }
            : { remainingHealth: minionHp - damageBefore - res.damageTaken }),
        },
        onomatopoeia,
      });

      return {
        state,
        success: true,
        mutatedState: res.damageTaken > 0 || res.targetDefeated,
        value: res.damageTaken,
        facts: {
          targetDefeated: Boolean(res.targetDefeated),
          defeated: Boolean(res.targetDefeated),
          excessDamage: res.excessDamage || 0,
        },
        onomatopoeia,
      };
    }
  }

  // 2. Default: Deal damage to Villain
  const villain = getActiveVillain(state);
  const damageRes = applyAbilityDamage(state, villainTargetRef(villain), amount, damageOpts);
  recordAttackedEnemy(context, 'villain', villain.instanceId || 'villain');

  state = damageRes.state;
  const onomatopoeia = damageRes.result.onomatopoeia || `KAPOW! ${amount} DAMAGE!`;

  return {
    state,
    success: true,
    mutatedState:
      damageRes.result.damageTaken > 0 ||
      damageRes.result.toughRemoved ||
      damageRes.result.targetDefeated,
    value: damageRes.result.damageTaken,
    facts: {
      targetDefeated: Boolean(damageRes.result.targetDefeated),
      defeated: Boolean(damageRes.result.targetDefeated),
      excessDamage: damageRes.result.excessDamage || 0,
    },
    onomatopoeia,
  };
}

function handleDistributeAmount(
  state: GameState,
  step: TypedStep<'DISTRIBUTE_AMOUNT'>,
  context: EffectExecutionContext,
  player: PlayerState,
): EffectResult {
  const stepParams = getStepEffectParams(step);
  const runtime = getRuntimeParams(step);
  const budget = resolveNumericAmount(stepParams.budget ?? 0, context, 0, {
    state,
    player,
    sourceCardInstance: context.sourceCardInstance,
    targetInstanceId: runtime.targetInstanceId || context.chosenTargetInstanceId,
  });
  const allocationDomain = stepParams.allocationDomain || 'DAMAGE';
  const targetScope = (stepParams.targetScope as string) || 'ALL_HEROES_AND_ALLIES';
  const canCancel = Boolean(runtime.canCancel);
  const exactMatchRequired = runtime.exactMatchRequired !== false;

  // 1. If assignments already provided, execute immediately
  if (context.assignments && typeof context.assignments === 'object') {
    const assignments = context.assignments;
    if (allocationDomain === 'DAMAGE') {
      state = applyDistributedDamage(state, assignments, player, context.sourceCardInstance);
    }
    for (const [targetId, amount] of Object.entries(assignments)) {
      if (amount <= 0) continue;

      if (allocationDomain === 'THREAT_REMOVAL') {
        const activeMain = getActiveMainScheme(state);
        if (
          targetId === 'main_scheme' ||
          targetId === activeMain?.instanceId ||
          targetId === activeMain?.card?.code
        ) {
          const prevThreat = activeMain.threat;
          activeMain.threat = Math.max(0, activeMain.threat - amount);
          if (prevThreat > 0 && activeMain.threat === 0) {
            dispatchTrigger(state, 'SCHEME_THREAT_REDUCED_TO_ZERO', {
              targetPlayerId: player.id,
              sourceInstanceId: activeMain.instanceId || 'main_scheme',
              entityType: 'SCHEME',
              threatAmount: prevThreat,
            });
          }
        } else {
          const sideIdx = (state.sideSchemes || []).findIndex(
            (s) => s.instanceId === targetId || s.card.code === targetId,
          );
          if (sideIdx !== -1) {
            const side = state.sideSchemes![sideIdx];
            const prevThreat = side.threat || 0;
            side.threat = Math.max(0, (side.threat || 0) - amount);
            if (side.threat <= 0) {
              defeatSideScheme(state, side.instanceId, player.id);
              if (prevThreat > 0) {
                dispatchTrigger(state, 'SCHEME_THREAT_REDUCED_TO_ZERO', {
                  targetPlayerId: player.id,
                  sourceInstanceId: side.instanceId,
                  entityType: 'SCHEME',
                  threatAmount: prevThreat,
                });
              }
            }
          }
        }
      } else if (allocationDomain === 'HEAL') {
        let ally: CardInstance | undefined;
        for (const p of state.players) {
          const found = p.allies.find((a) => a.instanceId === targetId);
          if (found) {
            ally = found;
            break;
          }
        }
        if (ally) {
          const currentDmg = ally.tokens?.damage || 0;
          ally.tokens = { ...ally.tokens, damage: Math.max(0, currentDmg - amount) };
        } else {
          const targetPlayer = state.players.find(
            (pl) =>
              pl.id === targetId ||
              pl.activeFormCard?.code === targetId ||
              pl.hero?.code === targetId,
          );
          if (targetPlayer) {
            targetPlayer.health = Math.min(targetPlayer.maxHealth, targetPlayer.health + amount);
          }
        }
      } else if (allocationDomain === 'EXHAUST') {
        for (const p of state.players) {
          const c =
            p.tableau.find((i) => i.instanceId === targetId) ||
            p.allies.find((i) => i.instanceId === targetId);
          if (c) c.exhausted = true;
          if (p.id === targetId) p.exhausted = true;
        }
      } else if (allocationDomain === 'COUNTERS') {
        for (const p of state.players) {
          const c =
            p.tableau.find((i) => i.instanceId === targetId) ||
            p.allies.find((i) => i.instanceId === targetId);
          if (c) {
            c.tokens = { ...c.tokens, counters: (c.tokens?.counters || 0) + amount };
          }
        }
      }
    }

    const totalAssigned = Object.values(assignments).reduce((s, n) => s + (n || 0), 0);
    return {
      state,
      success: true,
      mutatedState: totalAssigned > 0,
      value: totalAssigned,
      onomatopoeia: 'DISTRIBUTED!',
    };
  }

  // 2. No assignment yet: nothing to distribute, a single legal target, or a prompt to the assigner.
  if (budget <= 0) {
    return {
      state,
      success: true,
      mutatedState: false,
      value: 0,
      onomatopoeia: 'POINTS ASSIGNED!',
    };
  }

  const targets = compileDistributionTargets(state, targetScope, allocationDomain);
  const legalTargets = targets.filter((t) => t.isEligible !== false && (t.allocationCap ?? 0) > 0);

  // No legal target: the points are ignored.
  if (legalTargets.length === 0) {
    appendLog(state, {
      category: 'ability',
      actor: { name: player.name, type: player.currentForm },
      key: 'decision.distribution.noLegalTarget',
      params: {
        player: player.name,
        domain: allocationDomain,
        amount: budget,
        source: context.sourceCardInstance?.card.name || 'Game Effect',
      },
      onomatopoeia: 'NO LEGAL TARGET!',
    });
    return {
      state,
      success: true,
      mutatedState: false,
      value: 0,
      onomatopoeia: 'NO LEGAL TARGET!',
    };
  }

  // One legal target: nothing to choose, it takes as much of the budget as it can.
  if (legalTargets.length === 1) {
    const only = legalTargets[0];
    const portion = Math.min(budget, only.allocationCap ?? budget);
    return executeStep(state, step, {
      ...context,
      assignments: { [only.instanceId]: portion },
    });
  }

  const unitSingular =
    runtime.unitSingular ||
    (allocationDomain === 'DAMAGE' ? 'DMG' : allocationDomain === 'THREAT_REMOVAL' ? 'THW' : 'PT');
  const unitPlural =
    runtime.unitPlural ||
    (allocationDomain === 'DAMAGE' ? 'DMG' : allocationDomain === 'THREAT_REMOVAL' ? 'THW' : 'PTS');
  const config: DistributionPromptConfig = {
    totalBudget: budget,
    effectiveBudget: budget,
    budgetLabel: runtime.budgetLabel || `${allocationDomain.replace('_', ' ')}`,
    unitSingular,
    unitPlural,
    exactMatchRequired,
    canCancel,
    allocationDomain,
    targets,
  };

  // An encounter card that names no player leaves the choice to the first player (RR v1.8
  // First Player); any other source is assigned by the player who resolves it.
  const assigner =
    context.sourceCardInstance && isEncounterCard(context.sourceCardInstance.card)
      ? getFirstPlayer(state)
      : player;

  const prompt: PendingDecisionPrompt = {
    promptId: nextEngineId(state, 'dist'),
    playerId: assigner.id,
    title: `Distribute ${config.budgetLabel}`,
    description: `Assign ${budget} ${unitPlural} among eligible targets:`,
    sourceCardName: context.sourceCardInstance?.card.name || 'Game Effect',
    sourceCardCode: context.sourceCardInstance?.card.code,
    sourceCardInstanceId: context.sourceCardInstance?.instanceId,
    kind: 'DISTRIBUTE_POINTS',
    distributionConfig: config,
    options: [
      {
        id: 'confirm_distribution',
        label: 'Confirm Assignment',
        effect: 'DISTRIBUTE_POINTS',
      },
    ],
  };

  state = enqueueDistributionPrompt(state, prompt);
  return {
    state,
    success: true,
    mutatedState: true,
    onomatopoeia: 'ASSIGN POINTS!',
  };
}

function handleHealDamage(
  state: GameState,
  step: TypedStep<'HEAL_DAMAGE'>,
  context: EffectExecutionContext,
  player: PlayerState,
): EffectResult {
  const params = getStepEffectParams(step);
  const amount =
    params.amount === 'ALL'
      ? Number.MAX_SAFE_INTEGER
      : resolveNumericAmount(params.amount, context, 0, { state, player });
  const target = (params.target as string) || 'SELF';
  let healed = 0;

  const targetCharacters = resolveCharacterTargets(state, target, context);
  const charsToHeal = targetCharacters;

  let isFullyHealed = true;
  for (const targetChar of charsToHeal) {
    if (targetChar.entityType === 'villain') {
      const ent = targetChar.entity as VillainState;
      const currentHp = ent.health;
      const maxHp = ent.maxHealth || 100;
      const h = Math.min(maxHp - currentHp, amount);
      ent.health += h;
      healed += h;
      if (ent.health < maxHp) isFullyHealed = false;
    } else if (targetChar.entityType === 'hero' || targetChar.entityType === 'alter_ego') {
      const ent = targetChar.entity as PlayerState;
      const currentHp = ent.health;
      const maxHp = ent.maxHealth;
      const h = Math.min(maxHp - currentHp, amount);
      ent.health += h;
      healed += h;
      if (ent.health < maxHp) isFullyHealed = false;
    } else if (targetChar.entityType === 'ally' || targetChar.entityType === 'minion') {
      const ent = targetChar.entity as CardInstance;
      const currentDmg = ent.tokens?.damage || 0;
      const h = Math.min(currentDmg, amount);
      if (ent.tokens) ent.tokens.damage = Math.max(0, currentDmg - h);
      healed += h;
      if ((ent.tokens?.damage || 0) > 0) isFullyHealed = false;
    }
  }

  const onomatopoeia = `HEAL +${healed} HP!`;
  appendLog(state, {
    key: 'card.effect.heal',
    params: {
      player: player.name,
      target,
      amount: healed,
      health: target === 'VILLAIN' ? getActiveVillain(state).health : player.health,
    },
    onomatopoeia,
  });

  return {
    state,
    success: true,
    mutatedState: healed > 0,
    value: healed,
    facts: {
      fullyHealed: isFullyHealed,
    },
    onomatopoeia,
  };
}

function handlePreventDamage(
  state: GameState,
  step: TypedStep<'PREVENT_DAMAGE'>,
  context: EffectExecutionContext,
  player: PlayerState,
): EffectResult {
  const params = getStepEffectParams(step);
  const currentVal =
    context.remainingInterceptedValue ?? context.interceptedValue ?? context.damageAmount ?? 0;

  const hasInterceptContext =
    context.remainingInterceptedValue !== undefined ||
    context.interceptedValue !== undefined ||
    context.damageAmount !== undefined;

  const amountToPrevent =
    params.amount !== undefined
      ? params.amount === 'ALL'
        ? currentVal
        : resolveNumericAmount(params.amount, context, currentVal)
      : hasInterceptContext
        ? currentVal
        : 3;

  const consumed = hasInterceptContext ? Math.min(currentVal, amountToPrevent) : amountToPrevent;
  const remaining = hasInterceptContext ? Math.max(0, currentVal - consumed) : 0;

  if (hasInterceptContext) {
    context.remainingInterceptedValue = remaining;
    if (context.damageAmount !== undefined) {
      context.damageAmount = remaining;
    }
  }

  const onomatopoeia = `PREVENTED ${consumed} DAMAGE!`;

  appendLog(state, {
    category: 'ability',
    key: 'combat.damage.prevented',
    params: {
      player: player.name,
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

function handleGrantKeyword(
  state: GameState,
  _step: TypedStep,
  _context: EffectExecutionContext,
  _player: PlayerState,
): EffectResult {
  // These are declarative constant/trigger primitives evaluated dynamically by stat-calculator and combat pipelines
  return { state, success: true };
}

function handleTransferDamage(
  state: GameState,
  step: TypedStep<'TRANSFER_DAMAGE'>,
  context: EffectExecutionContext,
  player: PlayerState,
): EffectResult {
  const params = getStepEffectParams(step);
  const runtime = getRuntimeParams(step);
  const targetInstanceId = runtime.targetInstanceId || context.chosenTargetInstanceId;
  let amount = resolveNumericAmount(params.amount, context, 1, {
    state,
    player,
    sourceCardInstance: context.sourceCardInstance,
    targetInstanceId,
  });
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

  const targetEnemyId = targetInstanceId;
  // A character that cannot take this damage is not a valid target: nothing moves (#297).
  const transferTarget = targetEnemyId
    ? targetEnemyId === 'villain'
      ? getActiveVillain(state)
      : state.players.flatMap((p) => p.engagedMinions).find((m) => m.instanceId === targetEnemyId)
    : getActiveVillain(state);
  if (isImmuneToDamage(state, transferTarget, context.sourceCardInstance)) {
    return { state, success: false, error: 'Target cannot take damage from this source' };
  }
  // Damage can only move if the hero carries it (#300). With no damage there is no valid
  // source: the step fails without an error, so the rest of a Wakanda Forever! sequence resolves.
  const heroDamage = getEffectiveMaxHealth(player, state) - player.health;
  if (heroDamage <= 0) {
    return { state, success: false };
  }
  amount = Math.min(amount, heroDamage);
  player.health = Math.min(getEffectiveMaxHealth(player, state), player.health + amount);

  // The enemy side goes through the damage pipeline like DEAL_DAMAGE (#247): shields, Tough,
  // Retaliate for an attack, defeat triggers and villain defeat. A labelled "(attack)" ability
  // is an attack by the player's identity.
  const damageOpts: AbilityDamageOptions = {
    sourceType: context.labelledAttack ? 'HERO' : undefined,
    sourcePlayerId: player.id,
    sourceCardInstance: context.sourceCardInstance,
    isAttack: Boolean(step.effectParams?.isAttack || context.isAttack || context.labelledAttack),
    hasPiercing: false,
    triggerChain: context.triggerChain,
  };
  let targetMinionOwner: PlayerState | undefined;
  let targetMinion: CardInstance | undefined;
  if (targetEnemyId && targetEnemyId !== 'villain') {
    for (const p of state.players) {
      targetMinion = p.engagedMinions.find((m) => m.instanceId === targetEnemyId);
      if (targetMinion) {
        targetMinionOwner = p;
        break;
      }
    }
  }
  if (targetMinion && targetMinionOwner) {
    state = applyAbilityDamage(
      state,
      minionTargetRef(targetMinion, targetMinionOwner.id),
      amount,
      damageOpts,
    ).state;
    recordAttackedEnemy(context, 'minion', targetMinion.instanceId);
  } else {
    const villain = getActiveVillain(state);
    state = applyAbilityDamage(state, villainTargetRef(villain), amount, damageOpts).state;
    recordAttackedEnemy(context, 'villain', villain.instanceId || 'villain');
  }

  return {
    state,
    success: true,
    mutatedState: true,
    value: amount,
    onomatopoeia: `TRANSFERRED ${amount} DAMAGE!`,
  };
}

export const DAMAGE_HANDLERS = {
  DEAL_DAMAGE: handleDealDamage,
  DISTRIBUTE_AMOUNT: handleDistributeAmount,
  HEAL_DAMAGE: handleHealDamage,
  PREVENT_DAMAGE: handlePreventDamage,
  GRANT_KEYWORD: handleGrantKeyword,
  ATTACHMENT_DAMAGE_SHIELD: handleGrantKeyword,
  TRANSFER_DAMAGE: handleTransferDamage,
} satisfies Partial<StepHandlerMap>;
