import { bindKernel, kernel } from '../kernel';
import {
  GameState,
  PlayerState,
  CardInstance,
  StatusCard,
  DefenderDeclaration,
  AttackExecutionContext,
  DecisionPromptOption,
  GamePhase,
  Keyword,
  hasKeyword,
  StepFacts,
  VillainState,
  getActiveVillain,
  getVillainById,
  PendingDamagePlacement,
  AllyCard,
} from '../models';
import { popDecisionPrompt } from './prompt-queue';
import { dealBoostCards, resolveBoostCards, type BoostLogContext } from './boost-resolution';
import { nextEngineId } from '../state/rng';
import { TriggerDispatchResult, type TriggerContext } from '../triggers/trigger-dispatcher';
import {
  applyDamageToTarget,
  resumeDamage,
  type DamageRequest,
  type TargetEntityRef,
} from './damage-pipeline';
import { recordBasicAction } from './stats';
import {
  getEffectiveHeroStats,
  getEffectiveVillainStats,
  getEffectiveMinionAttack,
  getEffectiveRetaliate,
  consumeEntityStatusCards,
} from './stat-calculator';
import { appendLog } from '../state/game-log';

export type DefensePolicy =
  'TAKE_UNDEFENDED' | 'HERO_IF_READY' | 'ALLY_CHUMP_BLOCK' | 'AUTO_OPTIMAL';

export interface CombatOptions {
  synchronousPolicy?: DefensePolicy;
  acceptOptionalTriggers?: boolean;
  stepping?: boolean;
}

/**
 * The villain performing the current attack: fixed at initiation (`attackerVillainId`), falling
 * back to the active villain for contexts created without one.
 */
function attackingVillain(state: GameState, attackContext: AttackExecutionContext): VillainState {
  return (
    (attackContext.attackerVillainId
      ? getVillainById(state, attackContext.attackerVillainId)
      : undefined) ?? getActiveVillain(state)
  );
}

/**
 * Step 1: Pre-Attack & Status Intercepts (RR v1.8 p. 4, 28)
 * Checks Stun status first (priority 1 per RR v1.8 p. 28 "Status Cards"),
 * then checks HOST_WOULD_ATTACK attachment interrupts (priority 2).
 * Returns true if the attack was cancelled.
 */
function step1_preAttackAndStunCheck(
  state: GameState,
  attackerType: 'VILLAIN' | 'MINION',
  attackerCard?: CardInstance,
  targetPlayer?: PlayerState,
  attackerVillain?: VillainState,
): boolean {
  const villain = attackerVillain ?? getActiveVillain(state);
  const attackerEntity = attackerType === 'VILLAIN' ? villain : attackerCard;
  if (!attackerEntity) return false;

  // Priority 1: Check Stun status on attacking entity (taking into account Steady - RR v1.8 p. 28)
  if (consumeEntityStatusCards(attackerEntity, StatusCard.STUNNED)) {
    if (attackerType === 'VILLAIN') {
      appendLog(state, {
        category: 'combat',
        key: 'villain.stunned.cancelled',
        params: { actor: villain.card.name },
        onomatopoeia: 'STUN CLEARED!',
      });
    } else if (attackerCard) {
      appendLog(state, {
        category: 'combat',
        key: 'minion.stunned.cancelled',
        params: { actor: attackerCard.card.name },
        onomatopoeia: 'STUN CLEARED!',
      });
    }
    return true;
  }

  // Priority 2: Check attachments on attacking entity for HOST_WOULD_ATTACK interrupts
  const attachments = attackerEntity.attachments || [];
  for (let i = 0; i < attachments.length; i++) {
    const att = attachments[i];
    const ability = att.card.enrichment?.abilities?.find((a) => a.trigger === 'HOST_WOULD_ATTACK');
    if (ability) {
      const owner =
        (att.ownerId ? state.players.find((p) => p.id === att.ownerId) : undefined) ||
        targetPlayer ||
        state.players[0];

      const targetInstanceId =
        attackerType === 'VILLAIN'
          ? villain.instanceId || 'villain'
          : attackerCard?.instanceId || 'minion';

      kernel.executeEffect(state, ability, {
        playerId: owner.id,
        sourceCardInstance: att,
        eventTargetInstanceId: targetInstanceId,
      });

      appendLog(state, {
        category: 'combat',
        key: attackerType === 'VILLAIN' ? 'villain.attack.cancelled' : 'minion.attack.cancelled',
        params: {
          actor: attackerEntity.card.name,
          source: att.card.name,
        },
        onomatopoeia: `${att.card.name.toUpperCase()}! ATTACK CANCELLED & STUNNED!`,
      });
      return true;
    }
  }

  return false;
}

/**
 * Step 2: Attack Initiation Triggers (RR v1.8 p. 24)
 * Dispatches VILLAIN_INITIATES_ATTACK (e.g. Spider-Sense draws a card).
 */
function step2_dispatchInitiationTriggers(
  state: GameState,
  attackerType: 'VILLAIN' | 'MINION',
  targetPlayerId: string,
  acceptOptionalTriggers?: boolean,
): TriggerDispatchResult {
  return kernel.dispatchTrigger(state, 'ENEMY_INITIATES_ATTACK', {
    targetPlayerId,
    attackerType,
    attackerKind: attackerType,
    acceptOptionalTriggers,
  });
}

/**
 * What the last finished attack did, as step result facts for the steps after the one that
 * started it (#295). No attack outcome (cancelled in step 1) means no damage.
 */
export function getAttackOutcomeFacts(state: GameState): StepFacts {
  const outcome = state.lastCombatOutcome;
  const damage = outcome?.finalDamage ?? 0;
  return {
    damageDealt: damage,
    ...(damage > 0 && outcome?.damagedCharacter
      ? { damagedCharacter: outcome.damagedCharacter }
      : {}),
  };
}

/**
 * Initiates an enemy attack against a target player (7-Step Combat State Machine).
 */
export function initiateEnemyAttack(
  state: GameState,
  attacker: { type: 'VILLAIN' | 'MINION'; card?: CardInstance; villainId?: string },
  targetPlayerId: string,
  options?: CombatOptions,
): GameState {
  return beginEnemyAttack(state, attacker, targetPlayerId, options).state;
}

/**
 * Starts an enemy attack and reports whether it happened. An attack that Stun or a
 * `HOST_WOULD_ATTACK` interrupt cancels in step 1 did not happen ("if X did not attack").
 */
export function beginEnemyAttack(
  state: GameState,
  attacker: { type: 'VILLAIN' | 'MINION'; card?: CardInstance; villainId?: string },
  targetPlayerId: string,
  options?: CombatOptions,
): { state: GameState; attacked: boolean } {
  state.lastCombatOutcome = undefined;
  // The attacking villain is fixed now: moving the active counter mid-activation must not change it.
  const attackerVillain =
    attacker.type === 'VILLAIN'
      ? ((attacker.villainId ? getVillainById(state, attacker.villainId) : undefined) ??
        getActiveVillain(state))
      : undefined;

  const player = state.players.find((p) => p.id === targetPlayerId);
  if (!player) return { state, attacked: false };

  // Step 1: Pre-Attack & Stun check
  const isCancelled = step1_preAttackAndStunCheck(
    state,
    attacker.type,
    attacker.card,
    player,
    attackerVillain,
  );
  if (isCancelled) return { state, attacked: false };
  if (attackerVillain) recordBasicAction(state, 'villainAttack', attackerVillain.card?.code);
  else if (attacker.card) recordBasicAction(state, 'minionAttack', attacker.card.card.code);

  // Step 2: Initiation Triggers (Spider-Sense draws card BEFORE defender is declared)
  const initResult = step2_dispatchInitiationTriggers(
    state,
    attacker.type,
    targetPlayerId,
    options?.acceptOptionalTriggers,
  );

  // Compute Base Stats & Keywords
  let baseAttack = 0;
  let hasOverkill = false;
  let hasPiercing = false;

  if (attackerVillain) {
    const villainStats = getEffectiveVillainStats(state, attackerVillain);
    baseAttack = villainStats.attack;
    hasOverkill = villainStats.keywords.includes('OVERKILL');
    hasPiercing = villainStats.keywords.includes('PIERCING');
  } else if (attacker.card) {
    baseAttack = getEffectiveMinionAttack(state, attacker.card);
    hasOverkill = hasKeyword(attacker.card, Keyword.OVERKILL);
    hasPiercing = hasKeyword(attacker.card, Keyword.PIERCING);
  }

  const attackContext: AttackExecutionContext = {
    attackId: nextEngineId(state, 'attack'),
    attackerType: attacker.type,
    attackerCard: attacker.card,
    attackerVillainId: attackerVillain?.instanceId,
    targetPlayerId,
    phase: initResult.hasPendingPrompt ? 'INITIATION' : 'DECLARE_DEFENDER',
    baseAttack,
    totalBoostIcons: 0,
    hasOverkill,
    hasPiercing,
    acceptOptionalTriggers: options?.acceptOptionalTriggers,
    synchronousPolicy: options?.synchronousPolicy,
  };

  if (initResult.hasPendingPrompt) {
    state.activeAttackContext = attackContext;
    return { state, attacked: true };
  }

  return { state: continueAttackAfterInitiation(state, attackContext), attacked: true };
}

/**
 * Resumes an attack after initiation trigger prompt has been resolved.
 */
export function continueAttackAfterInitiation(
  state: GameState,
  attackContext: AttackExecutionContext,
): GameState {
  const player = state.players.find((p) => p.id === attackContext.targetPlayerId);
  if (!player) return state;

  attackContext.phase = 'DECLARE_DEFENDER';

  // Check if synchronous policy specified (Headless tests / simulator)
  if (attackContext.synchronousPolicy) {
    const declaration = evaluateDefensePolicy(
      state,
      player,
      attackContext.synchronousPolicy,
      attackContext,
    );
    return resolveDefenderDeclaration(state, declaration, attackContext);
  }

  // Interactive UI Mode: Open Step 3 DECLARE_DEFENDER prompt
  return step3_openDefenderDeclarationPrompt(state, player, attackContext);
}

/**
 * Step 3: Open Defender Declaration Prompt in pendingDecisionQueue.
 */
function step3_openDefenderDeclarationPrompt(
  state: GameState,
  player: PlayerState,
  attackContext: AttackExecutionContext,
): GameState {
  state.activeAttackContext = attackContext;

  const options: DecisionPromptOption[] = [];

  // 1. Target Player: Basic Hero Defend option (if Hero form and ready)
  if (player.currentForm === 'hero' && !player.exhausted) {
    const heroStats = getEffectiveHeroStats(state, player);
    const heroRetaliate = getEffectiveRetaliate(player, state);
    const isTough = player.statusCards.includes(StatusCard.TOUGH);
    options.push({
      id: 'defend_hero',
      label: `Defend with ${player.hero.name} (DEF: ${heroStats.defense})`,
      description: `Exhaust ${player.hero.name} to mitigate incoming damage by ${heroStats.defense}.${heroRetaliate > 0 ? ` Retaliate ${heroRetaliate} on survival.` : ''}`,
      cardCode: player.hero.code,
      cardName: player.hero.name,
      statusBadges: {
        isTough,
        retaliate: heroRetaliate > 0 ? heroRetaliate : undefined,
      },
      effect: 'DECLARE_DEFENDER',
      params: { defenderType: 'HERO', playerId: player.id },
    });
  }

  // 2. Target Player: Ready Allies Defend options
  for (const ally of player.allies) {
    if (!ally.exhausted) {
      const allyRetaliate = getEffectiveRetaliate(ally, state);
      const isTough = (ally.statusCards || []).includes(StatusCard.TOUGH);
      const allyCard = ally.card as AllyCard;
      const allyHp = allyCard.health || 2;
      const currentDmg = ally.tokens?.damage || 0;
      const remHp = Math.max(0, allyHp - currentDmg);
      options.push({
        id: `defend_ally_${ally.instanceId}`,
        label: `Block with ${ally.card.name} (Ally)`,
        description: `Exhaust ${ally.card.name} to absorb incoming attack (HP: ${remHp}).${allyRetaliate > 0 ? ` Retaliate ${allyRetaliate} on survival.` : ''}`,
        cardCode: ally.card.code,
        cardName: ally.card.name,
        statusBadges: {
          isTough,
          retaliate: allyRetaliate > 0 ? allyRetaliate : undefined,
        },
        effect: 'DECLARE_DEFENDER',
        params: { defenderType: 'ALLY', playerId: player.id, allyInstanceId: ally.instanceId },
      });
    }
  }

  // 3. Other Players: Ready Heroes and Allies (Cross-Table Defense - RR v1.8 p. 209)
  const otherPlayers = (state.players || []).filter((p) => p.id !== player.id);
  for (const other of otherPlayers) {
    if (other.currentForm === 'hero' && !other.exhausted) {
      const otherStats = getEffectiveHeroStats(state, other);
      const otherRetaliate = getEffectiveRetaliate(other, state);
      const isTough = other.statusCards.includes(StatusCard.TOUGH);
      options.push({
        id: `defend_hero_${other.id}`,
        label: `Defend with ${other.hero.name} (${other.name}) (DEF: ${otherStats.defense})`,
        description: `Exhaust ${other.hero.name} to defend for ${player.hero.name}. Retargets attack to ${other.name}.`,
        cardCode: other.hero.code,
        cardName: other.hero.name,
        statusBadges: {
          isTough,
          retaliate: otherRetaliate > 0 ? otherRetaliate : undefined,
        },
        effect: 'DECLARE_DEFENDER',
        params: { defenderType: 'HERO', playerId: other.id },
      });
    }

    for (const ally of other.allies) {
      if (!ally.exhausted) {
        const allyRetaliate = getEffectiveRetaliate(ally, state);
        const isTough = (ally.statusCards || []).includes(StatusCard.TOUGH);
        const allyCard = ally.card as AllyCard;
        const allyHp = allyCard.health || 2;
        const currentDmg = ally.tokens?.damage || 0;
        const remHp = Math.max(0, allyHp - currentDmg);
        options.push({
          id: `defend_ally_${ally.instanceId}`,
          label: `Block with ${ally.card.name} (${other.hero?.name || other.name}'s Ally)`,
          description: `Exhaust ${ally.card.name} to block for ${player.hero.name} (HP: ${remHp}). Retargets attack to ${other.name}.`,
          cardCode: ally.card.code,
          cardName: ally.card.name,
          statusBadges: {
            isTough,
            retaliate: allyRetaliate > 0 ? allyRetaliate : undefined,
          },
          effect: 'DECLARE_DEFENDER',
          params: { defenderType: 'ALLY', playerId: other.id, allyInstanceId: ally.instanceId },
        });
      }
    }
  }

  // 4. Take Undefended option
  options.push({
    id: 'undefended',
    label: 'Take Undefended',
    description: `Do not exhaust any character. ${player.hero?.name || player.name} takes full attack damage.`,
    icon: 'punch',
    effect: 'DECLARE_DEFENDER',
    params: { defenderType: 'UNDEFENDED', playerId: player.id },
  });

  const attackerName =
    attackContext.attackerType === 'VILLAIN'
      ? attackingVillain(state, attackContext).card.name
      : attackContext.attackerCard?.card.name || 'Minion';

  const targetRetaliate = getEffectiveRetaliate(player, state);

  state = kernel.enqueueDecisionPrompt(state, {
    promptId: `prompt_defend_${attackContext.attackId}`,
    playerId: player.id,
    title: `Enemy Attack: ${attackerName} (Base ATK: ${attackContext.baseAttack})`,
    description: 'Declare a defender before boost cards are dealt or revealed.',
    sourceCardName: attackerName,
    sourceCardCode:
      attackContext.attackerType === 'VILLAIN'
        ? attackingVillain(state, attackContext).card.code
        : attackContext.attackerCard?.card.code,
    triggerSourceCard:
      attackContext.attackerType === 'VILLAIN'
        ? attackingVillain(state, attackContext).card
        : attackContext.attackerCard?.card,
    attackerName,
    attackerCardCode:
      attackContext.attackerType === 'VILLAIN'
        ? attackingVillain(state, attackContext).card.code
        : attackContext.attackerCard?.card.code,
    hasOverkill: attackContext.hasOverkill,
    hasPiercing: attackContext.hasPiercing,
    targetName: player.hero?.name || player.name,
    targetPlayerName: player.name,
    targetHeroName: player.hero?.name || player.name,
    targetCardCode: player.hero?.code,
    targetCurrentHp: player.health,
    targetMaxHp: player.maxHealth,
    targetHasTough: player.statusCards.includes(StatusCard.TOUGH),
    targetRetaliate: targetRetaliate > 0 ? targetRetaliate : undefined,
    options,
  });

  return state;
}

/**
 * Evaluates automated defense policy for headless simulations.
 */
function evaluateDefensePolicy(
  _state: GameState,
  player: PlayerState,
  policy: DefensePolicy,
  attackContext: AttackExecutionContext,
): DefenderDeclaration {
  if (policy === 'HERO_IF_READY' && player.currentForm === 'hero' && !player.exhausted) {
    return { type: 'HERO', playerId: player.id };
  }

  if (policy === 'ALLY_CHUMP_BLOCK') {
    const readyAlly = player.allies.find((a) => !a.exhausted);
    if (readyAlly) {
      return { type: 'ALLY', playerId: player.id, allyInstanceId: readyAlly.instanceId };
    }
    if (player.currentForm === 'hero' && !player.exhausted) {
      return { type: 'HERO', playerId: player.id };
    }
  }

  if (policy === 'AUTO_OPTIMAL') {
    // If incoming base attack would KO hero and ready ally exists, block with ally
    if (attackContext.baseAttack >= player.health && player.allies.some((a) => !a.exhausted)) {
      const ally = player.allies.find((a) => !a.exhausted)!;
      return { type: 'ALLY', playerId: player.id, allyInstanceId: ally.instanceId };
    }
    if (player.currentForm === 'hero' && !player.exhausted) {
      return { type: 'HERO', playerId: player.id };
    }
  }

  return { type: 'UNDEFENDED', playerId: player.id };
}

/**
 * Step 3 -> 7: Resolves defender declaration, executes boost cards, damage, and post-attack resolution.
 */
export function resolveDefenderDeclaration(
  state: GameState,
  declaration: DefenderDeclaration,
  customContext?: AttackExecutionContext,
): GameState {
  const attackContext = customContext || state.activeAttackContext;
  if (!attackContext) return state;

  const player = state.players.find((p) => p.id === declaration.playerId);
  if (!player) return state;

  state.activeAttackContext = attackContext;
  attackContext.defender = declaration;

  // Cross-table defense retargeting (RR v1.8 p. 209-213)
  if (
    (declaration.type === 'HERO' || declaration.type === 'ALLY') &&
    declaration.playerId !== attackContext.targetPlayerId
  ) {
    attackContext.targetPlayerId = declaration.playerId;
  }

  const attackerName =
    attackContext.attackerType === 'VILLAIN'
      ? attackingVillain(state, attackContext).card.name
      : attackContext.attackerCard?.card.name || 'Minion';
  const heroOrPlayerName = player.hero?.name || player.name;

  // Apply Defender Exhaustion & DEF stat
  if (declaration.type === 'HERO') {
    player.exhausted = true;
    attackContext.heroDefended = true;
    attackContext.defenseValue = getEffectiveHeroStats(state, player).defense;

    appendLog(state, {
      category: 'combat',
      key: 'combat.hero.defended',
      params: {
        actor: heroOrPlayerName,
        source: attackerName,
        target: heroOrPlayerName,
        player: player.name,
        amount: attackContext.defenseValue,
      },
      onomatopoeia: 'DEFENSE DECLARED!',
    });
  } else if (declaration.type === 'ALLY' && declaration.allyInstanceId) {
    const ally = player.allies.find((a) => a.instanceId === declaration.allyInstanceId);
    if (ally) {
      ally.exhausted = true;
      attackContext.heroDefended = false;
      attackContext.defenseValue = 0;

      appendLog(state, {
        category: 'combat',
        key: 'combat.ally.defended',
        params: {
          actor: ally.card.name,
          source: attackerName,
          target: heroOrPlayerName,
          player: player.name,
        },
        onomatopoeia: 'ALLY BLOCKS!',
      });
    }
  } else {
    attackContext.heroDefended = false;
    attackContext.defenseValue = 0;

    appendLog(state, {
      category: 'combat',
      key: 'combat.attack.undefended',
      params: {
        actor: attackerName,
        target: heroOrPlayerName,
        player: player.name,
      },
      onomatopoeia: 'UNDEFENDED!',
    });
  }

  // Step 4 & 5: Deal & Resolve Boost Cards
  step4_and_5_dealAndResolveBoostCards(state, attackContext);

  // Step 6: Damage Calculation, Prevention & Overkill
  step6_calculateAndApplyAttackDamage(state, attackContext);

  if (attackContext.pendingDamage !== undefined) {
    state.activeAttackContext = attackContext;
    return state;
  }

  // Step 7: Post-Attack Reactions, Retaliate & Cleanup
  state = step7_resolvePostAttackAndRetaliate(state, attackContext);

  recordOutcomeOnStepEvent(state, player, attackContext);

  state.activeAttackContext = undefined;

  // Clear defender decision prompt from queue if present
  if (kernel.peekDecisionPrompt(state)?.options.some((o) => o.effect === 'DECLARE_DEFENDER')) {
    popDecisionPrompt(state);
  }

  // Trigger next pending activation if outside of Villain Phase (e.g. Gang-Up treachery)
  if (
    state.phase !== GamePhase.VILLAIN_PHASE &&
    !kernel.peekDecisionPrompt(state) &&
    state.pendingActivations &&
    state.pendingActivations.length > 0
  ) {
    const act = state.pendingActivations.shift()!;
    const targetPlayer = state.players.find((p) => p.id === act.playerId);
    if (targetPlayer) {
      if (act.type === 'VILLAIN') {
        initiateEnemyAttack(state, { type: 'VILLAIN' }, targetPlayer.id);
      } else if (act.type === 'MINION') {
        const minion = targetPlayer.engagedMinions.find(
          (m) => m.instanceId === act.minionInstanceId,
        );
        if (minion) {
          initiateEnemyAttack(state, { type: 'MINION', card: minion }, targetPlayer.id);
        }
      }
    }
  }

  return state;
}

/**
 * Step 4 & 5: Deal & 1-by-1 Boost Cards Resolution Loop (shared with schemes, see boost-resolution).
 */
export function step4_and_5_dealAndResolveBoostCards(
  state: GameState,
  attackContext: AttackExecutionContext,
): void {
  attackContext.phase = 'REVEAL_BOOST';

  const attacker =
    attackContext.attackerType === 'VILLAIN'
      ? attackingVillain(state, attackContext)
      : attackContext.attackerCard;
  if (!attacker) return;

  const log: BoostLogContext = {
    category: 'combat',
    actor: {
      name: attacker.card.name,
      type: attackContext.attackerType === 'VILLAIN' ? 'villain' : 'minion',
    },
  };
  const queue = dealBoostCards(state, attacker, log);

  attackContext.totalBoostIcons += resolveBoostCards(state, {
    ...log,
    queue,
    activatorInstanceId: attacker.instanceId ?? attackContext.attackerVillainId ?? 'villain',
    playerId: attackContext.targetPlayerId,
    abilityContext: {
      attackerType: attackContext.attackerType,
      defenderType: attackContext.defender?.type ?? 'UNDEFENDED',
    },
    onRevealed: (boostCard) => {
      (attackContext.revealedBoostCards ??= []).push(boostCard);
    },
    // "If this activation deals damage ...": the outcome is unknown until step 6, so the
    // ability waits and resolves after damage (applyCalculatedAttackDamage, #221).
    onDeferred: (ability, boostCard) => {
      if (!ability.steps?.some((s) => s.gate === 'IF_ACTIVATION_DEALT_DAMAGE')) return false;
      (attackContext.deferredBoostAbilities ??= []).push({
        ability,
        sourceCardInstance: boostCard,
      });
      return true;
    },
  });
}

/**
 * Step 6: Damage Calculation, Prevention Interrupts & Overkill.
 */
export function step6_calculateAndApplyAttackDamage(
  state: GameState,
  attackContext: AttackExecutionContext,
): void {
  attackContext.phase = 'CALCULATE_DAMAGE';

  const player = state.players.find((p) => p.id === attackContext.targetPlayerId);
  if (!player) return;

  const totalAttack = attackContext.baseAttack + attackContext.totalBoostIcons;
  let rawDamage = totalAttack;

  // Subtract Hero DEF if Hero Defended
  if (attackContext.defender?.type === 'HERO') {
    rawDamage = Math.max(0, totalAttack - (attackContext.defenseValue || 0));
  }

  // Verify defending ally is still alive (RR v1.8 p. 226-228: if ally was defeated by boost, revert to UNDEFENDED)
  let defenderAlly =
    attackContext.defender?.type === 'ALLY' && attackContext.defender.allyInstanceId
      ? player.allies.find((a) => a.instanceId === attackContext.defender?.allyInstanceId)
      : undefined;

  if (attackContext.defender?.type === 'ALLY' && !defenderAlly) {
    appendLog(state, {
      category: 'combat',
      key: 'ally.defeated.boost.undefended',
      params: {
        actor:
          attackContext.attackerType === 'VILLAIN'
            ? attackingVillain(state, attackContext).card.name
            : attackContext.attackerCard?.card.name || 'Minion',
        target: player.hero?.name || player.name,
      },
      onomatopoeia: 'DEFENDER DEFEATED! ATTACK UNDEFENDED!',
    });
    attackContext.defender = { type: 'UNDEFENDED', playerId: attackContext.targetPlayerId };
    attackContext.heroDefended = false;
    attackContext.defenseValue = 0;
  }

  applyCalculatedAttackDamage(state, player, attackContext, rawDamage);
}

/**
 * What the offered cards show for the damage of this attack (RR v1.8 Damage, step 3): the
 * attacker, the defender and the target, read before any damage is placed.
 */
function wouldTakeContext(
  state: GameState,
  player: PlayerState,
  attackContext: AttackExecutionContext,
): Partial<TriggerContext> {
  const defenderAlly =
    attackContext.defender?.type === 'ALLY'
      ? player.allies.find((a) => a.instanceId === attackContext.defender?.allyInstanceId)
      : undefined;
  return {
    attackerCardCode:
      attackContext.attackerCard?.card?.code || attackingVillain(state, attackContext)?.card?.code,
    attackerName:
      attackContext.attackerCard?.card?.name ||
      attackingVillain(state, attackContext)?.card?.name ||
      'Enemy',
    defenderType:
      attackContext.defender?.type || (attackContext.heroDefended ? 'HERO' : 'UNDEFENDED'),
    defenderCardCode:
      defenderAlly?.card?.code ||
      (attackContext.heroDefended ? player.activeFormCard?.code : undefined),
    defenderName:
      defenderAlly?.card?.name ||
      (attackContext.heroDefended ? player.activeFormCard?.name || player.name : undefined),
    targetCardCode: player.activeFormCard?.code || player.hero?.code,
    targetName: player.activeFormCard?.name || player.hero?.name || player.name,
    targetCurrentHp: player.health,
    targetMaxHp: player.maxHealth,
    acceptOptionalTriggers: attackContext.acceptOptionalTriggers,
  };
}

/**
 * The parts of the damage request of an attack that are code, not data. They are rebuilt when the
 * "would take" prompts are answered and the paused damage resumes (`resumeDamage`).
 */
function attackDamageHooks(
  state: GameState,
  player: PlayerState,
  attackContext: AttackExecutionContext,
): Required<Pick<DamageRequest, 'logPlayerHit' | 'wouldTakeWindow'>> {
  const enemy =
    attackContext.attackerType === 'VILLAIN' ? attackingVillain(state, attackContext) : undefined;
  const attackerName = enemy ? enemy.card.name : attackContext.attackerCard?.card.name || 'Minion';
  return {
    logPlayerHit: ({ amount, remainingHealth }) =>
      appendLog(state, {
        category: 'combat',
        key: enemy ? 'villain.attack.hit' : 'minion.attack.hit',
        params: {
          actor: attackerName,
          who_attacks: attackerName,
          target: player.name,
          who_is_taking_damage: player.name,
          player: player.name,
          amount,
          damage: amount,
          remainingHp: remainingHealth,
          defended: attackContext.heroDefended ? 'true' : 'false',
        },
        onomatopoeia: 'WHAM!',
      }),
    wouldTakeWindow: {
      attackId: attackContext.attackId,
      context: wouldTakeContext(state, player, attackContext),
      // A prevented hit counts as the hero's defense, unless an ally defended the attack.
      onPrevented: () => {
        if (attackContext.defender?.type === 'ALLY') return;
        attackContext.heroDefended = true;
        if (attackContext.defender?.type !== 'HERO') {
          attackContext.defender = { type: 'HERO', playerId: player.id };
        }
      },
    },
  };
}

/**
 * Applies calculated attack damage to hero or ally (Step 6 continuation). When the damage stops at
 * the "would take" window the attack waits (`pendingDamage`) and
 * `finishAttackDamageAndPostResolution` completes it once the prompts are answered.
 */
export function applyCalculatedAttackDamage(
  state: GameState,
  player: PlayerState,
  attackContext: AttackExecutionContext,
  rawDamage: number,
): void {
  const enemy =
    attackContext.attackerType === 'VILLAIN' ? attackingVillain(state, attackContext) : undefined;
  const defendingAlly =
    attackContext.defender?.type === 'ALLY' && attackContext.defender.allyInstanceId
      ? player.allies.find((a) => a.instanceId === attackContext.defender!.allyInstanceId)
      : undefined;

  // One damage procedure for every source (ADR-0078): Tough, Piercing, damage shields, the
  // "would take" window, defeat and Overkill are the pipeline's. Retaliate is step 7 of the attack.
  const damageTo = (target: TargetEntityRef) =>
    applyDamageToTarget(state, {
      target,
      amount: rawDamage,
      sourceType: enemy ? 'VILLAIN' : 'MINION',
      sourceCardInstance: attackContext.attackerCard,
      sourceInstanceId: enemy?.instanceId,
      isAttack: true,
      hasPiercing: attackContext.hasPiercing,
      hasOverkill: attackContext.hasOverkill,
      skipRetaliate: true,
      ...attackDamageHooks(state, player, attackContext),
    });

  let damage: ReturnType<typeof damageTo> | undefined;
  if (attackContext.defender?.type === 'ALLY') {
    // Ally Takes Attack Damage
    if (defendingAlly) {
      attackContext.damagedCharacter = {
        type: 'ALLY',
        playerId: player.id,
        allyInstanceId: defendingAlly.instanceId,
      };
      damage = damageTo({
        type: 'ally',
        entity: defendingAlly,
        instanceId: defendingAlly.instanceId,
        name: defendingAlly.card.name,
        targetPlayerId: player.id,
        attachments: defendingAlly.attachments,
        statusCards: defendingAlly.statusCards,
      });
    }
  } else {
    // Hero or Undefended Identity Takes Attack Damage
    attackContext.damagedCharacter = { type: 'HERO', playerId: player.id };
    damage = damageTo({
      type: 'player',
      entity: player,
      name: player.name,
      targetPlayerId: player.id,
      attachments: player.attachments,
      statusCards: player.statusCards,
    });
  }

  if (damage?.paused) {
    attackContext.pendingDamage = state.pendingDamagePlacements?.at(-1)?.amount ?? 0;
    return;
  }
  completeAttackDamage(state, player, attackContext, damage?.result.damageTaken ?? rawDamage);
}

/**
 * Records the outcome of the attack's damage and resolves the boost abilities that waited for it.
 * Runs once per attack: straight after the damage, or once the "would take" prompts are answered.
 * `damageTaken` is what the defending character took (the ally, not the Overkill excess).
 */
function completeAttackDamage(
  state: GameState,
  player: PlayerState,
  attackContext: AttackExecutionContext,
  damageTaken: number,
): void {
  const enemy =
    attackContext.attackerType === 'VILLAIN' ? attackingVillain(state, attackContext) : undefined;
  const attackerName = enemy ? enemy.card.name : attackContext.attackerCard?.card.name || 'Minion';
  attackContext.finalDamage = damageTaken;

  const attackerCode = enemy ? enemy.card.code : attackContext.attackerCard?.card.code;

  state.lastCombatOutcome = {
    id: attackContext.attackId,
    attackerName,
    attackerCode,
    attackerType: attackContext.attackerType,
    targetPlayerId: player.id,
    targetHeroName: player.hero?.name || player.name,
    targetHeroCode: player.hero?.code,
    defenderType: attackContext.defender?.type,
    defenderName:
      attackContext.defender?.type === 'HERO'
        ? player.hero?.name || player.name
        : attackContext.defender?.type === 'ALLY'
          ? player.allies.find((a) => a.instanceId === attackContext.defender?.allyInstanceId)?.card
              .name || 'Ally'
          : undefined,
    defenderCode:
      attackContext.defender?.type === 'HERO'
        ? player.hero?.code
        : attackContext.defender?.type === 'ALLY'
          ? player.allies.find((a) => a.instanceId === attackContext.defender?.allyInstanceId)?.card
              .code
          : undefined,
    baseAttack: attackContext.baseAttack,
    boostCards: attackContext.revealedBoostCards ? [...attackContext.revealedBoostCards] : [],
    totalBoostIcons: attackContext.totalBoostIcons,
    defenseValue: attackContext.defenseValue || 0,
    finalDamage: damageTaken,
    damagedCharacter: attackContext.damagedCharacter,
    hasOverkill: attackContext.hasOverkill,
    hasPiercing: attackContext.hasPiercing,
  };

  resolveDeferredBoostAbilities(state, attackContext);
}

/**
 * Resolves the boost abilities that waited for this activation's damage (step 5 deferral, #221).
 * Called once from `applyCalculatedAttackDamage`, which both the direct step 6 path and the
 * damage-prevention prompt resume path run, so no path resolves them twice or not at all.
 * The queue is emptied first so a re-entrant call cannot resolve an ability again.
 */
function resolveDeferredBoostAbilities(
  state: GameState,
  attackContext: AttackExecutionContext,
): void {
  const deferred = attackContext.deferredBoostAbilities;
  if (!deferred?.length) return;
  attackContext.deferredBoostAbilities = [];

  for (const { ability, sourceCardInstance } of deferred) {
    kernel.executeEffect(state, ability, {
      playerId: attackContext.targetPlayerId,
      sourceCardInstance,
      attackerType: attackContext.attackerType,
      defenderType: attackContext.defender?.type ?? 'UNDEFENDED',
      activationDamage: attackContext.finalDamage ?? 0,
      damagedCharacter: attackContext.damagedCharacter,
    });

    appendLog(state, {
      category: 'combat',
      key: 'villain.boost.starResolved',
      params: {
        card: sourceCardInstance.card.name,
        source: ability.id,
        abilityId: ability.id,
      },
      onomatopoeia: 'STAR BOOST ACTIVATED!',
    });
  }
}

/** Copies the outcome of the attack onto the villain phase step event the players are shown. */
function recordOutcomeOnStepEvent(
  state: GameState,
  player: PlayerState,
  attackContext: AttackExecutionContext,
): void {
  if (!state.lastCombatOutcome || !state.villainPhaseStepEvent) return;
  const { attackerName, finalDamage } = state.lastCombatOutcome;
  state.villainPhaseStepEvent.amount = finalDamage;
  state.villainPhaseStepEvent.description = `${attackerName} attacked ${player.name} (${attackContext.defender?.type === 'HERO' ? 'Hero Defended' : attackContext.defender?.type === 'ALLY' ? 'Ally Defended' : 'Undefended'}) for ${finalDamage} damage.`;
  state.villainPhaseStepEvent.onomatopoeia = finalDamage > 0 ? 'BANG!' : 'BLOCKED!';
  state.villainPhaseStepEvent.combatOutcome = state.lastCombatOutcome;
}

/**
 * Resumes the attack once the "would take" prompts of its damage are answered: places the live
 * amount through the damage pipeline (an Overkill excess included), records the outcome and runs
 * step 7 (#389).
 */
export function finishAttackDamageAndPostResolution(
  state: GameState,
  attackContext: AttackExecutionContext,
  placement: PendingDamagePlacement,
): GameState {
  const player = state.players.find((p) => p.id === attackContext.targetPlayerId);
  if (!player) return state;
  delete attackContext.pendingDamage;

  const hooks = attackDamageHooks(state, player, attackContext);
  const resumed = resumeDamage(state, placement, {
    logPlayerHit: hooks.logPlayerHit,
    onPrevented: hooks.wouldTakeWindow.onPrevented,
  });
  completeAttackDamage(resumed.state, player, attackContext, resumed.result.damageTaken);
  state = step7_resolvePostAttackAndRetaliate(resumed.state, attackContext);
  recordOutcomeOnStepEvent(state, player, attackContext);

  state.activeAttackContext = undefined;
  return state;
}

/**
 * Finishes the attack damage that waited for its "would take" prompts (#267, #389). Called once
 * all the interrupt prompts of the window are answered.
 */
export function finishPendingDamagePlacements(state: GameState): GameState {
  const pending: PendingDamagePlacement[] = state.pendingDamagePlacements ?? [];
  delete state.pendingDamagePlacements;
  let current = state;
  for (const placement of pending) {
    if (!current.activeAttackContext) {
      throw new Error(`Paused damage ${placement.id} has no attack to finish`);
    }
    current = finishAttackDamageAndPostResolution(current, current.activeAttackContext, placement);
  }
  return current;
}

/**
 * Step 7: Post-Attack Reactions, Retaliate & Cleanup.
 */
function step7_resolvePostAttackAndRetaliate(
  state: GameState,
  attackContext: AttackExecutionContext,
): GameState {
  attackContext.phase = 'POST_ATTACK';

  const player = state.players.find((p) => p.id === attackContext.targetPlayerId);

  // Post-Defense Reactions (e.g. Indomitable 01082 ready hero, Counter-Punch 01077)
  const attackerInstanceId =
    attackContext.attackerCard?.instanceId ?? attackContext.attackerVillainId;
  if (attackContext.heroDefended && player) {
    kernel.dispatchTrigger(state, 'ATTACK_DEFENDED', {
      targetPlayerId: player.id,
      defenderType: 'HERO',
      targetInstanceId: attackerInstanceId,
      sourceInstanceId: attackContext.attackerCard?.instanceId,
      damageAmount: attackContext.finalDamage,
      acceptOptionalTriggers: attackContext.acceptOptionalTriggers,
    });
  } else if (attackContext.defender?.type === 'ALLY' && player) {
    kernel.dispatchTrigger(state, 'ATTACK_DEFENDED', {
      targetPlayerId: player.id,
      defenderType: 'ALLY',
      targetInstanceId: attackerInstanceId,
      sourceInstanceId: attackContext.attackerCard?.instanceId,
      damageAmount: attackContext.finalDamage,
      acceptOptionalTriggers: attackContext.acceptOptionalTriggers,
    });
  }

  kernel.dispatchTrigger(state, 'ATTACK_RESOLVED', {
    targetPlayerId: attackContext.targetPlayerId,
    damageAmount: attackContext.finalDamage,
    acceptOptionalTriggers: attackContext.acceptOptionalTriggers,
    attackSource: { kind: 'ENEMY', instanceId: attackerInstanceId },
  });

  // Step 7 Retaliate: If defending character survived and has Retaliate X, deal X damage back to attacker (RR v1.8 p. 24, ADR-0054)
  const heroAttacked = attackContext.heroDefended || attackContext.defender?.type === 'UNDEFENDED';
  const allyDefended = attackContext.defender?.type === 'ALLY';

  if (player && player.health > 0 && heroAttacked && !allyDefended) {
    const retaliateX = getEffectiveRetaliate(player, state);

    if (retaliateX > 0) {
      if (attackContext.attackerType === 'VILLAIN') {
        const villain = attackingVillain(state, attackContext);
        const damageRes = kernel.applyDamageToTarget(state, {
          target: {
            type: 'villain',
            entity: villain,
            instanceId: villain.instanceId,
            name: villain.card?.name || 'Villain',
            attachments: villain.attachments,
            statusCards: villain.statusCards,
          },
          amount: retaliateX,
          sourceType: 'HERO',
          sourcePlayerId: player.id,
          isAttack: false,
          skipRetaliate: true,
        });
        state = damageRes.state;
      } else if (attackContext.attackerCard) {
        const minion = attackContext.attackerCard;
        const damageRes = kernel.applyDamageToTarget(state, {
          target: {
            type: 'minion',
            entity: minion,
            instanceId: minion.instanceId,
            name: minion.card.name,
            targetPlayerId: attackContext.targetPlayerId,
            attachments: minion.attachments,
            statusCards: minion.statusCards,
          },
          amount: retaliateX,
          sourceType: 'HERO',
          sourcePlayerId: player.id,
          isAttack: false,
          skipRetaliate: true,
        });
        state = damageRes.state;
      }

      const characterName = player.hero?.name || player.name;
      const targetName =
        attackContext.attackerType === 'VILLAIN'
          ? attackingVillain(state, attackContext).card?.name || 'Villain'
          : attackContext.attackerCard?.card.name || 'Minion';

      appendLog(state, {
        category: 'combat',
        key: 'RETALIATE_DAMAGE',
        actor: {
          name: characterName,
          type: 'hero',
        },
        params: {
          actor: characterName,
          who: characterName,
          amount: retaliateX,
          damage: retaliateX,
          target: targetName,
        },
        text: `${characterName} retaliated for ${retaliateX} damage.`,
        onomatopoeia: 'RETALIATE!',
      });
    }
  } else if (allyDefended && attackContext.defender?.allyInstanceId && player) {
    const ally = player.allies.find((a) => a.instanceId === attackContext.defender?.allyInstanceId);
    if (ally) {
      const allyRetaliate = getEffectiveRetaliate(ally, state);
      if (allyRetaliate > 0) {
        if (attackContext.attackerType === 'VILLAIN') {
          const villain = attackingVillain(state, attackContext);
          const damageRes = kernel.applyDamageToTarget(state, {
            target: {
              type: 'villain',
              entity: villain,
              instanceId: villain.instanceId,
              name: villain.card?.name || 'Villain',
              attachments: villain.attachments,
              statusCards: villain.statusCards,
            },
            amount: allyRetaliate,
            sourceType: 'ALLY',
            sourcePlayerId: player.id,
            sourceCardInstance: ally,
            isAttack: false,
            skipRetaliate: true,
          });
          state = damageRes.state;
        } else if (attackContext.attackerCard) {
          const minion = attackContext.attackerCard;
          const damageRes = kernel.applyDamageToTarget(state, {
            target: {
              type: 'minion',
              entity: minion,
              instanceId: minion.instanceId,
              name: minion.card.name,
              targetPlayerId: attackContext.targetPlayerId,
              attachments: minion.attachments,
              statusCards: minion.statusCards,
            },
            amount: allyRetaliate,
            sourceType: 'ALLY',
            sourcePlayerId: player.id,
            sourceCardInstance: ally,
            isAttack: false,
            skipRetaliate: true,
          });
          state = damageRes.state;
        }

        const characterName = ally.card.name;
        const targetName =
          attackContext.attackerType === 'VILLAIN'
            ? attackingVillain(state, attackContext).card?.name || 'Villain'
            : attackContext.attackerCard?.card.name || 'Minion';

        appendLog(state, {
          category: 'combat',
          key: 'RETALIATE_DAMAGE',
          actor: {
            name: characterName,
            type: 'ally',
          },
          params: {
            actor: characterName,
            who: characterName,
            amount: allyRetaliate,
            damage: allyRetaliate,
            target: targetName,
          },
          text: `${characterName} retaliated for ${allyRetaliate} damage.`,
          onomatopoeia: 'RETALIATE!',
        });
      }
    }
  }

  // HOST_ATTACK_ENDED: attachments on the attacker react at the end of the attack (e.g. Charge
  // discards itself). Iterate a copy since the ability removes its own attachment.
  const attackerAttachments =
    attackContext.attackerType === 'VILLAIN'
      ? attackingVillain(state, attackContext).attachments
      : attackContext.attackerCard?.attachments;
  for (const att of [...(attackerAttachments || [])]) {
    const owner =
      (att.ownerId ? state.players.find((p) => p.id === att.ownerId) : undefined) ||
      player ||
      state.players[0];
    const ownerId =
      owner?.id ||
      att.ownerId ||
      attackContext.targetPlayerId ||
      state.eliminatedPlayers?.[0]?.id ||
      '';
    for (const ability of att.card.enrichment?.abilities || []) {
      if (ability.trigger !== 'HOST_ATTACK_ENDED') continue;
      kernel.executeEffect(state, ability, { playerId: ownerId, sourceCardInstance: att });
    }
  }

  // Forced Responses on minion attack (e.g. Sandman 01102, Yon-Rogg 01177). An attack whose target
  // was eliminated has ended (RR v1.8 Player Elimination).
  const isMinionEngaged =
    (player?.engagedMinions.some((m) => m.instanceId === attackContext.attackerCard?.instanceId) ??
      false) ||
    state.players.some((p) =>
      p.engagedMinions.some((m) => m.instanceId === attackContext.attackerCard?.instanceId),
    );
  if (
    player &&
    attackContext.attackerType === 'MINION' &&
    attackContext.attackerCard &&
    isMinionEngaged
  ) {
    const minion = attackContext.attackerCard;
    const abilities = minion.card.enrichment?.abilities || [];
    for (const ability of abilities) {
      if (
        ability.trigger === 'MINION_ATTACKED' ||
        (ability.timing === 'FORCED_RESPONSE' && ability.trigger === 'ATTACK')
      ) {
        kernel.executeEffect(state, ability, {
          playerId: attackContext.targetPlayerId,
          sourceCardInstance: minion,
        });
      }
    }
  }

  return state;
}

/**
 * Executes a complete enemy attack synchronously using the specified defense policy.
 * Used for headless unit tests and fast match simulations.
 */
export function executeEnemyAttackSynchronously(
  state: GameState,
  attacker: { type: 'VILLAIN' | 'MINION'; card?: CardInstance; villainId?: string },
  targetPlayerId: string,
  policy: DefensePolicy = 'TAKE_UNDEFENDED',
  options?: { acceptOptionalTriggers?: boolean },
): GameState {
  return initiateEnemyAttack(state, attacker, targetPlayerId, {
    synchronousPolicy: policy,
    acceptOptionalTriggers: options?.acceptOptionalTriggers ?? true,
  });
}

bindKernel({ continueAttackAfterInitiation, getAttackOutcomeFacts, finishPendingDamagePlacements });
