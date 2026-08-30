import { GameState, PlayerState, CardInstance, CardAbility } from '../models';
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
  const spendTokens = cost.spendTokens;
  const removeCounter = cost.removeCounter || (cost as any).spendCounter;
  if (spendTokens) {
    const currentTokens = (sourceCardInst?.tokens as any)?.[spendTokens.type] || 0;
    if (currentTokens < spendTokens.count) {
      return {
        allowed: false,
        reason: `Insufficient '${spendTokens.type}' tokens on card (Requires ${spendTokens.count}, has ${currentTokens}).`,
      };
    }
  } else if (removeCounter && removeCounter > 0) {
    const currentCounters = sourceCardInst?.tokens?.counters || 0;
    if (currentCounters < removeCounter) {
      return {
        allowed: false,
        reason: `Insufficient counters on card (Requires ${removeCounter}, has ${currentCounters}).`,
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
  if (cost.spendTokens && sourceCardInst) {
    const tokenType = cost.spendTokens.type;
    const count = cost.spendTokens.count;
    const current = (sourceCardInst.tokens as any)?.[tokenType] || 0;
    sourceCardInst.tokens = {
      ...sourceCardInst.tokens,
      [tokenType]: Math.max(0, current - count),
    };
  } else if ((cost.removeCounter || (cost as any).spendCounter) && sourceCardInst) {
    const count = cost.removeCounter || (cost as any).spendCounter;
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
