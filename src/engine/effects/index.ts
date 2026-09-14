import {
  GameState,
  CardInstance,
  StatusCard,
  MinionCard,
  CardAbility,
  AbilityStep,
  CardType,
  SideSchemeCard,
  ConditionGate,
  StepResolutionResult,
  DecisionPromptOption,
  PendingDecisionPrompt,
  NormalizedCard,
  PlayerState,
  Keyword,
  hasKeyword,
} from '@engine/models';
import { handleVillainDefeat } from '../pipeline/scenario-helpers';
import { matchesCardFilter } from '../filters/card-filter';
import {
  executeVillainAttackAgainstPlayer,
  executeVillainSchemeAgainstPlayer,
  executeMinionAttackAgainstPlayer,
  resolveActiveEncounterCardAfterInterrupt,
} from '../pipeline/villain-phase';
import type { SearchZone } from '../../data/supplemental/schema';
import { drawEncounterCard, drawPlayerCard } from '../pipeline/deck-exhaustion';
import { enqueueDecisionPrompt } from '../pipeline/prompt-queue';
import { resolveDefenderDeclaration } from '../pipeline/combat-pipeline';
import {
  getEffectiveMaxHealth,
  getEffectiveHandSize,
  getEffectiveRetaliate,
  hasEntityKeyword,
} from '../pipeline/stat-calculator';
import { dispatchTrigger } from '../triggers/trigger-dispatcher';
import { TriggerCallNode } from '../errors/infinite-loop-error';
import { getSpecialHandler } from '../specials/special-registry';
import '../specials/wakanda-forever';
import {
  attachCardToHost,
  removeCardFromAllZones,
  initializeCardUses,
} from '../state/state-validator';

export interface EffectExecutionContext {
  playerId: string;
  targetPlayerId?: string;
  sourceCardInstance?: CardInstance;
  sourceCardId?: string;
  targetType?:
    | 'villain'
    | 'minion'
    | 'main_scheme'
    | 'side_scheme'
    | 'ally'
    | 'hero'
    | 'character'
    | 'identity';
  targetInstanceId?: string;
  resourcesSpent?: string[];
  previousResult?: StepResolutionResult;
  collectedCardInstanceIds?: string[];
  threatAmount?: number;
  damageAmount?: number;
  interceptedValue?: number;
  remainingInterceptedValue?: number;
  choice?: string;
  isAttack?: boolean;
  discardedCards?: CardInstance[];
  assignments?: Record<string, number>;
  /** Active chain of trigger nodes for cycle detection & depth tracking (ADR-0053) */
  triggerChain?: TriggerCallNode[];
  /** Host ability context for timing, trigger, and cost evaluation */
  ability?: CardAbility;
}

export { evaluateDynamicAmount } from './dynamic-formula-evaluator';
import { evaluateDynamicAmount } from './dynamic-formula-evaluator';

/**
 * Universal dynamic numeric amount resolver (ADR-0049, ADR-0052)
 * Resolves literal numbers, tokens, and DynamicValueSource with full math, fractions, and clamping.
 */
export function resolveNumericAmount(
  amountParam: any,
  context: Partial<EffectExecutionContext>,
  fallback: number = 0,
  options?: {
    state?: GameState;
    player?: PlayerState;
    targetInstanceId?: string;
    targetCardInstance?: CardInstance;
    sourceCardInstance?: CardInstance;
  },
): number {
  return evaluateDynamicAmount(amountParam, context, {
    fallback,
    state: options?.state || (context as any)?.state,
    player: options?.player || (context as any)?.player,
    targetInstanceId: options?.targetInstanceId || (context as any)?.targetInstanceId,
    targetCardInstance: options?.targetCardInstance || (context as any)?.targetCardInstance,
    sourceCardInstance: options?.sourceCardInstance || context?.sourceCardInstance,
  });
}

export interface EffectResult {
  state: GameState;
  success: boolean;
  error?: string;
  onomatopoeia?: string;
  mutatedState?: boolean;
  value?: number;
  selectedCardInstanceIds?: string[];
  targetId?: string;
  conditionMet?: boolean;
  discardedCards?: CardInstance[];
}

/**
 * Routes a defeated card to the permanent Victory Display if it carries the printed
 * 'Victory X' keyword, or to its normal discard pile otherwise (RR v1.8 p. 30, ADR-0034).
 * Reusable across every defeat path (minions, side schemes, player side schemes).
 */
export function moveDefeatedCardToPile(
  state: GameState,
  cardInstance: CardInstance,
  discardPile: CardInstance[],
): void {
  if (hasEntityKeyword(cardInstance, 'Victory')) {
    state.victoryDisplay.push(cardInstance);
  } else {
    discardPile.push(cardInstance);
  }
}

/**
 * Universal declarative card filter evaluator (ADR-0046, RR v1.8 p. 19, 26, 28).
 * Delegates to pure engine module src/engine/filters/card-filter.ts.
 */
export { matchesCardFilter } from '../filters/card-filter';

export function matchCardFilter(card: NormalizedCard, filter?: any, player?: PlayerState): boolean {
  return matchesCardFilter(card, filter, { player });
}

import { checkAndDiscardZeroCounterCard } from '../pipeline/cost-engine';
export { checkAndDiscardZeroCounterCard };

/**
 * Checks whether a card belongs to the encounter deck pool (RR v1.8 p. 11).
 */
export function isEncounterCard(card: NormalizedCard): boolean {
  if (!card) return false;
  const t = card.type?.toLowerCase();
  return (
    t === 'attachment' ||
    t === 'minion' ||
    t === 'treachery' ||
    t === 'main_scheme' ||
    t === 'side_scheme' ||
    t === 'villain' ||
    t === 'obligation' ||
    t === 'environment' ||
    (card as any).faction_code === 'encounter' ||
    Boolean((card as any).card_set_code)
  );
}

/**
 * Universal helper to cleanly discard all attachments and cards underneath when a host leaves play (RR v1.8 p. 5, 6).
 */
export function discardHostAttachmentsAndTuckedCards(
  state: GameState,
  host: { attachments?: CardInstance[]; cardsUnderneath?: CardInstance[] },
  ownerPlayerId?: string,
): void {
  if (!host) return;

  // 1. Discard all active attachments to appropriate discard piles
  if (host.attachments && host.attachments.length > 0) {
    for (const attachment of host.attachments) {
      if (isEncounterCard(attachment.card)) {
        state.encounterDiscard.push(attachment);
      } else {
        const ownerId = (attachment as any).ownerId || ownerPlayerId;
        const targetP = state.players.find((p) => p.id === ownerId) || state.players[0];
        targetP.discard.push(attachment);
        dispatchTrigger(state, 'CARD_DISCARDED', {
          targetPlayerId: targetP.id,
          sourceInstanceId: attachment.instanceId,
        });
      }
    }
    host.attachments = [];
  }

  // 2. Discard all face-down/out-of-play cards placed underneath
  if (host.cardsUnderneath && host.cardsUnderneath.length > 0) {
    for (const tucked of host.cardsUnderneath) {
      if (isEncounterCard(tucked.card)) {
        state.encounterDiscard.push(tucked);
      } else {
        const ownerId = (tucked as any).ownerId || ownerPlayerId;
        const targetP = state.players.find((p) => p.id === ownerId) || state.players[0];
        targetP.discard.push(tucked);
        dispatchTrigger(state, 'CARD_DISCARDED', {
          targetPlayerId: targetP.id,
          sourceInstanceId: tucked.instanceId,
        });
      }
    }
    host.cardsUnderneath = [];
  }
}

/**
 * Universal helper to process character defeat when cards are attached (RR v1.8 p. 6, 13).
 * Triggers all 'HOST_DEFEATED' interrupt abilities on attached cards, then cleanly discards them.
 */
export function processHostDefeated(
  state: GameState,
  hostCard: CardInstance,
  context?: { player?: PlayerState; sourceCardInstance?: CardInstance },
): void {
  const attachments = hostCard.attachments || [];
  const cardsUnderneath = hostCard.cardsUnderneath || [];
  if (attachments.length === 0 && cardsUnderneath.length === 0) return;

  for (const att of attachments) {
    const abilities = att.card.enrichment?.abilities || [];
    for (const ab of abilities) {
      if (ab.trigger === 'CHARACTER_DEFEATED' || ab.trigger === 'DEFEATED') {
        const ownerId = (att as any).ownerId;
        const owner =
          (ownerId ? state.players.find((p) => p.id === ownerId) : undefined) ||
          context?.player ||
          state.players[0];

        executeEffect(state, ab, {
          playerId: owner.id,
          sourceCardInstance: att,
        });

        state.log.push({
          id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          timestamp: Date.now(),
          round: state.roundNumber,
          phase: state.phase,
          key: `ability.${ab.id}.triggered`,
          params: { card: att.card.name, host: hostCard.card.name },
          onomatopoeia: 'HOST DEFEATED!',
        });
      }
    }
  }

  const ownerPlayerId = context?.player?.id || state.players[0]?.id;
  discardHostAttachmentsAndTuckedCards(state, hostCard, ownerPlayerId);
}

/**
 * Evaluates whether a sequential step gate condition is satisfied (RR v1.8 p. 2, 24).
 */
export function shouldExecuteStep(
  gate: ConditionGate | undefined,
  prevResult: StepResolutionResult | undefined,
  state: GameState,
  step: AbilityStep,
  context: EffectExecutionContext,
  stepResultsMap?: Map<string, StepResolutionResult>,
): boolean {
  if (!gate || gate === 'ALWAYS') return true;

  const targetStepId = step.params?.targetStepId as string | undefined;
  const evaluatedResult =
    targetStepId && stepResultsMap?.has(targetStepId)
      ? stepResultsMap.get(targetStepId)
      : prevResult;

  if (gate === 'THEN' || gate === 'IF_PREVIOUS_SUCCESS') {
    return !!evaluatedResult && evaluatedResult.success && evaluatedResult.mutatedState;
  }

  if (gate === 'IF_AMOUNT_ZERO' || gate === 'IF_ZERO_HEALED') {
    return (
      !!evaluatedResult && (!evaluatedResult.mutatedState || (evaluatedResult.value ?? 0) === 0)
    );
  }

  if (gate === 'IF_FAILED') {
    if (targetStepId && stepResultsMap?.has(targetStepId)) {
      const targetRes = stepResultsMap.get(targetStepId);
      return !targetRes || !targetRes.success || !targetRes.mutatedState;
    }
    return !evaluatedResult || !evaluatedResult.success || !evaluatedResult.mutatedState;
  }

  if (gate === 'IF_ALREADY_HAS_STATUS') {
    if (evaluatedResult && evaluatedResult.conditionMet !== undefined) {
      return evaluatedResult.conditionMet;
    }
    const statusParam = (step.params?.status as StatusCard) || StatusCard.TOUGH;
    const targetParam = (step.params?.target as string) || 'VILLAIN';
    if (targetParam === 'VILLAIN') {
      return state.villain.statusCards.includes(statusParam as StatusCard);
    }
    return false;
  }

  if (gate === 'IF_RESOURCE_MATCH') {
    const reqAspect = (
      (step.params?.aspect as string) ||
      (step.params?.resource as string) ||
      ''
    ).toLowerCase();

    // 1. Check resources spent (cost payment)
    if (
      context.resourcesSpent?.some(
        (r) => r.toLowerCase() === reqAspect || r.toLowerCase() === 'wild',
      )
    ) {
      return true;
    }

    // 2. Check discarded cards in context or previousResult
    const discarded: CardInstance[] = context.discardedCards || prevResult?.discardedCards || [];
    if (discarded.length > 0) {
      return discarded.some((inst) => {
        if (!inst?.card) return false;
        const res = inst.card.resources;
        const raw = inst.card.raw as any;
        const wildCount = res?.wild ?? raw?.resource_wild ?? 0;
        if (wildCount > 0) return true;
        const matchCount =
          res?.[reqAspect as keyof typeof res] ?? raw?.[`resource_${reqAspect}`] ?? 0;
        return typeof matchCount === 'number' && matchCount > 0;
      });
    }

    return false;
  }

  if (gate === 'IF_CARD_IN_PLAY') {
    const cardCode = (step.params?.cardCode as string) || (step.params?.code as string);
    if (cardCode) {
      const inSideSchemes = state.sideSchemes?.some((s) => s.card?.code === cardCode);
      const inVillainAttachments = state.villain?.attachments?.some(
        (a) => a.card?.code === cardCode,
      );
      const inPlayerZones = state.players?.some((p) =>
        [
          ...(p.tableau || []),
          ...(p.allies || []),
          ...(p.engagedMinions || []),
          ...(p.attachments || []),
        ].some((c) => c.card?.code === cardCode),
      );
      return Boolean(inSideSchemes || inVillainAttachments || inPlayerZones);
    }
    return false;
  }

  if (gate === 'IF_CARD_NOT_IN_PLAY') {
    const cardCode = (step.params?.cardCode as string) || (step.params?.code as string);
    if (cardCode) {
      const inSideSchemes = state.sideSchemes?.some((s) => s.card?.code === cardCode);
      const inVillainAttachments = state.villain?.attachments?.some(
        (a) => a.card?.code === cardCode,
      );
      const inPlayerZones = state.players?.some((p) =>
        [
          ...(p.tableau || []),
          ...(p.allies || []),
          ...(p.engagedMinions || []),
          ...(p.attachments || []),
        ].some((c) => c.card?.code === cardCode),
      );
      return !inSideSchemes && !inVillainAttachments && !inPlayerZones;
    }
    return true;
  }

  if (gate === 'IF_CONDITION_MET') {
    return !!evaluatedResult && evaluatedResult.conditionMet === true;
  }

  return true;
}

/**
 * Executes a declarative sequence of sub-action steps.
 */
export function executeSequence(
  state: GameState,
  steps: AbilityStep[],
  context: EffectExecutionContext,
): EffectResult {
  let currentState = state;
  let prevResult: StepResolutionResult | undefined = context.previousResult;
  let anyStepMutated = false;
  const stepResultsMap = new Map<string, StepResolutionResult>();
  const onomatopoeias: string[] = [];

  for (const step of steps) {
    const shouldRun = shouldExecuteStep(
      step.gate,
      prevResult,
      currentState,
      step,
      context,
      stepResultsMap,
    );
    if (!shouldRun) {
      if (step.id) {
        stepResultsMap.set(step.id, {
          success: false,
          mutatedState: false,
          conditionMet: false,
        });
      }
      continue;
    }

    const stepContext: EffectExecutionContext = {
      ...context,
      previousResult: prevResult,
      targetInstanceId:
        step.params?.target === 'PREVIOUS_TARGET'
          ? (prevResult?.targetId ?? context.targetInstanceId)
          : context.targetInstanceId,
    };

    const res = executeStep(currentState, step, stepContext);
    currentState = res.state;

    if (res.discardedCards) {
      context.discardedCards = res.discardedCards;
    }

    // Propagate mutated context fields back to sequence context
    if (stepContext.remainingInterceptedValue !== undefined) {
      context.remainingInterceptedValue = stepContext.remainingInterceptedValue;
    }
    if (stepContext.threatAmount !== undefined) {
      context.threatAmount = stepContext.threatAmount;
    }
    if (stepContext.damageAmount !== undefined) {
      context.damageAmount = stepContext.damageAmount;
    }

    const stepMutated = res.mutatedState ?? res.success;
    if (stepMutated) {
      anyStepMutated = true;
    }

    prevResult = {
      success: res.success,
      mutatedState: stepMutated,
      value: res.value,
      conditionMet: res.conditionMet,
      targetId: res.selectedCardInstanceIds?.[0] || res.targetId,
      discardedCards: res.discardedCards ?? prevResult?.discardedCards,
    };

    if (step.id) {
      stepResultsMap.set(step.id, prevResult);
    }

    if (res.onomatopoeia) {
      onomatopoeias.push(res.onomatopoeia);
    }
  }

  return {
    state: currentState,
    success: true,
    mutatedState: anyStepMutated,
    onomatopoeia: onomatopoeias.length > 0 ? onomatopoeias.join(' ➔ ') : 'SEQUENCE RESOLVED!',
  };
}

/**
 * Executes a declarative effect or ability on the GameState.
 */
export function executeEffect(
  state: GameState,
  abilityOrStep: CardAbility | AbilityStep,
  context: EffectExecutionContext,
): EffectResult {
  // Normalize interceptedValue from legacy / caller-provided threatAmount or damageAmount
  if (context.interceptedValue === undefined) {
    context.interceptedValue = context.threatAmount ?? context.damageAmount;
  }

  // Handle ability cost (e.g. discardSelf on in-play upgrades/attachments)
  if (
    'cost' in abilityOrStep &&
    (abilityOrStep as CardAbility).cost?.discardSelf &&
    context.sourceCardInstance
  ) {
    const player = state.players.find((p) => p.id === context.playerId);
    if (player) {
      const tableauIdx = player.tableau.findIndex(
        (c) => c.instanceId === context.sourceCardInstance!.instanceId,
      );
      if (tableauIdx !== -1) {
        const [discarded] = player.tableau.splice(tableauIdx, 1);
        player.discard.push(discarded);
      }
    }
  }

  if (
    'steps' in abilityOrStep &&
    Array.isArray(abilityOrStep.steps) &&
    abilityOrStep.steps.length > 0
  ) {
    if ((abilityOrStep as CardAbility).timing) {
      context.ability = abilityOrStep as CardAbility;
    }
    return executeSequence(state, abilityOrStep.steps, context);
  }

  if (
    'sequence' in abilityOrStep &&
    Array.isArray((abilityOrStep as any).sequence) &&
    (abilityOrStep as any).sequence.length > 0
  ) {
    if ((abilityOrStep as CardAbility).timing) {
      context.ability = abilityOrStep as CardAbility;
    }
    return executeSequence(state, (abilityOrStep as any).sequence, context);
  }

  if ('effect' in abilityOrStep && abilityOrStep.effect) {
    return executeStep(state, abilityOrStep as AbilityStep, context);
  }

  return { state, success: true, onomatopoeia: 'RESOLVED!' };
}

/**
 * Universal DISCARD Primitive Handler (RR v1.8 p. 10, Issue #66)
 * Handles card attrition/removal across all valid game zones (hand, deck, encounter deck, tableau, host, self, cards under host).
 */
export function executeDiscard(
  state: GameState,
  step: AbilityStep,
  context: EffectExecutionContext,
): EffectResult {
  const player = state.players.find((p) => p.id === context.playerId);
  if (!player) return { state, success: false, error: 'Player not found' };

  const source = (step.params?.source as string) || 'HAND';
  const rawCount = step.params?.count;
  const isCountAll = rawCount === 'ALL';
  const count = typeof rawCount === 'number' ? rawCount : 1;
  const mode =
    (step.params?.mode as string) ||
    (source === 'DECK' || source === 'ENCOUNTER_DECK' ? 'TOP' : 'CHOSEN');
  const fallback = step.params?.fallback as string | undefined;
  const filter = (step.params?.filter || step.filter) as any;

  // 1. DISCARD FROM HAND
  if (source === 'HAND') {
    const targetPlayer =
      (step.params?.target as string) === 'CHOSEN_PLAYER' && context.targetPlayerId
        ? state.players.find((p) => p.id === context.targetPlayerId) || player
        : player;

    if (mode === 'RANDOM') {
      let discardedCount = 0;
      for (let i = 0; i < count; i++) {
        if (targetPlayer.hand.length > 0) {
          const randIdx = Math.floor(Math.random() * targetPlayer.hand.length);
          const [discarded] = targetPlayer.hand.splice(randIdx, 1);
          targetPlayer.discard.push(discarded);
          discardedCount++;
          dispatchTrigger(state, 'CARD_DISCARDED', {
            targetPlayerId: targetPlayer.id,
            sourceInstanceId: discarded.instanceId,
            triggerChain: context.triggerChain,
          });
          state.log.push({
            id: `log_${Date.now()}_${discarded.instanceId}`,
            timestamp: Date.now(),
            round: state.roundNumber,
            phase: state.phase,
            category: 'combat',
            key: 'player.hand.randomDiscard',
            params: { player: targetPlayer.name, card: discarded.card.name },
            onomatopoeia: 'RANDOM DISCARD!',
          });
        }
      }
      return {
        state,
        success: true,
        mutatedState: discardedCount > 0,
        value: discardedCount,
        onomatopoeia: 'RANDOM DISCARD!',
      };
    }

    let discardedCount = 0;
    const toDiscardCount = isCountAll
      ? targetPlayer.hand.length
      : Math.min(count, targetPlayer.hand.length);
    for (let i = 0; i < toDiscardCount; i++) {
      if (targetPlayer.hand.length > 0) {
        const [discarded] = targetPlayer.hand.splice(0, 1);
        targetPlayer.discard.push(discarded);
        discardedCount++;
        dispatchTrigger(state, 'CARD_DISCARDED', {
          targetPlayerId: targetPlayer.id,
          sourceInstanceId: discarded.instanceId,
          triggerChain: context.triggerChain,
        });
      }
    }
    return {
      state,
      success: true,
      mutatedState: discardedCount > 0,
      value: discardedCount,
      onomatopoeia: `DISCARDED ${discardedCount} CARDS!`,
    };
  }

  // 2. DISCARD FROM PLAYER DECK
  if (source === 'DECK') {
    let discardedCount = 0;
    const discardedCards: CardInstance[] = [];
    const matchingDestination = step.params?.matchingDestination as string | undefined;
    for (let i = 0; i < count; i++) {
      const card = drawPlayerCard(state, player.id);
      if (card) {
        if (matchingDestination && filter && matchCardFilter(card.card, filter, player)) {
          if (matchingDestination === 'HAND') {
            player.hand.push(card);
          } else if (matchingDestination === 'PLAY') {
            player.tableau.push(card);
          } else {
            player.discard.push(card);
            discardedCards.push(card);
          }
        } else {
          player.discard.push(card);
          discardedCards.push(card);
        }
        discardedCount++;
        dispatchTrigger(state, 'CARD_DISCARDED', {
          targetPlayerId: player.id,
          sourceInstanceId: card.instanceId,
          triggerChain: context.triggerChain,
        });
      }
    }
    return {
      state,
      success: true,
      mutatedState: discardedCount > 0,
      value: discardedCount,
      discardedCards,
      onomatopoeia: `DISCARDED ${discardedCount} CARDS!`,
    };
  }

  // 3. DISCARD FROM ENCOUNTER DECK
  if (source === 'ENCOUNTER_DECK') {
    let discardedCount = 0;
    for (let i = 0; i < count; i++) {
      const card = drawEncounterCard(state);
      if (card) {
        state.encounterDiscard.push(card);
        discardedCount++;
      }
    }
    return {
      state,
      success: true,
      mutatedState: discardedCount > 0,
      value: discardedCount,
      onomatopoeia: `DISCARDED ${discardedCount} ENCOUNTER CARDS!`,
    };
  }

  // 4. DISCARD FROM TABLEAU
  if (source === 'TABLEAU') {
    const matchingIndices: number[] = [];
    player.tableau.forEach((inst, idx) => {
      if (!filter || matchesCardFilter(inst.card, filter, { player, state })) {
        matchingIndices.push(idx);
      }
    });

    if (matchingIndices.length > 0) {
      const targetIdx = matchingIndices[0];
      const [discarded] = player.tableau.splice(targetIdx, 1);
      player.discard.push(discarded);
      dispatchTrigger(state, 'CARD_DISCARDED', {
        targetPlayerId: player.id,
        sourceInstanceId: discarded.instanceId,
        triggerChain: context.triggerChain,
      });
      state.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        category: 'combat',
        key: 'player.tableau.discarded',
        params: { player: player.name, card: discarded.card.name },
        onomatopoeia: 'TABLEAU DISCARDED!',
      });
      return {
        state,
        success: true,
        mutatedState: true,
        onomatopoeia: `DISCARDED ${discarded.card.name.toUpperCase()}!`,
      };
    }

    if (fallback === 'SURGE') {
      const surgeCard = drawEncounterCard(state);
      if (surgeCard) player.dealtEncounterCards.push(surgeCard);
      return { state, success: true, mutatedState: true, onomatopoeia: 'SURGE!' };
    }

    return { state, success: true, mutatedState: false };
  }

  // 5. DISCARD SELF
  if (source === 'SELF') {
    const cardInst = context.sourceCardInstance;
    if (cardInst) {
      discardHostAttachmentsAndTuckedCards(state, cardInst, player.id);
      removeCardFromAllZones(state, cardInst.instanceId);
      if (isEncounterCard(cardInst.card)) {
        state.encounterDiscard.push(cardInst);
      } else {
        player.discard.push(cardInst);
      }
      return {
        state,
        success: true,
        mutatedState: true,
        discardedCards: [cardInst],
        onomatopoeia: `${cardInst.card.name.toUpperCase()} DISCARDED!`,
      };
    }
    return { state, success: true };
  }

  // 6. DISCARD FROM HOST (ATTACHMENT)
  if (source === 'HOST') {
    if (context.sourceCardInstance) {
      const vIdx = (state.villain.attachments || []).indexOf(context.sourceCardInstance);
      if (vIdx !== -1) {
        state.villain.attachments.splice(vIdx, 1);
        state.encounterDiscard.push(context.sourceCardInstance);
        return {
          state,
          success: true,
          mutatedState: true,
          onomatopoeia: 'ATTACHMENT DISCARDED!',
        };
      }
      for (const p of state.players) {
        const hIdx = (p.attachments || []).indexOf(context.sourceCardInstance);
        if (hIdx !== -1) {
          p.attachments?.splice(hIdx, 1);
          if (isEncounterCard(context.sourceCardInstance.card)) {
            state.encounterDiscard.push(context.sourceCardInstance);
          } else {
            p.discard.push(context.sourceCardInstance);
          }
          return {
            state,
            success: true,
            mutatedState: true,
            onomatopoeia: 'ATTACHMENT DISCARDED!',
          };
        }
      }
    }
    return { state, success: true };
  }

  // 7. DISCARD CARDS UNDER HOST
  if (source === 'CARDS_UNDER_HOST') {
    const targetHost = (step.params?.target as string) || 'VILLAIN';
    let cardsToDiscard: CardInstance[] = [];

    if (targetHost === 'VILLAIN') {
      cardsToDiscard = state.villain.cardsUnderneath || [];
      state.villain.cardsUnderneath = [];
    } else if (targetHost === 'MAIN_SCHEME') {
      cardsToDiscard = state.mainScheme.cardsUnderneath || [];
      state.mainScheme.cardsUnderneath = [];
    }

    for (const card of cardsToDiscard) {
      if (isEncounterCard(card.card)) {
        state.encounterDiscard.push(card);
      } else {
        const owner = state.players.find((p) => p.id === (card as any).ownerId) || player;
        owner.discard.push(card);
      }
    }

    return {
      state,
      success: true,
      mutatedState: cardsToDiscard.length > 0,
      onomatopoeia: 'CARDS DISCARDED FROM UNDER!',
    };
  }

  return { state, success: true };
}

/**
 * Executes a single declarative ability step primitive on the GameState.
 */
export function executeStep(
  state: GameState,
  step: AbilityStep,
  context: EffectExecutionContext,
): EffectResult {
  const player = state.players.find((p) => p.id === context.playerId);
  if (!player) return { state, success: false, error: 'Player not found' };

  switch (step.effect) {
    case 'DISCARD':
    case 'DISCARD_CARDS': {
      return executeDiscard(state, step, context);
    }
    case 'DRAW': {
      const rawCount = step.params?.count;
      const count = rawCount !== undefined ? resolveNumericAmount(rawCount, context, 1) : undefined;
      const limit = step.params?.limit as 'HAND_SIZE' | 'PRINTED_HAND_SIZE' | undefined;
      const targetParam = step.params?.target as string | undefined;
      const targetPlayerId =
        (step.params?.targetPlayerId as string) ||
        (step.params?.playerId as string) ||
        (context.targetInstanceId && state.players.some((p) => p.id === context.targetInstanceId)
          ? context.targetInstanceId
          : undefined);

      const getPlayerTargetLimit = (p: PlayerState): number | undefined => {
        if (!limit) return undefined;
        if (limit === 'PRINTED_HAND_SIZE') {
          const isHero = p.currentForm === 'hero';
          return isHero
            ? ((p.hero as any)?.handSize ?? p.activeFormCard.raw?.hand_size ?? 5)
            : ((p.alterEgo as any)?.handSize ?? p.activeFormCard.raw?.hand_size ?? 6);
        }
        // limit === 'HAND_SIZE'
        return getEffectiveHandSize(p, state);
      };

      // If a specific target player was designated (e.g. from decision prompt resolution)
      if (targetPlayerId) {
        const targetP = state.players.find((p) => p.id === targetPlayerId);
        if (targetP) {
          const targetLimit = getPlayerTargetLimit(targetP);
          let drawnForP = 0;
          while (
            (count === undefined || drawnForP < count) &&
            (targetLimit === undefined || targetP.hand.length < targetLimit)
          ) {
            const drawn = drawPlayerCard(state, targetP.id);
            if (!drawn) break;
            targetP.hand.push(drawn);
            drawnForP += 1;
          }
          state.log.push({
            id: `log_${Date.now()}_${targetP.id}`,
            timestamp: Date.now(),
            round: state.roundNumber,
            phase: state.phase,
            key: 'card.effect.drawCards',
            params: {
              player: targetP.name,
              count: drawnForP,
              handSize: targetP.hand.length,
              ...(targetLimit !== undefined ? { targetLimit } : {}),
            },
            onomatopoeia: `DRAW +${drawnForP}!`,
          });
          return {
            state,
            success: true,
            mutatedState: drawnForP > 0,
            value: drawnForP,
            onomatopoeia: `DRAW +${drawnForP}!`,
          };
        }
      }

      // If targeting CHOSEN_PLAYER in multiplayer mode, prompt the player to select the recipient
      if (targetParam === 'CHOSEN_PLAYER' && state.players.length > 1) {
        const effectiveCount = count ?? 1;
        const sourceCardName =
          context.sourceCardInstance?.card.name || player.activeFormCard?.name || 'Ability';
        const promptId = `prompt_${Date.now()}_choose_player`;
        state = enqueueDecisionPrompt(state, {
          promptId,
          playerId: player.id,
          title: 'Choose a Player',
          description: `Choose a player to draw ${effectiveCount} card${effectiveCount > 1 ? 's' : ''}:`,
          sourceCardName,
          options: state.players.map((p) => ({
            id: `draw_${p.id}`,
            label: `${p.name} (${p.hero?.name || 'Hero'})`,
            description: `Give ${effectiveCount} card draw to ${p.name} (Cards in hand: ${p.hand.length})`,
            effect: 'DRAW',
            params: {
              count: rawCount,
              limit,
              targetPlayerId: p.id,
            },
          })),
        });

        state.log.push({
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          round: state.roundNumber,
          phase: state.phase,
          category: 'ability',
          key: 'decision.prompt.opened',
          params: { player: player.name, promptId, source: sourceCardName },
          onomatopoeia: 'CHOOSE PLAYER!',
        });

        return {
          state,
          success: true,
          onomatopoeia: 'CHOOSE PLAYER!',
        };
      }

      const targetPlayers = targetParam === 'ALL_PLAYERS' ? state.players : [player];
      let totalDrawn = 0;

      for (const p of targetPlayers) {
        const targetLimit = getPlayerTargetLimit(p);
        let drawnForP = 0;
        const maxDraw = count !== undefined ? count : limit ? Infinity : 1;
        while (drawnForP < maxDraw && (targetLimit === undefined || p.hand.length < targetLimit)) {
          const drawn = drawPlayerCard(state, p.id);
          if (!drawn) break;
          p.hand.push(drawn);
          drawnForP += 1;
          totalDrawn += 1;
        }
        state.log.push({
          id: `log_${Date.now()}_${p.id}`,
          timestamp: Date.now(),
          round: state.roundNumber,
          phase: state.phase,
          key: 'card.effect.drawCards',
          params: {
            player: p.name,
            count: drawnForP,
            handSize: p.hand.length,
            ...(targetLimit !== undefined ? { targetLimit } : {}),
          },
          onomatopoeia: `DRAW +${drawnForP}!`,
        });
      }

      const onomatopoeia = `DRAW +${totalDrawn}!`;
      return {
        state,
        success: true,
        mutatedState: totalDrawn > 0,
        value: totalDrawn,
        onomatopoeia,
      };
    }

    case 'DEAL_DAMAGE': {
      let amount = resolveNumericAmount(step.params?.amount, context, 0, {
        state,
        player,
        sourceCardInstance: context.sourceCardInstance,
        targetInstanceId: (step.params?.targetInstanceId as string) || context.targetInstanceId,
      });
      if (step.params?.dynamicBonus) {
        const bonus = resolveNumericAmount(step.params.dynamicBonus as any, context, 0, {
          state,
          player,
          sourceCardInstance: context.sourceCardInstance,
          targetInstanceId: (step.params?.targetInstanceId as string) || context.targetInstanceId,
        });
        amount += bonus;
      }
      const targetParam = step.params?.target as string | undefined;

      if (targetParam === 'ALL_CHARACTERS') {
        // 1. Damage to Villain
        const villainToughIdx = state.villain.statusCards.indexOf(StatusCard.TOUGH);
        if (villainToughIdx !== -1) {
          state.villain.statusCards.splice(villainToughIdx, 1);
        } else {
          state.villain.health = Math.max(0, state.villain.health - amount);
          if (state.villain.health <= 0) {
            state = handleVillainDefeat(state, state.villain.instanceId);
          }
        }

        // 2. Damage to Minions
        for (const p of state.players) {
          for (let i = p.engagedMinions.length - 1; i >= 0; i--) {
            const minion = p.engagedMinions[i];
            const minionToughIdx = (minion.statusCards || []).indexOf(StatusCard.TOUGH);
            if (minionToughIdx !== -1) {
              minion.statusCards!.splice(minionToughIdx, 1);
            } else {
              const currentDmg = minion.tokens?.damage || 0;
              const newDmg = currentDmg + amount;
              const minionHp = (minion.card as MinionCard).health || 1;
              if (newDmg >= minionHp) {
                processHostDefeated(state, minion, { player: p });
                p.engagedMinions.splice(i, 1);
                moveDefeatedCardToPile(state, minion, state.encounterDiscard);
              } else {
                minion.tokens = { ...minion.tokens, damage: newDmg };
              }
            }
          }
        }

        // 3. Damage to Heroes
        for (const p of state.players) {
          const heroToughIdx = p.statusCards.indexOf(StatusCard.TOUGH);
          if (heroToughIdx !== -1) {
            p.statusCards.splice(heroToughIdx, 1);
          } else {
            p.health = Math.max(0, p.health - amount);
            if (p.health <= 0) state.winner = 'VILLAIN';
          }
        }

        // 4. Damage to Allies
        for (const p of state.players) {
          for (let i = p.allies.length - 1; i >= 0; i--) {
            const ally = p.allies[i];
            const allyToughIdx = (ally.statusCards || []).indexOf(StatusCard.TOUGH);
            if (allyToughIdx !== -1) {
              ally.statusCards!.splice(allyToughIdx, 1);
            } else {
              const currentDmg = ally.tokens?.damage || 0;
              const newDmg = currentDmg + amount;
              const allyHp = (ally.card as any).health || 1;
              if (newDmg >= allyHp) {
                p.allies.splice(i, 1);
                processHostDefeated(state, ally, { player: p });
                dispatchTrigger(state, 'CHARACTER_DEFEATED', {
                  targetPlayerId: p.id,
                  targetInstanceId: ally.instanceId,
                  targetType: 'ally',
                });
                const owner =
                  (ally.ownerId ? state.players.find((pl) => pl.id === ally.ownerId) : undefined) ||
                  p;
                owner.discard.push(ally);
              } else {
                ally.tokens = { ...ally.tokens, damage: newDmg };
              }
            }
          }
        }

        const onomatopoeia = `WHAM! ${amount} DAMAGE TO ALL CHARACTERS!`;
        state.log.push({
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          round: state.roundNumber,
          phase: state.phase,
          key: 'card.effect.dealDamage',
          params: { player: player.name, target: 'all_characters', amount },
          onomatopoeia,
        });

        return { state, success: true, mutatedState: amount > 0, value: amount, onomatopoeia };
      }

      if (targetParam === 'HEROES_AND_ALLIES') {
        if (context.assignments && typeof context.assignments === 'object') {
          for (const [id, dmg] of Object.entries(context.assignments as Record<string, number>)) {
            const ally = player.allies.find((a) => a.instanceId === id);
            if (ally) {
              const allyToughIdx = (ally.statusCards || []).indexOf(StatusCard.TOUGH);
              if (allyToughIdx !== -1) {
                ally.statusCards!.splice(allyToughIdx, 1);
              } else {
                const currentDmg = ally.tokens?.damage || 0;
                const newDmg = currentDmg + dmg;
                const allyHp = (ally.card as any).health || 1;
                if (newDmg >= allyHp) {
                  const idx = player.allies.indexOf(ally);
                  player.allies.splice(idx, 1);
                  processHostDefeated(state, ally, { player });
                  dispatchTrigger(state, 'CHARACTER_DEFEATED', {
                    targetPlayerId: player.id,
                    targetInstanceId: ally.instanceId,
                    targetType: 'ally',
                  });
                  const owner =
                    (ally.ownerId
                      ? state.players.find((pl) => pl.id === ally.ownerId)
                      : undefined) || player;
                  owner.discard.push(ally);
                } else {
                  ally.tokens = { ...ally.tokens, damage: newDmg };
                }
              }
            } else {
              const p = state.players.find((pl) => pl.id === id) || player;
              const toughIdx = p.statusCards.indexOf(StatusCard.TOUGH);
              if (toughIdx !== -1) {
                p.statusCards.splice(toughIdx, 1);
              } else {
                p.health = Math.max(0, p.health - dmg);
                if (p.health <= 0) state.winner = 'VILLAIN';
              }
            }
          }
        } else if (context.targetInstanceId) {
          const ally = player.allies.find((a) => a.instanceId === context.targetInstanceId);
          if (ally) {
            const allyToughIdx = (ally.statusCards || []).indexOf(StatusCard.TOUGH);
            if (allyToughIdx !== -1) {
              ally.statusCards!.splice(allyToughIdx, 1);
            } else {
              const currentDmg = ally.tokens?.damage || 0;
              const newDmg = currentDmg + amount;
              const allyHp = (ally.card as any).health || 1;
              if (newDmg >= allyHp) {
                const idx = player.allies.indexOf(ally);
                player.allies.splice(idx, 1);
                processHostDefeated(state, ally, { player });
                dispatchTrigger(state, 'CHARACTER_DEFEATED', {
                  targetPlayerId: player.id,
                  targetInstanceId: ally.instanceId,
                  targetType: 'ally',
                });
                const owner =
                  (ally.ownerId ? state.players.find((pl) => pl.id === ally.ownerId) : undefined) ||
                  player;
                owner.discard.push(ally);
              } else {
                ally.tokens = { ...ally.tokens, damage: newDmg };
              }
            }
          } else {
            const toughIdx = player.statusCards.indexOf(StatusCard.TOUGH);
            if (toughIdx !== -1) {
              player.statusCards.splice(toughIdx, 1);
            } else {
              player.health = Math.max(0, player.health - amount);
              if (player.health <= 0) state.winner = 'VILLAIN';
            }
          }
        } else {
          // Default: Hero takes the assigned damage
          const toughIdx = player.statusCards.indexOf(StatusCard.TOUGH);
          if (toughIdx !== -1) {
            player.statusCards.splice(toughIdx, 1);
          } else {
            player.health = Math.max(0, player.health - amount);
            if (player.health <= 0) state.winner = 'VILLAIN';
          }
        }

        const onomatopoeia = `EXPLOSION! ${amount} DAMAGE ASSIGNED!`;
        state.log.push({
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          round: state.roundNumber,
          phase: state.phase,
          key: 'card.effect.dealDamage',
          params: { player: player.name, target: 'heroes_and_allies', amount },
          onomatopoeia,
        });

        return {
          state,
          success: true,
          mutatedState: amount > 0,
          value: amount,
          onomatopoeia,
        };
      }

      if (targetParam === 'ALL_ENEMIES') {
        // Deal damage to villain
        const villainToughIdx = state.villain.statusCards.indexOf(StatusCard.TOUGH);
        if (villainToughIdx !== -1) {
          state.villain.statusCards.splice(villainToughIdx, 1);
        } else {
          state.villain.health = Math.max(0, state.villain.health - amount);
          if (state.villain.health <= 0) {
            state = handleVillainDefeat(state, state.villain.instanceId);
          }
        }

        // Deal damage to all minions across all players
        for (const p of state.players) {
          for (let i = p.engagedMinions.length - 1; i >= 0; i--) {
            const minion = p.engagedMinions[i];
            const minionToughIdx = (minion.statusCards || []).indexOf(StatusCard.TOUGH);
            if (minionToughIdx !== -1) {
              minion.statusCards!.splice(minionToughIdx, 1);
            } else {
              const currentDmg = minion.tokens?.damage || 0;
              const newDmg = currentDmg + amount;
              const minionHp = (minion.card as MinionCard).health || 1;
              if (newDmg >= minionHp) {
                processHostDefeated(state, minion, { player: p });
                p.engagedMinions.splice(i, 1);
                moveDefeatedCardToPile(state, minion, state.encounterDiscard);
              } else {
                minion.tokens = { ...minion.tokens, damage: newDmg };
              }
            }
          }
        }

        const onomatopoeia = `BOOM! ${amount} DAMAGE TO ALL ENEMIES!`;
        state.log.push({
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          round: state.roundNumber,
          phase: state.phase,
          key: 'card.effect.dealDamage',
          params: { player: player.name, target: 'all_enemies', amount },
          onomatopoeia,
        });

        return { state, success: true, onomatopoeia };
      }

      const targetType =
        targetParam === 'ALL_HEROES' ||
        targetParam === 'HERO' ||
        targetParam === 'SELF_IDENTITY' ||
        targetParam === 'IDENTITY' ||
        targetParam === 'SELF'
          ? 'hero'
          : context.targetType || 'villain';

      if (targetParam === 'SELF_IDENTITY' || targetParam === 'IDENTITY' || targetParam === 'SELF') {
        const toughIdx = player.statusCards.indexOf(StatusCard.TOUGH);
        if (toughIdx !== -1) {
          player.statusCards.splice(toughIdx, 1);
          state.log.push({
            id: `log_${Date.now()}`,
            timestamp: Date.now(),
            round: state.roundNumber,
            phase: state.phase,
            key: 'card.effect.dealDamage',
            params: {
              player: player.name,
              target: 'hero',
              amount: 0,
              toughAbsorbed: true,
            },
            onomatopoeia: 'CLANG! (TOUGH)',
          });
        } else {
          const prevResult = dispatchTrigger(state, 'DAMAGE_TAKEN', {
            targetPlayerId: player.id,
            targetType: 'player',
            damageAmount: amount,
            triggerChain: context.triggerChain,
          });
          const finalDmg = prevResult.damageAmount ?? amount;
          player.health = Math.max(0, player.health - finalDmg);
          if (player.health <= 0) state.winner = 'VILLAIN';
          state.log.push({
            id: `log_${Date.now()}`,
            timestamp: Date.now(),
            round: state.roundNumber,
            phase: state.phase,
            key: 'card.effect.dealDamage',
            params: {
              player: player.name,
              target: 'hero',
              amount: finalDmg,
              remainingHealth: player.health,
            },
            onomatopoeia: `OUCH! ${finalDmg} DAMAGE!`,
          });
        }
        return {
          state,
          success: true,
          mutatedState: amount > 0,
          value: amount,
          onomatopoeia: `OUCH! ${amount} DAMAGE!`,
        };
      }

      if (targetParam === 'ALL_HEROES' || (targetType === 'hero' && !context.targetInstanceId)) {
        for (const p of state.players) {
          const toughIdx = p.statusCards.indexOf(StatusCard.TOUGH);
          if (toughIdx !== -1) {
            p.statusCards.splice(toughIdx, 1);
            state.log.push({
              id: `log_${Date.now()}`,
              timestamp: Date.now(),
              round: state.roundNumber,
              phase: state.phase,
              key: 'card.effect.dealDamage',
              params: {
                player: p.name,
                target: 'hero',
                amount: 0,
                toughAbsorbed: true,
              },
              onomatopoeia: 'CLANG! (TOUGH)',
            });
          } else {
            const prevResult = dispatchTrigger(state, 'DAMAGE_TAKEN', {
              targetPlayerId: p.id,
              targetType: 'player',
              damageAmount: amount,
              triggerChain: context.triggerChain,
            });
            const finalDmg = prevResult.damageAmount ?? amount;
            p.health = Math.max(0, p.health - finalDmg);
            if (p.health <= 0) state.winner = 'VILLAIN';
            state.log.push({
              id: `log_${Date.now()}`,
              timestamp: Date.now(),
              round: state.roundNumber,
              phase: state.phase,
              key: 'card.effect.dealDamage',
              params: {
                player: p.name,
                target: 'hero',
                amount: finalDmg,
                remainingHealth: p.health,
              },
              onomatopoeia: `OUCH! ${finalDmg} DAMAGE!`,
            });
          }
        }
        return {
          state,
          success: true,
          onomatopoeia: `SHOCK! ${amount} DAMAGE TO HEROES!`,
        };
      }

      // 1. If targetInstanceId is specified, check engaged minions first
      const targetMinionId =
        step.params?.target === 'TRIGGERING_MINION' || step.params?.target === 'TRIGGERING_ENEMY'
          ? context.targetInstanceId || (step.params?.targetInstanceId as string)
          : (step.params?.targetInstanceId as string) || context.targetInstanceId;

      if (targetMinionId) {
        for (const p of state.players) {
          const minionIdx = p.engagedMinions.findIndex((m) => m.instanceId === targetMinionId);
          if (minionIdx !== -1) {
            const minion = p.engagedMinions[minionIdx];
            const toughIdx = (minion.statusCards || []).indexOf(StatusCard.TOUGH);
            if (toughIdx !== -1) {
              minion.statusCards!.splice(toughIdx, 1);
              const onomatopoeia = 'CLANG!';
              state.log.push({
                id: `log_${Date.now()}`,
                timestamp: Date.now(),
                round: state.roundNumber,
                phase: state.phase,
                key: 'card.effect.dealDamage',
                params: {
                  player: player.name,
                  target: minion.card.name,
                  amount: 0,
                  toughAbsorbed: true,
                },
                onomatopoeia,
              });
              return { state, success: true, onomatopoeia };
            }

            const currentDmg = minion.tokens?.damage || 0;
            const newDmg = currentDmg + amount;
            const minionHp = (minion.card as MinionCard).health || 1;

            if (newDmg >= minionHp) {
              const excessDmg = newDmg - minionHp;
              processHostDefeated(state, minion, { player: p });
              p.engagedMinions.splice(minionIdx, 1);
              moveDefeatedCardToPile(state, minion, state.encounterDiscard);

              // Overkill routing to villain if attack has Overkill
              const isOverkill = Boolean(
                step.params?.overkill ||
                step.params?.keyword === 'Overkill' ||
                (context.sourceCardInstance?.card as any)?.keywords?.includes('Overkill') ||
                (context.sourceCardInstance?.card.raw as any)?.keywords?.includes('Overkill'),
              );

              if (isOverkill && excessDmg > 0) {
                state.villain.health = Math.max(0, state.villain.health - excessDmg);
                state.log.push({
                  id: `log_${Date.now()}`,
                  timestamp: Date.now(),
                  round: state.roundNumber,
                  phase: state.phase,
                  category: 'combat',
                  key: 'overkill.villain.hit',
                  params: {
                    damage: excessDmg,
                    villain: state.villain.card.name,
                  },
                  onomatopoeia: `OVERKILL! ${excessDmg} DAMAGE TO VILLAIN!`,
                });
              }

              const onomatopoeia = 'SMASH! MINION DEFEATED!';
              state.log.push({
                id: `log_${Date.now()}`,
                timestamp: Date.now(),
                round: state.roundNumber,
                phase: state.phase,
                key: 'card.effect.dealDamage',
                params: {
                  player: player.name,
                  target: minion.card.name,
                  amount,
                  defeated: true,
                },
                onomatopoeia,
              });

              let conditionMet: boolean | undefined;
              let resValue: number = amount;
              if (step.condition === 'EXCESS_DAMAGE_DEALT') {
                conditionMet = excessDmg > 0;
                resValue = excessDmg;
              } else if (step.condition === 'TARGET_DEFEATED') {
                conditionMet = true;
              }

              return {
                state,
                success: true,
                mutatedState: true,
                value: resValue,
                conditionMet,
                onomatopoeia,
              };
            } else {
              minion.tokens = { ...minion.tokens, damage: newDmg };

              // Retaliate check if minion survives (RR v1.8 p. 24, ADR-0054)
              const retaliateX = getEffectiveRetaliate(minion, state);
              if (retaliateX > 0) {
                player.health = Math.max(0, player.health - retaliateX);
                state.log.push({
                  id: `log_${Date.now()}`,
                  timestamp: Date.now(),
                  round: state.roundNumber,
                  phase: state.phase,
                  category: 'combat',
                  key: 'retaliate.hit',
                  params: {
                    damage: retaliateX,
                    source: minion.card.name,
                    player: player.name,
                  },
                  onomatopoeia: 'RETALIATE!',
                });
              }

              const onomatopoeia = 'WHAM!';
              state.log.push({
                id: `log_${Date.now()}`,
                timestamp: Date.now(),
                round: state.roundNumber,
                phase: state.phase,
                key: 'card.effect.dealDamage',
                params: {
                  player: player.name,
                  target: minion.card.name,
                  amount,
                  remainingHealth: minionHp - newDmg,
                },
                onomatopoeia,
              });

              let conditionMet: boolean | undefined;
              let resValue: number = amount;
              if (step.condition === 'EXCESS_DAMAGE_DEALT') {
                conditionMet = false;
                resValue = 0;
              } else if (step.condition === 'TARGET_DEFEATED') {
                conditionMet = false;
              }

              return {
                state,
                success: true,
                mutatedState: true,
                value: resValue,
                conditionMet,
                onomatopoeia,
              };
            }
          }
        }
      }

      // 2. Default: Deal damage to Villain
      const toughIndex = state.villain.statusCards.indexOf(StatusCard.TOUGH);
      if (toughIndex !== -1) {
        state.villain.statusCards.splice(toughIndex, 1);
        const onomatopoeia = 'CLANG! (TOUGH)';
        state.log.push({
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          round: state.roundNumber,
          phase: state.phase,
          key: 'card.effect.dealDamage',
          params: {
            player: player.name,
            target: 'villain',
            amount: 0,
            toughAbsorbed: true,
          },
          onomatopoeia,
        });
        return { state, success: true, onomatopoeia };
      }

      // Check damage shield on villain (e.g. Armored Rhino Suit 01098)
      const armorIdx = (state.villain.attachments || []).findIndex((att) => {
        const abs = att.card.enrichment?.abilities || [];
        return abs.some((a) => a.steps?.some((s) => s.effect === 'ATTACHMENT_DAMAGE_SHIELD'));
      });
      if (armorIdx !== -1) {
        const armor = state.villain.attachments.splice(armorIdx, 1)[0];
        state.encounterDiscard.push(armor);
        const onomatopoeia = 'ARMORED SUIT ABSORBS DAMAGE!';
        state.log.push({
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          round: state.roundNumber,
          phase: state.phase,
          category: 'combat',
          key: 'attachment.damageShield.absorbed',
          params: {
            villain: state.villain.card.name,
            attachment: armor.card.name,
            damage: amount,
          },
          onomatopoeia,
        });
        return { state, success: true, onomatopoeia };
      }

      state.villain.health = Math.max(0, state.villain.health - amount);
      if (state.villain.health <= 0) {
        const defeatedState = handleVillainDefeat(state, state.villain.instanceId);
        return {
          state: defeatedState,
          success: true,
          onomatopoeia: `KAPOW! ${amount} DAMAGE!`,
        };
      }

      const onomatopoeia = `KAPOW! ${amount} DAMAGE!`;
      state.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        key: 'card.effect.dealDamage',
        params: {
          player: player.name,
          target: 'villain',
          amount,
          remainingHealth: state.villain.health,
        },
        onomatopoeia,
      });

      // Retaliate check if villain survives an attack (RR v1.8 p. 24, ADR-0054)
      const isAttack = Boolean(step.params?.isAttack || context.isAttack);
      if (isAttack && state.villain.health > 0) {
        const villainRetaliate = getEffectiveRetaliate(state.villain, state);
        if (villainRetaliate > 0) {
          player.health = Math.max(0, player.health - villainRetaliate);
          state.log.push({
            id: `log_${Date.now()}`,
            timestamp: Date.now(),
            round: state.roundNumber,
            phase: state.phase,
            category: 'combat',
            key: 'retaliate.hit',
            params: {
              damage: villainRetaliate,
              source: state.villain.card.name,
              player: player.name,
            },
            onomatopoeia: 'RETALIATE!',
          });
        }
      }

      return {
        state,
        success: true,
        onomatopoeia,
      };
    }

    case 'HEAL_DAMAGE': {
      const amount = resolveNumericAmount(step.params?.amount, context, 0, { state, player });
      const target = (step.params?.target as string) || 'SELF';
      let healed = 0;

      if (target === 'VILLAIN') {
        const currentHp = state.villain.health;
        const maxHp = state.villain.maxHealth || 100;
        healed = Math.min(maxHp - currentHp, amount);
        state.villain.health += healed;
      } else {
        healed = Math.min(player.maxHealth - player.health, amount);
        player.health += healed;
      }

      const onomatopoeia = `HEAL +${healed} HP!`;
      state.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        key: 'card.effect.heal',
        params: {
          player: player.name,
          target,
          amount: healed,
          health: target === 'VILLAIN' ? state.villain.health : player.health,
        },
        onomatopoeia,
      });

      const isFullyHealed =
        target === 'VILLAIN'
          ? state.villain.health >= (state.villain.maxHealth || 100)
          : player.health >= player.maxHealth;

      const conditionMet = step.condition === 'FULLY_HEALED' ? isFullyHealed : undefined;

      return {
        state,
        success: true,
        mutatedState: healed > 0,
        value: healed,
        conditionMet,
        onomatopoeia,
      };
    }

    case 'PREVENT_DAMAGE': {
      const currentVal =
        context.remainingInterceptedValue ??
        context.interceptedValue ??
        context.threatAmount ??
        context.damageAmount ??
        0;

      const hasInterceptContext =
        context.remainingInterceptedValue !== undefined ||
        context.interceptedValue !== undefined ||
        context.threatAmount !== undefined ||
        context.damageAmount !== undefined;

      const amountToPrevent =
        step.params?.amount !== undefined
          ? step.params.amount === 'ALL' || step.params.preventAll
            ? currentVal
            : resolveNumericAmount(step.params.amount, context, currentVal)
          : hasInterceptContext
            ? currentVal
            : step.params?.preventAll
              ? 999
              : 3;

      const consumed = hasInterceptContext
        ? Math.min(currentVal, amountToPrevent)
        : amountToPrevent;
      const remaining = hasInterceptContext ? Math.max(0, currentVal - consumed) : 0;

      if (hasInterceptContext) {
        context.remainingInterceptedValue = remaining;
        if (context.threatAmount !== undefined) {
          context.threatAmount = remaining;
        }
        if (context.damageAmount !== undefined) {
          context.damageAmount = remaining;
        }
      }

      const onomatopoeia =
        context.threatAmount !== undefined ? 'EVENT INTERCEPTED!' : `PREVENTED ${consumed} DAMAGE!`;

      state.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        category: 'ability',
        key:
          context.threatAmount !== undefined
            ? 'card.effect.consumeInterceptedEvent'
            : 'combat.damage.prevented',
        params: {
          player: player.name,
          amount: consumed,
          consumed,
          remaining,
        },
        onomatopoeia,
      });

      return {
        state,
        success: true,
        mutatedState: consumed > 0,
        value: consumed,
        onomatopoeia,
      };
    }

    case 'GENERATE_RESOURCE': {
      const resourceType = (step.params?.resource as string) || 'wild';
      const amount = (step.params?.amount as number) || 1;

      return {
        state,
        success: true,
        onomatopoeia: `+${amount} [${resourceType}] RESOURCE!`,
      };
    }

    case 'REMOVE_THREAT': {
      let amount = resolveNumericAmount(step.params?.amount, context, 1, { state, player });
      if (step.params?.dynamicBonus) {
        const bonus = resolveNumericAmount(step.params.dynamicBonus as any, context, 0, {
          state,
          player,
          sourceCardInstance: context.sourceCardInstance,
          targetInstanceId: (step.params?.targetInstanceId as string) || context.targetInstanceId,
        });
        amount += bonus;
      }
      const targetParam = (step.params?.target as string) || 'MAIN_SCHEME';
      let removed = 0;
      let targetSchemeName = state.mainScheme.card.name;
      let remainingThreat = state.mainScheme.threat;

      if (targetParam === 'CHOSEN_SCHEME') {
        const sideSchemes = state.sideSchemes || [];
        const explicitTargetId =
          (step.params?.targetInstanceId as string) || context.targetInstanceId;

        if (explicitTargetId) {
          if (
            explicitTargetId === 'main_scheme' ||
            explicitTargetId === state.mainScheme.instanceId
          ) {
            removed = Math.min(state.mainScheme.threat, amount);
            state.mainScheme.threat = Math.max(0, state.mainScheme.threat - amount);
            targetSchemeName = state.mainScheme.card.name;
            remainingThreat = state.mainScheme.threat;
          } else {
            const sideScheme = sideSchemes.find((s) => s.instanceId === explicitTargetId);
            if (sideScheme) {
              const current = sideScheme.threat || 0;
              removed = Math.min(current, amount);
              sideScheme.threat = Math.max(0, current - amount);
              targetSchemeName = sideScheme.card.name;
              remainingThreat = sideScheme.threat;
            } else {
              removed = Math.min(state.mainScheme.threat, amount);
              state.mainScheme.threat = Math.max(0, state.mainScheme.threat - amount);
              targetSchemeName = state.mainScheme.card.name;
              remainingThreat = state.mainScheme.threat;
            }
          }
        } else if (sideSchemes.length > 0) {
          // Multiple schemes in play -> enqueue interactive decision prompt
          const options: DecisionPromptOption[] = [
            {
              id: 'main_scheme',
              label: `${state.mainScheme.card.name} (${state.mainScheme.threat} Threat)`,
              description: `Remove ${amount} threat from ${state.mainScheme.card.name}`,
              effect: 'REMOVE_THREAT',
              params: { amount, target: 'MAIN_SCHEME' },
            },
            ...sideSchemes.map((s) => ({
              id: s.instanceId,
              label: `${s.card.name} (${s.threat || 0} Threat)`,
              description: `Remove ${amount} threat from ${s.card.name}`,
              effect: 'REMOVE_THREAT',
              params: { amount, target: 'SIDE_SCHEME', targetInstanceId: s.instanceId },
            })),
          ];

          enqueueDecisionPrompt(state, {
            promptId: `choose_scheme_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            playerId: player.id,
            title: 'Choose a Scheme',
            description: `Select a scheme to remove ${amount} threat from:`,
            sourceCardName: context.sourceCardInstance?.card.name || 'Spider-Tracer',
            options,
          });

          return {
            state,
            success: true,
            mutatedState: true,
            onomatopoeia: 'CHOOSE SCHEME!',
          };
        } else {
          // Only main scheme in play -> remove directly
          removed = Math.min(state.mainScheme.threat, amount);
          state.mainScheme.threat = Math.max(0, state.mainScheme.threat - amount);
          targetSchemeName = state.mainScheme.card.name;
          remainingThreat = state.mainScheme.threat;
        }
      } else if (targetParam === 'MAIN_SCHEME') {
        removed = Math.min(state.mainScheme.threat, amount);
        state.mainScheme.threat = Math.max(0, state.mainScheme.threat - amount);
        targetSchemeName = state.mainScheme.card.name;
        remainingThreat = state.mainScheme.threat;
      } else if (targetParam === 'SIDE_SCHEME' || context.targetInstanceId) {
        const targetId = (step.params?.targetInstanceId as string) || context.targetInstanceId;
        const sideScheme = (state.sideSchemes || []).find((s) => s.instanceId === targetId);
        if (sideScheme) {
          const current = sideScheme.threat || 0;
          removed = Math.min(current, amount);
          sideScheme.threat = Math.max(0, current - amount);
          targetSchemeName = sideScheme.card.name;
          remainingThreat = sideScheme.threat;
        } else {
          removed = Math.min(state.mainScheme.threat, amount);
          state.mainScheme.threat = Math.max(0, state.mainScheme.threat - amount);
          targetSchemeName = state.mainScheme.card.name;
          remainingThreat = state.mainScheme.threat;
        }
      } else {
        removed = Math.min(state.mainScheme.threat, amount);
        state.mainScheme.threat = Math.max(0, state.mainScheme.threat - amount);
        targetSchemeName = state.mainScheme.card.name;
        remainingThreat = state.mainScheme.threat;
      }

      const onomatopoeia = `-${removed} THREAT!`;
      state.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        key: 'card.effect.removeThreat',
        params: {
          player: player.name,
          amount: removed,
          scheme: targetSchemeName,
          remainingThreat,
        },
        onomatopoeia,
      });

      if (removed > 0 && remainingThreat === 0) {
        dispatchTrigger(state, 'SCHEME_DEFEATED', {
          targetPlayerId: player.id,
          sourceInstanceId: context.targetInstanceId || state.mainScheme.instanceId,
          entityType: 'SCHEME',
          threatAmount: removed,
        });
      }

      const conditionMet = step.condition === 'SCHEME_EMPTY' ? remainingThreat === 0 : undefined;

      return {
        state,
        success: true,
        mutatedState: removed > 0,
        value: removed,
        conditionMet,
        onomatopoeia,
      };
    }

    case 'ADD_STATUS': {
      let status: StatusCard = StatusCard.STUNNED;
      const statusParam = step.params?.status;
      if (statusParam === 'TOUGH' || statusParam === StatusCard.TOUGH) status = StatusCard.TOUGH;
      if (statusParam === 'CONFUSED' || statusParam === StatusCard.CONFUSED)
        status = StatusCard.CONFUSED;
      if (statusParam === 'STUNNED' || statusParam === StatusCard.STUNNED)
        status = StatusCard.STUNNED;

      const target = (step.params?.target as string) || 'VILLAIN';
      let mutatedState = false;
      let alreadyHadStatus = false;
      let isImmune = false;

      // Helper to apply status to a target entity considering Stalwart and Steady
      const applyStatusToEntity = (entity: any) => {
        if (!entity) return;
        if (!entity.statusCards) entity.statusCards = [];

        // Stalwart check (RR v1.8 p. 28)
        if (
          (status === StatusCard.STUNNED || status === StatusCard.CONFUSED) &&
          hasEntityKeyword(entity, 'Stalwart')
        ) {
          isImmune = true;
          return;
        }

        // Steady check (RR v1.8 p. 28)
        const isSteady = hasEntityKeyword(entity, 'Steady');
        const maxLimit =
          isSteady && (status === StatusCard.STUNNED || status === StatusCard.CONFUSED) ? 2 : 1;
        const currentCount = entity.statusCards.filter((s: StatusCard) => s === status).length;

        if (currentCount < maxLimit) {
          entity.statusCards.push(status);
          mutatedState = true;
        } else {
          alreadyHadStatus = true;
        }
      };

      if (
        target === 'VILLAIN' ||
        target === 'CHOSEN_ENEMY' ||
        target === 'ATTACK_TARGET' ||
        target === 'ATTACKED_ENEMY' ||
        target === 'TARGET_ENEMY' ||
        target === 'MINION' ||
        target === 'PREVIOUS_TARGET'
      ) {
        if ((target === 'MINION' || context.targetType === 'minion') && context.targetInstanceId) {
          for (const p of state.players) {
            const minion = p.engagedMinions.find((m) => m.instanceId === context.targetInstanceId);
            if (minion) {
              applyStatusToEntity(minion);
              break;
            }
          }
        } else {
          applyStatusToEntity(state.villain);
        }
      } else if (
        target === 'HERO' ||
        target === 'ALL_HEROES' ||
        target === 'DEFENDING_CHARACTER' ||
        target === 'DEFENDING_PLAYER' ||
        target === 'PLAYER' ||
        target === 'ACTIVE_PLAYER' ||
        target === 'ACTIVE_IDENTITY' ||
        target === 'IDENTITY'
      ) {
        const targetPlayer = state.players.find((p) => p.id === context.playerId) || player;
        applyStatusToEntity(targetPlayer);
      }

      const onomatopoeia = isImmune
        ? 'IMMUNE! (STALWART)'
        : mutatedState
          ? `${status} APPLIED!`
          : `${status} ALREADY APPLIED!`;

      state.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        key: 'card.effect.addStatus',
        params: {
          status,
          target,
          mutatedState,
          alreadyHadStatus,
          isImmune,
        },
        onomatopoeia,
      });

      let conditionMet: boolean = alreadyHadStatus;
      if (step.condition === 'STATUS_APPLIED') {
        conditionMet = mutatedState;
      } else if (step.condition === 'ALREADY_HAS_STATUS') {
        conditionMet = alreadyHadStatus;
      }

      return {
        state,
        success: true,
        mutatedState,
        value: mutatedState ? 1 : 0,
        conditionMet,
        onomatopoeia,
      };
    }

    case 'REMOVE_STATUS': {
      const requestedStatus = String(step.params?.status || 'ALL');
      const normalizedStatus =
        requestedStatus === 'STUNNED'
          ? StatusCard.STUNNED
          : requestedStatus === 'CONFUSED'
            ? StatusCard.CONFUSED
            : requestedStatus === 'TOUGH'
              ? StatusCard.TOUGH
              : requestedStatus;
      const statuses =
        normalizedStatus === 'ALL'
          ? [StatusCard.STUNNED, StatusCard.CONFUSED, StatusCard.TOUGH]
          : [normalizedStatus as StatusCard];
      const target = String(step.params?.target || 'VILLAIN');
      const targetPlayer =
        state.players.find((candidate) => candidate.id === context.targetPlayerId) || player;
      const targets: any[] = [];

      const addTargetByInstanceId = (instanceId: string | undefined) => {
        if (!instanceId) return;
        const candidates: any[] = [
          state.villain,
          state.mainScheme,
          ...state.sideSchemes,
          ...state.players,
          ...state.players.flatMap((candidate) => [
            ...candidate.allies,
            ...candidate.engagedMinions,
            ...candidate.tableau,
          ]),
        ];
        const match = candidates.find((candidate) => candidate?.instanceId === instanceId);
        if (match) targets.push(match);
      };

      if (target === 'VILLAIN' || target === 'TRIGGERING_ENEMY') {
        targets.push(state.villain);
      } else if (target === 'CHOSEN_ENEMY' || target === 'CHOSEN_CHARACTER') {
        addTargetByInstanceId(context.targetInstanceId);
      } else if (target === 'CHOSEN_CONTROLLED_ALLY') {
        const ally = targetPlayer.allies.find((candidate) =>
          context.targetInstanceId ? candidate.instanceId === context.targetInstanceId : true,
        );
        if (ally) targets.push(ally);
      } else if (target === 'ALL_CONTROLLED_ALLIES') {
        targets.push(...targetPlayer.allies);
      } else if (target === 'CHOSEN_CONTROLLED_CHARACTER') {
        addTargetByInstanceId(context.targetInstanceId);
        if (targets.length === 0) targets.push(targetPlayer);
      } else if (target === 'ALL_CONTROLLED_CHARACTERS') {
        targets.push(targetPlayer, ...targetPlayer.allies);
      } else if (target === 'CHOSEN_FRIENDLY_CHARACTER') {
        addTargetByInstanceId(context.targetInstanceId);
      } else if (target === 'ALL_FRIENDLY_CHARACTERS') {
        for (const candidate of state.players) {
          targets.push(candidate, ...candidate.allies);
        }
      } else if (target === 'CHOSEN_SIDE_SCHEME' || target === 'TRIGGERING_SCHEME') {
        const scheme = state.sideSchemes.find(
          (candidate) => candidate.instanceId === context.targetInstanceId,
        );
        if (scheme) targets.push(scheme);
      } else if (target === 'ALL_SCHEMES') {
        targets.push(state.mainScheme, ...state.sideSchemes);
      } else if (target === 'ACTIVE_PLAYER' || target === 'SELF_IDENTITY' || target === 'HERO') {
        targets.push(targetPlayer);
      } else if (context.targetInstanceId) {
        addTargetByInstanceId(context.targetInstanceId);
      }

      let removedCount = 0;
      for (const entity of targets) {
        if (!Array.isArray(entity?.statusCards)) continue;
        const removedStatuses = statuses.filter((status) => entity.statusCards.includes(status));
        const before = entity.statusCards.length;
        entity.statusCards = entity.statusCards.filter(
          (status: StatusCard) => !statuses.includes(status),
        );
        if (removedStatuses.length > 0) {
          removedCount += before - entity.statusCards.length;
          for (const status of removedStatuses) {
            dispatchTrigger(state, 'STATUS_REMOVED', {
              targetPlayerId: targetPlayer.id,
              targetInstanceId: entity.instanceId,
              status,
            });
          }
        }
      }

      return {
        state,
        success: true,
        mutatedState: removedCount > 0,
        value: removedCount,
        conditionMet: step.condition === 'STATUS_APPLIED' ? removedCount > 0 : undefined,
        onomatopoeia: removedCount > 0 ? 'STATUS REMOVED!' : 'NO STATUS TO REMOVE',
      };
    }

    case 'HEAL_DAMAGE_WITH_SURGE': {
      // Hard to Keep Down (01104): Rhino heals 4 HP. If 0 healed -> surge
      const amount = (step.params?.amount as number) || 4;
      const healed = Math.min(state.villain.maxHealth - state.villain.health, amount);
      if (healed > 0) {
        state.villain.health += healed;
        return {
          state,
          success: true,
          onomatopoeia: `RHINO HEALED +${healed} HP!`,
        };
      } else {
        // Surge -> deal 1 extra encounter card
        const surgeCard = state.encounterDeck.shift();
        if (surgeCard) player.dealtEncounterCards.push(surgeCard);
        return { state, success: true, onomatopoeia: 'SURGE!' };
      }
    }

    case 'ADD_STATUS_WITH_SURGE': {
      // "I'm Tough" (01105): Give Rhino Tough. If already Tough -> surge
      if (!state.villain.statusCards.includes(StatusCard.TOUGH)) {
        state.villain.statusCards.push(StatusCard.TOUGH);
        return { state, success: true, onomatopoeia: 'RHINO GAINS TOUGH!' };
      } else {
        const surgeCard = state.encounterDeck.shift();
        if (surgeCard) player.dealtEncounterCards.push(surgeCard);
        return { state, success: true, onomatopoeia: 'SURGE!' };
      }
    }

    case 'ATTACH_TO_HOST': {
      const targetHost = step.params?.target as string;
      const sourceCard = context.sourceCardInstance;
      if (!sourceCard) return { state, success: true };

      (sourceCard as any).ownerId = context.playerId;

      attachCardToHost(
        state,
        sourceCard,
        targetHost,
        context.targetInstanceId || context.targetPlayerId || context.playerId,
      );
      return {
        state,
        success: true,
        mutatedState: true,
        onomatopoeia: 'ATTACHED TO HOST!',
      };
    }

    case 'PLACE_CARD_UNDER_HOST': {
      const targetHost = (step.params?.target as string) || 'SELF';
      const sourceCard = context.sourceCardInstance;
      if (!sourceCard) return { state, success: true };

      if (targetHost === 'VILLAIN' || targetHost === 'ENEMY') {
        if (!state.villain.cardsUnderneath) state.villain.cardsUnderneath = [];
        state.villain.cardsUnderneath.push(sourceCard);
        return {
          state,
          success: true,
          mutatedState: true,
          onomatopoeia: 'PLACED UNDER VILLAIN!',
        };
      } else if (targetHost === 'MAIN_SCHEME' || targetHost === 'SCHEME') {
        if (!state.mainScheme.cardsUnderneath) state.mainScheme.cardsUnderneath = [];
        state.mainScheme.cardsUnderneath.push(sourceCard);
        return {
          state,
          success: true,
          mutatedState: true,
          onomatopoeia: 'PLACED UNDER SCHEME!',
        };
      } else if (targetHost === 'HERO' || targetHost === 'IDENTITY' || targetHost === 'PLAYER') {
        const targetP =
          state.players.find((p) => p.id === (context.targetPlayerId || context.playerId)) ||
          player;
        if (!targetP.cardsUnderneath) targetP.cardsUnderneath = [];
        targetP.cardsUnderneath.push(sourceCard);
        return {
          state,
          success: true,
          mutatedState: true,
          onomatopoeia: 'PLACED UNDER IDENTITY!',
        };
      }
      return { state, success: true, onomatopoeia: 'PLACED UNDER CARD!' };
    }

    case 'MODIFY_STAT': {
      if (
        step.params?.target === 'ALL_FRIENDLY_CHARACTERS' ||
        step.params?.atkBonus !== undefined ||
        step.params?.thwBonus !== undefined
      ) {
        const atkBonus =
          (step.params?.atkBonus as number) ||
          (step.params?.stat === 'ATK' ? (step.params?.amount as number) : 0) ||
          0;
        const thwBonus =
          (step.params?.thwBonus as number) ||
          (step.params?.stat === 'THW' ? (step.params?.amount as number) : 0) ||
          0;
        for (const a of player.allies) {
          if (!a.tokens) a.tokens = { damage: 0, threat: 0, counters: 0 };
          (a.tokens as any).atkBonus = ((a.tokens as any).atkBonus || 0) + atkBonus;
          (a.tokens as any).thwBonus = ((a.tokens as any).thwBonus || 0) + thwBonus;
        }
        return {
          state,
          success: true,
          mutatedState: true,
          onomatopoeia: `+${atkBonus} ATK / +${thwBonus} THW TO ALL CHARACTERS!`,
        };
      }
      // These are declarative constant/trigger primitives evaluated dynamically by stat-calculator and combat pipelines
      return { state, success: true };
    }

    case 'GRANT_KEYWORD':
    case 'ATTACHMENT_DAMAGE_SHIELD':
    case 'INTERCEPT_ATTACK':
    case 'WHEN_ATTACHED_HOST_DEFEATED': {
      // These are declarative constant/trigger primitives evaluated dynamically by stat-calculator and combat pipelines
      return { state, success: true };
    }

    case 'READY': {
      const targetParam = (step.params?.target as string) || 'SELF_IDENTITY';
      let readyTargetName = player.name;

      if (targetParam === 'SELF') {
        const sourceId = context.sourceCardId || context.sourceCardInstance?.instanceId;
        const tableauCard = player.tableau.find(
          (c) => c.instanceId === sourceId || c.card.code === sourceId,
        );
        const allyCard = player.allies.find(
          (a) => a.instanceId === sourceId || a.card.code === sourceId,
        );
        if (tableauCard) {
          tableauCard.exhausted = false;
          readyTargetName = tableauCard.card?.name || 'Tableau Card';
        } else if (allyCard) {
          allyCard.exhausted = false;
          readyTargetName = allyCard.card?.name || 'Ally';
        } else {
          player.exhausted = false;
          readyTargetName = player.activeFormCard?.name || player.name;
        }
      } else if (
        targetParam === 'CHOSEN_ALLY' ||
        targetParam === 'ALLY' ||
        context.targetType === 'ally'
      ) {
        const ally =
          (context.targetInstanceId
            ? player.allies.find((a) => a.instanceId === context.targetInstanceId)
            : undefined) ||
          player.allies.find((a) => a.exhausted) ||
          player.allies[0];
        if (ally) {
          ally.exhausted = false;
          readyTargetName = ally.card?.name || 'Ally';
        }
      } else if (targetParam === 'ALL_ALLIES') {
        for (const ally of player.allies) {
          ally.exhausted = false;
        }
        readyTargetName = 'All Allies';
      } else if (targetParam === 'ALL_CHARACTERS') {
        player.exhausted = false;
        for (const ally of player.allies) {
          ally.exhausted = false;
        }
        readyTargetName = 'All Characters';
      } else if (targetParam === 'CHOSEN_CHARACTER') {
        if (context.targetInstanceId) {
          const ally = player.allies.find((a) => a.instanceId === context.targetInstanceId);
          if (ally) {
            ally.exhausted = false;
            readyTargetName = ally.card?.name || 'Ally';
          } else {
            player.exhausted = false;
            readyTargetName = player.activeFormCard?.name || player.name;
          }
        } else if (context.targetType === 'identity') {
          player.exhausted = false;
          readyTargetName = player.activeFormCard?.name || player.name;
        } else if (player.exhausted) {
          player.exhausted = false;
          readyTargetName = player.activeFormCard?.name || player.name;
        } else {
          const exhaustedAlly = player.allies.find((a) => a.exhausted);
          if (exhaustedAlly) {
            exhaustedAlly.exhausted = false;
            readyTargetName = exhaustedAlly.card?.name || 'Ally';
          } else {
            player.exhausted = false;
          }
        }
      } else if (targetParam === 'VILLAIN') {
        if (state.villain) {
          state.villain.exhausted = false;
          readyTargetName = state.villain.card?.name || 'Villain';
        }
      } else if (targetParam === 'CHOSEN_MINION') {
        const minion =
          (context.targetInstanceId
            ? player.engagedMinions.find((m) => m.instanceId === context.targetInstanceId)
            : undefined) ||
          player.engagedMinions.find((m) => m.exhausted) ||
          player.engagedMinions[0];
        if (minion) {
          minion.exhausted = false;
          readyTargetName = minion.card?.name || 'Minion';
        }
      } else if (targetParam === 'ALL_MINIONS') {
        for (const p of state.players) {
          for (const m of p.engagedMinions) {
            m.exhausted = false;
          }
        }
        readyTargetName = 'All Minions';
      } else {
        // SELF_IDENTITY, ACTIVE_PLAYER, or default
        player.exhausted = false;
        readyTargetName = player.activeFormCard?.name || player.name;
      }

      state.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        category: 'ability',
        key: 'card.effect.readyCharacter',
        params: { player: player.name, target: readyTargetName },
        onomatopoeia: 'READY!',
      });
      return {
        state,
        success: true,
        mutatedState: true,
        onomatopoeia: 'READY!',
      };
    }

    case 'CANCEL_TREACHERY_AND_VILLAIN_ATTACKS':
    case 'CANCEL_WHEN_REVEALED_AND_ATTACK': {
      executeVillainAttackAgainstPlayer(state, player);
      state.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        category: 'ability',
        key: 'card.effect.getBehindMe',
        params: { player: player.name },
        onomatopoeia: 'GET BEHIND ME! (VILLAIN ATTACKS)',
      });
      return {
        state,
        success: true,
        onomatopoeia: 'GET BEHIND ME! VILLAIN ATTACKS!',
      };
    }

    case 'EXHAUST': {
      const targetParam = (step.params?.target as string) || 'SELF_IDENTITY';
      let exhaustTargetName = player.name;

      if (targetParam === 'SELF') {
        const sourceId = context.sourceCardId || context.sourceCardInstance?.instanceId;
        const tableauCard = player.tableau.find(
          (c) => c.instanceId === sourceId || c.card.code === sourceId,
        );
        const allyCard = player.allies.find(
          (a) => a.instanceId === sourceId || a.card.code === sourceId,
        );
        if (tableauCard) {
          tableauCard.exhausted = true;
          exhaustTargetName = tableauCard.card?.name || 'Tableau Card';
        } else if (allyCard) {
          allyCard.exhausted = true;
          exhaustTargetName = allyCard.card?.name || 'Ally';
        } else {
          player.exhausted = true;
          exhaustTargetName = player.activeFormCard?.name || player.name;
        }
      } else if (
        targetParam === 'CHOSEN_ALLY' ||
        targetParam === 'ALLY' ||
        context.targetType === 'ally'
      ) {
        const ally =
          (context.targetInstanceId
            ? player.allies.find((a) => a.instanceId === context.targetInstanceId)
            : undefined) ||
          player.allies.find((a) => !a.exhausted) ||
          player.allies[0];
        if (ally) {
          ally.exhausted = true;
          exhaustTargetName = ally.card?.name || 'Ally';
        }
      } else if (targetParam === 'ALL_ALLIES') {
        for (const ally of player.allies) {
          ally.exhausted = true;
        }
        exhaustTargetName = 'All Allies';
      } else if (targetParam === 'ALL_CHARACTERS') {
        player.exhausted = true;
        for (const ally of player.allies) {
          ally.exhausted = true;
        }
        exhaustTargetName = 'All Characters';
      } else if (targetParam === 'CHOSEN_CHARACTER') {
        if (context.targetInstanceId) {
          const ally = player.allies.find((a) => a.instanceId === context.targetInstanceId);
          if (ally) {
            ally.exhausted = true;
            exhaustTargetName = ally.card?.name || 'Ally';
          } else {
            player.exhausted = true;
            exhaustTargetName = player.activeFormCard?.name || player.name;
          }
        } else if (context.targetType === 'identity') {
          player.exhausted = true;
          exhaustTargetName = player.activeFormCard?.name || player.name;
        } else if (!player.exhausted) {
          player.exhausted = true;
          exhaustTargetName = player.activeFormCard?.name || player.name;
        } else {
          const readyAlly = player.allies.find((a) => !a.exhausted);
          if (readyAlly) {
            readyAlly.exhausted = true;
            exhaustTargetName = readyAlly.card?.name || 'Ally';
          } else {
            player.exhausted = true;
          }
        }
      } else if (targetParam === 'VILLAIN') {
        if (state.villain) {
          state.villain.exhausted = true;
          exhaustTargetName = state.villain.card?.name || 'Villain';
        }
      } else if (targetParam === 'CHOSEN_MINION') {
        const minion =
          (context.targetInstanceId
            ? player.engagedMinions.find((m) => m.instanceId === context.targetInstanceId)
            : undefined) ||
          player.engagedMinions.find((m) => !m.exhausted) ||
          player.engagedMinions[0];
        if (minion) {
          minion.exhausted = true;
          exhaustTargetName = minion.card?.name || 'Minion';
        }
      } else if (targetParam === 'ALL_MINIONS') {
        for (const p of state.players) {
          for (const m of p.engagedMinions) {
            m.exhausted = true;
          }
        }
        exhaustTargetName = 'All Minions';
      } else {
        // SELF_IDENTITY, ACTIVE_PLAYER, or default
        player.exhausted = true;
        exhaustTargetName = player.activeFormCard?.name || player.name;
      }

      state.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        category: 'status',
        key: 'card.state.exhausted',
        params: { card: exhaustTargetName, player: player.name },
        onomatopoeia: 'EXHAUST',
      });
      return {
        state,
        success: true,
        mutatedState: true,
        onomatopoeia: 'EXHAUSTED!',
      };
    }

    case 'GIVE_ADDITIONAL_BOOST_CARD':
    case 'DEAL_ADDITIONAL_BOOST_CARD': {
      if (state.activeAttackContext) {
        const extraCard = drawEncounterCard(state);
        if (extraCard) {
          state.activeAttackContext.boostQueue.push(extraCard);
          state.log.push({
            id: `log_${Date.now()}`,
            timestamp: Date.now(),
            round: state.roundNumber,
            phase: state.phase,
            category: 'combat',
            key: 'villain.boost.added',
            params: { card: extraCard.card.name },
            onomatopoeia: 'CHAIN BOOST ADDED!',
          });
        }
      }
      return { state, success: true, onomatopoeia: 'CHAIN BOOST ADDED!' };
    }

    case 'PUT_INTO_PLAY_ENGAGED':
    case 'SPAWN_MINION_ENGAGED': {
      const minionInst = context.sourceCardInstance;
      if (minionInst) {
        if (state.activeAttackContext) {
          (state.activeAttackContext as any).skipBoostDiscard = true;
        }
        player.engagedMinions.push(minionInst);
        state.log.push({
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          round: state.roundNumber,
          phase: state.phase,
          category: 'combat',
          key: 'minion.entered.play',
          params: { minion: minionInst.card.name, player: player.name },
          onomatopoeia: 'MINION ENTERS THE FRAY!',
        });
        dispatchTrigger(state, 'MINION_ENTERS_PLAY', {
          targetPlayerId: player.id,
          sourceInstanceId: minionInst.instanceId,
          targetInstanceId: minionInst.instanceId,
          encounterCardInstance: minionInst,
        });
      }
      return { state, success: true, onomatopoeia: 'MINION ENGAGED!' };
    }

    case 'PLAYER_CHOICE': {
      if (context.choice || step.params?.stat) {
        const amount = (step.params?.amount as number) || 2;
        const chosenStat = (context.choice as string) || (step.params?.stat as string) || 'ATK';
        if (context.sourceCardInstance) {
          if (!context.sourceCardInstance.tokens) {
            context.sourceCardInstance.tokens = {
              damage: 0,
              threat: 0,
              counters: 0,
            };
          }
          if (chosenStat === 'THW' || chosenStat === 'THWART') {
            (context.sourceCardInstance.tokens as any).thwBonus =
              ((context.sourceCardInstance.tokens as any).thwBonus || 0) + amount;
          } else {
            (context.sourceCardInstance.tokens as any).atkBonus =
              ((context.sourceCardInstance.tokens as any).atkBonus || 0) + amount;
          }
        }
        return {
          state,
          success: true,
          mutatedState: true,
          value: amount,
          onomatopoeia: `+${amount} ${chosenStat}!`,
        };
      }

      let options = (step.params?.options as any[]) || [];
      if (options.length > 0 && typeof options[0] === 'string') {
        const amt = (step.params?.amount as number) || 2;
        options = options.map((opt: string) => ({
          id: opt,
          label: `+${amt} ${opt}`,
          description: `Boost ${opt} by ${amt}`,
          effect: 'PLAYER_CHOICE',
          params: { stat: opt, amount: amt },
        }));
      }
      const title =
        (step.params?.title as string) ||
        (step.params?.promptTitle as string) ||
        'Choose an Option';
      const description = (step.params?.description as string) || '';
      const sourceCardName = context.sourceCardInstance?.card.name || step.id || 'Card Ability';
      const promptId = `prompt_${Date.now()}_${step.id || 'choice'}`;
      state = enqueueDecisionPrompt(state, {
        promptId,
        playerId: context.playerId || player.id,
        title,
        description,
        sourceCardName,
        options,
        isVoluntary: (step.params?.isVoluntary as boolean) ?? false,
      });

      state.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        category: 'ability',
        key: 'decision.prompt.opened',
        params: { player: player.name, promptId, source: sourceCardName },
        onomatopoeia: 'CHOICE REQUIRED!',
      });

      return { state, success: true, onomatopoeia: 'CHOOSE AN OPTION!' };
    }

    case 'DECLARE_DEFENDER': {
      const defenderType =
        (step.params?.defenderType as 'HERO' | 'ALLY' | 'UNDEFENDED') || 'UNDEFENDED';
      const allyInstanceId = step.params?.allyInstanceId as string | undefined;
      const playerId = context.playerId || (step.params?.playerId as string) || player.id;
      const resState = resolveDefenderDeclaration(state, {
        type: defenderType,
        playerId,
        allyInstanceId,
      });
      return {
        state: resState,
        success: true,
        onomatopoeia: 'DEFENSE RESOLVED!',
      };
    }

    case 'VILLAIN_SCHEMES': {
      executeVillainSchemeAgainstPlayer(state, player);
      return { state, success: true, onomatopoeia: 'VILLAIN SCHEMES!' };
    }

    case 'VILLAIN_ATTACKS': {
      if (player.currentForm === 'alter_ego') {
        const surgeCard = state.encounterDeck.shift();
        if (surgeCard) player.dealtEncounterCards.push(surgeCard);
        return { state, success: true, onomatopoeia: 'SURGE!' };
      } else {
        executeVillainAttackAgainstPlayer(state, player);
        return { state, success: true, onomatopoeia: 'VILLAIN ATTACKS!' };
      }
    }

    case 'VILLAIN_AND_ENGAGED_MINIONS_ATTACK': {
      if (player.currentForm === 'alter_ego') {
        const surgeCard = state.encounterDeck.shift();
        if (surgeCard) player.dealtEncounterCards.push(surgeCard);
        return { state, success: true, onomatopoeia: 'SURGE!' };
      } else {
        const activations: {
          type: 'VILLAIN' | 'MINION';
          playerId: string;
          minionInstanceId?: string;
        }[] = [
          { type: 'VILLAIN', playerId: player.id },
          ...player.engagedMinions.map((m) => ({
            type: 'MINION' as const,
            playerId: player.id,
            minionInstanceId: m.instanceId,
          })),
        ];
        (state as any).pendingActivations = [
          ...((state as any).pendingActivations || []),
          ...activations,
        ];

        if ((state as any).pendingActivations.length > 0) {
          const act = (state as any).pendingActivations.shift()!;
          if (act.type === 'VILLAIN') {
            executeVillainAttackAgainstPlayer(state, player);
          } else {
            const minion = player.engagedMinions.find((m) => m.instanceId === act.minionInstanceId);
            if (minion) executeMinionAttackAgainstPlayer(state, minion, player);
          }
        }
        return { state, success: true, onomatopoeia: 'GANG UP!' };
      }
    }

    case 'FORM_BRANCH': {
      const branchSteps =
        player.currentForm === 'hero' ? step.params?.heroSteps : step.params?.alterEgoSteps;
      if (!Array.isArray(branchSteps) || branchSteps.length === 0) {
        return { state, success: true, mutatedState: false, onomatopoeia: 'FORM BRANCH EMPTY' };
      }
      return executeSequence(state, branchSteps as AbilityStep[], context);
    }

    case 'HERO_FORM_BRANCH': {
      const bombScare = state.sideSchemes.find(
        (s) => s.card.code === '01109' || (s.card.name || '').includes('Bomb Scare'),
      );
      if (bombScare) {
        const damage = bombScare.threat || 1;
        player.health = Math.max(0, player.health - damage);
        if (player.health <= 0) state.winner = 'VILLAIN';
        return { state, success: true, onomatopoeia: 'EXPLOSION!' };
      } else {
        const surgeCard = state.encounterDeck.shift();
        if (surgeCard) player.dealtEncounterCards.push(surgeCard);
        return { state, success: true, onomatopoeia: 'SURGE!' };
      }
    }

    case 'REVEAL_ENCOUNTER_CARD_WITH_SURGE': {
      // 1. Surge: deal 1 card facedown to player
      const surgeCard = state.encounterDeck.shift();
      if (surgeCard) player.dealtEncounterCards.push(surgeCard);

      // 2. Extra card drawn to be revealed immediately
      const extraCard = state.encounterDeck.shift();
      if (extraCard) player.dealtEncounterCards.unshift(extraCard);

      return { state, success: true, onomatopoeia: 'UNDER FIRE!' };
    }

    case 'PUT_INTO_PLAY': {
      const fromZone = (step.params?.from as string) || 'SET_ASIDE';
      const toZone = (step.params?.to as string) || 'ENGAGED_WITH_PLAYER';
      const filter = (step.params?.filter || step.filter) as Record<string, any> | undefined;

      let sourceList: CardInstance[] = [];
      if (fromZone === 'SET_ASIDE') {
        sourceList = player.setAsideCards || [];
      } else if (fromZone === 'DISCARD') {
        sourceList = player.discard || [];
      } else if (fromZone === 'DECK') {
        sourceList = player.deck || [];
      } else if (fromZone === 'HAND') {
        sourceList = player.hand || [];
      }

      const matches =
        step.params?.target === 'SELF' && context.sourceCardInstance
          ? [context.sourceCardInstance]
          : sourceList.filter((c) => matchesCardFilter(c.card, filter, { player, state }));

      if (matches.length === 0) {
        return {
          state,
          success: true,
          mutatedState: false,
          value: 0,
          selectedCardInstanceIds: [],
          onomatopoeia: 'NO MATCHES FOUND',
        };
      }

      const matchIds = new Set(matches.map((m) => m.instanceId));
      if (fromZone === 'SET_ASIDE') {
        player.setAsideCards = player.setAsideCards.filter((c) => !matchIds.has(c.instanceId));
      } else if (fromZone === 'DISCARD') {
        player.discard = player.discard.filter((c) => !matchIds.has(c.instanceId));
      } else if (fromZone === 'DECK') {
        player.deck = player.deck.filter((c) => !matchIds.has(c.instanceId));
      } else if (fromZone === 'HAND') {
        player.hand = player.hand.filter((c) => !matchIds.has(c.instanceId));
      }

      for (const cardInst of matches) {
        // Initialize counters for cards with 'uses' keyword (RR v1.8 p. 30)
        initializeCardUses(cardInst);

        if (toZone === 'SIDE_SCHEMES' || cardInst.card.type === CardType.SIDE_SCHEME) {
          const sideCard = cardInst.card as SideSchemeCard;
          const baseThreat =
            sideCard.baseThreat * (sideCard.baseThreatFixed ? 1 : state.players.length);
          state.sideSchemes.push({
            instanceId: cardInst.instanceId,
            card: sideCard,
            threat: baseThreat,
          });

          const schemeAbilities = sideCard.enrichment?.abilities || [];
          for (const ab of schemeAbilities) {
            if (ab.trigger === 'WHEN_REVEALED' || ab.timing === 'FORCED_RESPONSE') {
              executeEffect(state, ab, {
                playerId: player.id,
                sourceCardInstance: cardInst,
              });
            }
          }
        } else if (
          toZone === 'TABLEAU' ||
          [CardType.ALLY, CardType.SUPPORT, CardType.UPGRADE].includes(cardInst.card.type)
        ) {
          player.tableau.push(cardInst);
        } else if (toZone === 'ENGAGED_WITH_PLAYER' || cardInst.card.type === CardType.MINION) {
          const hasToughness = hasKeyword(cardInst.card, Keyword.TOUGH);
          if (hasToughness) {
            if (!cardInst.statusCards) cardInst.statusCards = [];
            if (!cardInst.statusCards.includes(StatusCard.TOUGH)) {
              cardInst.statusCards.push(StatusCard.TOUGH);
            }
          }

          player.engagedMinions.push(cardInst as MinionCard & CardInstance);

          const hasQuickstrike = hasKeyword(cardInst.card, Keyword.QUICKSTRIKE);
          if (hasQuickstrike && player.currentForm === 'hero') {
            executeMinionAttackAgainstPlayer(state, cardInst as MinionCard & CardInstance, player);
          }

          const abilities = cardInst.card.enrichment?.abilities || [];
          for (const ab of abilities) {
            if (ab.trigger === 'WHEN_REVEALED' || ab.timing === 'FORCED_RESPONSE') {
              executeEffect(state, ab, {
                playerId: player.id,
                sourceCardInstance: cardInst,
              });
            }
          }

          dispatchTrigger(state, 'MINION_ENTERS_PLAY', {
            targetPlayerId: player.id,
            sourceInstanceId: cardInst.instanceId,
            targetInstanceId: cardInst.instanceId,
            encounterCardInstance: cardInst,
          });
        }
      }

      const cardNames = matches.map((m) => m.card.name).join(', ');
      const onomatopoeia = `ENTERS PLAY! ${cardNames.toUpperCase()}`;
      state.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        category: 'ability',
        key: 'card.putIntoPlay',
        params: {
          player: player.name,
          cards: cardNames,
          destination: toZone,
        },
        onomatopoeia,
      });

      return {
        state,
        success: true,
        mutatedState: true,
        value: matches.length,
        selectedCardInstanceIds: Array.from(matchIds),
        onomatopoeia,
      };
    }

    case 'SHUFFLE_INTO_DECK': {
      const fromZone =
        (step.params?.from as string) ||
        (step.params?.count !== undefined ? 'DISCARD' : 'SET_ASIDE');
      const toDeck =
        (step.params?.toDeck as string) ||
        (step.params?.count !== undefined ? 'PLAYER_DECK' : 'ENCOUNTER_DECK');
      const filter = (step.params?.filter || step.filter) as Record<string, any> | undefined;
      const count = step.params?.count as number | undefined;
      let sourceList: CardInstance[] = [];
      if (fromZone === 'SET_ASIDE') {
        sourceList = player.setAsideCards || [];
      } else if (fromZone === 'DISCARD') {
        sourceList = player.discard || [];
      } else if (fromZone === 'HAND') {
        sourceList = player.hand || [];
      }

      let matches = filter
        ? sourceList.filter((c) => matchesCardFilter(c.card, filter, { player, state }))
        : [...sourceList];

      if (count !== undefined && matches.length > count) {
        matches = matches.slice(0, count);
      }

      if (matches.length === 0) {
        return {
          state,
          success: true,
          mutatedState: false,
          value: 0,
          selectedCardInstanceIds: [],
          onomatopoeia: 'NO CARDS TO SHUFFLE',
        };
      }

      const matchIds = new Set(matches.map((m) => m.instanceId));
      if (fromZone === 'SET_ASIDE') {
        player.setAsideCards = player.setAsideCards.filter((c) => !matchIds.has(c.instanceId));
      } else if (fromZone === 'DISCARD') {
        player.discard = player.discard.filter((c) => !matchIds.has(c.instanceId));
      } else if (fromZone === 'HAND') {
        player.hand = player.hand.filter((c) => !matchIds.has(c.instanceId));
      }

      if (toDeck === 'ENCOUNTER_DECK') {
        state.encounterDeck.push(...matches);
        state.encounterDeck.sort(() => Math.random() - 0.5);
      } else if (toDeck === 'PLAYER_DECK') {
        player.deck.push(...matches);
        player.deck.sort(() => Math.random() - 0.5);
      }

      const onomatopoeia = `SHUFFLE ${matches.length} CARDS!`;
      state.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        category: 'ability',
        key: 'deck.shuffled',
        params: {
          player: player.name,
          count: matches.length,
          destination: toDeck,
        },
        onomatopoeia,
      });

      return {
        state,
        success: true,
        mutatedState: true,
        value: matches.length,
        selectedCardInstanceIds: Array.from(matchIds),
        onomatopoeia,
      };
    }

    case 'SPAWN_NEMESIS': {
      return executeSequence(
        state,
        [
          {
            id: 'step_1_spawn_nemesis_minion',
            effect: 'PUT_INTO_PLAY',
            params: {
              from: 'SET_ASIDE',
              to: 'ENGAGED_WITH_PLAYER',
              filter: { type: 'minion', set: 'PLAYER_NEMESIS' },
            },
          },
          {
            id: 'step_2_spawn_nemesis_scheme',
            effect: 'PUT_INTO_PLAY',
            params: {
              from: 'SET_ASIDE',
              to: 'SIDE_SCHEMES',
              filter: { type: 'side_scheme', set: 'PLAYER_NEMESIS' },
            },
          },
          {
            id: 'step_3_shuffle_remaining_cards',
            effect: 'SHUFFLE_INTO_DECK',
            params: {
              from: 'SET_ASIDE',
              toDeck: 'ENCOUNTER_DECK',
              filter: { set: 'PLAYER_NEMESIS' },
            },
          },
          {
            id: 'step_4_fallback_surge',
            effect: 'SURGE',
            gate: 'IF_FAILED',
          },
        ],
        context,
      );
    }

    case 'FLIP_FORM':
    case 'CHANGE_FORM': {
      const nextFormCard = player.availableForms.find((f) => f.code !== player.activeFormCard.code);
      if (nextFormCard) {
        player.activeFormCard = nextFormCard;
        player.currentForm = nextFormCard.type === CardType.HERO ? 'hero' : 'alter_ego';
      }
      const onomatopoeia = 'FLIP FORM!';
      state.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        key: 'card.effect.flipForm',
        params: { player: player.name, form: player.activeFormCard.name },
        onomatopoeia,
      });
      return {
        state,
        success: true,
        mutatedState: true,
        value: 1,
        onomatopoeia,
      };
    }

    case 'SURGE': {
      const surgeCard = drawEncounterCard(state);
      if (surgeCard) {
        player.dealtEncounterCards.push(surgeCard);
      }
      const onomatopoeia = 'SURGE!';
      state.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        key: 'encounter.surge.triggered',
        params: {
          card: context.sourceCardInstance?.card.name || 'Encounter',
          player: player.name,
        },
        onomatopoeia,
      });
      return {
        state,
        success: true,
        mutatedState: true,
        value: 1,
        onomatopoeia,
      };
    }

    case 'REVEAL_ENCOUNTER_CARD': {
      const extraCard = drawEncounterCard(state);
      if (extraCard) {
        player.dealtEncounterCards.push(extraCard);
      }
      const onomatopoeia = 'REVEAL ENCOUNTER CARD!';
      state.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        key: 'encounter.card.revealed',
        params: { player: player.name },
        onomatopoeia,
      });
      return {
        state,
        success: true,
        mutatedState: true,
        value: 1,
        onomatopoeia,
      };
    }

    case 'ADD_THREAT': {
      const baseAmount = resolveNumericAmount(
        step.params?.amount ?? step.params?.amountPerPlayer,
        context,
        1,
        { state, player },
      );
      const isPerPlayer = !!(step.params?.perPlayer || step.params?.amountPerPlayer);
      const amount = isPerPlayer ? baseAmount * state.players.length : baseAmount;
      const target = (step.params?.target as string) || 'MAIN_SCHEME';

      if (target === 'ALL_SIDE_SCHEMES') {
        if (state.sideSchemes.length > 0) {
          for (const s of state.sideSchemes) {
            s.threat = (s.threat || 0) + amount;
          }
          return {
            state,
            success: true,
            mutatedState: amount > 0,
            value: amount,
            onomatopoeia: `+${amount} THREAT TO SIDE SCHEMES!`,
          };
        } else {
          // Discard until a side scheme is found, then reveal it
          let foundSideScheme: CardInstance | undefined;
          while (state.encounterDeck.length > 0) {
            const card = state.encounterDeck.shift()!;
            if (card.card.type === CardType.SIDE_SCHEME) {
              foundSideScheme = card;
              break;
            }
            state.encounterDiscard.push(card);
          }
          if (foundSideScheme) {
            const sideCard = foundSideScheme.card as SideSchemeCard;
            const baseThreat =
              sideCard.baseThreat * (sideCard.baseThreatFixed ? 1 : state.players.length);
            state.sideSchemes.push({
              instanceId: foundSideScheme.instanceId,
              card: sideCard,
              threat: baseThreat,
            });
            return {
              state,
              success: true,
              mutatedState: true,
              onomatopoeia: 'SIDE SCHEME REVEALED!',
            };
          }
          return { state, success: true, onomatopoeia: 'NO SIDE SCHEMES FOUND' };
        }
      }
      const cardCode =
        (step.params?.cardCode as string) ||
        (target !== 'MAIN_SCHEME' && target !== 'THIS_SIDE_SCHEME' && /^\d{5}$/.test(target)
          ? target
          : undefined);
      const targetInstanceId =
        (step.params?.targetInstanceId as string) ||
        (target.startsWith('scheme_') || target.startsWith('side_') ? target : undefined) ||
        context.targetInstanceId;

      if (cardCode) {
        const sideScheme = (state.sideSchemes || []).find((s) => s.card?.code === cardCode);
        if (sideScheme) {
          sideScheme.threat = (sideScheme.threat || 0) + amount;
          const onomatopoeia = `SCHEME THREAT +${amount}!`;
          state.log.push({
            id: `log_${Date.now()}`,
            timestamp: Date.now(),
            round: state.roundNumber,
            phase: state.phase,
            key: 'scheme.threat.added',
            params: {
              target: sideScheme.card?.name || 'Side Scheme',
              cardCode,
              amount,
              total: sideScheme.threat,
            },
            onomatopoeia,
          });
          return {
            state,
            success: true,
            mutatedState: amount > 0,
            value: amount,
            onomatopoeia,
          };
        }

        if (state.mainScheme?.card?.code === cardCode) {
          state.mainScheme.threat = (state.mainScheme.threat || 0) + amount;
          const onomatopoeia = `SCHEME THREAT +${amount}!`;
          state.log.push({
            id: `log_${Date.now()}`,
            timestamp: Date.now(),
            round: state.roundNumber,
            phase: state.phase,
            key: 'scheme.threat.added',
            params: {
              target: state.mainScheme.card?.name || 'Main Scheme',
              cardCode,
              amount,
              total: state.mainScheme.threat,
            },
            onomatopoeia,
          });
          return {
            state,
            success: true,
            mutatedState: amount > 0,
            value: amount,
            onomatopoeia,
          };
        }

        // Targeted scheme is not in play: effect fizzles per RR v1.8 p. 29
        state.log.push({
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          round: state.roundNumber,
          phase: state.phase,
          key: 'scheme.threat.target_missing',
          params: { cardCode, amount },
        });
        return {
          state,
          success: true,
          mutatedState: false,
          value: 0,
        };
      }

      if (targetInstanceId) {
        const sideScheme = (state.sideSchemes || []).find((s) => s.instanceId === targetInstanceId);
        if (sideScheme) {
          sideScheme.threat = (sideScheme.threat || 0) + amount;
          const onomatopoeia = `SCHEME THREAT +${amount}!`;
          state.log.push({
            id: `log_${Date.now()}`,
            timestamp: Date.now(),
            round: state.roundNumber,
            phase: state.phase,
            key: 'scheme.threat.added',
            params: {
              target: sideScheme.card.name,
              instanceId: targetInstanceId,
              amount,
              total: sideScheme.threat,
            },
            onomatopoeia,
          });
          return {
            state,
            success: true,
            mutatedState: amount > 0,
            value: amount,
            onomatopoeia,
          };
        }

        if (
          state.mainScheme &&
          (state.mainScheme.instanceId === targetInstanceId || targetInstanceId === 'main_scheme')
        ) {
          state.mainScheme.threat = (state.mainScheme.threat || 0) + amount;
          const onomatopoeia = `SCHEME THREAT +${amount}!`;
          state.log.push({
            id: `log_${Date.now()}`,
            timestamp: Date.now(),
            round: state.roundNumber,
            phase: state.phase,
            key: 'scheme.threat.added',
            params: {
              target: state.mainScheme.card.name,
              instanceId: targetInstanceId,
              amount,
              total: state.mainScheme.threat,
            },
            onomatopoeia,
          });
          return {
            state,
            success: true,
            mutatedState: amount > 0,
            value: amount,
            onomatopoeia,
          };
        }
      }

      if ((target === 'THIS_SIDE_SCHEME' || target === 'SELF') && context.sourceCardInstance) {
        const sideScheme = (state.sideSchemes || []).find(
          (s) =>
            s.instanceId === context.sourceCardInstance!.instanceId ||
            s.card.code === context.sourceCardInstance!.card.code,
        );
        if (sideScheme) {
          sideScheme.threat = (sideScheme.threat || 0) + amount;
          const onomatopoeia = `SCHEME THREAT +${amount}!`;
          state.log.push({
            id: `log_${Date.now()}`,
            timestamp: Date.now(),
            round: state.roundNumber,
            phase: state.phase,
            key: 'scheme.threat.added',
            params: { target: sideScheme.card.name, amount, total: sideScheme.threat },
            onomatopoeia,
          });
          return {
            state,
            success: true,
            mutatedState: amount > 0,
            value: amount,
            onomatopoeia,
          };
        }
      }

      state.mainScheme.threat = (state.mainScheme.threat || 0) + amount;
      const onomatopoeia = `SCHEME THREAT +${amount}!`;
      state.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        key: 'scheme.threat.added',
        params: { target, amount, total: state.mainScheme.threat },
        onomatopoeia,
      });
      return {
        state,
        success: true,
        mutatedState: amount > 0,
        value: amount,
        onomatopoeia,
      };
    }

    case 'CANCEL_WHEN_REVEALED': {
      const onomatopoeia = 'CANCELLED!';
      state.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        key: 'encounter.whenRevealed.cancelled',
        params: { player: player.name },
        onomatopoeia,
      });
      return {
        state,
        success: true,
        mutatedState: true,
        value: 1,
        onomatopoeia,
      };
    }

    case 'ADD_COUNTERS':
    case 'MODIFY_COUNTER': {
      const targetParam = (step.params?.target as string) || 'SELF';
      const counterType = (step.params?.counterType as string) || 'all_purpose';
      let amount = (step.params?.amount as number) || 1;
      if (typeof amount !== 'number') amount = 1;

      if (targetParam === 'IDENTITY') {
        player.counters = player.counters || {};
        player.counters[counterType] = (player.counters[counterType] || 0) + amount;
      } else if (context.sourceCardInstance) {
        context.sourceCardInstance.counters = context.sourceCardInstance.counters || {};
        context.sourceCardInstance.counters[counterType] =
          (context.sourceCardInstance.counters[counterType] || 0) + amount;
        if (!context.sourceCardInstance.tokens) {
          context.sourceCardInstance.tokens = {
            damage: 0,
            threat: 0,
            counters: 0,
          };
        }
        context.sourceCardInstance.tokens.counters =
          (context.sourceCardInstance.tokens.counters || 0) + amount;
      }
      return {
        state,
        success: true,
        mutatedState: true,
        value: amount,
        onomatopoeia: `+${amount} ${counterType.toUpperCase()} COUNTERS!`,
      };
    }

    case 'SPEND_COUNTERS':
    case 'REMOVE_COUNTERS': {
      const targetParam = (step.params?.target as string) || 'SELF';
      const counterType = (step.params?.counterType as string) || 'all_purpose';
      let amount = (step.params?.amount as number) || 1;
      if (typeof amount !== 'number') amount = 1;

      if (targetParam === 'IDENTITY') {
        player.counters = player.counters || {};
        const current = player.counters[counterType] || 0;
        player.counters[counterType] = Math.max(0, current - amount);
      } else if (context.sourceCardInstance) {
        context.sourceCardInstance.counters = context.sourceCardInstance.counters || {};
        const current =
          context.sourceCardInstance.counters[counterType] ??
          context.sourceCardInstance.tokens?.counters ??
          0;
        context.sourceCardInstance.counters[counterType] = Math.max(0, current - amount);
        if (context.sourceCardInstance.tokens) {
          context.sourceCardInstance.tokens.counters = Math.max(
            0,
            (context.sourceCardInstance.tokens.counters || 0) - amount,
          );
        }

        // Check and discard if Uses counters reached 0 per RR v1.8 p. 30
        checkAndDiscardZeroCounterCard(state, player, context.sourceCardInstance, counterType);
      }
      return {
        state,
        success: true,
        mutatedState: true,
        value: amount,
        onomatopoeia: `-${amount} ${counterType.toUpperCase()} COUNTERS!`,
      };
    }

    case 'REMOVE_COUNTERS_MATCHING_FILTER': {
      const targetZone = (step.params?.targetZone as string) || 'TABLEAU';
      const traitFilter = step.params?.traitFilter as string | undefined;
      const counterType = step.params?.counterType as string | undefined;
      const amountParam = step.params?.amount;

      let targetCards: CardInstance[] = [];
      if (targetZone === 'TABLEAU' || targetZone === 'ALL_CONTROLLED') {
        targetCards = [...player.tableau, ...player.allies];
      }

      if (traitFilter) {
        targetCards = targetCards.filter((c) =>
          (c.card.traits || []).some(
            (t) => t.toLowerCase().trim() === traitFilter.toLowerCase().trim(),
          ),
        );
      }

      let totalRemoved = 0;
      for (const cardInst of targetCards) {
        if (cardInst.counters) {
          for (const [k, count] of Object.entries(cardInst.counters)) {
            if (
              !counterType ||
              counterType === 'ALL' ||
              counterType.toLowerCase() === k.toLowerCase()
            ) {
              if (amountParam === 'ALL') {
                totalRemoved += count;
                cardInst.counters[k] = 0;
              } else if (typeof amountParam === 'number') {
                const toRemove = Math.min(count, amountParam);
                totalRemoved += toRemove;
                cardInst.counters[k] = count - toRemove;
              }
            }
          }
        }
        if (cardInst.tokens?.counters) {
          if (amountParam === 'ALL') {
            totalRemoved += cardInst.tokens.counters;
            cardInst.tokens.counters = 0;
          } else if (typeof amountParam === 'number') {
            const toRemove = Math.min(cardInst.tokens.counters, amountParam);
            totalRemoved += toRemove;
            cardInst.tokens.counters -= toRemove;
          }
        }
        checkAndDiscardZeroCounterCard(state, player, cardInst, counterType);
      }

      return {
        state,
        success: true,
        mutatedState: totalRemoved > 0,
        value: totalRemoved,
        onomatopoeia: `PURGED ${totalRemoved} COUNTERS!`,
      };
    }

    case 'RETURN_TO_HAND': {
      if (
        context.sourceCardInstance?.attachments &&
        context.sourceCardInstance.attachments.length > 0
      ) {
        for (const card of context.sourceCardInstance.attachments) {
          const ownerId = (card as any).ownerId;
          const owner = state.players.find((p) => p.id === ownerId) || player;
          owner.hand.push(card);
        }
        context.sourceCardInstance.attachments = [];
        return {
          state,
          success: true,
          mutatedState: true,
          onomatopoeia: 'CARDS RETURNED TO HANDS!',
        };
      }
      if (context.sourceCardInstance) {
        const allyIdx = player.allies.indexOf(context.sourceCardInstance);
        if (allyIdx !== -1) {
          player.allies.splice(allyIdx, 1);
          player.hand.push(context.sourceCardInstance);
        } else {
          const tabIdx = player.tableau.indexOf(context.sourceCardInstance);
          if (tabIdx !== -1) {
            player.tableau.splice(tabIdx, 1);
            player.hand.push(context.sourceCardInstance);
          }
        }
      }
      return {
        state,
        success: true,
        mutatedState: true,
        onomatopoeia: 'RETURNED TO HAND!',
      };
    }

    case 'GENERATE_TOP_DISCARD_RESOURCES': {
      const topCard = player.discard[player.discard.length - 1];
      let resCount = 1;
      if (topCard) {
        resCount = topCard.card.resources?.total || 1;
      }
      return {
        state,
        success: true,
        mutatedState: true,
        value: resCount,
        onomatopoeia: `+${resCount} RESOURCES FROM DISCARD!`,
      };
    }

    case 'SEARCH': {
      const rawSource = step.params?.source;
      const sourceZones: SearchZone[] = (
        Array.isArray(rawSource) ? rawSource : [rawSource || 'PLAYER_DECK']
      ) as SearchZone[];

      let resolvedLookCount: number | 'ALL' | undefined = undefined;
      if (step.params?.lookCount === 'ALL') {
        resolvedLookCount = 'ALL';
      } else if (step.params?.lookCount !== undefined) {
        resolvedLookCount = resolveNumericAmount(step.params.lookCount, context, 0, {
          state,
          player,
        });
      }
      const isFullSearch =
        resolvedLookCount === undefined || resolvedLookCount === 'ALL' || resolvedLookCount === 0;
      const isLookCountSpliced =
        !isFullSearch && typeof resolvedLookCount === 'number' && resolvedLookCount > 0;

      let resolvedTakeCount: number | 'ALL' = 1;
      if (step.params?.takeCount === 'ALL') {
        resolvedTakeCount = 'ALL';
      } else if (step.params?.takeCount !== undefined) {
        resolvedTakeCount = resolveNumericAmount(step.params.takeCount, context, 1, {
          state,
          player,
        });
      }
      const isTakeAll = resolvedTakeCount === 'ALL' || resolvedTakeCount === 0;
      const countToTake = isTakeAll ? 0 : Math.max(1, resolvedTakeCount as number);

      const filter =
        (step.params?.filter || step.filter) ??
        (step.params?.targetCardCode ||
        step.params?.targetCardName ||
        step.params?.trait ||
        step.params?.type ||
        step.params?.type_code ||
        step.params?.cardType
          ? {
              targetCardCode: step.params?.targetCardCode,
              targetCardName: step.params?.targetCardName,
              trait: step.params?.trait,
              type: step.params?.type || step.params?.type_code || step.params?.cardType,
            }
          : undefined);
      const selectedDestination = (step.params?.selectedDestination as string) || 'HAND';
      const unselectedDestination = step.params?.unselectedDestination as string | null | undefined;
      const shuffleAfter =
        step.params?.shuffleAfter !== undefined
          ? (step.params.shuffleAfter as boolean)
          : isFullSearch;

      const timing = context.ability?.timing;
      const trigger = context.ability?.trigger;
      const isAction =
        timing === 'ACTION' || timing === 'HERO_ACTION' || timing === 'ALTER_EGO_ACTION';
      const isForced =
        timing === 'WHEN_REVEALED' ||
        timing === 'FORCED_RESPONSE' ||
        timing === 'FORCED_INTERRUPT' ||
        trigger === 'WHEN_REVEALED';

      let isVoluntary = false;
      if (isForced) {
        isVoluntary = false;
      } else if (step.params?.isVoluntary !== undefined) {
        isVoluntary = Boolean(step.params.isVoluntary);
      } else if (isAction) {
        isVoluntary = true;
      }

      const promptTitle =
        (step.params?.promptTitle as string) ||
        (context.sourceCardInstance
          ? `${context.sourceCardInstance.card.name}: Choose card(s)`
          : 'Search & Select: Choose card(s)');

      const cardOriginMap = new Map<string, SearchZone>();
      const getZonePile = (zone: SearchZone): { pile: CardInstance[]; isDeck: boolean } => {
        switch (zone) {
          case 'PLAYER_DISCARD':
            return { pile: player.discard, isDeck: false };
          case 'PLAYER_HAND':
            return { pile: player.hand, isDeck: false };
          case 'ENCOUNTER_DECK':
            return { pile: state.encounterDeck, isDeck: true };
          case 'ENCOUNTER_DISCARD':
            return { pile: state.encounterDiscard, isDeck: false };
          case 'PLAYER_DECK':
          default:
            return { pile: player.deck, isDeck: true };
        }
      };

      const shuffleSearchedDecks = () => {
        if (sourceZones.includes('ENCOUNTER_DECK')) {
          state.encounterDeck.sort(() => Math.random() - 0.5);
        }
        if (sourceZones.includes('PLAYER_DECK')) {
          player.deck.sort(() => Math.random() - 0.5);
        }
      };

      // Determine candidate pool
      let lookedCards: CardInstance[] = [];
      if (isLookCountSpliced) {
        let remainingToLook = resolvedLookCount as number;
        for (const zone of sourceZones) {
          if (remainingToLook <= 0) break;
          const { pile } = getZonePile(zone);
          const sliceCount = Math.min(remainingToLook, pile.length);
          const spliced = pile.splice(0, sliceCount);
          for (const card of spliced) {
            cardOriginMap.set(card.instanceId, zone);
          }
          lookedCards.push(...spliced);
          remainingToLook -= sliceCount;
        }
      } else {
        for (const zone of sourceZones) {
          const { pile } = getZonePile(zone);
          for (const card of pile) {
            cardOriginMap.set(card.instanceId, zone);
            lookedCards.push(card);
          }
        }
      }

      const routeCards = (cards: CardInstance[], destination: string | null | undefined) => {
        if (cards.length === 0) return;
        if (!destination || destination === 'LEAVE_IN_PLACE') {
          for (const card of cards) {
            const origin = cardOriginMap.get(card.instanceId) || sourceZones[0];
            if (origin === 'PLAYER_DISCARD') player.discard.push(card);
            else if (origin === 'PLAYER_HAND') player.hand.push(card);
            else if (origin === 'ENCOUNTER_DECK') state.encounterDeck.unshift(card);
            else if (origin === 'ENCOUNTER_DISCARD') state.encounterDiscard.push(card);
            else player.deck.unshift(card);
          }
          return;
        }

        if (destination === 'REVEAL') {
          for (const card of cards) {
            resolveActiveEncounterCardAfterInterrupt(state, card, player, false);
          }
        } else if (destination === 'TABLEAU') {
          for (const card of cards) {
            if (card.card.type === CardType.SIDE_SCHEME) {
              const sideSchemeCard = card.card as SideSchemeCard;
              const baseThreat =
                sideSchemeCard.baseThreat *
                (sideSchemeCard.baseThreatFixed ? 1 : state.players.length);
              state.sideSchemes.push({
                instanceId: card.instanceId,
                card: sideSchemeCard,
                threat: baseThreat,
              });
              state.log.push({
                id: `log_${Date.now()}`,
                timestamp: Date.now(),
                key: 'encounter.reveal.sideScheme',
                params: { sideScheme: card.card.name, threat: baseThreat },
                onomatopoeia: 'SIDE SCHEME!',
              });
              const abilities = card.card.enrichment?.abilities || [];
              for (const ability of abilities) {
                if (ability.trigger === 'WHEN_REVEALED' || ability.timing === 'WHEN_REVEALED') {
                  executeEffect(state, ability, {
                    playerId: player.id,
                    sourceCardInstance: card,
                  });
                }
              }
            } else {
              player.tableau.push(card);
            }
          }
        } else if (destination === 'HAND') {
          player.hand.push(...cards);
        } else if (destination === 'DISCARD') {
          for (const card of cards) {
            const origin = cardOriginMap.get(card.instanceId) || sourceZones[0];
            if (origin.startsWith('ENCOUNTER') || card.card.faction === 'encounter') {
              state.encounterDiscard.push(card);
            } else {
              player.discard.push(card);
            }
          }
        } else if (destination === 'DECK_TOP') {
          for (const card of cards) {
            const origin = cardOriginMap.get(card.instanceId) || sourceZones[0];
            if (origin.startsWith('ENCOUNTER') || card.card.faction === 'encounter') {
              state.encounterDeck.unshift(card);
            } else {
              player.deck.unshift(card);
            }
          }
        } else if (destination === 'DECK_BOTTOM') {
          for (const card of cards) {
            const origin = cardOriginMap.get(card.instanceId) || sourceZones[0];
            if (origin.startsWith('ENCOUNTER') || card.card.faction === 'encounter') {
              state.encounterDeck.push(card);
            } else {
              player.deck.push(card);
            }
          }
        } else if (destination === 'DECK_SHUFFLE') {
          for (const card of cards) {
            const origin = cardOriginMap.get(card.instanceId) || sourceZones[0];
            if (origin.startsWith('ENCOUNTER') || card.card.faction === 'encounter') {
              state.encounterDeck.push(card);
              state.encounterDeck.sort(() => Math.random() - 0.5);
            } else {
              player.deck.push(card);
              player.deck.sort(() => Math.random() - 0.5);
            }
          }
        }
      };

      // Filter matching candidate cards
      const matchingCandidates = lookedCards.filter((c) => matchCardFilter(c.card, filter, player));

      if (matchingCandidates.length === 0) {
        if (isLookCountSpliced) {
          if (unselectedDestination === 'DISCARD') {
            routeCards(lookedCards, 'DISCARD');
          } else {
            routeCards(lookedCards, 'LEAVE_IN_PLACE');
          }
        }
        if (shuffleAfter) {
          shuffleSearchedDecks();
        }
        return {
          state,
          success: true,
          mutatedState: false,
          onomatopoeia: 'NO MATCHING TARGET FOUND',
        };
      }

      const effectiveTakeCount = isTakeAll ? matchingCandidates.length : countToTake;
      const shouldAutoSelect =
        isTakeAll ||
        (!step.params?.isVoluntary &&
          step.params?.autoSelectIfUnambiguous !== false &&
          matchingCandidates.length <= effectiveTakeCount);

      if (shouldAutoSelect) {
        const selectedCards = matchingCandidates.slice(0, effectiveTakeCount);
        const selectedIds = new Set(selectedCards.map((card) => card.instanceId));
        const unselectedCards = lookedCards.filter((card) => !selectedIds.has(card.instanceId));

        if (!isLookCountSpliced) {
          for (const selectedCard of selectedCards) {
            const zone = cardOriginMap.get(selectedCard.instanceId) || sourceZones[0];
            const { pile } = getZonePile(zone);
            const selectedIndex = pile.findIndex(
              (card) => card.instanceId === selectedCard.instanceId,
            );
            if (selectedIndex !== -1) pile.splice(selectedIndex, 1);
          }
        }

        routeCards(selectedCards, selectedDestination);
        if (isLookCountSpliced) routeCards(unselectedCards, unselectedDestination);
        if (shuffleAfter) shuffleSearchedDecks();

        return {
          state,
          success: true,
          mutatedState: selectedCards.length > 0,
          selectedCardInstanceIds: selectedCards.map((card) => card.instanceId),
          onomatopoeia: `SEARCHED ${selectedCards.length} CARD(S)!`,
        };
      }

      const options: DecisionPromptOption[] = matchingCandidates.map((c) => ({
        id: c.instanceId,
        label: `${c.card.name} (${c.card.type}${c.card.cost !== undefined ? `, Cost: ${c.card.cost}` : ''})`,
        description: c.card.text || `Select ${c.card.name}`,
        effect: 'SEARCH_AND_SELECT_RESOLUTION',
        params: {
          chosenInstanceId: c.instanceId,
          lookedCards,
          lookedCardInstanceIds: lookedCards.map((l) => l.instanceId),
          sourceZone: cardOriginMap.get(c.instanceId) || sourceZones[0],
          sourceZones,
          selectedDestination,
          unselectedDestination,
          shuffleAfter: shuffleAfter && sourceZones.some((z) => z.includes('DECK')),
          isLookCountSpliced,
        },
      }));

      if (isVoluntary) {
        options.push({
          id: 'pass_search',
          label: 'Pass / Do not select',
          description: 'Pass and do not choose any card',
          effect: 'SEARCH_AND_SELECT_PASS',
          params: {
            lookedCards,
            lookedCardInstanceIds: lookedCards.map((l) => l.instanceId),
            sourceZone: sourceZones[0],
            sourceZones,
            unselectedDestination,
            shuffleAfter: shuffleAfter && sourceZones.some((z) => z.includes('DECK')),
            isLookCountSpliced,
          },
        });
      }

      const prompt: PendingDecisionPrompt = {
        promptId: `prompt_search_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        playerId: context.playerId,
        title: promptTitle,
        description: `Select up to ${effectiveTakeCount} card(s):`,
        sourceCardName: context.sourceCardInstance?.card.name || 'Search & Select',
        options,
        isVoluntary,
      };

      const enqueuedState = enqueueDecisionPrompt(state, prompt);
      return {
        state: enqueuedState,
        success: true,
        onomatopoeia: 'CHOOSE CARD!',
      };
    }

    case 'SEARCH_AND_PLAY_UPGRADE': {
      const traitFilter = step.params?.trait as string | undefined;
      const typeFilter =
        (step.params?.type as string) || (step.params?.type_code as string) || 'upgrade';

      const matchIdx = player.deck.findIndex((c) => {
        const typeMatch =
          !typeFilter || c.card.type === typeFilter || c.card.raw.type_code === typeFilter;
        const traitMatch = !traitFilter || c.card.traits?.includes(traitFilter);
        return typeMatch && traitMatch;
      });

      if (matchIdx !== -1) {
        const [foundCard] = player.deck.splice(matchIdx, 1);
        player.tableau.push(foundCard);
        // Shuffle deck after search
        player.deck = [...player.deck].sort(() => Math.random() - 0.5);
        return {
          state,
          success: true,
          mutatedState: true,
          onomatopoeia: `FOUND ${foundCard.card.name}!`,
        };
      }

      // Target not found: shuffle deck
      player.deck = [...player.deck].sort(() => Math.random() - 0.5);
      return {
        state,
        success: true,
        mutatedState: false,
        onomatopoeia: 'TARGET NOT FOUND IN DECK',
      };
    }

    case 'TRIGGER_WAKANDA_UPGRADES':
    case 'EXECUTE_WAKANDA_FOREVER':
    case 'EXECUTE_SPECIAL': {
      const specialId = (step.params?.specialId as string) || 'WAKANDA_FOREVER';
      const handler = getSpecialHandler(specialId);
      if (!handler) {
        return {
          state,
          success: false,
          error: `Special handler not found for ${specialId}`,
        };
      }
      return handler.execute(state, context, step.params);
    }

    case 'TRANSFER_DAMAGE': {
      const amount = (step.params?.baseAmount as number) || (step.params?.amount as number) || 1;
      player.health = Math.min(getEffectiveMaxHealth(player, state), player.health + amount);
      dealDirectDamage(state, 'VILLAIN', amount);
      return {
        state,
        success: true,
        mutatedState: true,
        value: amount,
        onomatopoeia: `TRANSFERRED ${amount} DAMAGE!`,
      };
    }

    case 'CANCEL_WHEN_REVEALED_AND_REVEAL_ANOTHER': {
      const replacement = drawEncounterCard(state);
      if (replacement) {
        player.dealtEncounterCards.push(replacement);
      }
      return {
        state,
        success: true,
        mutatedState: true,
        onomatopoeia: 'CANCELLED & REVEALED ANOTHER!',
      };
    }

    case 'ATTACH_FACEDOWN_CARDS_FROM_HAND': {
      for (const p of state.players) {
        if (p.hand.length > 0) {
          const randIdx = Math.floor(Math.random() * p.hand.length);
          const [removed] = p.hand.splice(randIdx, 1);
          if (context.sourceCardInstance) {
            if (!context.sourceCardInstance.attachments)
              context.sourceCardInstance.attachments = [];
            context.sourceCardInstance.attachments.push({
              ...removed,
              ownerId: p.id,
            } as any);
          }
        }
      }
      return {
        state,
        success: true,
        mutatedState: true,
        onomatopoeia: 'CARDS ATTACHED FACEDOWN!',
      };
    }

    case 'REDUCE_NEXT_CARD_COST': {
      const amount = (step.params?.amount as number) || 1;
      player.costReductions = (player.costReductions || 0) + amount;
      return {
        state,
        success: true,
        mutatedState: true,
        onomatopoeia: `COST REDUCED BY ${amount}!`,
      };
    }

    case 'PLAY_FROM_ZONE': {
      const source = (step.params?.source as string) || 'PLAYER_DISCARD';
      const filter = (step.params?.filter || step.filter) as Record<string, any> | undefined;
      const costMode = (step.params?.costMode as string) || 'PRINTED_COST';
      const costReduction = (step.params?.costReduction as number) || 0;
      const destination = (step.params?.destination as string) || 'TABLEAU';
      const control = (step.params?.control as string) || 'SELF';
      const promptTitle =
        (step.params?.promptTitle as string) ||
        (context.sourceCardInstance
          ? `${context.sourceCardInstance.card.name}: Choose a card to play`
          : 'Choose a card to play:');

      // 1. Gather candidate cards from designated source
      interface CandidateCard {
        instance: CardInstance;
        owner: PlayerState;
      }
      const candidates: CandidateCard[] = [];

      if (source === 'ANY_PLAYER_DISCARD') {
        for (const p of state.players) {
          for (const cardInst of p.discard) {
            if (matchesCardFilter(cardInst.card, filter, { player, state })) {
              candidates.push({ instance: cardInst, owner: p });
            }
          }
        }
      } else if (source === 'PLAYER_DISCARD') {
        for (const cardInst of player.discard) {
          if (matchesCardFilter(cardInst.card, filter, { player, state })) {
            candidates.push({ instance: cardInst, owner: player });
          }
        }
      } else if (source === 'PLAYER_DECK') {
        for (const cardInst of player.deck) {
          if (matchesCardFilter(cardInst.card, filter, { player, state })) {
            candidates.push({ instance: cardInst, owner: player });
          }
        }
      }

      if (candidates.length === 0) {
        return {
          state,
          success: true,
          mutatedState: false,
          onomatopoeia: 'NO TARGET FOUND',
        };
      }

      // Check Option B: Direct targeted play when targetInstanceId is pre-supplied (e.g. from tests or bot)
      if (context.targetInstanceId) {
        const matched = candidates.find((c) => c.instance.instanceId === context.targetInstanceId);
        if (matched) {
          const chosenCard = matched.instance;
          const ownerPlayer = matched.owner;

          // Splice from owner's discard/source
          const spliceIdx = ownerPlayer.discard.findIndex(
            (c) => c.instanceId === chosenCard.instanceId,
          );
          if (spliceIdx !== -1) {
            ownerPlayer.discard.splice(spliceIdx, 1);
          }

          // Track owner for cross-player control per RR v1.8 p. 11
          chosenCard.ownerId = ownerPlayer.id;

          // Move into controller's tableau / allies
          if (chosenCard.card.type === CardType.ALLY) {
            player.allies.push(chosenCard);
          } else {
            player.tableau.push(chosenCard);
          }

          initializeCardUses(chosenCard);

          // Dispatch ENTERS_PLAY only — card is put into play, NOT played (RR v1.8 p.21)
          // CARD_PLAYED does NOT fire here (no cost was paid via the play action)
          dispatchTrigger(state, 'ENTERS_PLAY', {
            targetPlayerId: player.id,
            sourceInstanceId: chosenCard.instanceId,
          });

          const onomatopoeia = `PLAYED ${chosenCard.card.name.toUpperCase()}!`;
          state.log.push({
            id: `log_${Date.now()}`,
            timestamp: Date.now(),
            round: state.roundNumber,
            phase: state.phase,
            category: 'ability',
            key: 'card.playFromZone',
            params: {
              player: player.name,
              card: chosenCard.card.name,
              source,
            },
            onomatopoeia,
          });

          return {
            state,
            success: true,
            mutatedState: true,
            onomatopoeia,
          };
        }
      }

      // Option A: If only 1 candidate or no pre-supplied target, enqueue a Decision Prompt
      const options: DecisionPromptOption[] = candidates.map(({ instance: c, owner }) => ({
        id: c.instanceId,
        label: `${c.card.name} (Cost: ${c.card.cost ?? 0}${owner.id !== player.id ? `, Owner: ${owner.name}` : ''})`,
        description: c.card.text || `Play ${c.card.name} from ${owner.name}'s discard`,
        effect: 'PLAY_CARD_FROM_ZONE_RESOLUTION',
        params: {
          chosenInstanceId: c.instanceId,
          ownerId: owner.id,
          source,
          destination,
          control,
          costMode,
          costReduction,
        },
      }));

      options.push({
        id: 'pass_play_from_zone',
        label: 'Pass / Cancel',
        description: 'Do not play a card',
        effect: 'PLAY_CARD_FROM_ZONE_PASS',
        params: {},
      });

      const prompt: PendingDecisionPrompt = {
        promptId: `prompt_play_from_zone_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        playerId: player.id,
        title: promptTitle,
        description: 'Choose a card to pay for and play into your tableau:',
        sourceCardName: context.sourceCardInstance?.card.name || 'Make the Call',
        options,
        isVoluntary: true,
      };

      const enqueuedState = enqueueDecisionPrompt(state, prompt);
      return {
        state: enqueuedState,
        success: true,
        onomatopoeia: 'CHOOSE CARD TO PLAY!',
      };
    }

    case 'ALLY_LIMIT_BONUS':
    case 'MODIFY_RESTRICTED_LIMIT':
    case 'MODIFY_ALLY_LIMIT': {
      // Evaluated as constant modifier in legality-checker getPlayerAllyLimit
      return {
        state,
        success: true,
        mutatedState: false,
        onomatopoeia: 'ALLY LIMIT UPDATED!',
      };
    }

    default:
      return { state, success: true, onomatopoeia: 'RESOLVED!' };
  }
}

/**
 * Executes direct damage dealing outside standard basic/event combat attacks.
 * Direct damage bypasses Hero DEF and Ally block mitigation, but is absorbed by Tough and universal prevention.
 */
export function dealDirectDamage(
  state: GameState,
  target:
    | 'HERO'
    | 'VILLAIN'
    | { type: 'MINION'; instanceId: string }
    | { type: 'ALLY'; instanceId: string },
  amount: number,
  playerId?: string,
  triggerChain?: TriggerCallNode[],
): { damageDealt: number; absorbedByTough: boolean } {
  if (amount <= 0) return { damageDealt: 0, absorbedByTough: false };

  if (target === 'HERO') {
    const player = state.players.find((p) => p.id === playerId) || state.players[0];
    const toughIdx = player.statusCards.indexOf(StatusCard.TOUGH);
    if (toughIdx !== -1) {
      player.statusCards.splice(toughIdx, 1);
      return { damageDealt: 0, absorbedByTough: true };
    }
    const prevResult = dispatchTrigger(state, 'DAMAGE_TAKEN', {
      targetPlayerId: player.id,
      damageAmount: amount,
      triggerChain,
    });
    const finalDmg = prevResult.damageAmount ?? amount;
    player.health = Math.max(0, player.health - finalDmg);
    return { damageDealt: finalDmg, absorbedByTough: false };
  }

  if (target === 'VILLAIN') {
    const toughIdx = state.villain.statusCards.indexOf(StatusCard.TOUGH);
    if (toughIdx !== -1) {
      state.villain.statusCards.splice(toughIdx, 1);
      return { damageDealt: 0, absorbedByTough: true };
    }
    state.villain.health = Math.max(0, state.villain.health - amount);
    return { damageDealt: amount, absorbedByTough: false };
  }

  return { damageDealt: amount, absorbedByTough: false };
}
