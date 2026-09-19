import {
  GameState,
  PlayerState,
  CardInstance,
  CardAbility,
  AbilityTiming,
  Keyword,
  hasKeyword,
  NormalizedCard,
  ActiveCostReduction,
  CardType,
} from '../models';
import { getEffectiveMaxHealth } from './stat-calculator';
import { removeCardFromAllZones } from '../state/state-validator';
import { dispatchTrigger } from '../triggers/trigger-dispatcher';
import { getStepEffectParams } from '../../data/supplemental/schema';
import { matchesCardFilter } from '../filters/card-filter';
import { locateCard, readCardResources } from '../queries/card-inspector';
import { getCardEnrichment } from '../../data/supplemental';

export interface AbilityPaymentOptions {
  paymentCardInstanceIds?: string[];
  generatorInstanceIds?: string[];
  discardCardInstanceIds?: string[];
  targetInstanceId?: string;
}

/**
 * Normalizes and extracts resource requirements and requirePrinted constraint from an ability cost.
 */
export function extractResourceCost(cost?: CardAbility['cost']): {
  hasCost: boolean;
  requiredType?: string;
  requiredAmount: number;
  requirePrinted: boolean;
} {
  if (!cost) {
    return { hasCost: false, requiredAmount: 0, requirePrinted: false };
  }
  const requirePrinted = Boolean(cost.requirePrinted);
  if (cost.resources && cost.resources.length > 0) {
    return {
      hasCost: true,
      requiredType: cost.resources[0],
      requiredAmount: cost.resources.length,
      requirePrinted,
    };
  }
  if (cost.resourceCost !== undefined) {
    if (typeof cost.resourceCost === 'number') {
      return {
        hasCost: true,
        requiredType: undefined,
        requiredAmount: cost.resourceCost,
        requirePrinted,
      };
    }
    if (typeof cost.resourceCost === 'object' && cost.resourceCost !== null) {
      const keys = Object.keys(cost.resourceCost);
      const reqType = keys[0];
      const reqAmount = reqType ? cost.resourceCost[reqType] || 1 : 1;
      return {
        hasCost: true,
        requiredType: reqType,
        requiredAmount: reqAmount,
        requirePrinted,
      };
    }
  }
  return { hasCost: false, requiredAmount: 0, requirePrinted: false };
}

/**
 * Calculates matching resources provided by a physical card in hand (RR v1.8 p. 15).
 */
export function getCardProvidedResources(
  cardInst: CardInstance,
  requiredType?: string,
  requirePrinted?: boolean,
): number {
  const printedList = readCardResources(cardInst);
  if (printedList.length > 0) {
    if (requirePrinted && requiredType) {
      return printedList.filter((r) => r === requiredType).length;
    }
    if (!requiredType) {
      return printedList.length;
    }
    return printedList.filter((r) => r === requiredType || r === 'wild').length;
  }
  const res = cardInst.card?.resources;
  if (!res) return requirePrinted ? 0 : !requiredType ? 1 : 0;
  if (requirePrinted && requiredType) {
    return (res as any)[requiredType] || 0;
  }
  if (!requiredType) {
    return res.total || 1;
  }
  return ((res as any)[requiredType] || 0) + (res.wild || 0);
}

/**
 * Calculates matching resources provided by an in-play generator or identity ability (RR v1.8 p. 15, 25).
 */
export function getGeneratorProvidedResources(
  state: GameState,
  player: PlayerState,
  gId: string,
  requiredType?: string,
  requirePrinted?: boolean,
): number {
  if (gId === 'identity_ability' || gId === player.activeFormCard.code) {
    const idAbility = player.activeFormCard.enrichment?.abilities?.find(
      (a) =>
        a.timing === 'RESOURCE' ||
        a.timing === 'HERO_RESOURCE' ||
        a.timing === 'ALTER_EGO_RESOURCE' ||
        a.steps?.some((s) => s.effect === 'GENERATE_RESOURCE'),
    );
    if (!idAbility) return 0;
    if (idAbility.timing === 'HERO_RESOURCE' && player.currentForm !== 'hero') return 0;
    if (idAbility.timing === 'ALTER_EGO_RESOURCE' && player.currentForm !== 'alter_ego') return 0;
    if (
      idAbility.limit === 'ONCE_PER_ROUND' &&
      (player.usedAbilitiesThisRound?.[idAbility.id] || 0) >= 1
    ) {
      return 0;
    }
    if (
      idAbility.limit === 'ONCE_PER_PHASE' &&
      (player.usedAbilitiesThisPhase?.[idAbility.id] || 0) >= 1
    ) {
      return 0;
    }
    const genStep = idAbility.steps?.find((s) => s.effect === 'GENERATE_RESOURCE');
    if (genStep && getStepEffectParams(genStep).fromCard) {
      const target = locateCard(state, getStepEffectParams(genStep).fromCard!, { player });
      if (!target) return 0;
      const printedList = readCardResources(target);
      if (requirePrinted && requiredType) {
        return printedList.filter((r) => r === requiredType).length;
      }
      if (!requiredType) {
        return printedList.length;
      }
      return printedList.filter((r) => r === requiredType || r === 'wild').length;
    }
    const resType = (genStep?.effectParams?.resource as string) || 'wild';
    const amount = Number(genStep?.effectParams?.amount) || 1;
    if (requirePrinted) {
      return resType === requiredType ? amount : 0;
    }
    if (!requiredType || resType === requiredType || resType === 'wild') {
      return amount;
    }
    return 0;
  }

  const gCard = player.tableau.find((c) => c.instanceId === gId);
  if (!gCard || gCard.exhausted) return 0;

  const enrichment = gCard.card.enrichment || getCardEnrichment(gCard.card.code);
  const abilities = enrichment?.abilities || [];
  const tableAbility = abilities.find(
    (a) =>
      isResourceAbility(a.timing) ||
      a.steps?.some((s) => s.effect === 'GENERATE_RESOURCE' || s.effect === 'COST_REDUCER'),
  );

  if (!tableAbility) {
    if (enrichment?.uses) {
      const uType = enrichment.uses.type;
      const count = gCard.tokens?.counters ?? (uType ? gCard.counters?.[uType] : undefined) ?? 0;
      if (count <= 0) return 0;
      if (requirePrinted) return 0;
      return 1;
    }
    return 0;
  }

  if (!isAbilityPlayableInForm(tableAbility.timing as any, player.currentForm)) return 0;

  const abilityKey = `${gCard.instanceId}_${tableAbility.id}`;
  if (
    tableAbility.limit === 'ONCE_PER_ROUND' &&
    (player.usedAbilitiesThisRound?.[abilityKey] || 0) >= 1
  ) {
    return 0;
  }
  if (
    tableAbility.limit === 'ONCE_PER_PHASE' &&
    (player.usedAbilitiesThisPhase?.[abilityKey] || 0) >= 1
  ) {
    return 0;
  }

  if (enrichment?.uses) {
    const uType = enrichment.uses.type;
    const count = gCard.tokens?.counters ?? (uType ? gCard.counters?.[uType] : undefined) ?? 0;
    if (count <= 0) return 0;
  }

  const genStep = tableAbility.steps?.find(
    (s) => s.effect === 'GENERATE_RESOURCE' || s.effect === 'COST_REDUCER',
  );
  if (genStep && getStepEffectParams(genStep).fromCard) {
    const target = locateCard(state, getStepEffectParams(genStep).fromCard!, {
      player,
      sourceCardInstance: gCard,
    });
    if (!target) return 0;
    const printedList = readCardResources(target);
    if (requirePrinted && requiredType) {
      return printedList.filter((r) => r === requiredType).length;
    }
    if (!requiredType) {
      return printedList.length;
    }
    return printedList.filter((r) => r === requiredType || r === 'wild').length;
  }

  const resType = (genStep?.effectParams?.resource as string) || 'wild';
  const amount = Number(genStep?.effectParams?.amount) || 1;
  if (requirePrinted) {
    return resType === requiredType ? amount : 0;
  }
  if (!requiredType || resType === requiredType || resType === 'wild') {
    return amount;
  }
  return 0;
}

/**
 * Validates whether a player can satisfy all prerequisites and costs of a card ability.
 */
export function canPayAbilityCost(
  state: GameState,
  player: PlayerState,
  ability: CardAbility,
  sourceCardInst?: CardInstance,
  options?: AbilityPaymentOptions,
): { allowed: boolean; reason?: string } {
  const cost = ability.cost;
  if (!cost) return { allowed: true };

  // 1. Heal Cost Validation
  if (cost.heal) {
    const requiredHeal = cost.heal.amount || 1;
    const targetMode = cost.heal.target || 'SELF';
    if (targetMode === 'SELF') {
      const maxHp = getEffectiveMaxHealth(player, state);
      const currentDamage = Math.max(0, maxHp - player.health);
      if (currentDamage < requiredHeal) {
        return {
          allowed: false,
          reason: `Requires at least ${requiredHeal} damage on Identity to heal as cost (currently has ${currentDamage}).`,
        };
      }
    }
  }

  // 2. Exhaustion Cost Validation
  const isExhaustSelf = cost.exhaustSelf || (cost as any).exhaust;
  if (isExhaustSelf) {
    if (sourceCardInst) {
      if (sourceCardInst.exhausted) {
        return { allowed: false, reason: 'Card is already exhausted.' };
      }
    } else {
      // Identity Ability (Hero / Alter-Ego)
      if (player.exhausted) {
        return { allowed: false, reason: 'Identity is already exhausted.' };
      }
    }
  }

  if (cost.exhaustCard === 'SELF_IDENTITY' || (cost as any).exhaustHero) {
    if (player.exhausted) {
      return { allowed: false, reason: 'Identity is already exhausted.' };
    }
  }

  // 3. Hero Damage Cost Validation
  if (cost.damageHero && cost.damageHero > 0) {
    if (player.health <= cost.damageHero) {
      return {
        allowed: false,
        reason: `Cannot pay ${cost.damageHero} damage cost (Identity only has ${player.health} HP remaining).`,
      };
    }
  }

  // 3b. Self-Damage Cost Validation (e.g. War Machine 01070 dealing 2 damage to self)
  const selfDamage = cost.damageSelf || (cost as any).selfDamage;
  if (selfDamage && selfDamage > 0) {
    if (!sourceCardInst) {
      if (player.health <= selfDamage) {
        return {
          allowed: false,
          reason: `Cannot pay ${selfDamage} self-damage cost (Identity only has ${player.health} HP remaining).`,
        };
      }
    }
  }

  // 4. Token / Counter Depletion Validation
  if (cost.spendCounters) {
    const counterType = cost.spendCounters.counterType || 'all_purpose';
    const amount = cost.spendCounters.amount;
    if (cost.spendCounters.target === 'IDENTITY') {
      const current = player.counters?.[counterType] || 0;
      if (current < amount) {
        return {
          allowed: false,
          reason: `Insufficient '${counterType}' counters on Identity (Requires ${amount}, has ${current}).`,
        };
      }
    } else {
      const current =
        sourceCardInst?.counters?.[counterType] ?? sourceCardInst?.tokens?.counters ?? 0;
      if (current < amount) {
        return {
          allowed: false,
          reason: `Insufficient ${counterType} counters on card (Requires ${amount}, has ${current}).`,
        };
      }
    }
  }

  // 5. Hand Card Discard Cost Validation
  if (cost.discardCard) {
    const fromZone = cost.discardCard.from;
    const requiredCount = cost.discardCard.count || 1;
    const maxCount = (cost.discardCard as any).maxCount;

    if (fromZone === 'HAND') {
      if (player.hand.length === 0) {
        return { allowed: false, reason: 'No cards in hand to discard as cost.' };
      }
      if (!maxCount && player.hand.length < requiredCount) {
        return {
          allowed: false,
          reason: 'Insufficient cards in hand to discard as cost.',
        };
      }
      if (cost.discardCard.filter) {
        const matchingCount = player.hand.filter((c) =>
          matchesCardFilter(c.card, cost.discardCard!.filter, { player, state }),
        ).length;
        if (matchingCount < requiredCount) {
          return {
            allowed: false,
            reason: 'No cards in hand matching required discard filter.',
          };
        }
      }
      if (options?.discardCardInstanceIds) {
        for (const id of options.discardCardInstanceIds) {
          const cardInst = player.hand.find((c) => c.instanceId === id);
          if (!cardInst) {
            return {
              allowed: false,
              reason: `Selected discard card ${id} not found in hand.`,
            };
          }
          if (
            cost.discardCard.filter &&
            !matchesCardFilter(cardInst.card, cost.discardCard.filter, { player, state })
          ) {
            return {
              allowed: false,
              reason: `Selected discard card ${cardInst.card.name} does not match the required filter.`,
            };
          }
        }
        if (!maxCount && options.discardCardInstanceIds.length < requiredCount) {
          return {
            allowed: false,
            reason: `Insufficient cards selected to discard as cost (Requires ${requiredCount}, selected ${options.discardCardInstanceIds.length}).`,
          };
        }
      }
    }
  }

  // 6. Resource Cost Validation (cost.resourceCost / cost.resources)
  let resCost = extractResourceCost(cost);
  if (
    !resCost.hasCost &&
    ability.zone === 'HAND' &&
    sourceCardInst?.card &&
    ((sourceCardInst.card.type as any) === 'event' || sourceCardInst.card.type === CardType.EVENT)
  ) {
    const cardCost = sourceCardInst.card.cost ?? 0;
    if (cardCost > 0) {
      resCost = {
        hasCost: true,
        requiredType: undefined,
        requiredAmount: cardCost,
        requirePrinted: false,
      };
    }
  }

  if (resCost.hasCost) {
    const { requiredType, requiredAmount, requirePrinted } = resCost;
    const specifiedPaymentIds = options?.paymentCardInstanceIds || [];
    const specifiedGeneratorIds = options?.generatorInstanceIds || [];

    if (specifiedPaymentIds.length > 0 || specifiedGeneratorIds.length > 0) {
      let providedAmount = 0;
      for (const id of specifiedPaymentIds) {
        if (sourceCardInst && id === sourceCardInst.instanceId) {
          return { allowed: false, reason: 'A card cannot pay for its own cost.' };
        }
        const cardInst = player.hand.find((c) => c.instanceId === id);
        if (!cardInst) {
          return { allowed: false, reason: `Selected payment card ${id} not found in hand.` };
        }
        providedAmount += getCardProvidedResources(cardInst, requiredType, requirePrinted);
      }
      for (const gId of specifiedGeneratorIds) {
        if (gId === 'identity_ability' || gId === player.activeFormCard.code) {
          const genAmt = getGeneratorProvidedResources(
            state,
            player,
            gId,
            requiredType,
            requirePrinted,
          );
          if (genAmt <= 0) {
            return {
              allowed: false,
              reason: `Identity resource ability cannot generate ${requiredType || 'the required'} resource.`,
            };
          }
          providedAmount += genAmt;
        } else {
          const gCard = player.tableau.find((c) => c.instanceId === gId);
          if (!gCard) {
            return {
              allowed: false,
              reason: `Resource generator instance ${gId} not found in tableau.`,
            };
          }
          if (gCard.exhausted) {
            return {
              allowed: false,
              reason: `Resource generator ${gCard.card.name} is already exhausted.`,
            };
          }
          const genAmt = getGeneratorProvidedResources(
            state,
            player,
            gId,
            requiredType,
            requirePrinted,
          );
          if (genAmt <= 0) {
            return {
              allowed: false,
              reason: `Resource generator ${gCard.card.name} cannot generate ${requiredType || 'the required'} resource.`,
            };
          }
          providedAmount += genAmt;
        }
      }

      if (providedAmount < requiredAmount) {
        return {
          allowed: false,
          reason: `Insufficient resources selected (Requires ${requiredAmount} ${requiredType || 'resources'}, provided ${providedAmount}).`,
        };
      }
    } else {
      // General availability check across player hand cards AND ready generators
      let availableAmount = 0;
      for (const cardInst of player.hand) {
        if (sourceCardInst && cardInst.instanceId === sourceCardInst.instanceId) continue;
        availableAmount += getCardProvidedResources(cardInst, requiredType, requirePrinted);
      }
      for (const gCard of player.tableau) {
        if (!gCard.exhausted) {
          availableAmount += getGeneratorProvidedResources(
            state,
            player,
            gCard.instanceId,
            requiredType,
            requirePrinted,
          );
        }
      }
      availableAmount += getGeneratorProvidedResources(
        state,
        player,
        'identity_ability',
        requiredType,
        requirePrinted,
      );

      if (availableAmount < requiredAmount) {
        return {
          allowed: false,
          reason: `Insufficient resources (Requires ${requiredAmount} ${requiredType || 'resources'}, has ${availableAmount}).`,
        };
      }
    }
  }

  // 7. RR v1.8 p. 3 Zero-State Invariant for COUNTERS (e.g. Energy Channel 01019)
  for (const step of ability.steps || []) {
    const stepParams = getStepEffectParams(step);
    const amountObj =
      typeof stepParams.amount === 'object' && stepParams.amount !== null
        ? (stepParams.amount as Record<string, any>)
        : null;
    if (amountObj?.from === 'COUNTERS') {
      const counterType = (amountObj.counterType as string) || 'energy';
      const count =
        sourceCardInst?.counters?.[counterType] ?? sourceCardInst?.tokens?.counters ?? 0;
      if (count <= 0) {
        return {
          allowed: false,
          reason: `Cannot trigger ability: card has 0 counters.`,
        };
      }
    }
  }

  // 8. Target existence validation for abilities requiring minions (RR v1.8 p. 19, 28)
  for (const step of ability.steps || []) {
    const stepParams = getStepEffectParams(step);
    const target = stepParams.target;
    if (target === 'CHOSEN_MINION' || target === 'MINION' || target === 'ALL_MINIONS') {
      const totalMinions = state.players.reduce(
        (acc: number, p: PlayerState) => acc + (p.engagedMinions?.length || 0),
        0,
      );
      if (totalMinions === 0) {
        return { allowed: false, reason: 'No minions in play to target.' };
      }
    } else if (target === 'CHOSEN_ENGAGED_MINION') {
      const localCount = player.engagedMinions?.length || 0;
      if (localCount === 0) {
        return { allowed: false, reason: 'No minions engaged with you to target.' };
      }
    }
  }

  return { allowed: true };
}

/**
 * Deducts and executes all prerequisites and costs for an ability.
 */
export function executeAbilityCost(
  state: GameState,
  player: PlayerState,
  ability: CardAbility,
  sourceCardInst?: CardInstance,
  options?: AbilityPaymentOptions,
): { state: GameState; discardedCount: number; resourcesPaid: number } {
  const hasInHandEventCost =
    ability.zone === 'HAND' &&
    sourceCardInst?.card &&
    ((sourceCardInst.card.type as any) === 'event' ||
      sourceCardInst.card.type === CardType.EVENT) &&
    (sourceCardInst.card.cost ?? 0) > 0;

  const cost =
    ability.cost ?? (hasInHandEventCost ? ({} as NonNullable<CardAbility['cost']>) : undefined);
  let discardedCount = 0;
  if (!cost) {
    return { state, discardedCount: 0, resourcesPaid: 0 };
  }

  // 1. Exhaustion
  const isExhaustSelf = cost.exhaustSelf || (cost as any).exhaust;
  if (isExhaustSelf) {
    if (sourceCardInst) {
      sourceCardInst.exhausted = true;
    } else {
      player.exhausted = true;
    }
  }

  if (cost.exhaustCard === 'SELF_IDENTITY' || (cost as any).exhaustHero) {
    player.exhausted = true;
  }

  // 1b. Heal Cost Execution
  if (cost.heal) {
    const healAmount = cost.heal.amount || 1;
    const targetMode = cost.heal.target || 'SELF';
    if (targetMode === 'SELF') {
      const maxHp = getEffectiveMaxHealth(player, state);
      const actualHealed = Math.min(healAmount, maxHp - player.health);
      player.health = Math.min(maxHp, player.health + actualHealed);
      state.log.push({
        id: `log_${Date.now()}_cost_heal`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        key: 'card.cost.heal',
        params: { player: player.name, healed: actualHealed, currentHealth: player.health },
        onomatopoeia: `HEAL! +${actualHealed} HP (COST)`,
      });
    }
  }

  // 2. Direct Damage Cost to Hero
  if (cost.damageHero && cost.damageHero > 0) {
    player.health = Math.max(1, player.health - cost.damageHero);
    state.log.push({
      id: `log_${Date.now()}_cost_dmg`,
      timestamp: Date.now(),
      round: state.roundNumber,
      phase: state.phase,
      key: 'card.cost.damageHero',
      params: { player: player.name, damagePaid: cost.damageHero, remainingHealth: player.health },
      onomatopoeia: `OUCH! -${cost.damageHero} HP (COST)`,
    });
  }

  // 2b. Direct Damage Cost to Self / Ally (e.g. War Machine 01070)
  const selfDamage = cost.damageSelf || (cost as any).selfDamage;
  if (selfDamage && selfDamage > 0) {
    if (sourceCardInst) {
      sourceCardInst.tokens = {
        ...sourceCardInst.tokens,
        damage: (sourceCardInst.tokens?.damage || 0) + selfDamage,
      };
      const health = (sourceCardInst.card as any).health;
      if (health && (sourceCardInst.tokens.damage || 0) >= health) {
        // Defeated from self-damage cost -> remove and discard
        removeCardFromAllZones(state, sourceCardInst.instanceId);
        player.discard.push(sourceCardInst);
        state.log.push({
          id: `log_${Date.now()}_wm_defeat`,
          timestamp: Date.now(),
          round: state.roundNumber,
          phase: state.phase,
          key: 'card.ally.defeated',
          params: { ally: sourceCardInst.card.name },
          onomatopoeia: `${sourceCardInst.card.name.toUpperCase()} DEFEATED!`,
        });
      }
    } else {
      player.health = Math.max(1, player.health - selfDamage);
    }
  }

  // 2c. Discard Self Cost (e.g. Superhuman Strength 01028)
  if (cost.discardSelf && sourceCardInst) {
    removeCardFromAllZones(state, sourceCardInst.instanceId);
    player.discard.push(sourceCardInst);
    discardedCount += 1;
  }

  // 3. Tokens / Counters
  if (cost.spendCounters) {
    const counterType = cost.spendCounters.counterType || 'all_purpose';
    const amount = cost.spendCounters.amount;
    if (cost.spendCounters.target === 'IDENTITY') {
      player.counters = player.counters || {};
      const current = player.counters[counterType] || 0;
      player.counters[counterType] = Math.max(0, current - amount);
    } else if (sourceCardInst) {
      sourceCardInst.counters = sourceCardInst.counters || {};
      const current = sourceCardInst.counters[counterType] ?? sourceCardInst.tokens?.counters ?? 0;
      sourceCardInst.counters[counterType] = Math.max(0, current - amount);
      if (sourceCardInst.tokens) {
        sourceCardInst.tokens.counters = Math.max(
          0,
          (sourceCardInst.tokens.counters || 0) - amount,
        );
      }
      checkAndDiscardZeroCounterCard(state, player, sourceCardInst, counterType);
    }
  }

  // 4. Discard Cards as Cost
  if (cost.discardCard) {
    const fromZone = cost.discardCard.from;
    const maxCount = (cost.discardCard as any).maxCount;
    const specifiedIds = options?.discardCardInstanceIds || [];

    if (fromZone === 'HAND') {
      if (specifiedIds.length > 0) {
        for (const id of specifiedIds) {
          const idx = player.hand.findIndex((c) => c.instanceId === id);
          if (idx !== -1) {
            const [discarded] = player.hand.splice(idx, 1);
            player.discard.push(discarded);
            discardedCount++;
          }
        }
      } else if (cost.discardCard.mode === 'RANDOM') {
        const count = cost.discardCard.count || 1;
        const countToDiscard = Math.min(player.hand.length, count);
        for (let i = 0; i < countToDiscard; i++) {
          const randIdx = Math.floor(Math.random() * player.hand.length);
          const [discarded] = player.hand.splice(randIdx, 1);
          player.discard.push(discarded);
          discardedCount++;
        }
      } else if (maxCount) {
        // Discard all available hand cards up to maxCount
        const countToDiscard = Math.min(player.hand.length, maxCount);
        const discarded = player.hand.splice(0, countToDiscard);
        player.discard.push(...discarded);
        discardedCount = countToDiscard;
      } else {
        const countToDiscard = Math.min(player.hand.length, cost.discardCard.count || 1);
        const discarded = player.hand.splice(0, countToDiscard);
        player.discard.push(...discarded);
        discardedCount = countToDiscard;
      }
    }
  }

  // 5. Resource Cost Payment (cost.resourceCost / cost.resources)
  let resourcesPaid = 0;
  let resCost = extractResourceCost(cost);
  if (
    !resCost.hasCost &&
    ability.zone === 'HAND' &&
    sourceCardInst?.card &&
    ((sourceCardInst.card.type as any) === 'event' || sourceCardInst.card.type === CardType.EVENT)
  ) {
    const cardCost = sourceCardInst.card.cost ?? 0;
    if (cardCost > 0) {
      resCost = {
        hasCost: true,
        requiredType: undefined,
        requiredAmount: cardCost,
        requirePrinted: false,
      };
    }
  }
  if (resCost.hasCost) {
    const { requiredType, requiredAmount, requirePrinted } = resCost;
    const specifiedPaymentIds = options?.paymentCardInstanceIds || [];
    const specifiedGeneratorIds = options?.generatorInstanceIds || [];

    // Process generator activations
    for (const gId of specifiedGeneratorIds) {
      if (gId === 'identity_ability' || gId === player.activeFormCard.code) {
        const genAmt = getGeneratorProvidedResources(
          state,
          player,
          gId,
          requiredType,
          requirePrinted,
        );
        resourcesPaid += genAmt;

        const idAbility = player.activeFormCard.enrichment?.abilities?.find(
          (a) =>
            a.timing === 'RESOURCE' ||
            a.timing === 'HERO_RESOURCE' ||
            a.timing === 'ALTER_EGO_RESOURCE' ||
            a.steps?.some((s) => s.effect === 'GENERATE_RESOURCE'),
        );
        if (idAbility) {
          if (!player.usedAbilitiesThisRound) player.usedAbilitiesThisRound = {};
          player.usedAbilitiesThisRound[idAbility.id] =
            (player.usedAbilitiesThisRound[idAbility.id] || 0) + 1;
          if (!player.usedAbilitiesThisPhase) player.usedAbilitiesThisPhase = {};
          player.usedAbilitiesThisPhase[idAbility.id] =
            (player.usedAbilitiesThisPhase[idAbility.id] || 0) + 1;
        }
        state.log.push({
          id: `log_${Date.now()}_id_res`,
          timestamp: Date.now(),
          round: state.roundNumber,
          phase: state.phase,
          key: 'identity.ability.used',
          params: { ability: idAbility?.id || 'resource', hero: player.activeFormCard.name },
          onomatopoeia: 'RESOURCE GENERATED!',
        });
      } else {
        const gIdx = player.tableau.findIndex((c) => c.instanceId === gId);
        if (gIdx !== -1) {
          const gCard = player.tableau[gIdx];
          const genAmt = getGeneratorProvidedResources(
            state,
            player,
            gId,
            requiredType,
            requirePrinted,
          );
          resourcesPaid += genAmt;

          gCard.exhausted = true;
          const enrichment = gCard.card.enrichment || getCardEnrichment(gCard.card.code);
          const abilities = enrichment?.abilities || [];
          const tableAbility = abilities.find(
            (a) =>
              isResourceAbility(a.timing) ||
              a.steps?.some((s) => s.effect === 'GENERATE_RESOURCE' || s.effect === 'COST_REDUCER'),
          );
          if (tableAbility) {
            const key = `${gCard.instanceId}_${tableAbility.id}`;
            if (!player.usedAbilitiesThisRound) player.usedAbilitiesThisRound = {};
            player.usedAbilitiesThisRound[key] = (player.usedAbilitiesThisRound[key] || 0) + 1;
            if (!player.usedAbilitiesThisPhase) player.usedAbilitiesThisPhase = {};
            player.usedAbilitiesThisPhase[key] = (player.usedAbilitiesThisPhase[key] || 0) + 1;
          }
          if (enrichment?.uses) {
            const counterType = enrichment.uses.type;
            if (
              gCard.tokens &&
              typeof gCard.tokens.counters === 'number' &&
              gCard.tokens.counters > 0
            ) {
              gCard.tokens.counters = Math.max(0, gCard.tokens.counters - 1);
            }
            if (
              counterType &&
              gCard.counters &&
              typeof gCard.counters[counterType] === 'number' &&
              gCard.counters[counterType] > 0
            ) {
              gCard.counters[counterType] = Math.max(0, gCard.counters[counterType] - 1);
            }
            checkAndDiscardZeroCounterCard(state, player, gCard, counterType);
          }
          state.log.push({
            id: `log_${Date.now()}_gen_res`,
            timestamp: Date.now(),
            round: state.roundNumber,
            phase: state.phase,
            key: 'card.ability.used',
            params: { card: gCard.card.name },
            onomatopoeia: 'GENERATED RESOURCE!',
          });
        }
      }
    }

    // Process payment cards from hand
    if (specifiedPaymentIds.length > 0) {
      for (const id of specifiedPaymentIds) {
        if (sourceCardInst && id === sourceCardInst.instanceId) continue;
        const idx = player.hand.findIndex((c) => c.instanceId === id);
        if (idx !== -1) {
          const [discarded] = player.hand.splice(idx, 1);
          player.discard.push(discarded);
          discardedCount++;
          const cardAmt = getCardProvidedResources(discarded, requiredType, requirePrinted);
          resourcesPaid += cardAmt;
        }
      }
    } else if (specifiedGeneratorIds.length === 0) {
      // Auto-consume cards from hand until requiredAmount is satisfied
      while (player.hand.length > 0 && resourcesPaid < requiredAmount) {
        let cardIdx = -1;
        for (let i = 0; i < player.hand.length; i++) {
          if (sourceCardInst && player.hand[i].instanceId === sourceCardInst.instanceId) continue;
          if (getCardProvidedResources(player.hand[i], requiredType, requirePrinted) > 0) {
            cardIdx = i;
            break;
          }
        }
        if (cardIdx === -1) break;

        const [discarded] = player.hand.splice(cardIdx, 1);
        player.discard.push(discarded);
        discardedCount++;
        const cardAmt = getCardProvidedResources(discarded, requiredType, requirePrinted);
        resourcesPaid += cardAmt;
      }
    }
  }

  return { state, discardedCount, resourcesPaid };
}

/**
 * Returns true if the specified timing is a resource generation timing (ADR-0039).
 */
export function isResourceAbility(timing: AbilityTiming): boolean {
  return timing === 'RESOURCE' || timing === 'HERO_RESOURCE' || timing === 'ALTER_EGO_RESOURCE';
}

/**
 * Returns true if the specified ability timing is legal in the current identity form (ADR-0039).
 */
export function isAbilityPlayableInForm(
  timing: AbilityTiming,
  currentForm: 'hero' | 'alter_ego',
): boolean {
  if (timing.startsWith('HERO_') && currentForm !== 'hero') return false;
  if (timing.startsWith('ALTER_EGO_') && currentForm !== 'alter_ego') return false;
  return true;
}

/**
 * Cascades hosted attachments and tucked cards to appropriate discard piles when a host leaves play (RR v1.8 p. 5, 6).
 */
function cascadeAttachmentsAndTuckedCards(
  state: GameState,
  cardInstance: CardInstance,
  defaultPlayerId: string,
): void {
  if (cardInstance.attachments && cardInstance.attachments.length > 0) {
    for (const attachment of cardInstance.attachments) {
      const type = attachment.card?.type?.toLowerCase();
      const isEncounter =
        type === 'minion' ||
        type === 'treachery' ||
        type === 'side_scheme' ||
        type === 'attachment' ||
        type === 'obligation';
      if (isEncounter) {
        state.encounterDiscard.push(attachment);
      } else {
        const ownerId = (attachment as any).ownerId || defaultPlayerId;
        const targetP = state.players.find((p) => p.id === ownerId) || state.players[0];
        targetP.discard.push(attachment);
        dispatchTrigger(state, 'CARD_DISCARDED', {
          targetPlayerId: targetP.id,
          sourceInstanceId: attachment.instanceId,
        });
      }
    }
    cardInstance.attachments = [];
  }

  if (cardInstance.cardsUnderneath && cardInstance.cardsUnderneath.length > 0) {
    for (const tucked of cardInstance.cardsUnderneath) {
      const type = tucked.card?.type?.toLowerCase();
      const isEncounter =
        type === 'minion' ||
        type === 'treachery' ||
        type === 'side_scheme' ||
        type === 'attachment' ||
        type === 'obligation';
      if (isEncounter) {
        state.encounterDiscard.push(tucked);
      } else {
        const ownerId = (tucked as any).ownerId || defaultPlayerId;
        const targetP = state.players.find((p) => p.id === ownerId) || state.players[0];
        targetP.discard.push(tucked);
        dispatchTrigger(state, 'CARD_DISCARDED', {
          targetPlayerId: targetP.id,
          sourceInstanceId: tucked.instanceId,
        });
      }
    }
    cardInstance.cardsUnderneath = [];
  }
}

/**
 * Checks if an in-play card has exhausted its 'Uses' counters and discards it per RR v1.8 p. 30 and ADR-0057.
 * Cascades hosted attachments and cards underneath to appropriate discard piles, routes host card to owner's
 * discard, dispatches the CARD_DISCARDED trigger, and logs comic onomatopoeia.
 * Strictly respects discardOnEmpty: false for cards that enter with counters but lack the Uses keyword (e.g. Hawkeye 01066).
 */
export function checkAndDiscardZeroCounterCard(
  state: GameState,
  player: PlayerState,
  cardInstance: CardInstance,
  counterType?: string,
): boolean {
  // Strict non-discard guard: if enrichment explicitly marks discardOnEmpty as false, do not discard
  if (cardInstance.card.enrichment?.uses?.discardOnEmpty === false) return false;

  // Check if card has 'Uses' keyword or enrichment discardOnEmpty
  const hasUsesKeyword =
    Boolean(cardInstance.card.enrichment?.uses?.discardOnEmpty) ||
    Boolean((cardInstance.card as any).uses) ||
    hasKeyword(cardInstance.card, Keyword.USES);

  if (!hasUsesKeyword) return false;

  // Calculate remaining counters
  let remainingCounters = 0;
  if (counterType && cardInstance.counters && cardInstance.counters[counterType] !== undefined) {
    remainingCounters = cardInstance.counters[counterType];
  } else if (cardInstance.counters && Object.keys(cardInstance.counters).length > 0) {
    remainingCounters = Object.values(cardInstance.counters).reduce((sum, v) => sum + v, 0);
  } else {
    remainingCounters = cardInstance.tokens?.counters || 0;
  }

  if (remainingCounters <= 0) {
    // Check if card is already in a discard pile to prevent duplicate discard processing
    const isAlreadyDiscarded =
      state.players.some((p) => p.discard.some((c) => c.instanceId === cardInstance.instanceId)) ||
      state.encounterDiscard.some((c) => c.instanceId === cardInstance.instanceId);
    if (isAlreadyDiscarded) return false;

    // 1. Remove using removeCardFromAllZones
    removeCardFromAllZones(state, cardInstance.instanceId);

    // 2. Cascade attachments & cards underneath to discard via helper or loop
    cascadeAttachmentsAndTuckedCards(state, cardInstance, player.id);

    // 3. Push to owner's discard (or player's discard if owner not found)
    const owner =
      (cardInstance.ownerId
        ? state.players.find((p) => p.id === cardInstance.ownerId)
        : undefined) || player;
    owner.discard.push(cardInstance);

    // 4. Dispatch CARD_DISCARDED trigger
    dispatchTrigger(state, 'CARD_DISCARDED', {
      targetPlayerId: player.id,
      sourceInstanceId: cardInstance.instanceId,
    });

    // 5. Append comic log entry card.discarded.uses_exhausted with onomatopoeia 'USES EXHAUSTED!'
    state.log.push({
      id: `log_${Date.now()}_uses_exhausted`,
      timestamp: Date.now(),
      round: state.roundNumber,
      phase: state.phase,
      category: 'card_play',
      actor: { name: player.name, type: player.currentForm },
      key: 'card.discarded.uses_exhausted',
      params: { player: player.name, card: cardInstance.card.name },
      onomatopoeia: 'USES EXHAUSTED!',
    });

    return true;
  }

  return false;
}

/**
 * Returns all active cost reduction auras currently on the player that apply to the specified card.
 */
export function getApplicableCostReductions(
  player: PlayerState,
  cardOrInstance: CardInstance | NormalizedCard,
  state?: GameState,
): ActiveCostReduction[] {
  const reductions = player.activeCostReductions || [];
  if (reductions.length === 0) return [];

  const rawCard = 'card' in cardOrInstance ? cardOrInstance.card : cardOrInstance;

  return reductions.filter((r) => {
    if (!r.cardFilter) return true;
    return matchesCardFilter(rawCard, r.cardFilter, { player, state });
  });
}

/**
 * Calculates the effective resource cost of a card, accounting for all applicable active cost reductions.
 */
export function getEffectiveCardCost(
  state: GameState,
  player: PlayerState,
  cardOrInstance: CardInstance | NormalizedCard,
): {
  effectiveCost: number;
  baseCost: number;
  reductions: ActiveCostReduction[];
  totalReduction: number;
} {
  const rawCard = 'card' in cardOrInstance ? cardOrInstance.card : cardOrInstance;
  const baseCost = rawCard.cost ?? 0;
  const reductions = getApplicableCostReductions(player, cardOrInstance, state);
  const totalReduction = reductions.reduce((sum, r) => sum + r.amount, 0);
  const effectiveCost = Math.max(0, baseCost - totalReduction);

  return {
    effectiveCost,
    baseCost,
    reductions,
    totalReduction,
  };
}
