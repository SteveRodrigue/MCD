import {
  GameState,
  PlayerState,
  CardInstance,
  StatusCard,
  DefenderDeclaration,
  AttackExecutionContext,
  DecisionPromptOption,
  GamePhase,
} from '../models';
import { enqueueDecisionPrompt, popDecisionPrompt } from './prompt-queue';
import { dispatchTrigger } from '../triggers/trigger-dispatcher';
import { executeEffect } from '../effects';
import { getEffectiveHeroStats, getEffectiveVillainStats } from './stat-calculator';

export type DefensePolicy =
  | 'TAKE_UNDEFENDED'
  | 'HERO_IF_READY'
  | 'ALLY_CHUMP_BLOCK'
  | 'AUTO_OPTIMAL';

export interface CombatOptions {
  synchronousPolicy?: DefensePolicy;
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
 * Step 1: Pre-Attack & Status Intercepts (RR v1.8 p. 4)
 * Checks Webbed Up / INTERCEPT_ATTACK attachments and Stun status.
 * Returns true if the attack was cancelled.
 */
export function step1_preAttackAndStunCheck(
  state: GameState,
  attackerType: 'VILLAIN' | 'MINION',
  attackerCard?: CardInstance,
  targetPlayer?: PlayerState,
): boolean {
  if (attackerType === 'VILLAIN') {
    // Check Webbed Up or attachments with INTERCEPT_ATTACK
    const webbedUpIdx = (state.villain.attachments || []).findIndex(
      (att) =>
        att.card.code === '01009' ||
        att.card.enrichment?.abilities?.some((a) =>
          a.steps?.some((s) => s.effect === 'INTERCEPT_ATTACK'),
        ),
    );

    if (webbedUpIdx !== -1) {
      const [webbedUp] = state.villain.attachments.splice(webbedUpIdx, 1);
      const owner = state.players.find((p) => p.hero.code === '01001a') || targetPlayer || state.players[0];
      owner.discard.push(webbedUp);

      if (!state.villain.statusCards.includes(StatusCard.STUNNED)) {
        state.villain.statusCards.push(StatusCard.STUNNED);
      }

      state.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        category: 'combat',
        key: 'villain.attack.cancelled',
        params: { villain: state.villain.card.name, cancelledBy: 'Webbed Up' },
        onomatopoeia: 'WEBBED UP! ATTACK CANCELLED & STUNNED!',
      });
      return true;
    }

    // Check Stun status on Villain
    const stunIndex = state.villain.statusCards.indexOf(StatusCard.STUNNED);
    if (stunIndex !== -1) {
      state.villain.statusCards.splice(stunIndex, 1);
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
      return true;
    }
  } else if (attackerCard) {
    // Minion stun check
    const minionStunIdx = (attackerCard.statusCards || []).indexOf(StatusCard.STUNNED);
    if (minionStunIdx !== -1) {
      attackerCard.statusCards!.splice(minionStunIdx, 1);
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
): GameState {
  if (attackerType === 'VILLAIN') {
    dispatchTrigger(state, 'VILLAIN_INITIATES_ATTACK', { targetPlayerId });
  }
  return state;
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
  const player = state.players.find((p) => p.id === targetPlayerId);
  if (!player) return state;

  // Step 1: Pre-Attack & Stun check
  const isCancelled = step1_preAttackAndStunCheck(state, attacker.type, attacker.card, player);
  if (isCancelled) return state;

  // Step 2: Initiation Triggers (Spider-Sense draws card BEFORE defender is declared)
  step2_dispatchInitiationTriggers(state, attacker.type, targetPlayerId);

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
    const traits = attacker.card.card.traits || [];
    hasOverkill = traits.includes('Overkill') || (attacker.card.card.text || '').includes('Overkill');
  }

  const attackContext: AttackExecutionContext = {
    attackId: `attack_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    attackerType: attacker.type,
    attackerCard: attacker.card,
    targetPlayerId,
    phase: 'DECLARE_DEFENDER',
    baseAttack,
    boostQueue: [],
    totalBoostIcons: 0,
    hasOverkill,
    hasPiercing,
  };

  // Check if synchronous policy specified (Headless tests / simulator)
  if (options?.synchronousPolicy) {
    const declaration = evaluateDefensePolicy(state, player, options.synchronousPolicy, attackContext);
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

  // 1. Basic Hero Defend option (if Hero form and ready)
  if (player.currentForm === 'hero' && !player.exhausted) {
    const heroStats = getEffectiveHeroStats(state, player);
    options.push({
      id: 'defend_hero',
      label: `Defend with ${player.hero.name} (DEF: ${heroStats.defense})`,
      description: `Exhaust ${player.hero.name} to mitigate incoming damage by ${heroStats.defense}.`,
      effect: 'DECLARE_DEFENDER',
      params: { defenderType: 'HERO', playerId: player.id },
    });
  }

  // 2. Ready Allies Defend options
  for (const ally of player.allies) {
    if (!ally.exhausted) {
      options.push({
        id: `defend_ally_${ally.instanceId}`,
        label: `Block with ${ally.card.name} (Ally)`,
        description: `Exhaust ${ally.card.name} to absorb incoming attack.`,
        effect: 'DECLARE_DEFENDER',
        params: { defenderType: 'ALLY', playerId: player.id, allyInstanceId: ally.instanceId },
      });
    }
  }

  // 3. Take Undefended option
  options.push({
    id: 'undefended',
    label: 'Take Undefended',
    description: 'Do not exhaust any character. Target identity takes full attack damage.',
    effect: 'DECLARE_DEFENDER',
    params: { defenderType: 'UNDEFENDED', playerId: player.id },
  });

  const attackerName =
    attackContext.attackerType === 'VILLAIN'
      ? state.villain.card.name
      : attackContext.attackerCard?.card.name || 'Minion';

  state = enqueueDecisionPrompt(state, {
    promptId: `prompt_defend_${attackContext.attackId}`,
    playerId: player.id,
    title: `Enemy Attack: ${attackerName} (Base ATK: ${attackContext.baseAttack})`,
    description: 'Declare a defender before boost cards are dealt or revealed.',
    sourceCardName: attackerName,
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
      params: { player: player.name, defense: attackContext.defenseValue },
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
        params: { player: player.name, ally: ally.card.name },
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
      params: { player: player.name },
      onomatopoeia: 'UNDEFENDED!',
    });
  }

  // Step 4 & 5: Deal & Resolve Boost Cards
  step4_and_5_dealAndResolveBoostCards(state, attackContext);

  // Step 6: Damage Calculation, Prevention & Overkill
  step6_calculateAndApplyAttackDamage(state, attackContext);

  // Step 7: Post-Attack Reactions, Retaliate & Cleanup
  step7_resolvePostAttackAndRetaliate(state, attackContext);

  state.activeAttackContext = undefined;

  // Clear defender decision prompt from queue if present
  if (state.pendingDecisionPrompt?.options.some((o) => o.effect === 'DECLARE_DEFENDER')) {
    popDecisionPrompt(state);
  }

  // Trigger next pending activation if outside of Villain Phase (e.g. Gang-Up treachery)
  if (state.phase !== GamePhase.VILLAIN_PHASE && !state.pendingDecisionPrompt && (state as any).pendingActivations && (state as any).pendingActivations.length > 0) {
    const act = (state as any).pendingActivations.shift()!;
    const targetPlayer = state.players.find((p) => p.id === act.playerId);
    if (targetPlayer) {
      if (act.type === 'VILLAIN') {
        initiateEnemyAttack(state, { type: 'VILLAIN' }, targetPlayer.id);
      } else if (act.type === 'MINION') {
        const minion = targetPlayer.engagedMinions.find((m) => m.instanceId === act.minionInstanceId);
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

  if (attackContext.attackerType === 'VILLAIN') {
    // Step 4: Deal base boost card
    const boostCard = drawEncounterCardForCombat(state);
    if (boostCard) {
      attackContext.boostQueue.push(boostCard);
    }

    // Check villain innate abilities or text for extra boost cards (e.g. Klaw 01113/01114/01115)
    const villainText = (state.villain.card.text || '').toLowerCase();
    if (villainText.includes('give him 1 additional boost card') || villainText.includes('additional boost card')) {
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

  // Damage Prevention Interrupt Window (e.g. Backflip 01003)
  if (attackContext.attackerType === 'VILLAIN' || attackContext.heroDefended) {
    const defenseResult = dispatchTrigger(state, 'TAKE_ATTACK_DAMAGE', {
      targetPlayerId: player.id,
      damageAmount: rawDamage,
    });
    rawDamage = defenseResult.damageAmount ?? rawDamage;
  }

  if (attackContext.defender?.type === 'ALLY' && attackContext.defender.allyInstanceId) {
    // Ally Takes Attack Damage
    const allyIdx = player.allies.findIndex((a) => a.instanceId === attackContext.defender!.allyInstanceId);
    if (allyIdx !== -1) {
      const ally = player.allies[allyIdx];
      const allyCard = ally.card as any;
      const allyMaxHp = allyCard.health || 2;
      const currentDamage = ally.tokens?.damage || 0;
      const remainingHp = Math.max(0, allyMaxHp - currentDamage);

      const toughIdx = (ally.statusCards || []).indexOf(StatusCard.TOUGH);
      if (toughIdx !== -1 && rawDamage > 0) {
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
      } else if (rawDamage > 0) {
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
          player.discard.push(ally);

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
    } else if (rawDamage > 0) {
      player.health = Math.max(0, player.health - rawDamage);
      state.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        category: 'combat',
        key: attackContext.attackerType === 'VILLAIN' ? 'villain.attack.hit' : 'minion.attack.hit',
        params: {
          villain: state.villain.card.name,
          minion: attackContext.attackerCard?.card.name || 'Minion',
          player: player.name,
          damage: rawDamage,
          defended: attackContext.heroDefended ? 'true' : 'false',
        },
        onomatopoeia: 'WHAM!',
      });

      if (player.health <= 0) {
        state.winner = 'VILLAIN';
      }
    }
  }

  attackContext.finalDamage = rawDamage;
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
    dispatchTrigger(state, 'HERO_DEFENDED_ATTACK', {
      targetPlayerId: player.id,
      sourceInstanceId: attackContext.attackerCard?.instanceId,
    });
  }

  dispatchTrigger(state, 'ATTACK_RESOLVED', {
    targetPlayerId: attackContext.targetPlayerId,
  });

  // Step 7 Retaliate: If defending character survived and has Retaliate X, deal X damage back to attacker (RR v1.8 p. 24)
  if (player && player.health > 0 && attackContext.heroDefended) {
    // Check Hero or Tableau cards for Retaliate
    let retaliateX = 0;
    const heroCard = player.hero as any;
    if (heroCard.keywords?.includes('Retaliate 1') || heroCard.keywords?.includes('Retaliate') || (heroCard.text || '').toLowerCase().includes('retaliate 1')) {
      retaliateX = 1;
    }
    for (const item of player.tableau || []) {
      const itemText = (item.card.text || '').toLowerCase();
      if (itemText.includes('retaliate 1') || (item.card as any).keywords?.includes('Retaliate') || (item.card as any).keywords?.includes('Retaliate 1')) {
        retaliateX += 1;
      }
    }

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
  }

  // Discard single-use attack attachments on villain (e.g. Charge 01099)
  if (attackContext.attackerType === 'VILLAIN') {
    const chargeIdx = (state.villain.attachments || []).findIndex((att) => att.card.code === '01099');
    if (chargeIdx !== -1) {
      const [chargeAtt] = state.villain.attachments.splice(chargeIdx, 1);
      state.encounterDiscard.push(chargeAtt);
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
): GameState {
  return initiateEnemyAttack(state, attacker, targetPlayerId, { synchronousPolicy: policy });
}
