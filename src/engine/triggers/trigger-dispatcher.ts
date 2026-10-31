import { bindKernel, kernel } from '../kernel';
import {
  GameState,
  PendingDecisionPrompt,
  TriggerType,
  AbilityStep,
  PlayerState,
  CardInstance,
  CardAbility,
  VillainState,
  getActiveVillain,
  getVillainById,
  getVillainsInPlay,
} from '@engine/models';
import type { TriggerFilter } from '../../data/supplemental/schema';
import { getStepEffectParams } from '../../data/supplemental/runtime';
import { matchesCardFilter } from '../filters/card-filter';
import { type EffectExecutionContext } from '../effects';
import {
  executeAbilityCost,
  canPayAbilityCost,
  extractResourceCost,
} from '../pipeline/cost-engine';
import {
  abilityCancelsEncounterReveal,
  canCancelEncounterReveal,
} from '../pipeline/encounter-cancel';
import { InfiniteLoopError, TriggerCallNode } from '../errors/infinite-loop-error';
import { nextEngineId } from '../state/rng';
import { appendLog } from '../state/game-log';

export const MAX_TRIGGER_DEPTH = 15;

function isDefeatTrigger(trigger: TriggerType): boolean {
  return trigger === 'DEFEATED' || trigger === 'CHARACTER_DEFEATED';
}

/** A Forced Interrupt / Forced Response resolves at once; every other timing is the player's choice. */
function isForcedTiming(timing: string): boolean {
  return timing === 'FORCED_INTERRUPT' || timing === 'FORCED_RESPONSE';
}

export function triggersAreEquivalent(
  left: string | undefined,
  right: string | undefined,
): boolean {
  return Boolean(left && right && left === right);
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

/**
 * Without its own scope, a damage or defeat ability reacts only to its controller's events ("your
 * ally" is never another player's ally, #363). `targetPlayerScope: ANY` opts out. A defeat ability
 * that already names who defeated (`defeatedByAttackOf`) or which card (`targetScope`) keeps that.
 */
function failsImplicitControllerScope(
  filter: TriggerFilter | undefined,
  context: TriggerContext,
  player: PlayerState | undefined,
  trigger: TriggerType | string | undefined,
): boolean {
  if (filter?.targetPlayerScope || !player || !context.targetPlayerId) return false;
  if (context.targetPlayerScope === 'ANY') return false;
  const implicitlyScoped =
    triggersAreEquivalent(trigger, 'DAMAGE_WOULD_BE_TAKEN') ||
    ((trigger === 'DEFEATED' || trigger === 'CHARACTER_DEFEATED') &&
      !filter?.defeatedByAttackOf &&
      !filter?.targetScope);
  return implicitlyScoped && context.targetPlayerId !== player.id;
}

export function matchesTriggerFilter(
  filter: TriggerFilter | undefined,
  context: TriggerContext,
  player?: PlayerState,
  cardInst?: CardInstance,
  trigger?: TriggerType | string,
): boolean {
  const hostId = cardInst?.hostInstanceId;
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

  if (failsImplicitControllerScope(filter, context, player, trigger)) return false;

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
    if (filter.attackerKind === 'ANY_ENEMY') {
      if (actual !== 'VILLAIN' && actual !== 'MINION' && actual !== 'ANY_ENEMY') {
        return false;
      }
    } else if (actual === 'ANY_ENEMY') {
      return true;
    } else if (actual !== filter.attackerKind) {
      return false;
    }
  }

  if (filter.attackerCardFilter) {
    if (!context.attackerCard?.card) return false;
    if (!matchesCardFilter(context.attackerCard, filter.attackerCardFilter, { player })) {
      return false;
    }
  }

  if (filter.cardFilter) {
    const subject = context.encounterCardInstance?.card
      ? context.encounterCardInstance
      : context.attackerCard;
    if (!subject?.card) return false;
    if (!matchesCardFilter(subject, filter.cardFilter, { player })) {
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
    if (!player) return false;
    if (context.targetPlayerScope === 'ANY') {
      // Trigger event targets any/all players
    } else {
      if (!context.targetPlayerId) return false;
      const actualScope = context.targetPlayerId === player.id ? 'SELF' : 'OTHER';
      if (filter.targetPlayerScope === 'ANY') {
        // no-op, allowed by explicit contract
      } else if (actualScope !== filter.targetPlayerScope) {
        return false;
      }
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

  if (filter.isSecondaryAttack !== undefined) {
    const actual = context.isSecondaryAttack ?? false;
    if (actual !== filter.isSecondaryAttack) {
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
  attackerCard?: CardInstance;
  status?: string;
  acceptOptionalTriggers?: boolean;
  encounterCardInstance?: CardInstance;
  resourcesSpent?: string[];
  attackerCardCode?: string;
  attackerName?: string;
  defenderCardCode?: string;
  defenderName?: string;
  defenderType?: 'HERO' | 'ALLY' | 'UNDEFENDED';
  isSecondaryAttack?: boolean;
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
    appendLog(state, {
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
    appendLog(state, {
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
      if (s.effect === 'DRAW') {
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
        if (!kernel.checkAbilityTargets(state, p, a, card).allowed) return false;
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
          if (card.card.type === 'event' || ability.cost?.discardSelf !== false) {
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

      kernel.enqueueDecisionPrompt(state, {
        promptId: nextEngineId(state, `prompt_trigger_${ability.id}`),
        playerId: p.id,
        title: `Do you want to use the following ability from ${cardName}${costSuffix}?${spec.promptTitleSuffix ?? ''}`,
        description: `${formatAbilityStepsSummary(trigger, ability.steps || [])}${spec.promptDescriptionSuffix ?? ''}`,
        sourceCardName: cardName,
        sourceCardCode: card.card.code,
        sourceCardInstanceId: card.instanceId,
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
 * A Forced ability that matched the trigger. `run` resolves it now; `prompt` describes it as a
 * queued prompt, built only when two or more Forced abilities need the first player's order.
 */
interface ForcedCandidate {
  controller: PlayerState;
  run: () => void;
  prompt: () => PendingDecisionPrompt;
}

/** Forced abilities initiate before any optional one (RR v1.8 "Forced"): two passes per trigger. */
type TriggerPass = 'FORCED' | 'OPTIONAL';

interface TriggerScanState {
  currentDamage: number;
  isPrevented: boolean;
  currentThreat: number;
  isCancelled: boolean;
  hasPendingPrompt: boolean;
  pass: TriggerPass;
  forcedCandidates: ForcedCandidate[];
  /** The first player's ordering of the simultaneous Forced abilities, ahead of every optional prompt. */
  forcedOrdering?: PendingDecisionPrompt;
}

/**
 * A Forced ability as a prompt the engine answers itself, once the first player has ordered the
 * simultaneous Forced abilities. It carries what `EXECUTE_OPTIONAL_TRIGGER` needs to resolve it
 * (live placement amounts, cost, limits), so one executor serves both.
 */
function forcedAbilityPrompt(
  state: GameState,
  scanState: TriggerScanState,
  trigger: TriggerType,
  context: TriggerContext,
  controller: PlayerState,
  ability: CardAbility,
  source: { name: string; code: string; instanceId?: string },
): PendingDecisionPrompt {
  return {
    promptId: nextEngineId(state, `prompt_trigger_${ability.id}`),
    playerId: controller.id,
    title: source.name,
    description: formatAbilityStepsSummary(trigger, ability.steps || []),
    sourceCardName: source.name,
    sourceCardCode: source.code,
    sourceCardInstanceId: source.instanceId,
    triggerType: ability.timing,
    isVoluntary: false,
    forced: true,
    options: [
      {
        id: `trigger_${ability.id}`,
        label: source.name,
        effect: 'EXECUTE_OPTIONAL_TRIGGER',
        params: {
          ability,
          context: {
            ...context,
            threatAmount: scanState.currentThreat,
            damageAmount: scanState.currentDamage,
            interceptedValue: scanState.currentThreat || scanState.currentDamage,
          },
          sourceCardInstanceId: source.instanceId,
        },
      },
    ],
  };
}

function getAbilityPreventAmount(ability: CardAbility): number | 'ALL' | undefined {
  const preventStep = ability.steps?.find(
    (s): s is AbilityStep & { effect: 'PREVENT_DAMAGE' } => s.effect === 'PREVENT_DAMAGE',
  );
  const preventParams = preventStep
    ? getStepEffectParams<'PREVENT_DAMAGE'>(preventStep)
    : undefined;
  return typeof preventParams?.amount === 'number'
    ? preventParams.amount
    : preventParams?.amount === 'ALL' ||
        (preventParams as { preventAll?: boolean } | undefined)?.preventAll ||
        ability.steps?.some((s) => s.effect === 'CANCEL_ATTACK')
      ? 'ALL'
      : undefined;
}

function getTriggerSourceFields(state: GameState, context: TriggerContext) {
  const villainSource =
    context.targetType === 'villain' ? targetedVillain(state, context) : undefined;
  return {
    triggerSourceName: context.encounterCardInstance?.card?.name || villainSource?.card.name,
    triggerSourceCode: context.encounterCardInstance?.card?.code || villainSource?.card.code,
    triggerSourceCard: context.encounterCardInstance?.card || villainSource?.card,
  };
}

function scanIdentityTriggerAbilities(
  state: GameState,
  trigger: TriggerType,
  context: TriggerContext,
  currentChain: TriggerCallNode[],
  playersToScan: PlayerState[],
  scanState: TriggerScanState,
): void {
  const playerAbilitiesSuspended = arePlayerAbilitiesSuspended(state);
  for (const identityPlayer of playersToScan) {
    const identityAbilities =
      identityPlayer && !playerAbilitiesSuspended
        ? identityPlayer.activeFormCard?.enrichment?.abilities || []
        : [];
    for (const ability of identityAbilities) {
      if (triggersAreEquivalent(ability.trigger, trigger)) {
        if (revealCannotBeCanceledBy(state, ability, context)) continue;
        if (
          (ability.timing === 'HERO_INTERRUPT' || ability.timing === 'HERO_RESPONSE') &&
          identityPlayer.currentForm !== 'hero'
        ) {
          continue;
        }
        if (
          (ability.timing === 'ALTER_EGO_INTERRUPT' || ability.timing === 'ALTER_EGO_RESPONSE') &&
          identityPlayer.currentForm !== 'alter_ego'
        ) {
          continue;
        }
        if (
          !matchesTriggerFilter(
            ability.triggerFilter,
            context,
            identityPlayer,
            { instanceId: identityPlayer.id, card: identityPlayer.activeFormCard } as CardInstance,
            trigger,
          )
        ) {
          continue;
        }
        if (
          ability.limit === 'ONCE_PER_ROUND' &&
          identityPlayer.usedAbilitiesThisRound?.[ability.id]
        ) {
          continue;
        }
        if (
          ability.limit === 'ONCE_PER_PHASE' &&
          identityPlayer.usedAbilitiesThisPhase?.[ability.id]
        ) {
          continue;
        }

        const isForced = isForcedTiming(ability.timing);
        if (isForced !== (scanState.pass === 'FORCED')) continue;
        if (isForced || context.acceptOptionalTriggers === true) {
          const run = (): void => {
            const node: TriggerCallNode = {
              trigger,
              abilityId: ability.id,
              sourceInstanceId: identityPlayer.id,
              cardCode: identityPlayer.activeFormCard.code,
              cardName: identityPlayer.activeFormCard.name,
            };
            const nextChain = checkAndRecordTriggerNode(state, node, currentChain);

            if (ability.cost) {
              executeAbilityCost(state, identityPlayer, ability);
            }
            if (ability.limit === 'ONCE_PER_ROUND') {
              if (!identityPlayer.usedAbilitiesThisRound)
                identityPlayer.usedAbilitiesThisRound = {};
              identityPlayer.usedAbilitiesThisRound[ability.id] =
                (identityPlayer.usedAbilitiesThisRound[ability.id] || 0) + 1;
            } else if (ability.limit === 'ONCE_PER_PHASE') {
              if (!identityPlayer.usedAbilitiesThisPhase)
                identityPlayer.usedAbilitiesThisPhase = {};
              identityPlayer.usedAbilitiesThisPhase[ability.id] =
                (identityPlayer.usedAbilitiesThisPhase[ability.id] || 0) + 1;
            }
            const effCtx: EffectExecutionContext = {
              playerId: identityPlayer.id,
              eventTargetType: context.targetType,
              eventTargetInstanceId: context.targetInstanceId,
              threatAmount: scanState.currentThreat,
              damageAmount: scanState.currentDamage,
              interceptedValue: scanState.currentThreat || scanState.currentDamage,
              triggerChain: nextChain,
            };
            kernel.executeEffect(state, ability, effCtx);
            if (trigger === 'THREAT_WOULD_BE_PLACED' && effCtx.threatAmount !== undefined) {
              scanState.currentThreat = effCtx.threatAmount;
            }
            if (trigger === 'DAMAGE_WOULD_BE_TAKEN' && effCtx.damageAmount !== undefined) {
              scanState.currentDamage = effCtx.damageAmount;
              if (scanState.currentDamage === 0) scanState.isPrevented = true;
            }
            appendLog(state, {
              key: `ability.${ability.id}.triggered`,
              params: { actor: identityPlayer.name },
              onomatopoeia: 'ABILITY TRIGGERED!',
            });
          };
          if (isForced) {
            scanState.forcedCandidates.push({
              controller: identityPlayer,
              run,
              prompt: () =>
                forcedAbilityPrompt(state, scanState, trigger, context, identityPlayer, ability, {
                  name: identityPlayer.activeFormCard.name,
                  code: identityPlayer.activeFormCard.code,
                }),
            });
          } else {
            run();
          }
        } else {
          // Optional Identity Ability: Check cost & limits before prompting
          const costCheck = canPayAbilityCost(state, identityPlayer, ability);
          if (!costCheck.allowed) continue;
          // RR v1.8 "Target": an ability that requires a target needs at least one valid target.
          if (!kernel.checkAbilityTargets(state, identityPlayer, ability).allowed) continue;

          if (
            ability.limit === 'ONCE_PER_ROUND' &&
            identityPlayer.usedAbilitiesThisRound?.[ability.id]
          ) {
            continue;
          }
          if (
            ability.limit === 'ONCE_PER_PHASE' &&
            identityPlayer.usedAbilitiesThisPhase?.[ability.id]
          ) {
            continue;
          }

          const cardName = identityPlayer.activeFormCard.name;
          const isDamageTrigger = triggersAreEquivalent(trigger, 'DAMAGE_WOULD_BE_TAKEN');
          const damageSuffix =
            isDamageTrigger && scanState.currentDamage > 0
              ? ` (Incoming Damage: ${scanState.currentDamage})`
              : '';
          const damageDescSuffix =
            isDamageTrigger && scanState.currentDamage > 0
              ? ` [Incoming Damage: ${scanState.currentDamage}]`
              : '';
          const sourceFields = getTriggerSourceFields(state, context);
          kernel.enqueueDecisionPrompt(state, {
            promptId: nextEngineId(state, `prompt_trigger_${ability.id}`),
            playerId: identityPlayer.id,
            title: `Do you want to use the following ability from ${cardName}?${damageSuffix}`,
            description: `${formatAbilityStepsSummary(trigger, ability.steps || [])}${damageDescSuffix}`,
            incomingDamage: isDamageTrigger ? scanState.currentDamage : undefined,
            sourceCardName: cardName,
            sourceCardCode: identityPlayer.activeFormCard.code,
            ...sourceFields,
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
                    threatAmount: scanState.currentThreat,
                    damageAmount: scanState.currentDamage,
                    interceptedValue: scanState.currentThreat || scanState.currentDamage,
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
          scanState.hasPendingPrompt = true;
        }
      }
    }
  }
}

function scanInPlayTriggerAbilities(
  state: GameState,
  trigger: TriggerType,
  context: TriggerContext,
  currentChain: TriggerCallNode[],
  playersToScan: PlayerState[],
  scanState: TriggerScanState,
): void {
  const playerAbilitiesSuspended = arePlayerAbilitiesSuspended(state);
  for (const controller of playersToScan) {
    if (
      scanState.hasPendingPrompt &&
      trigger !== 'THREAT_WOULD_BE_PLACED' &&
      trigger !== 'DAMAGE_WOULD_BE_TAKEN' &&
      !isDefeatTrigger(trigger)
    ) {
      break;
    }
    const isFirstPlayer =
      controller.id === (state.players[state.firstPlayerIndex]?.id || state.players[0]?.id);
    const villainAttachments = isFirstPlayer
      ? getVillainsInPlay(state).flatMap((v) => v.attachments || [])
      : [];
    const inPlayCards: CardInstance[] = [
      ...(playerAbilitiesSuspended ? [] : controller.tableau || []),
      ...(playerAbilitiesSuspended ? [] : controller.allies || []),
      ...(controller.attachments || []),
      ...(controller.obligations || []),
      ...(playerAbilitiesSuspended
        ? []
        : (controller.allies || []).flatMap((a) => a.attachments || [])),
      ...(controller.engagedMinions || []),
      ...(controller.engagedMinions || []).flatMap((m) => m.attachments || []),
      ...villainAttachments,
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
          if (trigger === 'ENTERS_PLAY' || trigger === 'CARD_PLAYED') {
            if (context.sourceInstanceId && context.sourceInstanceId !== cardInst.instanceId) {
              continue;
            }
            if (!context.sourceInstanceId) {
              continue;
            }
          }

          // Ally action-resolution guard:
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
          if (isForced !== (scanState.pass === 'FORCED')) continue;
          if (isForced || context.acceptOptionalTriggers === true) {
            // RR v1.8 Forced: a forced ability that requires a target and has no valid one does not initiate
            if (
              !kernel.checkAbilityTargets(state, controller, ability, cardInst, {
                targetType: context.targetType,
                targetInstanceId: context.targetInstanceId,
              }).allowed
            ) {
              continue;
            }
            if (ability.cost && !canPayAbilityCost(state, controller, ability, cardInst).allowed) {
              continue;
            }
            const run = (): void => {
              const node: TriggerCallNode = {
                trigger,
                abilityId: ability.id,
                sourceInstanceId: cardInst.instanceId,
                cardCode: cardInst.card.code,
                cardName: cardInst.card.name,
              };
              const nextChain = checkAndRecordTriggerNode(state, node, currentChain);
              if (ability.cost) executeAbilityCost(state, controller, ability, cardInst);
              const effCtx: EffectExecutionContext = {
                playerId: controller.id,
                sourceCardInstance: cardInst,
                eventTargetType: context.targetType,
                eventTargetInstanceId: context.targetInstanceId,
                resourcesSpent: context.resourcesSpent,
                threatAmount: scanState.currentThreat,
                damageAmount: scanState.currentDamage,
                interceptedValue: scanState.currentThreat || scanState.currentDamage,
                triggerChain: nextChain,
              };
              kernel.executeEffect(state, ability, effCtx);
              if (trigger === 'THREAT_WOULD_BE_PLACED' && effCtx.threatAmount !== undefined) {
                scanState.currentThreat = effCtx.threatAmount;
              }
              if (trigger === 'DAMAGE_WOULD_BE_TAKEN' && effCtx.damageAmount !== undefined) {
                scanState.currentDamage = effCtx.damageAmount;
                if (scanState.currentDamage === 0) scanState.isPrevented = true;
              }
              // Logged like the identity and optional paths, so the order of a window can be read
              appendLog(state, {
                key: `ability.${ability.id}.triggered`,
                params: { actor: controller.name },
                onomatopoeia: 'ABILITY TRIGGERED!',
              });
            };
            if (isForced) {
              scanState.forcedCandidates.push({
                controller,
                run,
                prompt: () =>
                  forcedAbilityPrompt(state, scanState, trigger, context, controller, ability, {
                    name: cardInst.card.name,
                    code: cardInst.card.code,
                    instanceId: cardInst.instanceId,
                  }),
              });
            } else {
              run();
            }
          } else {
            // Optional In-Play Ability: Check cost & limits before prompting
            if (
              triggersAreEquivalent(trigger, 'DAMAGE_WOULD_BE_TAKEN') &&
              scanState.currentDamage <= 0
            ) {
              continue;
            }
            const costCheck = canPayAbilityCost(state, controller, ability, cardInst);
            if (!costCheck.allowed) continue;
            // RR v1.8 "Target": an ability that requires a target needs at least one valid target.
            if (
              !kernel.checkAbilityTargets(state, controller, ability, cardInst, {
                targetType: context.targetType,
                targetInstanceId: context.targetInstanceId,
              }).allowed
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

            const preventAmount = getAbilityPreventAmount(ability);
            const cardName = cardInst.card.name;
            const isDamageTrigger = triggersAreEquivalent(trigger, 'DAMAGE_WOULD_BE_TAKEN');
            const damageSuffix =
              isDamageTrigger && scanState.currentDamage > 0
                ? ` (Incoming Damage: ${scanState.currentDamage})`
                : '';
            const damageDescSuffix =
              isDamageTrigger && scanState.currentDamage > 0
                ? ` [Incoming Damage: ${scanState.currentDamage}]`
                : '';
            const sourceFields = getTriggerSourceFields(state, context);
            kernel.enqueueDecisionPrompt(state, {
              promptId: nextEngineId(state, `prompt_trigger_${ability.id}`),
              playerId: controller.id,
              title: `Do you want to use the following ability from ${cardName}?${damageSuffix}`,
              description: `${formatAbilityStepsSummary(trigger, ability.steps || [])}${damageDescSuffix}`,
              incomingDamage: isDamageTrigger ? scanState.currentDamage : undefined,
              attackerCardCode: context.attackerCardCode as string | undefined,
              attackerName: context.attackerName as string | undefined,
              defenderCardCode: context.defenderCardCode as string | undefined,
              defenderName: context.defenderName as string | undefined,
              defenderType: context.defenderType,
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
              ...sourceFields,
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
                      damageAmount: scanState.currentDamage,
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
            scanState.hasPendingPrompt = true;
            if (trigger !== 'THREAT_WOULD_BE_PLACED' && trigger !== 'DAMAGE_WOULD_BE_TAKEN') {
              break;
            }
          }
        }
      }
      if (
        scanState.hasPendingPrompt &&
        trigger !== 'THREAT_WOULD_BE_PLACED' &&
        trigger !== 'DAMAGE_WOULD_BE_TAKEN'
      ) {
        break;
      }
    }
  }
}

function scanAllHandTriggerReactions(
  state: GameState,
  trigger: TriggerType,
  context: TriggerContext,
  currentChain: TriggerCallNode[],
  player: PlayerState,
  scanState: TriggerScanState,
): void {
  // 3. In-hand reactions to damage about to be taken (e.g. Backflip 01003).
  if (trigger === 'DAMAGE_WOULD_BE_TAKEN' && scanState.currentDamage > 0) {
    if (
      scanHandReactions(state, trigger, context, currentChain, playersInTurnOrder(state), {
        isActive: () => scanState.currentDamage > 0,
        allEligibleCards: true,
        resolve: ({ player: p, card, ability, chain }) => {
          if (ability.steps?.some((s) => s.effect === 'PREVENT_DAMAGE')) {
            const effCtx = {
              playerId: p.id,
              sourceCardInstance: card,
              damageAmount: scanState.currentDamage,
              interceptedValue: scanState.currentDamage,
              triggerChain: chain,
            };
            kernel.executeEffect(state, ability, effCtx);
            scanState.currentDamage = effCtx.damageAmount ?? 0;
            if (scanState.currentDamage === 0) {
              scanState.isPrevented = true;
            }
          } else {
            kernel.executeEffect(state, ability, {
              playerId: p.id,
              sourceCardInstance: card,
              triggerChain: chain,
            });
          }
        },
        promptTitleSuffix: ` (Incoming Damage: ${scanState.currentDamage})`,
        promptDescriptionSuffix: ` [Incoming Damage: ${scanState.currentDamage}]`,
        promptFields: (p, ability) => {
          const preventAmount = getAbilityPreventAmount(ability);
          const sourceFields = getTriggerSourceFields(state, context);
          return {
            incomingDamage: scanState.currentDamage,
            attackerCardCode: context.attackerCardCode as string | undefined,
            attackerName: context.attackerName as string | undefined,
            defenderCardCode: context.defenderCardCode as string | undefined,
            defenderName: context.defenderName as string | undefined,
            defenderType: context.defenderType,
            targetCardCode:
              (context.targetCardCode as string | undefined) || p.activeFormCard?.code,
            targetName:
              (context.targetName as string | undefined) || p.activeFormCard?.name || p.name,
            targetCurrentHp: (context.targetCurrentHp as number | undefined) ?? p.health,
            targetMaxHp: (context.targetMaxHp as number | undefined) ?? p.maxHealth,
            preventAmount,
            ...sourceFields,
          };
        },
        promptContext: () => ({
          damageAmount: scanState.currentDamage,
          interceptedValue: scanState.currentDamage,
        }),
      })
    ) {
      scanState.hasPendingPrompt = true;
    }
  }

  // 4. In-hand reactions to threat about to be placed (e.g. Emergency 01085, Great Responsibility 01061). Every player may react.
  if (trigger === 'THREAT_WOULD_BE_PLACED' && scanState.currentThreat > 0) {
    if (
      scanHandReactions(state, trigger, context, currentChain, playersInTurnOrder(state), {
        isActive: () => scanState.currentThreat > 0,
        allEligibleCards: true,
        resolve: ({ player: p, card, ability, chain }) => {
          const hasConsume = ability.steps?.some((s) => s.effect === 'PREVENT_THREAT');
          const threatStep =
            ability.steps?.find((s) => s.effect === 'REMOVE_THREAT') || ability.steps?.[0];
          if (hasConsume) {
            const effCtx = {
              playerId: p.id,
              threatAmount: scanState.currentThreat,
              interceptedValue: scanState.currentThreat,
              sourceCardInstance: card,
              triggerChain: chain,
            };
            kernel.executeEffect(state, ability, effCtx);
            scanState.currentThreat = effCtx.threatAmount ?? 0;
          } else if (threatStep?.effect === 'REMOVE_THREAT') {
            const reduction = Number(threatStep.effectParams?.amount ?? 1);
            scanState.currentThreat = Math.max(0, scanState.currentThreat - reduction);
            appendLog(state, {
              key: `card.${card.card.code}.threatReduced`,
              params: { actor: p.name, amount: reduction },
              onomatopoeia: 'EMERGENCY!',
            });
          } else {
            kernel.executeEffect(state, ability, {
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
        promptContext: () => ({
          threatAmount: scanState.currentThreat,
          interceptedValue: scanState.currentThreat,
        }),
      })
    ) {
      scanState.hasPendingPrompt = true;
    }
  }

  // 5. In-hand reactions to an encounter card being revealed (e.g. Enhanced Spider-Sense 01004, Get Behind Me! 01078).
  if (trigger === 'ENCOUNTER_CARD_REVEALED') {
    if (
      scanHandReactions(state, trigger, context, currentChain, revealReactors(state, player), {
        isActive: () => !state.activeEncounterContext?.cancelled,
        allEligibleCards: true,
        resolve: ({ player: p, card, ability, chain }) => {
          kernel.executeEffect(state, ability, {
            playerId: p.id,
            sourceCardInstance: card,
            triggerChain: chain,
          });
          scanState.isCancelled = true;
        },
        promptFields: () => ({
          triggerSourceName: context.encounterCardInstance?.card?.name || 'Encounter Card',
          triggerSourceCode: context.encounterCardInstance?.card?.code,
          triggerSourceCard: context.encounterCardInstance?.card,
        }),
      })
    ) {
      scanState.hasPendingPrompt = true;
    }
  }

  // 6. In-hand reactions after a hero or ally defends an attack (e.g. Counter-Punch 01077).
  if (triggersAreEquivalent('ATTACK_DEFENDED', trigger)) {
    if (
      scanHandReactions(state, trigger, context, currentChain, playersInTurnOrder(state), {
        allEligibleCards: true,
        resolve: ({ player: p, card, ability, chain }) => {
          kernel.executeEffect(state, ability, {
            playerId: p.id,
            sourceCardInstance: card,
            eventTargetType: context.targetType,
            eventTargetInstanceId: context.targetInstanceId,
            triggerChain: chain,
          });
        },
      })
    ) {
      scanState.hasPendingPrompt = true;
    }
  }

  // 7. In-hand Responses after a character is defeated (e.g. Chase Them Down 01052).
  if (trigger === 'DEFEATED' && context.entityType === 'CHARACTER') {
    if (
      scanHandReactions(state, trigger, context, currentChain, playersInTurnOrder(state), {
        allEligibleCards: true,
        alsoTriggers: ['CHARACTER_DEFEATED'],
        resolve: ({ player: p, card, ability, chain }) => {
          kernel.executeEffect(state, ability, {
            playerId: p.id,
            sourceCardInstance: card,
            eventTargetType: context.targetType,
            eventTargetInstanceId: context.targetInstanceId,
            triggerChain: chain,
          });
        },
      })
    ) {
      scanState.hasPendingPrompt = true;
    }
  }

  // 8. In-hand Responses after a hero makes a basic attack (e.g. One-Two Punch 01024).
  if (trigger === 'BASIC_ATTACK_PERFORMED') {
    if (
      scanHandReactions(state, trigger, context, currentChain, [player], {
        allEligibleCards: true,
        resolve: ({ player: p, card, ability, chain }) => {
          kernel.executeEffect(state, ability, {
            playerId: p.id,
            sourceCardInstance: card,
            triggerChain: chain,
          });
        },
      })
    ) {
      scanState.hasPendingPrompt = true;
    }
  }
}

/**
 * The first player's prompt to order simultaneous abilities (RR v1.8 p. 27). Choosing one resolves
 * it first; the rest follow in turn order. Forced abilities name their controller, since the
 * first player orders them whoever controls the cards.
 */
function simultaneousAbilitiesPrompt(
  state: GameState,
  candidates: PendingDecisionPrompt[],
  kind: { title: string; description: string },
): PendingDecisionPrompt {
  const firstPlayerId =
    state.players[state.firstPlayerIndex]?.id || state.players[0]?.id || candidates[0].playerId;
  return {
    promptId: nextEngineId(state, 'prompt_order_simultaneous'),
    playerId: firstPlayerId,
    kind: 'ORDER_SIMULTANEOUS_ABILITIES',
    title: kind.title,
    description: kind.description,
    sourceCardName:
      candidates[0]?.triggerSourceName || candidates[0]?.sourceCardName || 'Simultaneous Abilities',
    sourceCardCode: candidates[0]?.triggerSourceCode,
    triggerSourceName: candidates[0]?.triggerSourceName,
    triggerSourceCode: candidates[0]?.triggerSourceCode,
    triggerSourceCard: candidates[0]?.triggerSourceCard,
    triggerType: candidates[0]?.triggerType,
    isVoluntary: false,
    options: candidates.map((candidate) => {
      const owner = state.players.find((pl) => pl.id === candidate.playerId);
      const ownerName = owner?.hero?.name || owner?.name || owner?.id || candidate.playerId;
      const candidateOption = candidate.options?.find(
        (o) => o.effect === 'EXECUTE_OPTIONAL_TRIGGER',
      );
      return {
        id: candidate.promptId,
        label: candidate.forced
          ? `${candidate.sourceCardName} (${owner?.name ?? candidate.playerId})`
          : candidate.sourceCardName,
        cardName: candidate.sourceCardName,
        cardCode: candidate.sourceCardCode,
        description: candidate.description,
        effect: 'EXECUTE_OPTIONAL_TRIGGER',
        params: {
          promptId: candidate.promptId,
          playerId: candidate.playerId,
          playerName: ownerName,
          triggerType: candidate.triggerType,
          sourceCardInstanceId: candidate.sourceCardInstanceId,
          ...(candidateOption?.params || {}),
          context: { ...(candidateOption?.params?.context || {}) },
        },
      };
    }),
    simultaneousPrompts: candidates,
  };
}

/**
 * Forced abilities initiate before any optional one (RR v1.8 "Forced"). One resolves at once.
 * Two or more simultaneous ones are queued as prompts the engine answers itself, behind the first
 * player's ordering prompt (whoever controls the cards): `finalizeQueuedTriggerPrompts` puts it
 * ahead of every optional prompt.
 */
function resolveForcedCandidates(state: GameState, scanState: TriggerScanState): void {
  const { forcedCandidates } = scanState;
  if (forcedCandidates.length === 1) {
    forcedCandidates[0].run();
  } else if (forcedCandidates.length > 1) {
    scanState.forcedOrdering = simultaneousAbilitiesPrompt(
      state,
      forcedCandidates.map((candidate) => candidate.prompt()),
      {
        title: 'Simultaneous Forced Abilities: Choose Resolution Order',
        description:
          'Multiple forced abilities triggered simultaneously. The first player determines the order in which they resolve.',
      },
    );
  }
  scanState.forcedCandidates = [];
}

function finalizeQueuedTriggerPrompts(
  state: GameState,
  priorityOrder: PlayerState[],
  queueLenBefore: number,
  context: TriggerContext,
  scanState: TriggerScanState,
): void {
  const queue = state.pendingDecisionQueue ?? [];
  if (queue.length <= queueLenBefore && !scanState.forcedOrdering) return;

  const turnOrder = priorityOrder.map((p) => p.id);
  const existing = queue.slice(0, queueLenBefore);
  const newlyAdded = queue.slice(queueLenBefore);
  newlyAdded.sort((a, b) => {
    const idxA = turnOrder.indexOf(a.playerId);
    const idxB = turnOrder.indexOf(b.playerId);
    const orderA = idxA === -1 ? 999 : idxA;
    const orderB = idxB === -1 ? 999 : idxB;
    return orderA - orderB;
  });
  const isIdenticalHandDuplicates =
    newlyAdded.length > 1 &&
    newlyAdded.every((c) => {
      const first = newlyAdded[0];
      if (c.playerId !== first.playerId) return false;
      if (!c.sourceCardCode || c.sourceCardCode !== first.sourceCardCode) return false;
      const owner = state.players.find((p) => p.id === c.playerId);
      return Boolean(owner?.hand?.some((h) => h.instanceId === c.sourceCardInstanceId));
    });

  const optionalPrompts =
    newlyAdded.length > 1 && context.acceptOptionalTriggers !== true && !isIdenticalHandDuplicates
      ? [
          simultaneousAbilitiesPrompt(state, newlyAdded, {
            title: 'Simultaneous Optional Abilities: Choose Resolution Order',
            description:
              'Multiple optional abilities triggered simultaneously. The first player determines the order in which they resolve.',
          }),
        ]
      : newlyAdded;
  state.pendingDecisionQueue = [
    ...existing,
    ...(scanState.forcedOrdering ? [scanState.forcedOrdering] : []),
    ...optionalPrompts,
  ];
  const total = state.pendingDecisionQueue.length;
  for (let i = 0; i < total; i++) {
    state.pendingDecisionQueue[i].queuePosition = i + 1;
    state.pendingDecisionQueue[i].totalQueued = total;
  }
  kernel.refreshPromptOptionAvailability(state, state.pendingDecisionQueue[0]);
  scanState.hasPendingPrompt = true;
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
  // The game is over (either side won): nothing triggers any more.
  if (state.winner) return { state };

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
    appendLog(state, {
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

  const scanState: TriggerScanState = {
    currentDamage: context.damageAmount ?? 0,
    isPrevented: context.preventedDamage ?? false,
    currentThreat: context.threatAmount ?? 0,
    isCancelled: false,
    hasPendingPrompt: false,
    pass: 'FORCED',
    forcedCandidates: [],
  };

  const queueLenBefore = state.pendingDecisionQueue?.length ?? 0;

  const priorityOrder =
    trigger === 'MINION_ENTERS_PLAY' || trigger === 'ENCOUNTER_CARD_REVEALED'
      ? revealReactors(state, player)
      : playersInTurnOrder(state);

  const isGlobalTrigger =
    trigger === 'THREAT_WOULD_BE_PLACED' ||
    trigger === 'DAMAGE_WOULD_BE_TAKEN' ||
    trigger === 'MINION_ENTERS_PLAY' ||
    trigger === 'ENCOUNTER_CARD_REVEALED' ||
    trigger === 'ENEMY_INITIATES_ATTACK';

  // "After you defeat ..." belongs to the player who defeated, not to the one the enemy engaged.
  const playersToScan: PlayerState[] =
    isGlobalTrigger || isDefeatTrigger(trigger) ? priorityOrder : [player];

  // Forced abilities initiate first (RR v1.8 "Forced"): identity, then tableau, allies & in-play cards.
  scanIdentityTriggerAbilities(state, trigger, context, currentChain, playersToScan, scanState);
  scanInPlayTriggerAbilities(state, trigger, context, currentChain, playersToScan, scanState);
  resolveForcedCandidates(state, scanState);

  // Then the optional ones: identity (e.g. Spider-Sense on Spider-Man 01001a), in play, in hand.
  scanState.pass = 'OPTIONAL';
  scanIdentityTriggerAbilities(state, trigger, context, currentChain, playersToScan, scanState);
  scanInPlayTriggerAbilities(state, trigger, context, currentChain, playersToScan, scanState);
  scanAllHandTriggerReactions(state, trigger, context, currentChain, player, scanState);

  // 4. Finalize queued prompts
  finalizeQueuedTriggerPrompts(state, priorityOrder, queueLenBefore, context, scanState);

  return {
    state,
    damageAmount: scanState.currentDamage,
    preventedDamage: scanState.isPrevented,
    threatAmount: scanState.currentThreat,
    cancelled: scanState.isCancelled,
    hasPendingPrompt: scanState.hasPendingPrompt,
  };
}

bindKernel({ dispatchTrigger, matchesTriggerFilter });
