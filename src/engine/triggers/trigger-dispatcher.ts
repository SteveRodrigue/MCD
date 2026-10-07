import {
  GameState,
  TriggerType,
  AbilityStep,
  PlayerState,
  CardInstance,
  CardAbility,
  VillainState,
  getActiveVillain,
  getVillainById,
} from '@engine/models';
import { TriggerFilter } from '../../data/supplemental/schema';
import { matchesCardFilter } from '../filters/card-filter';
import { executeEffect, type EffectExecutionContext } from '../effects';
import { abilityHasValidTarget } from '../effects/target-choice';
import {
  executeAbilityCost,
  canPayAbilityCost,
  extractResourceCost,
} from '../pipeline/cost-engine';
import { enqueueDecisionPrompt } from '../pipeline/prompt-queue';
import {
  abilityCancelsEncounterReveal,
  canCancelEncounterReveal,
} from '../pipeline/encounter-cancel';
import { InfiniteLoopError, TriggerCallNode } from '../errors/infinite-loop-error';

export const MAX_TRIGGER_DEPTH = 15;

/** A Forced Interrupt / Forced Response resolves at once; every other timing is the player's choice. */
function isForcedTiming(timing: string): boolean {
  return timing === 'FORCED_INTERRUPT' || timing === 'FORCED_RESPONSE';
}

const TRIGGER_EQUIVALENTS: Record<string, string[]> = {
  ENEMY_INITIATES_ATTACK: ['VILLAIN_INITIATES_ATTACK'],
  DAMAGE_WOULD_BE_TAKEN: ['TAKE_ATTACK_DAMAGE', 'TAKE_DAMAGE'],
  ATTACK_DEFENDED: ['HERO_DEFENDED_ATTACK'],
  CHARACTER_DEFEATED: ['MINION_DEFEATED', 'MINION_DEFEATED_BY_ATTACK', 'HOST_DEFEATED'],
  SCHEME_DEFEATED: ['SCHEME_THREAT_REDUCED_TO_ZERO'],
  FORM_CHANGED: ['FORM_CHANGED_TO_HERO', 'FORM_CHANGED_TO_ALTER_EGO', 'HERO_FLIPPED'],
};

export function triggersAreEquivalent(
  left: string | undefined,
  right: string | undefined,
): boolean {
  if (!left || !right) return false;
  if (left === right) return true;
  return (
    TRIGGER_EQUIVALENTS[left]?.includes(right) === true ||
    TRIGGER_EQUIVALENTS[right]?.includes(left) === true
  );
}

function displayTriggerName(trigger: string): string {
  return trigger;
}

function displayEffectName(effect: string): string {
  return effect;
}

/**
 * An ability that cancels the reveal of an encounter card is not offered when that reveal cannot
 * be canceled (RR v1.8 Cancel; see `canCancelEncounterReveal`) or was already canceled by an
 * earlier ability: a second cancel would only waste its cost.
 */
function revealCannotBeCanceledBy(
  state: GameState,
  ability: CardAbility,
  context: TriggerContext,
): boolean {
  return (
    context.encounterCardInstance !== undefined &&
    abilityCancelsEncounterReveal(ability) &&
    (!canCancelEncounterReveal(context.encounterCardInstance) ||
      state.activeEncounterContext?.cancelled === true)
  );
}

export function matchesTriggerFilter(
  filter: TriggerFilter | undefined,
  context: TriggerContext,
  player?: PlayerState,
  cardInst?: CardInstance,
  trigger?: TriggerType | string,
): boolean {
  const hostId = (cardInst as any)?.hostInstanceId;
  const targetId =
    context.targetInstanceId ||
    (trigger === 'CHARACTER_DEFEATED' || trigger === 'DEFEATED'
      ? context.sourceInstanceId
      : undefined);

  // Universal attachment defeat guard:
  // Attachments in play must only trigger when their attached host is defeated
  if (hostId && (trigger === 'CHARACTER_DEFEATED' || trigger === 'DEFEATED')) {
    if (targetId && targetId !== hostId) {
      return false;
    }
  }

  if (!filter) return true;

  if (filter.targetScope) {
    if (filter.targetScope === 'HOST') {
      if (!hostId) {
        return false;
      }
      if (targetId && targetId !== hostId) {
        return false;
      }
    } else if (filter.targetScope === 'SELF') {
      if (targetId && targetId !== cardInst?.instanceId) {
        return false;
      }
    } else if (filter.targetScope === 'OTHER') {
      if (targetId && targetId === cardInst?.instanceId) {
        return false;
      }
    }
  }

  if (filter.attackerKind) {
    const actual =
      context.attackerKind ??
      (context.attackerType ? String(context.attackerType).toUpperCase() : undefined);
    if (actual === 'ANY_ENEMY') {
      return true;
    }
    if (actual !== filter.attackerKind) {
      return false;
    }
  }

  if (filter.attackerCardFilter) {
    const attackerCard = context.attackerCard?.card || context.encounterCardInstance?.card;
    if (!attackerCard) return false;
    if (!matchesCardFilter(attackerCard, filter.attackerCardFilter, { player })) {
      return false;
    }
  }

  if (filter.sourceCardCode) {
    const actualSourceCardCode =
      context.sourceCardCode || context.encounterCardInstance?.card?.code;
    if (!actualSourceCardCode || actualSourceCardCode !== filter.sourceCardCode) {
      return false;
    }
  }

  if (filter.sourceInstanceId && context.sourceInstanceId !== filter.sourceInstanceId) {
    return false;
  }

  if (filter.targetPlayerScope) {
    if (!player || !context.targetPlayerId) return false;
    const actualScope = context.targetPlayerId === player.id ? 'SELF' : 'OTHER';
    if (filter.targetPlayerScope === 'ANY') {
      // no-op, allowed by explicit contract
    } else if (actualScope !== filter.targetPlayerScope) {
      return false;
    }
  }

  if (filter.targetForm) {
    const actualForm = context.targetForm?.toUpperCase();
    if (!actualForm || actualForm !== filter.targetForm) {
      return false;
    }
  }

  if (filter.targetType) {
    const actualType = context.targetType?.toUpperCase();
    // ENEMY: the villain or a minion (RR v1.8 glossary E)
    const typeMatches =
      filter.targetType === 'ENEMY'
        ? actualType === 'VILLAIN' || actualType === 'MINION'
        : actualType === filter.targetType;
    if (!actualType || !typeMatches) {
      return false;
    }
  }

  if (filter.defeatedByAttackOf) {
    // "After your hero attacks and defeats ..." / "After <this card> attacks and defeats ..."
    // (RR v1.8 glossary Y: an ally's attack is not an attack by your hero).
    const source = context.defeatSource;
    if (!source || !source.byAttack) return false;
    if (filter.defeatedByAttackOf === 'YOUR_HERO') {
      if (source.kind !== 'HERO' || !player || source.playerId !== player.id) return false;
    } else if (!cardInst || source.instanceId !== cardInst.instanceId) {
      return false;
    }
  }

  if (filter.attackedBy) {
    // "After your hero attacks ..." / "After <this card> attacks ..." (RR v1.8 glossary Y).
    const source = context.attackSource;
    if (!source) return false;
    if (filter.attackedBy === 'YOUR_HERO') {
      if (source.kind !== 'HERO' || !player || source.playerId !== player.id) return false;
    } else if (filter.attackedBy === 'THIS_CARD') {
      if (!cardInst || source.instanceId !== cardInst.instanceId) return false;
    }
  }

  if (filter.defenderType) {
    if (context.defenderType !== filter.defenderType) {
      return false;
    }
  }

  if (filter.threatSource) {
    if (context.threatSource !== filter.threatSource) {
      return false;
    }
  }

  if (filter.damageSource) {
    if (context.damageSource !== filter.damageSource) {
      return false;
    }
  }

  if (filter.isEngaged !== undefined) {
    const actualEngaged =
      Boolean(context.targetType) &&
      ['VILLAIN', 'MINION', 'ENEMY'].includes(String(context.targetType).toUpperCase());
    if (actualEngaged !== filter.isEngaged) {
      return false;
    }
  }

  return true;
}

/**
 * Who or what defeated a character (#247). Filled by the damage pipeline from the damage request
 * and carried on the DEFEATED / CHARACTER_DEFEATED contexts.
 */
export interface DefeatSource {
  kind: 'HERO' | 'ALLY' | 'ENEMY' | 'EFFECT';
  /** The player whose hero, ally or effect dealt the damage. */
  playerId?: string;
  /** The card (ally, enemy or effect source) that dealt the damage. */
  instanceId?: string;
  /** True when the damage was dealt as part of an attack. */
  byAttack: boolean;
}

/** Who made an attack, carried on the ATTACK_RESOLVED context (`triggerFilter.attackedBy`). */
export interface AttackSource {
  kind: 'HERO' | 'ALLY' | 'ENEMY';
  /** The player whose hero or ally attacked. */
  playerId?: string;
  /** The attacking ally or enemy card. */
  instanceId?: string;
}

export interface TriggerContext {
  targetPlayerId: string;
  sourceInstanceId?: string;
  sourceCardCode?: string;
  damageAmount?: number;
  preventedDamage?: boolean;
  threatAmount?: number;
  interceptedValue?: number;
  targetType?: string;
  targetInstanceId?: string;
  entityType?: string;
  attackerType?: string;
  attackerKind?: 'VILLAIN' | 'MINION' | 'ANY_ENEMY';
  targetPlayerScope?: 'SELF' | 'OTHER' | 'ANY';
  targetForm?: 'HERO' | 'ALTER_EGO';
  attackerCard?: any;
  status?: string;
  acceptOptionalTriggers?: boolean;
  encounterCardInstance?: any;
  resourcesSpent?: string[];
  attackerCardCode?: string;
  attackerName?: string;
  defenderCardCode?: string;
  defenderName?: string;
  defenderType?: 'HERO' | 'ALLY' | 'UNDEFENDED';
  /** What placed the threat, for THREAT_WOULD_BE_PLACED (e.g. 'VILLAIN_SCHEME' for Emergency). */
  threatSource?: NonNullable<TriggerFilter['threatSource']>;
  /** What dealt the damage, for DAMAGE_WOULD_BE_TAKEN (Backflip: 'ATTACK'). Absent never matches. */
  damageSource?: NonNullable<TriggerFilter['damageSource']>;
  targetCardCode?: string;
  targetName?: string;
  targetCurrentHp?: number;
  targetMaxHp?: number;
  /** For DEFEATED / CHARACTER_DEFEATED: what defeated the character. */
  defeatSource?: DefeatSource;
  /** For ATTACK_RESOLVED: who made the attack. */
  attackSource?: AttackSource;
  /** Active chain of trigger nodes leading to this invocation (ADR-0053) */
  triggerChain?: TriggerCallNode[];
  triggerDepth?: number;
}

/**
 * The villain a trigger refers to: the one named by `context.targetInstanceId`, else the active
 * villain.
 */
function targetedVillain(state: GameState, context: TriggerContext): VillainState {
  return (
    (context.targetInstanceId ? getVillainById(state, context.targetInstanceId) : undefined) ??
    getActiveVillain(state)
  );
}

export interface TriggerDispatchResult {
  state: GameState;
  preventedDamage?: boolean;
  damageAmount?: number;
  threatAmount?: number;
  interceptedValue?: number;
  cancelled?: boolean;
  hasPendingPrompt?: boolean;
}

/**
 * Validates active trigger call chain for cycles and maximum depth ceiling (ADR-0053, Issue #48).
 * Throws InfiniteLoopError if a cycle or depth limit is detected.
 */
function checkAndRecordTriggerNode(
  state: GameState,
  node: TriggerCallNode,
  chain: TriggerCallNode[],
): TriggerCallNode[] {
  // Check if node already exists in ancestor chain (cycle detection)
  const cycleIndex = chain.findIndex(
    (n) =>
      n.trigger === node.trigger &&
      (n.abilityId === node.abilityId || (!n.abilityId && !node.abilityId)) &&
      (n.sourceInstanceId === node.sourceInstanceId ||
        (!n.sourceInstanceId && !node.sourceInstanceId && n.cardCode === node.cardCode)),
  );

  if (cycleIndex !== -1) {
    const cycle = [...chain.slice(cycleIndex), node];
    const loopErr = new InfiniteLoopError(
      `[INFINITE LOOP DETECTED] Circular trigger cycle detected between forced abilities: ${node.cardName || node.cardCode || 'Unknown Card'} (${node.abilityId || 'ability'} / ${node.trigger})`,
      {
        cycle,
        triggerChain: chain,
        depth: chain.length,
      },
    );
    state.log.push({
      id: `log_${Date.now()}`,
      timestamp: Date.now(),
      key: 'engine.infinite_loop_detected',
      params: {
        message: loopErr.message,
        cycle: loopErr.formattedCycle,
      },
      onomatopoeia: 'INFINITE LOOP DETECTED!',
    });
    state.lastError = {
      type: 'INFINITE_LOOP',
      message: loopErr.message,
      formattedDetails: loopErr.formattedCycle,
    };
    throw loopErr;
  }

  const nextChain = [...chain, node];
  if (nextChain.length > MAX_TRIGGER_DEPTH) {
    const loopErr = new InfiniteLoopError(
      `[INFINITE LOOP DETECTED] Trigger recursion depth limit exceeded (${MAX_TRIGGER_DEPTH}). Unbounded cascade halted.`,
      {
        triggerChain: nextChain,
        depth: nextChain.length,
        cycle: nextChain.slice(-5),
      },
    );
    state.log.push({
      id: `log_${Date.now()}`,
      timestamp: Date.now(),
      key: 'engine.infinite_loop_detected',
      params: {
        message: loopErr.message,
        cycle: loopErr.formattedCycle,
      },
      onomatopoeia: 'INFINITE LOOP DETECTED!',
    });
    state.lastError = {
      type: 'INFINITE_LOOP',
      message: loopErr.message,
      formattedDetails: loopErr.formattedCycle,
    };
    throw loopErr;
  }

  return nextChain;
}

/**
 * Format ability steps into a concise summary: 'trigger -> step(s)'.
 * Example: 'VILLAIN_INITIATES_ATTACK -> DRAW_CARDS (1)'
 */
export function formatAbilityStepsSummary(trigger: string, steps: AbilityStep[]): string {
  const stepDescriptions = (steps || [])
    .map((s) => {
      if (s.effect === 'DRAW_CARDS' || s.effect === 'DRAW') {
        return `${displayEffectName(s.effect)} (${s.effectParams?.count ?? 1})`;
      }
      if (s.effect === 'DEAL_DAMAGE') return `DEAL_DAMAGE (${s.effectParams?.amount ?? 1})`;
      if (s.effect === 'REMOVE_THREAT') return `REMOVE_THREAT (${s.effectParams?.amount ?? 1})`;
      if (s.effect === 'HEAL_DAMAGE') return `HEAL_DAMAGE (${s.effectParams?.amount ?? 1})`;
      if (s.effect === 'ADD_STATUS') return `ADD_STATUS (${s.effectParams?.status})`;
      if (s.effect === 'PREVENT_DAMAGE')
        return `PREVENT_DAMAGE (${s.effectParams?.amount ?? 'ALL'})`;
      if (s.effect === 'PREVENT_THREAT')
        return `PREVENT_THREAT (${s.effectParams?.amount ?? 'ALL'})`;
      return displayEffectName(s.effect);
    })
    .join(', ');
  return `${displayTriggerName(trigger)} -> ${stepDescriptions}`;
}

interface HandReactionResolution {
  player: PlayerState;
  card: CardInstance;
  ability: CardAbility;
  chain: TriggerCallNode[];
}

interface HandReactionSpec {
  /** Live gate evaluated before each player and card is scanned (e.g. threat still above zero). */
  isActive?: () => boolean;
  /** Offer every eligible hand card of each player (copies included), not only the first (#266). */
  allEligibleCards?: boolean;
  /** Trigger-specific resolution, run after the cost is paid and the card has left the hand. */
  resolve: (reaction: HandReactionResolution) => void;
  promptTitleSuffix?: string;
  promptDescriptionSuffix?: string;
  /** Extra decision-prompt fields (trigger source display, combat details). */
  promptFields?: (player: PlayerState, ability: CardAbility, card: CardInstance) => object;
  /** Context stored on the prompt option and replayed when the player accepts. */
  promptContext?: () => Partial<TriggerContext>;
  /** Further triggers a hand ability may declare and still match this scan (one scan per event). */
  alsoTriggers?: TriggerType[];
}

/**
 * True while the game is being set up (Appendix II steps 1 to 16): player-controlled abilities
 * (hand cards, identity, tableau and allies) cannot be used or triggered; encounter-side
 * abilities still resolve.
 */
function arePlayerAbilitiesSuspended(state: GameState): boolean {
  return state.setupState?.stage === 'SCENARIO_SETUP';
}

/** Players in player order starting from the first player (RR v1.8 First Player). */
/**
 * Players who may react to a card revealed for `revealing`: the revealing player first, then the
 * others in seat order. The active player never changes (their cards stay theirs to resolve).
 */
function revealReactors(state: GameState, revealing: PlayerState): PlayerState[] {
  return [revealing, ...playersInTurnOrder(state).filter((p) => p.id !== revealing.id)];
}

function playersInTurnOrder(state: GameState): PlayerState[] {
  const first = Math.max(0, Math.min(state.firstPlayerIndex ?? 0, state.players.length - 1));
  return [...state.players.slice(first), ...state.players.slice(0, first)];
}

/**
 * Shared in-hand reaction scan: for each scanned player, picks the first hand card holding an
 * ability on this trigger (zone HAND) that the form, cost and triggerFilter allow, then either
 * resolves it at once (FORCED_ timing or acceptOptionalTriggers) or queues the optional prompt.
 * At most one reaction per player per scan, unless the spec offers every eligible card. Returns
 * true when a prompt was queued.
 */
function scanHandReactions(
  state: GameState,
  trigger: TriggerType,
  context: TriggerContext,
  chain: TriggerCallNode[],
  players: PlayerState[],
  spec: HandReactionSpec,
): boolean {
  let hasPendingPrompt = false;

  // No player ability can be used before the game begins (Appendix II, setup).
  if (arePlayerAbilitiesSuspended(state)) return false;

  for (const p of players) {
    if (spec.isActive && !spec.isActive()) break;

    for (const card of [...p.hand]) {
      if (spec.isActive && !spec.isActive()) break;
      if (!p.hand.includes(card)) continue;
      const ability = (card.card.enrichment?.abilities || []).find((a) => {
        const triggerMatches =
          triggersAreEquivalent(a.trigger, trigger) ||
          (spec.alsoTriggers ?? []).some((t) => triggersAreEquivalent(a.trigger, t));
        if (!triggerMatches || a.zone !== 'HAND') return false;
        if (revealCannotBeCanceledBy(state, a, context)) return false;
        if (a.timing.startsWith('HERO_') && p.currentForm !== 'hero') return false;
        if (a.timing.startsWith('ALTER_EGO_') && p.currentForm !== 'alter_ego') return false;
        if (!canPayAbilityCost(state, p, a, card).allowed) return false;
        if (!abilityHasValidTarget(state, p, a, card)) return false;
        return matchesTriggerFilter(a.triggerFilter, context, p, card, trigger);
      });
      if (!ability) continue;

      const isForced = isForcedTiming(ability.timing);

      if (isForced || context.acceptOptionalTriggers === true) {
        const node: TriggerCallNode = {
          trigger,
          abilityId: ability.id,
          sourceInstanceId: card.instanceId,
          cardCode: card.card.code,
          cardName: card.card.name,
        };
        const nextChain = checkAndRecordTriggerNode(state, node, chain);

        if (ability.cost || (card.card.type === 'event' && (card.card.cost ?? 0) > 0)) {
          executeAbilityCost(state, p, ability, card);
        }
        const handIdx = p.hand.findIndex((c) => c.instanceId === card.instanceId);
        if (handIdx !== -1) {
          p.hand.splice(handIdx, 1);
          if (ability.cost?.discardSelf !== false) {
            p.discard.push(card);
          }
        }
        spec.resolve({ player: p, card, ability, chain: nextChain });
        if (spec.allEligibleCards) continue;
        break;
      }

      const cardName = card.card.name;
      const resCost = extractResourceCost(ability.cost);
      const reqAmount = resCost.hasCost
        ? resCost.requiredAmount
        : card.card.type === 'event'
          ? (card.card.cost ?? 0)
          : 0;
      const hasCost = reqAmount > 0;
      const costSuffix = hasCost
        ? ` (Cost: ${reqAmount} resource${reqAmount === 1 ? '' : 's'})`
        : '';

      enqueueDecisionPrompt(state, {
        promptId: `prompt_trigger_${ability.id}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        playerId: p.id,
        title: `Do you want to use the following ability from ${cardName}${costSuffix}?${spec.promptTitleSuffix ?? ''}`,
        description: `${formatAbilityStepsSummary(trigger, ability.steps || [])}${spec.promptDescriptionSuffix ?? ''}`,
        sourceCardName: cardName,
        sourceCardCode: card.card.code,
        triggerType: ability.timing,
        isVoluntary: true,
        ...(spec.promptFields?.(p, ability, card) ?? {}),
        options: [
          {
            id: `trigger_${ability.id}`,
            label: hasCost ? `Yes${costSuffix}` : 'Yes',
            effect: 'EXECUTE_OPTIONAL_TRIGGER',
            params: {
              ability,
              context: { ...context, ...(spec.promptContext?.() ?? {}) },
              sourceCardInstanceId: card.instanceId,
              requiresPayment: hasCost,
              costCardInstanceId: card.instanceId,
              resourceCost: hasCost
                ? { amount: reqAmount, resourceType: resCost.requiredType }
                : undefined,
            },
          },
          {
            id: 'pass',
            label: 'No',
            effect: 'PASS',
          },
        ],
      });
      hasPendingPrompt = true;
      if (!spec.allEligibleCards) break;
    }
  }

  return hasPendingPrompt;
}

/**
 * Generic Trigger Dispatcher: Resolves all matching declarative abilities for a given trigger event.
 * Eliminates all hardcoded card codes from engine pipelines!
 * Prompts player for optional interrupts and responses per RR v1.8 while auto-executing FORCED_ triggers.
 */
export function dispatchTrigger(
  state: GameState,
  trigger: TriggerType,
  context: TriggerContext,
  triggerChainOverride?: TriggerCallNode[],
): TriggerDispatchResult {
  const currentChain = triggerChainOverride || context.triggerChain || [];

  // Immediate depth ceiling check (ADR-0053, Issue #48)
  if (currentChain.length >= MAX_TRIGGER_DEPTH) {
    const loopErr = new InfiniteLoopError(
      `[INFINITE LOOP DETECTED] Trigger recursion depth limit exceeded (${MAX_TRIGGER_DEPTH}). Unbounded cascade halted.`,
      {
        triggerChain: currentChain,
        depth: currentChain.length,
        cycle: currentChain.slice(-5),
      },
    );
    state.log.push({
      id: `log_${Date.now()}`,
      timestamp: Date.now(),
      key: 'engine.infinite_loop_detected',
      params: {
        message: loopErr.message,
        cycle: loopErr.formattedCycle,
      },
      onomatopoeia: 'INFINITE LOOP DETECTED!',
    });
    state.lastError = {
      type: 'INFINITE_LOOP',
      message: loopErr.message,
      formattedDetails: loopErr.formattedCycle,
    };
    throw loopErr;
  }

  const player =
    state.players.find((p) => p.id === context.targetPlayerId) ||
    state.players[state.firstPlayerIndex] ||
    state.players[0];
  if (!player) return { state };

  let currentDamage = context.damageAmount ?? 0;
  let isPrevented = context.preventedDamage ?? false;
  let currentThreat = context.threatAmount ?? 0;
  let isCancelled = false;
  let hasPendingPrompt = false;

  // 1. Scan in-play identity card abilities (e.g. Spider-Sense on Spider-Man 01001a)
  const playerAbilitiesSuspended = arePlayerAbilitiesSuspended(state);
  const identityAbilities =
    player && !playerAbilitiesSuspended ? player.activeFormCard?.enrichment?.abilities || [] : [];
  for (const ability of identityAbilities) {
    if (triggersAreEquivalent(ability.trigger, trigger)) {
      if (revealCannotBeCanceledBy(state, ability, context)) continue;
      if (
        (ability.timing === 'HERO_INTERRUPT' || ability.timing === 'HERO_RESPONSE') &&
        player.currentForm !== 'hero'
      ) {
        continue;
      }
      if (
        (ability.timing === 'ALTER_EGO_INTERRUPT' || ability.timing === 'ALTER_EGO_RESPONSE') &&
        player.currentForm !== 'alter_ego'
      ) {
        continue;
      }
      if (
        !matchesTriggerFilter(
          ability.triggerFilter,
          context,
          player,
          { instanceId: player.id, card: player.activeFormCard } as CardInstance,
          trigger,
        )
      ) {
        continue;
      }
      if (ability.limit === 'ONCE_PER_ROUND' && player.usedAbilitiesThisRound?.[ability.id]) {
        continue;
      }
      if (ability.limit === 'ONCE_PER_PHASE' && player.usedAbilitiesThisPhase?.[ability.id]) {
        continue;
      }

      const isForced = isForcedTiming(ability.timing);
      if (isForced || context.acceptOptionalTriggers === true) {
        const node: TriggerCallNode = {
          trigger,
          abilityId: ability.id,
          sourceInstanceId: player.id,
          cardCode: player.activeFormCard.code,
          cardName: player.activeFormCard.name,
        };
        const nextChain = checkAndRecordTriggerNode(state, node, currentChain);

        if (ability.cost) {
          executeAbilityCost(state, player, ability);
        }
        if (ability.limit === 'ONCE_PER_ROUND') {
          if (!player.usedAbilitiesThisRound) player.usedAbilitiesThisRound = {};
          player.usedAbilitiesThisRound[ability.id] =
            (player.usedAbilitiesThisRound[ability.id] || 0) + 1;
        } else if (ability.limit === 'ONCE_PER_PHASE') {
          if (!player.usedAbilitiesThisPhase) player.usedAbilitiesThisPhase = {};
          player.usedAbilitiesThisPhase[ability.id] =
            (player.usedAbilitiesThisPhase[ability.id] || 0) + 1;
        }
        const effCtx: EffectExecutionContext = {
          playerId: player.id,
          eventTargetType: context.targetType,
          eventTargetInstanceId: context.targetInstanceId,
          threatAmount: currentThreat,
          damageAmount: currentDamage,
          interceptedValue: currentThreat || currentDamage,
          triggerChain: nextChain,
        };
        executeEffect(state, ability, effCtx);
        if (trigger === 'THREAT_WOULD_BE_PLACED' && effCtx.threatAmount !== undefined) {
          currentThreat = effCtx.threatAmount;
        }
        if (trigger === 'DAMAGE_WOULD_BE_TAKEN' && effCtx.damageAmount !== undefined) {
          currentDamage = effCtx.damageAmount;
          if (currentDamage === 0) isPrevented = true;
        }
        state.log.push({
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          key: `ability.${ability.id}.triggered`,
          params: { player: player.name },
          onomatopoeia: 'ABILITY TRIGGERED!',
        });
      } else {
        // Optional Identity Ability: Check cost & limits before prompting
        const costCheck = canPayAbilityCost(state, player, ability);
        if (!costCheck.allowed) continue;
        // RR v1.8 "Target": an ability that requires a target needs at least one valid target.
        if (!abilityHasValidTarget(state, player, ability)) continue;

        if (ability.limit === 'ONCE_PER_ROUND' && player.usedAbilitiesThisRound?.[ability.id]) {
          continue;
        }
        if (ability.limit === 'ONCE_PER_PHASE' && player.usedAbilitiesThisPhase?.[ability.id]) {
          continue;
        }

        const cardName = player.activeFormCard.name;
        const isDamageTrigger = triggersAreEquivalent(trigger, 'DAMAGE_WOULD_BE_TAKEN');
        const damageSuffix =
          isDamageTrigger && currentDamage > 0 ? ` (Incoming Damage: ${currentDamage})` : '';
        const damageDescSuffix =
          isDamageTrigger && currentDamage > 0 ? ` [Incoming Damage: ${currentDamage}]` : '';
        enqueueDecisionPrompt(state, {
          promptId: `prompt_trigger_${ability.id}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          playerId: player.id,
          title: `Do you want to use the following ability from ${cardName}?${damageSuffix}`,
          description: `${formatAbilityStepsSummary(trigger, ability.steps || [])}${damageDescSuffix}`,
          incomingDamage: isDamageTrigger ? currentDamage : undefined,
          sourceCardName: cardName,
          sourceCardCode: player.activeFormCard.code,
          triggerSourceName:
            context.encounterCardInstance?.card?.name ||
            (context.targetType === 'villain'
              ? targetedVillain(state, context).card.name
              : undefined),
          triggerSourceCode:
            context.encounterCardInstance?.card?.code ||
            (context.targetType === 'villain'
              ? targetedVillain(state, context).card.code
              : undefined),
          triggerSourceCard:
            context.encounterCardInstance?.card ||
            (context.targetType === 'villain' ? targetedVillain(state, context).card : undefined),
          triggerType: ability.timing,
          isVoluntary: true,
          options: [
            {
              id: `trigger_${ability.id}`,
              label: 'Yes',
              effect: 'EXECUTE_OPTIONAL_TRIGGER',
              params: {
                ability,
                context: {
                  ...context,
                  threatAmount: currentThreat,
                  damageAmount: currentDamage,
                  interceptedValue: currentThreat || currentDamage,
                },
              },
            },
            {
              id: 'pass',
              label: 'No',
              effect: 'PASS',
            },
          ],
        });
        hasPendingPrompt = true;
      }
    }
  }

  // 2. Scan tableau, allies & in-play cards
  // A card revealed for one player can be interrupted by the cards in play of every player
  // ("When a card is revealed from the encounter deck", Black Widow 01075).
  const playersToScanForInPlay: PlayerState[] =
    trigger === 'MINION_ENTERS_PLAY' ||
    trigger === 'ENCOUNTER_CARD_REVEALED' ||
    trigger === 'TREACHERY_REVEALED'
      ? [player, ...state.players.filter((p) => p.id !== player.id)]
      : [player];

  for (const controller of playersToScanForInPlay) {
    if (hasPendingPrompt) break;
    const inPlayCards: CardInstance[] = [
      ...(playerAbilitiesSuspended ? [] : controller.tableau || []),
      ...(playerAbilitiesSuspended ? [] : controller.allies || []),
      ...(controller.attachments || []),
      ...(controller.obligations || []),
      ...(playerAbilitiesSuspended
        ? []
        : (controller.allies || []).flatMap((a) => a.attachments || [])),
      ...(controller.engagedMinions || []).flatMap((m) => m.attachments || []),
    ];
    for (const cardInst of inPlayCards) {
      const abilities = cardInst.card.enrichment?.abilities || [];
      for (const ability of abilities) {
        if (triggersAreEquivalent(ability.trigger, trigger)) {
          if (revealCannotBeCanceledBy(state, ability, context)) continue;
          if (
            (ability.timing === 'HERO_INTERRUPT' || ability.timing === 'HERO_RESPONSE') &&
            controller.currentForm !== 'hero'
          ) {
            continue;
          }
          if (
            (ability.timing === 'ALTER_EGO_INTERRUPT' || ability.timing === 'ALTER_EGO_RESPONSE') &&
            controller.currentForm !== 'alter_ego'
          ) {
            continue;
          }
          if (
            !matchesTriggerFilter(ability.triggerFilter, context, controller, cardInst, trigger)
          ) {
            continue;
          }
          // Universal guard for self-referential in-play play/entry triggers (ADR-0050):
          // Abilities on in-play cards (allies, upgrades, supports, attachments) triggered by
          // ENTERS_PLAY or CARD_PLAYED must only fire if this specific card was the event source (RR v1.8 pp. 11, 21).
          if (trigger === 'ENTERS_PLAY' || trigger === 'CARD_PLAYED') {
            if (context.sourceInstanceId && context.sourceInstanceId !== cardInst.instanceId) {
              continue;
            }
            if (!context.sourceInstanceId) {
              continue;
            }
          }

          // Ally action-resolution guard:
          // An ally's ability triggered by THWART_RESOLVED or ATTACK_RESOLVED must only fire
          // if this specific ally was the character that attacked or thwarted.
          // Upgrades in the tableau (e.g. Superhuman Strength 01028) trigger on the hero's attack/thwart.
          if (
            cardInst.card.type === 'ally' &&
            (trigger === 'THWART_RESOLVED' || trigger === 'ATTACK_RESOLVED')
          ) {
            if (context.sourceInstanceId && context.sourceInstanceId !== cardInst.instanceId) {
              continue;
            }
            if (!context.sourceInstanceId) {
              continue;
            }
          }

          const isForced = isForcedTiming(ability.timing);
          if (isForced || context.acceptOptionalTriggers === true) {
            const node: TriggerCallNode = {
              trigger,
              abilityId: ability.id,
              sourceInstanceId: cardInst.instanceId,
              cardCode: cardInst.card.code,
              cardName: cardInst.card.name,
            };
            const nextChain = checkAndRecordTriggerNode(state, node, currentChain);

            // RR v1.8 Forced: a forced ability that requires a target and has no valid one does
            // not initiate, and no cost is paid.
            if (
              !abilityHasValidTarget(state, controller, ability, cardInst, {
                targetType: context.targetType,
                targetInstanceId: context.targetInstanceId,
              })
            ) {
              continue;
            }
            if (ability.cost) {
              const costCheck = canPayAbilityCost(state, controller, ability, cardInst);
              if (!costCheck.allowed) continue;
              executeAbilityCost(state, controller, ability, cardInst);
            }
            const effCtx: EffectExecutionContext = {
              playerId: controller.id,
              sourceCardInstance: cardInst,
              eventTargetType: context.targetType,
              eventTargetInstanceId: context.targetInstanceId,
              resourcesSpent: context.resourcesSpent,
              threatAmount: currentThreat,
              damageAmount: currentDamage,
              interceptedValue: currentThreat || currentDamage,
              triggerChain: nextChain,
            };
            executeEffect(state, ability, effCtx);
            if (trigger === 'THREAT_WOULD_BE_PLACED' && effCtx.threatAmount !== undefined) {
              currentThreat = effCtx.threatAmount;
            }
            if (trigger === 'DAMAGE_WOULD_BE_TAKEN' && effCtx.damageAmount !== undefined) {
              currentDamage = effCtx.damageAmount;
              if (currentDamage === 0) isPrevented = true;
            }
          } else {
            // Optional In-Play Ability: Check cost & limits before prompting
            if (triggersAreEquivalent(trigger, 'DAMAGE_WOULD_BE_TAKEN') && currentDamage <= 0) {
              continue;
            }
            const costCheck = canPayAbilityCost(state, controller, ability, cardInst);
            if (!costCheck.allowed) continue;
            // RR v1.8 "Target": an ability that requires a target needs at least one valid target.
            if (
              !abilityHasValidTarget(state, controller, ability, cardInst, {
                targetType: context.targetType,
                targetInstanceId: context.targetInstanceId,
              })
            ) {
              continue;
            }

            if (
              ability.limit === 'ONCE_PER_ROUND' &&
              controller.usedAbilitiesThisRound?.[ability.id]
            ) {
              continue;
            }
            if (
              ability.limit === 'ONCE_PER_PHASE' &&
              controller.usedAbilitiesThisPhase?.[ability.id]
            ) {
              continue;
            }

            const preventStep = ability.steps?.find((s: any) => s.effect === 'PREVENT_DAMAGE');
            const preventParams = preventStep?.effectParams as any;
            const preventAmount: number | 'ALL' | undefined =
              preventParams?.amount ??
              (preventParams?.preventAll ||
              ability.steps?.some((s: any) => s.effect === 'CANCEL_ATTACK')
                ? 'ALL'
                : undefined);

            const cardName = cardInst.card.name;
            const isDamageTrigger = triggersAreEquivalent(trigger, 'DAMAGE_WOULD_BE_TAKEN');
            const damageSuffix =
              isDamageTrigger && currentDamage > 0 ? ` (Incoming Damage: ${currentDamage})` : '';
            const damageDescSuffix =
              isDamageTrigger && currentDamage > 0 ? ` [Incoming Damage: ${currentDamage}]` : '';
            enqueueDecisionPrompt(state, {
              promptId: `prompt_trigger_${ability.id}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              playerId: controller.id,
              title: `Do you want to use the following ability from ${cardName}?${damageSuffix}`,
              description: `${formatAbilityStepsSummary(trigger, ability.steps || [])}${damageDescSuffix}`,
              incomingDamage: isDamageTrigger ? currentDamage : undefined,
              attackerCardCode: context.attackerCardCode as string | undefined,
              attackerName: context.attackerName as string | undefined,
              defenderCardCode: context.defenderCardCode as string | undefined,
              defenderName: context.defenderName as string | undefined,
              defenderType: context.defenderType as any,
              targetCardCode:
                (context.targetCardCode as string | undefined) || controller.activeFormCard?.code,
              targetName:
                (context.targetName as string | undefined) ||
                controller.activeFormCard?.name ||
                controller.name,
              targetCurrentHp: (context.targetCurrentHp as number | undefined) ?? controller.health,
              targetMaxHp: (context.targetMaxHp as number | undefined) ?? controller.maxHealth,
              preventAmount,
              sourceCardName: cardName,
              sourceCardCode: cardInst.card.code,
              triggerSourceName:
                context.encounterCardInstance?.card?.name ||
                (context.targetType === 'villain'
                  ? targetedVillain(state, context).card.name
                  : undefined),
              triggerSourceCode:
                context.encounterCardInstance?.card?.code ||
                (context.targetType === 'villain'
                  ? targetedVillain(state, context).card.code
                  : undefined),
              triggerSourceCard:
                context.encounterCardInstance?.card ||
                (context.targetType === 'villain'
                  ? targetedVillain(state, context).card
                  : undefined),
              triggerType: ability.timing,
              isVoluntary: true,
              options: [
                {
                  id: `trigger_${ability.id}`,
                  label: 'Yes',
                  effect: 'EXECUTE_OPTIONAL_TRIGGER',
                  params: {
                    ability,
                    context: {
                      ...context,
                      damageAmount: currentDamage,
                    },
                    sourceCardInstanceId: cardInst.instanceId,
                  },
                },
                {
                  id: 'pass',
                  label: 'No',
                  effect: 'PASS',
                },
              ],
            });
            hasPendingPrompt = true;
            break;
          }
        }
      }
      if (hasPendingPrompt) break;
    }
  }

  // 3. In-hand reactions to damage about to be taken (e.g. Backflip 01003). Only the targeted player.
  if (trigger === 'DAMAGE_WOULD_BE_TAKEN' && currentDamage > 0) {
    const isDamageTrigger = triggersAreEquivalent(trigger, 'DAMAGE_WOULD_BE_TAKEN');
    if (
      scanHandReactions(state, trigger, context, currentChain, [player], {
        resolve: ({ player: p, card, ability, chain }) => {
          if (ability.steps?.some((s) => s.effect === 'PREVENT_DAMAGE')) {
            const effCtx = {
              playerId: p.id,
              sourceCardInstance: card,
              damageAmount: currentDamage,
              interceptedValue: currentDamage,
              triggerChain: chain,
            };
            executeEffect(state, ability, effCtx);
            currentDamage = effCtx.damageAmount ?? 0;
            if (currentDamage === 0) {
              isPrevented = true;
            }
          } else {
            executeEffect(state, ability, {
              playerId: p.id,
              sourceCardInstance: card,
              triggerChain: chain,
            });
          }
        },
        promptTitleSuffix: isDamageTrigger ? ` (Incoming Damage: ${currentDamage})` : '',
        promptDescriptionSuffix: isDamageTrigger ? ` [Incoming Damage: ${currentDamage}]` : '',
        promptFields: (p, ability) => {
          const preventStep = ability.steps?.find((s: any) => s.effect === 'PREVENT_DAMAGE');
          const preventParams = preventStep?.effectParams as any;
          const preventAmount: number | 'ALL' | undefined =
            preventParams?.amount ??
            (preventParams?.preventAll ||
            ability.steps?.some((s: any) => s.effect === 'CANCEL_ATTACK')
              ? 'ALL'
              : undefined);
          const villainSource =
            context.targetType === 'villain' ? targetedVillain(state, context) : undefined;
          return {
            incomingDamage: isDamageTrigger ? currentDamage : undefined,
            attackerCardCode: context.attackerCardCode as string | undefined,
            attackerName: context.attackerName as string | undefined,
            defenderCardCode: context.defenderCardCode as string | undefined,
            defenderName: context.defenderName as string | undefined,
            defenderType: context.defenderType as any,
            targetCardCode:
              (context.targetCardCode as string | undefined) || p.activeFormCard?.code,
            targetName:
              (context.targetName as string | undefined) || p.activeFormCard?.name || p.name,
            targetCurrentHp: (context.targetCurrentHp as number | undefined) ?? p.health,
            targetMaxHp: (context.targetMaxHp as number | undefined) ?? p.maxHealth,
            preventAmount,
            triggerSourceName:
              context.encounterCardInstance?.card?.name || villainSource?.card.name,
            triggerSourceCode:
              context.encounterCardInstance?.card?.code || villainSource?.card.code,
            triggerSourceCard: context.encounterCardInstance?.card || villainSource?.card,
          };
        },
        promptContext: () => ({ damageAmount: currentDamage, interceptedValue: currentDamage }),
      })
    ) {
      hasPendingPrompt = true;
    }
  }

  // 4. In-hand reactions to threat about to be placed (e.g. Emergency 01085, Great Responsibility
  // 01061). Every player may react.
  if (trigger === 'THREAT_WOULD_BE_PLACED' && currentThreat > 0) {
    if (
      scanHandReactions(state, trigger, context, currentChain, playersInTurnOrder(state), {
        isActive: () => currentThreat > 0,
        allEligibleCards: true,
        resolve: ({ player: p, card, ability, chain }) => {
          const hasConsume = ability.steps?.some((s) => s.effect === 'PREVENT_THREAT');
          const threatStep =
            ability.steps?.find((s) => s.effect === 'REMOVE_THREAT') || ability.steps?.[0];
          if (hasConsume) {
            const effCtx = {
              playerId: p.id,
              threatAmount: currentThreat,
              interceptedValue: currentThreat,
              sourceCardInstance: card,
              triggerChain: chain,
            };
            executeEffect(state, ability, effCtx);
            currentThreat = effCtx.threatAmount ?? 0;
          } else if (threatStep?.effect === 'REMOVE_THREAT') {
            const reduction = Number(threatStep.effectParams?.amount ?? 1);
            currentThreat = Math.max(0, currentThreat - reduction);
            state.log.push({
              id: `log_${Date.now()}`,
              timestamp: Date.now(),
              key: `card.${card.card.code}.threatReduced`,
              params: { player: p.name, reduction },
              onomatopoeia: 'EMERGENCY!',
            });
          } else {
            executeEffect(state, ability, {
              playerId: p.id,
              sourceCardInstance: card,
              triggerChain: chain,
            });
          }
        },
        promptFields: () => ({
          triggerSourceName:
            context.encounterCardInstance?.card?.name || 'Main Scheme / Threat Placement',
          triggerSourceCode: context.encounterCardInstance?.card?.code,
          triggerSourceCard: context.encounterCardInstance?.card,
        }),
        promptContext: () => ({ threatAmount: currentThreat, interceptedValue: currentThreat }),
      })
    ) {
      hasPendingPrompt = true;
    }
  }

  // 5. In-hand reactions to an encounter card being revealed (e.g. Enhanced Spider-Sense 01004,
  // Get Behind Me! 01078). Their text has no "you", so any player may react, the revealing one first.
  if (trigger === 'ENCOUNTER_CARD_REVEALED' || trigger === 'TREACHERY_REVEALED') {
    if (
      scanHandReactions(state, trigger, context, currentChain, revealReactors(state, player), {
        resolve: ({ player: p, card, ability, chain }) => {
          executeEffect(state, ability, {
            playerId: p.id,
            sourceCardInstance: card,
            triggerChain: chain,
          });
          isCancelled = true;
        },
        promptFields: () => ({
          triggerSourceName:
            context.encounterCardInstance?.card?.name || 'Treachery / Encounter Card',
          triggerSourceCode: context.encounterCardInstance?.card?.code,
          triggerSourceCard: context.encounterCardInstance?.card,
        }),
      })
    ) {
      hasPendingPrompt = true;
    }
  }

  // 6. In-hand reactions after a hero or ally defends an attack (e.g. Counter-Punch 01077). Every
  // player may react; each card's own triggerFilter decides who qualifies.
  if (triggersAreEquivalent('ATTACK_DEFENDED', trigger)) {
    if (
      scanHandReactions(state, trigger, context, currentChain, state.players, {
        resolve: ({ player: p, card, ability, chain }) => {
          executeEffect(state, ability, {
            playerId: p.id,
            sourceCardInstance: card,
            eventTargetType: context.targetType,
            eventTargetInstanceId: context.targetInstanceId,
            triggerChain: chain,
          });
        },
      })
    ) {
      hasPendingPrompt = true;
    }
  }

  // 7. In-hand Responses after a character is defeated (e.g. Chase Them Down 01052). One scan per
  // defeat, on the DEFEATED dispatch only (dispatchDefeat also fires CHARACTER_DEFEATED); hand
  // abilities on either trigger match, every eligible card is offered, first player first. A
  // Response happens after the event, so there is no window to close.
  if (trigger === 'DEFEATED' && context.entityType === 'CHARACTER') {
    if (
      scanHandReactions(state, trigger, context, currentChain, playersInTurnOrder(state), {
        allEligibleCards: true,
        alsoTriggers: ['CHARACTER_DEFEATED'],
        resolve: ({ player: p, card, ability, chain }) => {
          executeEffect(state, ability, {
            playerId: p.id,
            sourceCardInstance: card,
            eventTargetType: context.targetType,
            eventTargetInstanceId: context.targetInstanceId,
            triggerChain: chain,
          });
        },
      })
    ) {
      hasPendingPrompt = true;
    }
  }

  return {
    state,
    damageAmount: currentDamage,
    preventedDamage: isPrevented,
    threatAmount: currentThreat,
    cancelled: isCancelled,
    hasPendingPrompt,
  };
}
