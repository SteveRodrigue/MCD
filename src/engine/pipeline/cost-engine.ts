import { GameState, PlayerState, CardInstance, CardAbility, AbilityTiming } from '../models';
import { getEffectiveMaxHealth } from './stat-calculator';

export interface AbilityPaymentOptions {
  paymentCardInstanceIds?: string[];
  discardCardInstanceIds?: string[];
  targetInstanceId?: string;
}

/**
 * Validates whether a player can satisfy all prerequisites and costs of a card ability.
 */
export function canPayAbilityCost(
  _state: GameState,
  player: PlayerState,
  ability: CardAbility,
  sourceCardInst?: CardInstance,
  _options?: AbilityPaymentOptions,
): { allowed: boolean; reason?: string } {
  const cost = ability.cost;
  if (!cost) return { allowed: true };

  // 1. Cost Check / Pre-Condition Validation
  if (cost.costCheck) {
    if (cost.costCheck === 'CURRENT_HEALTH < MAX_HEALTH') {
      const maxHp = getEffectiveMaxHealth(player, _state);
      if (player.health >= maxHp) {
        return { allowed: false, reason: 'Identity is already at maximum health.' };
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
        sourceCardInst?.counters?.[counterType] ??
        sourceCardInst?.tokens?.counters ??
        0;
      if (current < amount) {
        return {
          allowed: false,
          reason: `Insufficient ${counterType} counters on card (Requires ${amount}, has ${current}).`,
        };
      }
    }
  } else if (cost.spendTokens) {
    const currentTokens = (sourceCardInst?.tokens as any)?.[cost.spendTokens.type] || 0;
    if (currentTokens < cost.spendTokens.count) {
      return {
        allowed: false,
        reason: `Insufficient '${cost.spendTokens.type}' tokens on card (Requires ${cost.spendTokens.count}, has ${currentTokens}).`,
      };
    }
  } else if (cost.removeCounter || (cost as any).spendCounter) {
    const required = cost.removeCounter || (cost as any).spendCounter;
    const current =
      sourceCardInst?.counters?.['all_purpose'] ??
      sourceCardInst?.counters?.['counter'] ??
      (sourceCardInst?.counters ? Object.values(sourceCardInst.counters)[0] : undefined) ??
      sourceCardInst?.tokens?.counters ??
      0;
    if (current < required) {
      return {
        allowed: false,
        reason: `Insufficient counters on card (Requires ${required}, has ${current}).`,
      };
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
          reason: `Insufficient cards in hand (Requires ${requiredCount} cards, has ${player.hand.length}).`,
        };
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
): { state: GameState; discardedCount: number } {
  const cost = ability.cost;
  let discardedCount = 0;
  if (!cost) return { state, discardedCount: 0 };

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
      const current =
        sourceCardInst.counters[counterType] ??
        sourceCardInst.tokens?.counters ??
        0;
      sourceCardInst.counters[counterType] = Math.max(0, current - amount);
      if (sourceCardInst.tokens) {
        sourceCardInst.tokens.counters = Math.max(0, (sourceCardInst.tokens.counters || 0) - amount);
      }
    }
  } else if (cost.spendTokens && sourceCardInst) {
    const tokenType = cost.spendTokens.type;
    const count = cost.spendTokens.count;
    const current = (sourceCardInst.tokens as any)?.[tokenType] || 0;
    sourceCardInst.tokens = {
      ...sourceCardInst.tokens,
      [tokenType]: Math.max(0, current - count),
    };
  } else if ((cost.removeCounter || (cost as any).spendCounter) && sourceCardInst) {
    const count = cost.removeCounter || (cost as any).spendCounter;
    if (sourceCardInst.counters) {
      for (const k of Object.keys(sourceCardInst.counters)) {
        sourceCardInst.counters[k] = Math.max(0, sourceCardInst.counters[k] - count);
      }
    }
    const current = sourceCardInst.tokens?.counters || 0;
    sourceCardInst.tokens = {
      ...sourceCardInst.tokens,
      counters: Math.max(0, current - count),
    };
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

  return { state, discardedCount };
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
export function isAbilityPlayableInForm(timing: AbilityTiming, currentForm: 'hero' | 'alter_ego'): boolean {
  if (timing.startsWith('HERO_') && currentForm !== 'hero') return false;
  if (timing.startsWith('ALTER_EGO_') && currentForm !== 'alter_ego') return false;
  return true;
}
