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
import {
  executeAbilityCost,
  canPayAbilityCost,
  extractResourceCost,
} from '../pipeline/cost-engine';
import { enqueueDecisionPrompt } from '../pipeline/prompt-queue';
import { InfiniteLoopError, TriggerCallNode } from '../errors/infinite-loop-error';

export const MAX_TRIGGER_DEPTH = 15;

const TRIGGER_EQUIVALENTS: Record<string, string[]> = {
  ENEMY_INITIATES_ATTACK: ['VILLAIN_INITIATES_ATTACK'],
  DAMAGE_WOULD_BE_TAKEN: ['TAKE_ATTACK_DAMAGE', 'TAKE_DAMAGE'],
  ATTACK_DEFENDED: ['HERO_DEFENDED_ATTACK'],
  CHARACTER_DEFEATED: ['MINION_DEFEATED', 'MINION_DEFEATED_BY_ATTACK', 'HOST_DEFEATED'],
  DEFEATED: ['ENEMY_DEFEATED_BY_HERO_ATTACK'],
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
    if (!actualType || actualType !== filter.targetType) {
      return false;
    }
  }

  if (filter.defenderType) {
    if (context.defenderType !== filter.defenderType) {
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
  targetCardCode?: string;
  targetName?: string;
  targetCurrentHp?: number;
  targetMaxHp?: number;
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
  /** Live gate evaluated before each player is scanned (e.g. threat still above zero). */
  isActive?: () => boolean;
  /** Trigger-specific resolution, run after the cost is paid and the card has left the hand. */
  resolve: (reaction: HandReactionResolution) => void;
  promptTitleSuffix?: string;
  promptDescriptionSuffix?: string;
  /** Extra decision-prompt fields (trigger source display, combat details). */
  promptFields?: (player: PlayerState, ability: CardAbility, card: CardInstance) => object;
  /** Context stored on the prompt option and replayed when the player accepts. */
  promptContext?: () => Partial<TriggerContext>;
}

/**
 * Shared in-hand reaction scan: for each scanned player, picks the first hand card holding an
 * ability on this trigger (zone HAND) that the form, cost and triggerFilter allow, then either
 * resolves it at once (FORCED_ timing or acceptOptionalTriggers) or queues the optional prompt.
 * At most one reaction per player per scan. Returns true when a prompt was queued.
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

  for (const p of players) {
    if (spec.isActive && !spec.isActive()) break;

    let reaction: { card: CardInstance; ability: CardAbility } | undefined;
    for (const c of p.hand) {
      const ability = (c.card.enrichment?.abilities || []).find((a) => {
        if (!triggersAreEquivalent(a.trigger, trigger) || a.zone !== 'HAND') return false;
        if (a.timing.startsWith('HERO_') && p.currentForm !== 'hero') return false;
        if (a.timing.startsWith('ALTER_EGO_') && p.currentForm !== 'alter_ego') return false;
        if (!canPayAbilityCost(state, p, a, c).allowed) return false;
        return matchesTriggerFilter(a.triggerFilter, context, p, c, trigger);
      });
      if (ability) {
        reaction = { card: c, ability };
        break;
      }
    }
    if (!reaction) continue;

    const { card, ability } = reaction;
    const isForced = ability.timing.startsWith('FORCED_');

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
      continue;
    }

    const cardName = card.card.name;
    const resCost = extractResourceCost(ability.cost);
    const reqAmount = resCost.hasCost
      ? resCost.requiredAmount
      : card.card.type === 'event'
        ? (card.card.cost ?? 0)
        : 0;
    const hasCost = reqAmount > 0;
    const costSuffix = hasCost ? ` (Cost: ${reqAmount} resource${reqAmount === 1 ? '' : 's'})` : '';

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
  const identityAbilities = player ? player.activeFormCard?.enrichment?.abilities || [] : [];
  for (const ability of identityAbilities) {
    if (triggersAreEquivalent(ability.trigger, trigger)) {
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

      const isForced = ability.timing.startsWith('FORCED_');
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
        const effCtx = {
          playerId: player.id,
          targetType: context.targetType as any,
          targetInstanceId: context.targetInstanceId,
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
  const playersToScanForInPlay: PlayerState[] =
    trigger === 'MINION_ENTERS_PLAY'
      ? [player, ...state.players.filter((p) => p.id !== player.id)]
      : [player];

  for (const controller of playersToScanForInPlay) {
    if (hasPendingPrompt) break;
    const inPlayCards: CardInstance[] = [
      ...(controller.tableau || []),
      ...(controller.allies || []),
      ...(controller.attachments || []),
      ...(controller.obligations || []),
      ...(controller.allies || []).flatMap((a) => a.attachments || []),
      ...(controller.engagedMinions || []).flatMap((m) => m.attachments || []),
    ];
    for (const cardInst of inPlayCards) {
      const abilities = cardInst.card.enrichment?.abilities || [];
      for (const ability of abilities) {
        if (triggersAreEquivalent(ability.trigger, trigger)) {
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

          const isForced = ability.timing.startsWith('FORCED_');
          if (isForced || context.acceptOptionalTriggers === true) {
            const node: TriggerCallNode = {
              trigger,
              abilityId: ability.id,
              sourceInstanceId: cardInst.instanceId,
              cardCode: cardInst.card.code,
              cardName: cardInst.card.name,
            };
            const nextChain = checkAndRecordTriggerNode(state, node, currentChain);

            if (ability.cost) {
              const costCheck = canPayAbilityCost(state, controller, ability, cardInst);
              if (!costCheck.allowed) continue;
              executeAbilityCost(state, controller, ability, cardInst);
            }
            const effCtx = {
              playerId: controller.id,
              sourceCardInstance: cardInst,
              targetType: context.targetType as any,
              targetInstanceId: context.targetInstanceId,
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
      scanHandReactions(state, trigger, context, currentChain, state.players, {
        isActive: () => currentThreat > 0,
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
  // Get Behind Me! 01078). Only the targeted player.
  if (trigger === 'WHEN_REVEALED' || trigger === 'TREACHERY_REVEALED') {
    if (
      scanHandReactions(state, trigger, context, currentChain, [player], {
        resolve: ({ player: p, card, ability, chain }) => {
          executeEffect(state, ability, {
            playerId: p.id,
            sourceCardInstance: card,
            triggerChain: chain,
          });
          isCancelled = true;
          if (state.activeEncounterContext) {
            state.activeEncounterContext.cancelled = true;
          }
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
            targetType: context.targetType as EffectExecutionContext['targetType'],
            targetInstanceId: context.targetInstanceId,
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
