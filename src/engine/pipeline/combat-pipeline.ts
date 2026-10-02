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
} from '../models';
import { enqueueDecisionPrompt, popDecisionPrompt } from './prompt-queue';
import { dispatchTrigger, TriggerDispatchResult } from '../triggers/trigger-dispatcher';
import { executeEffect, processHostDefeated, resetCardState } from '../effects';
import {
  getEffectiveHeroStats,
  getEffectiveVillainStats,
  getEffectiveRetaliate,
  hasEntityKeyword,
  consumeEntityStatusCards,
} from './stat-calculator';

export type DefensePolicy =
  'TAKE_UNDEFENDED' | 'HERO_IF_READY' | 'ALLY_CHUMP_BLOCK' | 'AUTO_OPTIMAL';

function dispatchCanonicalCharacterDefeat(
  state: GameState,
  targetPlayerId: string,
  sourceInstanceId: string,
  targetType?: 'ALLY' | 'HERO' | 'MINION' | 'VILLAIN',
): void {
  const context = {
    targetPlayerId,
    sourceInstanceId,
    entityType: 'CHARACTER' as const,
    targetType,
  };
  dispatchTrigger(state, 'DEFEATED', context);
  dispatchTrigger(state, 'CHARACTER_DEFEATED', context);
}

export interface CombatOptions {
  synchronousPolicy?: DefensePolicy;
  acceptOptionalTriggers?: boolean;
  stepping?: boolean;
}

/**
 * Helper to draw the top card of the encounter deck.
 * If empty, increments acceleration tokens, shuffles discard pile into a new deck (RR v1.8 p. 11).
 */
export function drawEncounterCardForCombat(state: GameState): CardInstance | undefined {
  if (state.encounterDeck.length === 0) {
    if (state.encounterDiscard.length === 0) return undefined;

    state.accelerationTokens += 1;
    state.log.push({
      id: `log_${Date.now()}`,
      timestamp: Date.now(),
      round: state.roundNumber,
      phase: state.phase,
      category: 'phase',
      key: 'encounter.deck.empty',
      onomatopoeia: 'ACCELERATION!',
    });

    state.encounterDeck = [...state.encounterDiscard].sort(() => Math.random() - 0.5);
    state.encounterDiscard = [];
  }

  return state.encounterDeck.shift();
}

/**
 * Step 1: Pre-Attack & Status Intercepts (RR v1.8 p. 4, 28)
 * Checks Stun status first (priority 1 per RR v1.8 p. 28 "Status Cards"),
 * then checks HOST_WOULD_ATTACK attachment interrupts (priority 2).
 * Returns true if the attack was cancelled.
 */
export function step1_preAttackAndStunCheck(
  state: GameState,
  attackerType: 'VILLAIN' | 'MINION',
  attackerCard?: CardInstance,
  targetPlayer?: PlayerState,
): boolean {
  const attackerEntity = attackerType === 'VILLAIN' ? state.villain : attackerCard;
  if (!attackerEntity) return false;

  // Priority 1: Check Stun status on attacking entity (taking into account Steady - RR v1.8 p. 28)
  if (consumeEntityStatusCards(attackerEntity, StatusCard.STUNNED)) {
    if (attackerType === 'VILLAIN') {
      state.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        category: 'combat',
        key: 'villain.stunned.cancelled',
        params: { villain: state.villain.card.name },
        onomatopoeia: 'STUN CLEARED!',
      });
    } else if (attackerCard) {
      state.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        category: 'combat',
        key: 'minion.stunned.cancelled',
        params: { minion: attackerCard.card.name },
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
          ? state.villain.instanceId || 'villain'
          : attackerCard?.instanceId || 'minion';

      executeEffect(state, ability, {
        playerId: owner.id,
        sourceCardInstance: att,
        targetInstanceId,
      });

      state.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        category: 'combat',
        key: attackerType === 'VILLAIN' ? 'villain.attack.cancelled' : 'minion.attack.cancelled',
        params: {
          ...(attackerType === 'VILLAIN' ? { villain: state.villain.card.name } : {}),
          ...(attackerType === 'MINION' && attackerCard ? { minion: attackerCard.card.name } : {}),
          cancelledBy: att.card.name,
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
export function step2_dispatchInitiationTriggers(
  state: GameState,
  attackerType: 'VILLAIN' | 'MINION',
  targetPlayerId: string,
  acceptOptionalTriggers?: boolean,
): TriggerDispatchResult {
  return dispatchTrigger(state, 'ENEMY_INITIATES_ATTACK', {
    targetPlayerId,
    attackerType,
    attackerKind: attackerType,
    acceptOptionalTriggers,
  });
}

/**
 * Initiates an enemy attack against a target player (7-Step Combat State Machine).
 */
export function initiateEnemyAttack(
  state: GameState,
  attacker: { type: 'VILLAIN' | 'MINION'; card?: CardInstance },
  targetPlayerId: string,
  options?: CombatOptions,
): GameState {
  state.lastCombatOutcome = undefined;

  const player = state.players.find((p) => p.id === targetPlayerId);
  if (!player) return state;

  // Step 1: Pre-Attack & Stun check
  const isCancelled = step1_preAttackAndStunCheck(state, attacker.type, attacker.card, player);
  if (isCancelled) return state;

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

  if (attacker.type === 'VILLAIN') {
    const villainStats = getEffectiveVillainStats(state, state.villain);
    baseAttack = villainStats.attack;
    hasOverkill = villainStats.keywords.includes('OVERKILL');
    hasPiercing = villainStats.keywords.includes('PIERCING');
  } else if (attacker.card) {
    baseAttack = (attacker.card.card as any).attack || 1;
    hasOverkill = hasKeyword(attacker.card, Keyword.OVERKILL);
    hasPiercing = hasKeyword(attacker.card, Keyword.PIERCING);
  }

  const attackContext: AttackExecutionContext = {
    attackId: `attack_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    attackerType: attacker.type,
    attackerCard: attacker.card,
    targetPlayerId,
    phase: initResult.hasPendingPrompt ? 'INITIATION' : 'DECLARE_DEFENDER',
    baseAttack,
    boostQueue: [],
    totalBoostIcons: 0,
    hasOverkill,
    hasPiercing,
    acceptOptionalTriggers: options?.acceptOptionalTriggers,
    synchronousPolicy: options?.synchronousPolicy,
  };

  if (initResult.hasPendingPrompt) {
    state.activeAttackContext = attackContext;
    return state;
  }

  return continueAttackAfterInitiation(state, attackContext);
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
export function step3_openDefenderDeclarationPrompt(
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
      const allyCard = ally.card as any;
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
        const allyCard = ally.card as any;
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
      ? state.villain.card.name
      : attackContext.attackerCard?.card.name || 'Minion';

  const targetRetaliate = getEffectiveRetaliate(player, state);

  state = enqueueDecisionPrompt(state, {
    promptId: `prompt_defend_${attackContext.attackId}`,
    playerId: player.id,
    title: `Enemy Attack: ${attackerName} (Base ATK: ${attackContext.baseAttack})`,
    description: 'Declare a defender before boost cards are dealt or revealed.',
    sourceCardName: attackerName,
    sourceCardCode:
      attackContext.attackerType === 'VILLAIN'
        ? state.villain.card.code
        : attackContext.attackerCard?.card.code,
    triggerSourceCard:
      attackContext.attackerType === 'VILLAIN'
        ? state.villain.card
        : attackContext.attackerCard?.card,
    attackerName,
    attackerCardCode:
      attackContext.attackerType === 'VILLAIN'
        ? state.villain.card.code
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
export function evaluateDefensePolicy(
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
      ? state.villain.card.name
      : attackContext.attackerCard?.card.name || 'Minion';
  const heroOrPlayerName = player.hero?.name || player.name;

  // Apply Defender Exhaustion & DEF stat
  if (declaration.type === 'HERO') {
    player.exhausted = true;
    attackContext.heroDefended = true;
    attackContext.defenseValue = getEffectiveHeroStats(state, player).defense;

    state.log.push({
      id: `log_${Date.now()}`,
      timestamp: Date.now(),
      round: state.roundNumber,
      phase: state.phase,
      category: 'combat',
      key: 'combat.hero.defended',
      params: {
        player: player.name,
        defense: attackContext.defenseValue,
        who_attacks: attackerName,
        who_defends: heroOrPlayerName,
        target: heroOrPlayerName,
      },
      onomatopoeia: 'DEFENSE DECLARED!',
    });
  } else if (declaration.type === 'ALLY' && declaration.allyInstanceId) {
    const ally = player.allies.find((a) => a.instanceId === declaration.allyInstanceId);
    if (ally) {
      ally.exhausted = true;
      attackContext.heroDefended = false;
      attackContext.defenseValue = 0;

      state.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        category: 'combat',
        key: 'combat.ally.defended',
        params: {
          player: player.name,
          ally: ally.card.name,
          who_attacks: attackerName,
          who_defends: ally.card.name,
          target: heroOrPlayerName,
        },
        onomatopoeia: 'ALLY BLOCKS!',
      });
    }
  } else {
    attackContext.heroDefended = false;
    attackContext.defenseValue = 0;

    state.log.push({
      id: `log_${Date.now()}`,
      timestamp: Date.now(),
      round: state.roundNumber,
      phase: state.phase,
      category: 'combat',
      key: 'combat.attack.undefended',
      params: {
        player: player.name,
        who_attacks: attackerName,
        who_defends: heroOrPlayerName,
        target: heroOrPlayerName,
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
  step7_resolvePostAttackAndRetaliate(state, attackContext);

  if (state.lastCombatOutcome && state.villainPhaseStepEvent) {
    const rawDamage = state.lastCombatOutcome.finalDamage;
    const attackerName = state.lastCombatOutcome.attackerName;
    state.villainPhaseStepEvent.amount = rawDamage;
    state.villainPhaseStepEvent.description = `${attackerName} attacked ${player.name} (${attackContext.defender?.type === 'HERO' ? 'Hero Defended' : attackContext.defender?.type === 'ALLY' ? 'Ally Defended' : 'Undefended'}) for ${rawDamage} damage.`;
    state.villainPhaseStepEvent.onomatopoeia = rawDamage > 0 ? 'BANG!' : 'BLOCKED!';
    state.villainPhaseStepEvent.combatOutcome = state.lastCombatOutcome;
  }

  state.activeAttackContext = undefined;

  // Clear defender decision prompt from queue if present
  if (state.pendingDecisionPrompt?.options.some((o) => o.effect === 'DECLARE_DEFENDER')) {
    popDecisionPrompt(state);
  }

  // Trigger next pending activation if outside of Villain Phase (e.g. Gang-Up treachery)
  if (
    state.phase !== GamePhase.VILLAIN_PHASE &&
    !state.pendingDecisionPrompt &&
    (state as any).pendingActivations &&
    (state as any).pendingActivations.length > 0
  ) {
    const act = (state as any).pendingActivations.shift()!;
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
 * Step 4 & 5: Deal & 1-by-1 Boost Cards Resolution Loop.
 */
export function step4_and_5_dealAndResolveBoostCards(
  state: GameState,
  attackContext: AttackExecutionContext,
): void {
  attackContext.phase = 'REVEAL_BOOST';

  const isVillainousMinion =
    attackContext.attackerType === 'MINION' &&
    attackContext.attackerCard &&
    hasEntityKeyword(attackContext.attackerCard, 'Villainous');

  if (attackContext.attackerType === 'VILLAIN' || isVillainousMinion) {
    // Step 4: Deal base boost card
    const boostCard = drawEncounterCardForCombat(state);
    if (boostCard) {
      attackContext.boostQueue.push(boostCard);
    }

    // Check villain innate abilities for extra boost cards (e.g. Klaw 01113/01114/01115 / ADR-0019)
    const villainAbilities = state.villain.card.enrichment?.abilities || [];
    const extraBoostAbility =
      Boolean((state.villain.card as any).additionalBoostCards) ||
      villainAbilities.some((a) =>
        a.steps?.some(
          (s) =>
            s.effect === 'DEAL_ADDITIONAL_BOOST_CARD' || s.effect === 'GIVE_ADDITIONAL_BOOST_CARD',
        ),
      );
    if (extraBoostAbility) {
      const extraBoost = drawEncounterCardForCombat(state);
      if (extraBoost) {
        attackContext.boostQueue.push(extraBoost);
        state.log.push({
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          round: state.roundNumber,
          phase: state.phase,
          category: 'combat',
          key: 'villain.boost.extra',
          params: { villain: state.villain.card.name },
          onomatopoeia: 'EXTRA BOOST DEALT!',
        });
      }
    }

    // Step 5: 1-by-1 FIFO Boost Resolution Loop
    while (attackContext.boostQueue.length > 0) {
      const currentBoost = attackContext.boostQueue.shift()!;
      state.activeBoostCard = currentBoost;
      if (!attackContext.revealedBoostCards) {
        attackContext.revealedBoostCards = [];
      }
      attackContext.revealedBoostCards.push(currentBoost);

      // 1. Dispatch Boost Reveal Interrupt Window (e.g. Defiance, Target Acquired)
      dispatchTrigger(state, 'WHEN_BOOST_CARD_REVEALED', {
        targetPlayerId: attackContext.targetPlayerId,
        sourceInstanceId: currentBoost.instanceId,
      });

      // 2. Resolve ★ Star Boost Abilities (if present and not cancelled)
      if (currentBoost.card.boostStar) {
        const boostAbilities = (currentBoost.card.enrichment?.abilities || []).filter(
          (a) => a.timing === 'BOOST' || a.trigger === 'BOOST',
        );

        for (const boostAbility of boostAbilities) {
          executeEffect(state, boostAbility, {
            playerId: attackContext.targetPlayerId,
            sourceCardInstance: currentBoost,
          });

          state.log.push({
            id: `log_${Date.now()}`,
            timestamp: Date.now(),
            round: state.roundNumber,
            phase: state.phase,
            category: 'combat',
            key: 'villain.boost.starResolved',
            params: { card: currentBoost.card.name, abilityId: boostAbility.id },
            onomatopoeia: 'STAR BOOST ACTIVATED!',
          });
        }
      }

      // 3. Accumulate Boost Icons
      const icons = currentBoost.card.boostIcons || 0;
      attackContext.totalBoostIcons += icons;

      state.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        category: 'combat',
        key: 'villain.boost.revealed',
        params: { card: currentBoost.card.name, boostIcons: icons },
        onomatopoeia: 'BOOST REVEALED!',
      });

      // 4. Discard Boost Card (unless put into play by an ability like Weapons Runner)
      if (!(attackContext as any).skipBoostDiscard) {
        state.encounterDiscard.push(currentBoost);
      } else {
        delete (attackContext as any).skipBoostDiscard;
      }

      state.activeBoostCard = undefined;
    }
  }
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
    state.log.push({
      id: `log_${Date.now()}`,
      timestamp: Date.now(),
      round: state.roundNumber,
      phase: state.phase,
      category: 'combat',
      key: 'ally.defeated.boost.undefended',
      params: {
        player: player.name,
        who_attacks:
          attackContext.attackerType === 'VILLAIN'
            ? state.villain.card.name
            : attackContext.attackerCard?.card.name || 'Minion',
        target: player.hero?.name || player.name,
      },
      onomatopoeia: 'DEFENDER DEFEATED! ATTACK UNDEFENDED!',
    });
    attackContext.defender = { type: 'UNDEFENDED', playerId: attackContext.targetPlayerId };
    attackContext.heroDefended = false;
    attackContext.defenseValue = 0;
  }

  const attackerCardCode = attackContext.attackerCard?.card?.code || state.villain?.card?.code;
  const attackerName =
    attackContext.attackerCard?.card?.name || state.villain?.card?.name || 'Enemy';
  const defenderType =
    attackContext.defender?.type || (attackContext.heroDefended ? 'HERO' : 'UNDEFENDED');
  const defenderCardCode =
    defenderAlly?.card?.code ||
    (attackContext.heroDefended ? player.activeFormCard?.code : undefined);
  const defenderName =
    defenderAlly?.card?.name ||
    (attackContext.heroDefended ? player.activeFormCard?.name || player.name : undefined);
  const targetCardCode = player.activeFormCard?.code || player.hero?.code;
  const targetName = player.activeFormCard?.name || player.hero?.name || player.name;
  const targetCurrentHp = player.health;
  const targetMaxHp = player.maxHealth;

  if (attackContext.defender?.type !== 'ALLY' && rawDamage > 0) {
    const defenseResult = dispatchTrigger(state, 'DAMAGE_WOULD_BE_TAKEN', {
      targetPlayerId: player.id,
      damageAmount: rawDamage,
      attackerCardCode,
      attackerName,
      defenderType,
      defenderCardCode,
      defenderName,
      targetCardCode,
      targetName,
      targetCurrentHp,
      targetMaxHp,
      acceptOptionalTriggers: attackContext.acceptOptionalTriggers,
    });
    const modifiedDamage = defenseResult.damageAmount ?? rawDamage;
    if (modifiedDamage < rawDamage) {
      attackContext.heroDefended = true;
      if (attackContext.defender?.type !== 'HERO') {
        attackContext.defender = { type: 'HERO', playerId: player.id };
      }
    }
    rawDamage = modifiedDamage;
    if (defenseResult.hasPendingPrompt) {
      attackContext.pendingDamage = rawDamage;
      return;
    }
  }

  applyCalculatedAttackDamage(state, player, attackContext, rawDamage);
}

/**
 * Applies calculated attack damage to hero or ally (Step 6 continuation).
 */
export function applyCalculatedAttackDamage(
  state: GameState,
  player: PlayerState,
  attackContext: AttackExecutionContext,
  rawDamage: number,
): void {
  if (attackContext.defender?.type === 'ALLY' && attackContext.defender.allyInstanceId) {
    // Ally Takes Attack Damage
    const allyIdx = player.allies.findIndex(
      (a) => a.instanceId === attackContext.defender!.allyInstanceId,
    );
    if (allyIdx !== -1) {
      const ally = player.allies[allyIdx];
      const allyCard = ally.card as any;
      const allyMaxHp = allyCard.health || 2;
      const currentDamage = ally.tokens?.damage || 0;
      const remainingHp = Math.max(0, allyMaxHp - currentDamage);

      const toughIdx = (ally.statusCards || []).indexOf(StatusCard.TOUGH);
      if (toughIdx !== -1 && rawDamage > 0) {
        if (attackContext.hasPiercing) {
          ally.statusCards!.splice(toughIdx, 1);
          state.log.push({
            id: `log_${Date.now()}`,
            timestamp: Date.now(),
            round: state.roundNumber,
            phase: state.phase,
            category: 'combat',
            key: 'ally.piercing.tough.discarded',
            params: { ally: ally.card.name },
            onomatopoeia: 'PIERCING SHRED! (ALLY TOUGH LOST)',
          });
        } else {
          ally.statusCards!.splice(toughIdx, 1);
          state.log.push({
            id: `log_${Date.now()}`,
            timestamp: Date.now(),
            round: state.roundNumber,
            phase: state.phase,
            category: 'combat',
            key: 'ally.tough.absorbed',
            params: { ally: ally.card.name },
            onomatopoeia: 'CLANG! (ALLY TOUGH)',
          });
          rawDamage = 0;
        }
      }

      if (rawDamage > 0) {
        const damageToAlly = Math.min(rawDamage, remainingHp);
        const excessDamage = rawDamage - damageToAlly;

        if (!ally.tokens) ally.tokens = {};
        ally.tokens.damage = currentDamage + damageToAlly;

        state.log.push({
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          round: state.roundNumber,
          phase: state.phase,
          category: 'combat',
          key: 'ally.attack.hit',
          params: { ally: ally.card.name, damage: damageToAlly },
          onomatopoeia: 'OOF! (ALLY HIT)',
        });

        // If ally defeated
        if (ally.tokens.damage >= allyMaxHp) {
          player.allies.splice(allyIdx, 1);
          processHostDefeated(state, ally, { player });
          const owner =
            (ally.ownerId ? state.players.find((p) => p.id === ally.ownerId) : undefined) || player;
          resetCardState(ally);
          owner.discard.push(ally);

          state.log.push({
            id: `log_${Date.now()}`,
            timestamp: Date.now(),
            round: state.roundNumber,
            phase: state.phase,
            category: 'combat',
            key: 'ally.defeated',
            params: { ally: ally.card.name },
            onomatopoeia: 'DEFEATED!',
          });

          dispatchCanonicalCharacterDefeat(state, player.id, ally.instanceId, 'ALLY');

          // Overkill Check
          if (attackContext.hasOverkill && excessDamage > 0) {
            player.health = Math.max(0, player.health - excessDamage);
            state.log.push({
              id: `log_${Date.now()}`,
              timestamp: Date.now(),
              round: state.roundNumber,
              phase: state.phase,
              category: 'combat',
              key: 'overkill.hit',
              params: { damage: excessDamage, player: player.name },
              onomatopoeia: 'OVERKILL SPILLOVER!',
            });
            if (player.health <= 0) {
              state.winner = 'VILLAIN';
            }
          }
        }
      }
    }
  } else {
    // Hero or Undefended Identity Takes Attack Damage
    const toughIndex = player.statusCards.indexOf(StatusCard.TOUGH);
    if (toughIndex !== -1 && rawDamage > 0) {
      if (attackContext.hasPiercing) {
        player.statusCards.splice(toughIndex, 1);
        state.log.push({
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          round: state.roundNumber,
          phase: state.phase,
          category: 'combat',
          key: 'hero.piercing.tough.discarded',
          params: { player: player.name },
          onomatopoeia: 'PIERCING SHRED! (TOUGH LOST)',
        });
      } else {
        player.statusCards.splice(toughIndex, 1);
        state.log.push({
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          round: state.roundNumber,
          phase: state.phase,
          category: 'combat',
          key: 'hero.tough.absorbed',
          params: { player: player.name },
          onomatopoeia: 'CLANG! (TOUGH)',
        });
        rawDamage = 0;
      }
    }

    if (rawDamage > 0) {
      player.health = Math.max(0, player.health - rawDamage);
      state.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        category: 'combat',
        key: attackContext.attackerType === 'VILLAIN' ? 'villain.attack.hit' : 'minion.attack.hit',
        params: {
          who_attacks:
            attackContext.attackerType === 'VILLAIN'
              ? state.villain.card.name
              : attackContext.attackerCard?.card.name || 'Minion',
          who_is_taking_damage: player.name,
          villain: state.villain.card.name,
          minion: attackContext.attackerCard?.card.name || 'Minion',
          player: player.name,
          damage: rawDamage,
          amount: rawDamage,
          remainingHp: player.health,
          defended: attackContext.heroDefended ? 'true' : 'false',
        },
        onomatopoeia: 'WHAM!',
      });

      if (player.health <= 0) {
        dispatchCanonicalCharacterDefeat(state, player.id, player.id, 'HERO');
        state.winner = 'VILLAIN';
      }
    }
  }

  attackContext.finalDamage = rawDamage;

  const attackerName =
    attackContext.attackerType === 'VILLAIN'
      ? state.villain.card.name
      : attackContext.attackerCard?.card.name || 'Minion';
  const attackerCode =
    attackContext.attackerType === 'VILLAIN'
      ? state.villain.card.code
      : attackContext.attackerCard?.card.code;

  state.lastCombatOutcome = {
    id: attackContext.attackId,
    attackerName,
    attackerCode,
    attackerType: attackContext.attackerType,
    targetPlayerId: player.id,
    targetHeroName: player.hero?.name || player.name,
    defenderType: attackContext.defender?.type,
    defenderName:
      attackContext.defender?.type === 'HERO'
        ? player.hero?.name || player.name
        : attackContext.defender?.type === 'ALLY'
          ? player.allies.find((a) => a.instanceId === attackContext.defender?.allyInstanceId)?.card
              .name || 'Ally'
          : undefined,
    baseAttack: attackContext.baseAttack,
    boostCards: attackContext.revealedBoostCards ? [...attackContext.revealedBoostCards] : [],
    totalBoostIcons: attackContext.totalBoostIcons,
    defenseValue: attackContext.defenseValue || 0,
    finalDamage: rawDamage,
    hasOverkill: attackContext.hasOverkill,
    hasPiercing: attackContext.hasPiercing,
  };
}

/**
 * Resumes and finishes attack damage application and post-attack resolution after damage prevention prompt.
 */
export function finishAttackDamageAndPostResolution(
  state: GameState,
  attackContext: AttackExecutionContext,
  preventedDamageAmount?: number,
): GameState {
  const player = state.players.find((p) => p.id === attackContext.targetPlayerId);
  if (!player) return state;

  let rawDamage = attackContext.pendingDamage ?? 0;
  if (preventedDamageAmount !== undefined) {
    rawDamage = Math.max(0, rawDamage - preventedDamageAmount);
    if (preventedDamageAmount > 0 && attackContext.defender?.type !== 'ALLY') {
      attackContext.heroDefended = true;
      if (attackContext.defender?.type !== 'HERO') {
        attackContext.defender = { type: 'HERO', playerId: player.id };
      }
    }
  }
  delete attackContext.pendingDamage;

  applyCalculatedAttackDamage(state, player, attackContext, rawDamage);
  step7_resolvePostAttackAndRetaliate(state, attackContext);

  if (state.lastCombatOutcome && state.villainPhaseStepEvent) {
    const attackerName = state.lastCombatOutcome.attackerName;
    state.villainPhaseStepEvent.amount = rawDamage;
    state.villainPhaseStepEvent.description = `${attackerName} attacked ${player.name} (${attackContext.defender?.type === 'HERO' ? 'Hero Defended' : attackContext.defender?.type === 'ALLY' ? 'Ally Defended' : 'Undefended'}) for ${rawDamage} damage.`;
    state.villainPhaseStepEvent.onomatopoeia = rawDamage > 0 ? 'BANG!' : 'BLOCKED!';
    state.villainPhaseStepEvent.combatOutcome = state.lastCombatOutcome;
  }

  state.activeAttackContext = undefined;
  return state;
}

/**
 * Step 7: Post-Attack Reactions, Retaliate & Cleanup.
 */
export function step7_resolvePostAttackAndRetaliate(
  state: GameState,
  attackContext: AttackExecutionContext,
): void {
  attackContext.phase = 'POST_ATTACK';

  const player = state.players.find((p) => p.id === attackContext.targetPlayerId);

  // Post-Defense Reactions (e.g. Indomitable 01082 ready hero, Counter-Punch 01077)
  if (attackContext.heroDefended && player) {
    dispatchTrigger(state, 'ATTACK_DEFENDED', {
      targetPlayerId: player.id,
      sourceInstanceId: attackContext.attackerCard?.instanceId,
      damageAmount: attackContext.finalDamage,
      acceptOptionalTriggers: attackContext.acceptOptionalTriggers,
    });
  } else if (attackContext.defender?.type === 'ALLY' && player) {
    dispatchTrigger(state, 'ATTACK_DEFENDED', {
      targetPlayerId: player.id,
      sourceInstanceId: attackContext.attackerCard?.instanceId,
      damageAmount: attackContext.finalDamage,
      acceptOptionalTriggers: attackContext.acceptOptionalTriggers,
    });
  }

  dispatchTrigger(state, 'ATTACK_RESOLVED', {
    targetPlayerId: attackContext.targetPlayerId,
    damageAmount: attackContext.finalDamage,
    acceptOptionalTriggers: attackContext.acceptOptionalTriggers,
  });

  // Step 7 Retaliate: If defending character survived and has Retaliate X, deal X damage back to attacker (RR v1.8 p. 24, ADR-0054)
  if (player && player.health > 0 && attackContext.heroDefended) {
    const retaliateX = getEffectiveRetaliate(player, state);

    if (retaliateX > 0) {
      if (attackContext.attackerType === 'VILLAIN') {
        state.villain.health = Math.max(0, state.villain.health - retaliateX);
        state.log.push({
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          round: state.roundNumber,
          phase: state.phase,
          category: 'combat',
          key: 'retaliate.hero.hit',
          params: { damage: retaliateX, villain: state.villain.card.name },
          onomatopoeia: 'RETALIATE! (HERO)',
        });
      } else if (attackContext.attackerCard) {
        const minion = attackContext.attackerCard;
        if (!minion.tokens) minion.tokens = {};
        minion.tokens.damage = (minion.tokens.damage || 0) + retaliateX;
        state.log.push({
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          round: state.roundNumber,
          phase: state.phase,
          category: 'combat',
          key: 'retaliate.hero.hit',
          params: { damage: retaliateX, minion: minion.card.name },
          onomatopoeia: 'RETALIATE! (HERO)',
        });
      }
    }
  } else if (
    attackContext.defender?.type === 'ALLY' &&
    attackContext.defender.allyInstanceId &&
    player
  ) {
    const ally = player.allies.find((a) => a.instanceId === attackContext.defender?.allyInstanceId);
    if (ally) {
      const allyRetaliate = getEffectiveRetaliate(ally, state);
      if (allyRetaliate > 0) {
        if (attackContext.attackerType === 'VILLAIN') {
          state.villain.health = Math.max(0, state.villain.health - allyRetaliate);
          state.log.push({
            id: `log_${Date.now()}`,
            timestamp: Date.now(),
            round: state.roundNumber,
            phase: state.phase,
            category: 'combat',
            key: 'retaliate.ally.hit',
            params: {
              damage: allyRetaliate,
              villain: state.villain.card.name,
              ally: ally.card.name,
            },
            onomatopoeia: 'RETALIATE! (ALLY)',
          });
        } else if (attackContext.attackerCard) {
          const minion = attackContext.attackerCard;
          if (!minion.tokens) minion.tokens = {};
          minion.tokens.damage = (minion.tokens.damage || 0) + allyRetaliate;
          state.log.push({
            id: `log_${Date.now()}`,
            timestamp: Date.now(),
            round: state.roundNumber,
            phase: state.phase,
            category: 'combat',
            key: 'retaliate.ally.hit',
            params: { damage: allyRetaliate, minion: minion.card.name, ally: ally.card.name },
            onomatopoeia: 'RETALIATE! (ALLY)',
          });
        }
      }
    }
  }

  // Discard single-use attack attachments on villain (e.g. Charge 01099)
  if (attackContext.attackerType === 'VILLAIN') {
    const chargeIdx = (state.villain.attachments || []).findIndex(
      (att) => att.card.code === '01099',
    );
    if (chargeIdx !== -1) {
      const [chargeAtt] = state.villain.attachments.splice(chargeIdx, 1);
      state.encounterDiscard.push(chargeAtt);
    }
  }

  // Forced Responses on minion attack (e.g. Sandman 01102, Yon-Rogg 01177)
  if (attackContext.attackerType === 'MINION' && attackContext.attackerCard) {
    const minion = attackContext.attackerCard;
    const abilities = minion.card.enrichment?.abilities || [];
    for (const ability of abilities) {
      if (
        ability.trigger === 'MINION_ATTACKED' ||
        (ability.timing === 'FORCED_RESPONSE' && ability.trigger === 'ATTACK')
      ) {
        executeEffect(state, ability, {
          playerId: attackContext.targetPlayerId,
          sourceCardInstance: minion,
        });
      }
    }
  }
}

/**
 * Executes a complete enemy attack synchronously using the specified defense policy.
 * Used for headless unit tests and fast match simulations.
 */
export function executeEnemyAttackSynchronously(
  state: GameState,
  attacker: { type: 'VILLAIN' | 'MINION'; card?: CardInstance },
  targetPlayerId: string,
  policy: DefensePolicy = 'TAKE_UNDEFENDED',
  options?: { acceptOptionalTriggers?: boolean },
): GameState {
  return initiateEnemyAttack(state, attacker, targetPlayerId, {
    synchronousPolicy: policy,
    acceptOptionalTriggers: options?.acceptOptionalTriggers ?? true,
  });
}
