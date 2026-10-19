/**
 * Centralized Dynamic Formula & State Value Evaluator Engine (ADR-0052)
 *
 * Implements RR v1.8 calculation rules:
 * - Dynamic point-in-time calculation at ability resolution (RR v1.8 p. 11, 31).
 * - Fractions rounded down via Math.floor (RR v1.8 p. 11).
 * - Minimum bound of 0 via Math.max(0, ...) (RR v1.8 p. 11: "A quantity cannot be reduced below 0").
 * - Clamping bounds (clamp.min, clamp.max) for limits and ceilings.
 */

import type {
  GameState,
  PlayerState,
  CardInstance,
  SideSchemeState,
  VillainState,
  NormalizedCard,
} from '../models';
import { getActiveVillain, getActiveMainScheme, getVillainById } from '../models';
import type {
  DynamicValueSource,
  CardLocationSelector,
  CardInspectionAttribute,
} from '../../data/supplemental/schema';
import { matchesCardFilter } from '../filters/card-filter';
import {
  getEffectiveHeroStats,
  getEffectiveMaxHealth,
  hasPlayerTrait,
} from '../pipeline/stat-calculator';
import { locateCard, readCardAttribute } from '../queries/card-inspector';
import type { EffectExecutionContext } from './index';

type ExtendedDynamicSource = DynamicValueSource & {
  discardAttribute?: string;
  resourceType?: string;
  targetCardCode?: string;
  fromCard?: CardLocationSelector;
  targetCard?: CardLocationSelector;
  trait?: string;
  resource?: string;
  amount?: number;
};

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
  context: Partial<EffectExecutionContext> & {
    state?: GameState;
    player?: PlayerState;
    resourcesSpent?: string[];
  } = {},
  options: DynamicEvaluationOptions = {},
): number {
  if (typeof amountParam === 'number') {
    return amountParam;
  }
  if (!amountParam || typeof amountParam !== 'object') {
    return options.fallback ?? 0;
  }

  const extParam = amountParam as ExtendedDynamicSource;

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

  const state = options.state || context.state;
  const player = options.player || context.player;

  let baseValue = 0;

  switch (from) {
    case 'INTERCEPTED_VALUE': {
      baseValue = context.interceptedValue ?? context.threatAmount ?? context.damageAmount ?? 0;
      break;
    }
    case 'PREVIOUS_RESULT': {
      baseValue = context.previousResult?.value ?? 0;
      break;
    }
    case 'PREVIOUS_EXCESS_DAMAGE': {
      baseValue = context.previousResult?.facts?.excessDamage ?? 0;
      break;
    }
    case 'DISCARDED_CARDS': {
      const discarded: CardInstance[] =
        context.previousResult?.discardedCards || context.discardedCards || [];
      const cards = filter
        ? discarded.filter(
            (inst) => inst?.card && matchesCardFilter(inst, filter, { player, state }),
          )
        : discarded;

      const discardAttribute =
        extParam.discardAttribute || (extParam.resourceType ? 'RESOURCE_ICONS' : 'COUNT');

      switch (discardAttribute) {
        case 'COUNT': {
          baseValue = cards.length;
          break;
        }
        case 'RESOURCE_ICONS': {
          const resType = extParam.resourceType;
          let count = 0;
          for (const inst of cards) {
            if (!inst?.card) continue;
            const res = inst.card.resources;
            const raw = inst.card.raw as unknown as Record<string, unknown> | undefined;
            if (resType) {
              const val =
                res?.[resType as keyof typeof res] ??
                (raw?.[`resource_${resType}`] as number | undefined) ??
                0;
              count += typeof val === 'number' ? val : 0;
            } else {
              const totalVal =
                res?.total ??
                ((raw?.resource_physical as number | undefined) || 0) +
                  ((raw?.resource_energy as number | undefined) || 0) +
                  ((raw?.resource_mental as number | undefined) || 0) +
                  ((raw?.resource_wild as number | undefined) || 0);
              count += typeof totalVal === 'number' ? totalVal : 0;
            }
          }
          baseValue = count;
          break;
        }
        case 'DIFFERENT_RESOURCES': {
          const distinctTypes = new Set<string>();
          for (const inst of cards) {
            if (!inst?.card) continue;
            const res = inst.card.resources;
            const raw = inst.card.raw as unknown as Record<string, unknown> | undefined;
            const resourceKeys = ['physical', 'energy', 'mental', 'wild'] as const;
            for (const rk of resourceKeys) {
              const val = res?.[rk] ?? (raw?.[`resource_${rk}`] as number | undefined) ?? 0;
              if (typeof val === 'number' && val > 0) {
                distinctTypes.add(rk);
              }
            }
          }
          baseValue = distinctTypes.size;
          break;
        }
        case 'BOOST_ICONS': {
          let totalBoost = 0;
          for (const inst of cards) {
            if (!inst?.card) continue;
            const cardRec = inst.card as unknown as Record<string, unknown>;
            const rawRec = inst.card.raw as unknown as Record<string, unknown> | undefined;
            const boostVal =
              (cardRec.boostIcons as number | undefined) ??
              (cardRec.boost as number | undefined) ??
              (rawRec?.boost as number | undefined) ??
              0;
            totalBoost += typeof boostVal === 'number' ? boostVal : 0;
          }
          baseValue = totalBoost;
          break;
        }
        case 'DIFFERENT_CARD_TYPES': {
          const distinctTypes = new Set<string>();
          for (const inst of cards) {
            if (!inst?.card) continue;
            const rawRec = inst.card.raw as unknown as Record<string, unknown> | undefined;
            const cardType = inst.card.type || (rawRec?.type_code as string | undefined);
            if (cardType) {
              distinctTypes.add(cardType);
            }
          }
          baseValue = distinctTypes.size;
          break;
        }
        case 'PRINTED_COST': {
          let totalCost = 0;
          for (const inst of cards) {
            if (!inst?.card) continue;
            const rawRec = inst.card.raw as unknown as Record<string, unknown> | undefined;
            const costVal = inst.card.cost ?? (rawRec?.cost as number | undefined) ?? 0;
            totalCost += typeof costVal === 'number' ? costVal : 0;
          }
          baseValue = totalCost;
          break;
        }
        default:
          baseValue = cards.length;
      }
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
            : player.hero?.health || player.health;
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
          const targetObj = target as { code?: string } | undefined;
          const filterObj = filter as { code?: string; codes?: string[] } | undefined;
          const targetCardCode =
            extParam.targetCardCode || targetObj?.code || filterObj?.code || filterObj?.codes?.[0];
          if (targetCardCode) {
            const located = locateCard(
              state,
              { zone: 'IN_PLAY', cardCode: targetCardCode },
              { player },
            );
            baseValue = located ? readCardAttribute(located, 'THREAT') : 0;
          } else if (options.targetInstanceId) {
            const sideScheme = state.sideSchemes?.find(
              (s: SideSchemeState) =>
                s.instanceId === options.targetInstanceId ||
                (s as unknown as { id?: string }).id === options.targetInstanceId,
            );
            baseValue = sideScheme ? sideScheme.threat : (getActiveMainScheme(state)?.threat ?? 0);
          } else {
            baseValue = getActiveMainScheme(state)?.threat ?? 0;
          }
        }
      } else if (stat === 'DAMAGE') {
        if (state) {
          const targetObj = target as { code?: string } | undefined;
          const filterObj = filter as { code?: string; codes?: string[] } | undefined;
          const targetCardCode =
            extParam.targetCardCode || targetObj?.code || filterObj?.code || filterObj?.codes?.[0];
          if (options.targetInstanceId) {
            const minion = state.players
              .flatMap((p: PlayerState) => p.engagedMinions || [])
              .find(
                (m: CardInstance) =>
                  m.instanceId === options.targetInstanceId ||
                  (m as unknown as { id?: string }).id === options.targetInstanceId,
              );
            if (minion) {
              baseValue =
                minion.tokens?.damage ?? (minion as unknown as { damage?: number }).damage ?? 0;
            } else {
              const ally = state.players
                .flatMap((p: PlayerState) => p.allies || [])
                .find(
                  (a: CardInstance) =>
                    a.instanceId === options.targetInstanceId ||
                    (a as unknown as { id?: string }).id === options.targetInstanceId,
                );
              if (ally) {
                baseValue =
                  ally.tokens?.damage ?? (ally as unknown as { damage?: number }).damage ?? 0;
              } else {
                const targetPlayer = state.players.find(
                  (p: PlayerState) =>
                    p.id === options.targetInstanceId ||
                    (p as unknown as { instanceId?: string }).instanceId ===
                      options.targetInstanceId ||
                    (p as unknown as { identity?: { instanceId?: string } }).identity
                      ?.instanceId === options.targetInstanceId,
                );
                if (targetPlayer) {
                  baseValue = Math.max(
                    0,
                    (targetPlayer.maxHealth ?? 0) - (targetPlayer.health ?? 0),
                  );
                } else {
                  const targetVillain =
                    getVillainById(state, options.targetInstanceId) ||
                    (state.villains || []).find(
                      (v: VillainState) =>
                        v.instanceId === options.targetInstanceId ||
                        (v as unknown as { id?: string }).id === options.targetInstanceId,
                    );
                  if (targetVillain) {
                    baseValue = Math.max(
                      0,
                      (targetVillain.maxHealth ?? 0) - (targetVillain.health ?? 0),
                    );
                  } else {
                    const activeVillain = getActiveVillain(state);
                    baseValue = activeVillain
                      ? Math.max(0, (activeVillain.maxHealth ?? 0) - (activeVillain.health ?? 0))
                      : 0;
                  }
                }
              }
            }
          } else if (targetCardCode) {
            const located = locateCard(
              state,
              { zone: 'IN_PLAY', cardCode: targetCardCode },
              { player },
            );
            baseValue = located ? readCardAttribute(located, 'DAMAGE') : 0;
          } else {
            const activeVillain = getActiveVillain(state);
            baseValue = activeVillain
              ? Math.max(0, (activeVillain.maxHealth ?? 0) - (activeVillain.health ?? 0))
              : 0;
          }
        }
      }
      break;
    }
    case 'ENTITY_COUNT': {
      if (state) {
        if (filter?.types?.includes('side_scheme')) {
          baseValue = (state.sideSchemes || []).length;
        } else if (filter) {
          baseValue = (player?.tableau || []).filter((inst: CardInstance) =>
            matchesCardFilter(inst, filter, { player, state }),
          ).length;
        }
      }
      break;
    }
    case 'CARD_ATTRIBUTE': {
      const cardSelector = extParam.fromCard || extParam.targetCard;
      let targetEntity: CardInstance | NormalizedCard | undefined = undefined;

      if (cardSelector && state) {
        targetEntity = locateCard(state, cardSelector, {
          player,
          sourceCardInstance: options.sourceCardInstance || context.sourceCardInstance,
          targetCardInstance: options.targetCardInstance || context.targetCardInstance,
        });
      } else {
        targetEntity =
          options.targetCardInstance || options.sourceCardInstance || context.sourceCardInstance;
      }

      if (targetEntity) {
        baseValue = readCardAttribute(
          targetEntity,
          (attribute as CardInspectionAttribute) || 'PRINTED_RESOURCES',
        );
      }
      break;
    }
    case 'HAS_TRAIT': {
      if (player) {
        const traitsToCheck = filter?.traits || (extParam.trait ? [extParam.trait] : []);
        const hasTrait = traitsToCheck.some((t: string) => hasPlayerTrait(player, t, state));
        baseValue = hasTrait ? 1 : 0;
      }
      break;
    }
    case 'HAS_IDENTITY': {
      const activeCard =
        player?.activeFormCard ||
        (player?.currentForm === 'hero' ? player?.hero : player?.alterEgo);
      if (activeCard) {
        baseValue = matchesCardFilter(activeCard, filter, { player, state }) ? 1 : 0;
      }
      break;
    }
    case 'PAID_WITH_RESOURCE': {
      const requiredResource = extParam.resource || extParam.resourceType;
      const spent: string[] = context.resourcesSpent || [];
      const hasMatchingResource = requiredResource
        ? spent.some((r) => {
            const lower = String(r).toLowerCase();
            return lower === String(requiredResource).toLowerCase() || lower === 'wild';
          })
        : spent.length > 0;
      baseValue = hasMatchingResource ? (extParam.amount ?? 1) : 0;
      break;
    }
    case 'RESOURCES_SPENT': {
      const targetResource = extParam.resource || extParam.resourceType;
      const spent: string[] = context.resourcesSpent || [];
      if (targetResource) {
        const count = spent.filter((r) => {
          const lower = String(r).toLowerCase();
          return lower === String(targetResource).toLowerCase() || lower === 'wild';
        }).length;
        baseValue = count;
      } else {
        baseValue = spent.length;
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
