/**
 * Centralized Dynamic Formula & State Value Evaluator Engine (ADR-0052)
 *
 * Implements RR v1.8 calculation rules:
 * - Dynamic point-in-time calculation at ability resolution (RR v1.8 p. 11, 31).
 * - Fractions rounded down via Math.floor (RR v1.8 p. 11).
 * - Minimum bound of 0 via Math.max(0, ...) (RR v1.8 p. 11: "A quantity cannot be reduced below 0").
 * - Clamping bounds (clamp.min, clamp.max) for limits and ceilings.
 */

import type { GameState, PlayerState, CardInstance } from '../models';
import type { DynamicValueSource } from '../../data/supplemental/schema';
import { matchesCardFilter } from '../filters/card-filter';
import { getEffectiveHeroStats, getEffectiveMaxHealth } from '../pipeline/stat-calculator';

export interface DynamicEvaluationOptions {
  state?: GameState;
  player?: PlayerState;
  targetInstanceId?: string;
  targetCardInstance?: CardInstance;
  sourceCardInstance?: CardInstance;
  fallback?: number;
}

export function evaluateDynamicAmount(
  amountParam: number | DynamicValueSource | undefined,
  context: Record<string, any> = {},
  options: DynamicEvaluationOptions = {},
): number {
  if (typeof amountParam === 'number') {
    return amountParam;
  }
  if (!amountParam || typeof amountParam !== 'object') {
    return options.fallback ?? 0;
  }

  const {
    from,
    stat,
    counterType,
    target,
    filter,
    attribute,
    multiplier = 1,
    offset = 0,
    clamp,
  } = amountParam;

  const state = options.state || (context as any).state;
  const player = options.player || (context as any).player;

  let baseValue = 0;

  switch (from) {
    case 'INTERCEPTED_VALUE': {
      baseValue = context.interceptedValue ?? context.threatAmount ?? context.damageAmount ?? 0;
      break;
    }
    case 'PREVIOUS_RESULT':
    case 'DISCARDED_COUNT': {
      baseValue = context.previousResult?.value ?? 0;
      break;
    }
    case 'COUNTERS': {
      const cType = counterType || 'energy';
      if (
        target === 'SELF_IDENTITY' ||
        target === 'TRIGGERING_HERO' ||
        (target as string) === 'IDENTITY' ||
        (target as string) === 'PLAYER'
      ) {
        baseValue = player?.counters?.[cType] ?? 0;
      } else {
        const cardInst =
          options.targetCardInstance || options.sourceCardInstance || context.sourceCardInstance;
        if (cardInst) {
          baseValue = cardInst.counters?.[cType] ?? cardInst.tokens?.counters ?? 0;
        } else if (player) {
          baseValue = player.counters?.[cType] ?? 0;
        }
      }
      break;
    }
    case 'STAT_VALUE': {
      if (stat === 'SUFFERED_DAMAGE') {
        if (player) {
          const effectiveMax = state
            ? getEffectiveMaxHealth(player, state)
            : player.hero?.hitPoints || player.health;
          baseValue = Math.max(0, effectiveMax - player.health);
        }
      } else if (stat === 'ATTACK' || stat === 'HERO_ATK') {
        if (state && player) {
          baseValue = getEffectiveHeroStats(state, player).attack;
        } else if (player?.hero) {
          baseValue = player.hero.attack || 0;
        }
      } else if (stat === 'THWART') {
        if (state && player) {
          baseValue = getEffectiveHeroStats(state, player).thwart;
        } else if (player?.hero) {
          baseValue = player.hero.thwart || 0;
        }
      } else if (stat === 'DEFENSE') {
        if (state && player) {
          baseValue = getEffectiveHeroStats(state, player).defense;
        } else if (player?.hero) {
          baseValue = player.hero.defense || 0;
        }
      } else if (stat === 'RECOVERY') {
        if (state && player) {
          baseValue = getEffectiveHeroStats(state, player).recovery;
        } else if (player?.alterEgo) {
          baseValue = player.alterEgo.recover || 0;
        }
      } else if (stat === 'THREAT') {
        if (state) {
          if (options.targetInstanceId) {
            const sideScheme = state.sideSchemes?.find(
              (s: any) =>
                s.instanceId === options.targetInstanceId || s.id === options.targetInstanceId,
            );
            baseValue = sideScheme ? sideScheme.threat : (state.mainScheme?.threat ?? 0);
          } else {
            baseValue = state.mainScheme?.threat ?? 0;
          }
        }
      } else if (stat === 'DAMAGE') {
        if (state) {
          if (options.targetInstanceId) {
            const minion = state.players
              .flatMap((p: PlayerState) => p.engagedMinions || [])
              .find(
                (m: any) =>
                  m.instanceId === options.targetInstanceId || m.id === options.targetInstanceId,
              );
            baseValue = minion ? minion.damage || 0 : state.villain?.damage || 0;
          } else {
            baseValue = state.villain?.damage || 0;
          }
        }
      }
      break;
    }
    case 'ENTITY_COUNT': {
      if (state) {
        if (filter?.types?.includes('side_scheme') || (filter as any)?.type === 'side_scheme') {
          baseValue = (state.sideSchemes || []).length;
        } else if (filter) {
          const cardsToCheck = (player?.tableau || []).map((t: any) => t.card);
          baseValue = cardsToCheck.filter((c: any) =>
            matchesCardFilter(c, filter, { player, state }),
          ).length;
        }
      }
      break;
    }
    case 'CARD_ATTRIBUTE': {
      const cardInst =
        options.targetCardInstance || options.sourceCardInstance || context.sourceCardInstance;
      if (cardInst?.card) {
        if (attribute === 'BOOST_ICONS') {
          baseValue = (cardInst.card as any).boost || 0;
        } else if (attribute === 'PRINTED_COST') {
          baseValue = (cardInst.card as any).cost || 0;
        } else if (attribute === 'PRINTED_RESOURCES') {
          baseValue = (cardInst.card as any).resources?.length || 0;
        }
      }
      break;
    }
    default:
      baseValue = 0;
  }

  // RR v1.8 p. 11: Calculations: Multiply, add offset, round down fractions
  let calculated = Math.floor(baseValue * multiplier + offset);

  // Apply clamping bounds if defined
  if (clamp?.min !== undefined) {
    calculated = Math.max(clamp.min, calculated);
  }
  if (clamp?.max !== undefined) {
    calculated = Math.min(clamp.max, calculated);
  }

  // RR v1.8 p. 11: A quantity cannot be reduced below 0
  return Math.max(0, calculated);
}
