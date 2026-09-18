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
  DistributionPromptConfig,
  TargetAllocationItem,
  NormalizedCard,
  PlayerState,
  VillainState,
  Keyword,
  hasKeyword,
  ActiveCostReduction,
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
import { getStepEffectParams, getStepGateParams } from '../../data/supplemental/schema';
import { drawEncounterCard, drawPlayerCard } from '../pipeline/deck-exhaustion';
import { enqueueDecisionPrompt, enqueueDistributionPrompt } from '../pipeline/prompt-queue';
import { resolveDefenderDeclaration } from '../pipeline/combat-pipeline';
import {
  getEffectiveMaxHealth,
  getEffectiveHandSize,
  getEffectiveRetaliate,
  hasEntityKeyword,
  hasPlayerTrait,
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
  isFinalStep?: boolean;
  discardedCards?: CardInstance[];
  assignments?: Record<string, number>;
  interactivePrompt?: boolean;
  /** Active chain of trigger nodes for cycle detection & depth tracking (ADR-0053) */
  triggerChain?: TriggerCallNode[];
  /** Host ability context for timing, trigger, and cost evaluation */
  ability?: CardAbility;
}

export { evaluateDynamicAmount } from './dynamic-formula-evaluator';
import { evaluateDynamicAmount } from './dynamic-formula-evaluator';
export {
  resolveTargets,
  resolveCharacterTargets,
  resolveSchemeTargets,
  resolvePlayerTargets,
  resolveCardTargets,
  resolveEntityByInstanceId,
} from './target-resolver';
export type {
  EffectContext,
  ResolvedTarget,
  CharacterTarget,
  SchemeTarget,
  PlayerTarget,
  CardTarget,
} from './target-resolver';
import {
  resolveTargets,
  resolveCharacterTargets,
  resolveSchemeTargets,
  resolvePlayerTargets,
  resolveEntityByInstanceId,
  type EffectContext,
} from './target-resolver';

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
 * Universal helper to cleanly discard a card instance respecting persistent ownership invariants (RR v1.8 p. 11, 23, ADR-0040, ADR-0068).
 */
export function discardCardInstance(
  state: GameState,
  card: CardInstance,
  fallbackPlayerId?: string,
): void {
  if (!card) return;

  // 1. Cascade host attachments and tucked cards
  discardHostAttachmentsAndTuckedCards(state, card, fallbackPlayerId);

  // 2. Atomic remove from all zones
  removeCardFromAllZones(state, card.instanceId);

  // 3. Proper destination routing based on encounter vs. player card ownership
  if (isEncounterCard(card.card)) {
    state.encounterDiscard.push(card);
  } else {
    const targetPlayer =
      (card.ownerId ? state.players.find((p) => p.id === card.ownerId) : undefined) ||
      (fallbackPlayerId ? state.players.find((p) => p.id === fallbackPlayerId) : undefined) ||
      state.players[0];

    if (targetPlayer) {
      targetPlayer.discard.push(card);
      dispatchTrigger(state, 'CARD_DISCARDED', {
        targetPlayerId: targetPlayer.id,
        sourceInstanceId: card.instanceId,
      });
    }
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
 * Compiles eligible and ineligible distribution targets with dynamic capacity limits (ADR-0064).
 */
export function compileDistributionTargets(
  state: GameState,
  targetScope: string,
  allocationDomain: string,
  capRule?: string,
): TargetAllocationItem[] {
  const targets: TargetAllocationItem[] = [];

  const includeHeroes =
    targetScope === 'ALL_HEROES_AND_ALLIES' ||
    targetScope === 'ALL_HEROES' ||
    targetScope === 'ALL_PLAYERS' ||
    targetScope === 'ALL_FRIENDLY_CHARACTERS' ||
    targetScope === 'ALL_CHARACTERS' ||
    targetScope === 'CHOSEN_CHARACTER' ||
    targetScope === 'CHOSEN_FRIENDLY_CHARACTER' ||
    targetScope === 'CHOSEN_HERO';

  const includeAllies =
    targetScope === 'ALL_HEROES_AND_ALLIES' ||
    targetScope === 'ALL_ALLIES' ||
    targetScope === 'ALL_FRIENDLY_CHARACTERS' ||
    targetScope === 'ALL_CONTROLLED_CHARACTERS' ||
    targetScope === 'ALL_CHARACTERS' ||
    targetScope === 'CHOSEN_CHARACTER' ||
    targetScope === 'CHOSEN_FRIENDLY_CHARACTER' ||
    targetScope === 'CHOSEN_ALLY';

  const includeSchemes =
    targetScope === 'ALL_SCHEMES' ||
    targetScope === 'ALL_SIDE_SCHEMES' ||
    targetScope === 'MAIN_SCHEME' ||
    targetScope === 'CHOSEN_SCHEME' ||
    targetScope === 'CHOSEN_SIDE_SCHEME' ||
    allocationDomain === 'THREAT_REMOVAL';

  const includeEnemies =
    targetScope === 'ALL_ENEMIES' ||
    targetScope === 'ALL_CHARACTERS' ||
    targetScope === 'CHOSEN_ENEMY';

  // 1. Players / Identities & Allies
  for (const p of state.players) {
    if (includeHeroes) {
      const isHero = p.currentForm === 'hero';
      const isFormRestricted =
        (targetScope === 'ALL_HEROES' || targetScope === 'ALL_HEROES_AND_ALLIES') && !isHero;
      const hasTough = p.statusCards.includes(StatusCard.TOUGH);
      let isEligible = true;
      let ineligibilityReason: string | undefined;
      let allocationCap: number = p.health;

      if (isFormRestricted) {
        isEligible = false;
        ineligibilityReason = 'Alter-Ego (Immune)';
        allocationCap = 0;
      } else if (allocationDomain === 'HEAL') {
        const damageSuffered = p.maxHealth - p.health;
        if (damageSuffered <= 0) {
          isEligible = false;
          ineligibilityReason = 'At full health';
          allocationCap = 0;
        } else {
          allocationCap = damageSuffered;
        }
      } else if (allocationDomain === 'EXHAUST') {
        if (p.exhausted) {
          isEligible = false;
          ineligibilityReason = 'Already exhausted';
          allocationCap = 0;
        } else {
          allocationCap = 1;
        }
      } else if (allocationDomain === 'DAMAGE') {
        if (capRule === 'REMAINING_HP') {
          allocationCap = p.health;
        } else if (capRule === 'NONE') {
          allocationCap = 999;
        } else {
          allocationCap = p.health;
        }
      }

      targets.push({
        instanceId: p.id,
        name: p.activeFormCard?.name || p.hero?.name || p.name,
        cardCode: p.activeFormCard?.code || p.hero?.code,
        cardType: isHero ? 'hero' : 'alter_ego',
        controllerPlayerId: p.id,
        controllerName: p.name,
        currentValue: p.health,
        maxValue: p.maxHealth,
        allocationCap,
        hasTough,
        statusCards: p.statusCards,
        isEligible,
        ineligibilityReason,
      });
    }

    if (includeAllies) {
      for (const ally of p.allies) {
        const allyHp = (ally.card as any).health || 1;
        const currentDmg = ally.tokens?.damage || 0;
        const currentHp = Math.max(0, allyHp - currentDmg);
        const hasTough = (ally.statusCards || []).includes(StatusCard.TOUGH);
        let isEligible = true;
        let ineligibilityReason: string | undefined;
        let allocationCap: number = currentHp;

        if (allocationDomain === 'HEAL') {
          if (currentDmg <= 0) {
            isEligible = false;
            ineligibilityReason = 'At full health';
            allocationCap = 0;
          } else {
            allocationCap = currentDmg;
          }
        } else if (allocationDomain === 'EXHAUST') {
          if (ally.exhausted) {
            isEligible = false;
            ineligibilityReason = 'Already exhausted';
            allocationCap = 0;
          } else {
            allocationCap = 1;
          }
        } else if (allocationDomain === 'DAMAGE') {
          if (capRule === 'REMAINING_HP') {
            allocationCap = currentHp;
          } else if (capRule === 'NONE') {
            allocationCap = 999;
          } else {
            allocationCap = currentHp;
          }
        }

        targets.push({
          instanceId: ally.instanceId,
          name: ally.card.name,
          cardCode: ally.card.code,
          cardType: 'ally',
          controllerPlayerId: p.id,
          controllerName: p.name,
          currentValue: currentHp,
          maxValue: allyHp,
          allocationCap,
          hasTough,
          statusCards: ally.statusCards,
          isEligible,
          ineligibilityReason,
        });
      }
    }
  }

  // 2. Schemes (Main Scheme + Side Schemes)
  if (includeSchemes && state.mainScheme) {
    const mainThreat = state.mainScheme.threat || 0;
    const isMainEligible = mainThreat > 0;
    targets.push({
      instanceId: 'main_scheme',
      name: state.mainScheme.card.name,
      cardCode: state.mainScheme.card.code,
      cardType: 'main_scheme',
      currentValue: mainThreat,
      allocationCap: mainThreat,
      isEligible: isMainEligible,
      ineligibilityReason: isMainEligible ? undefined : 'No threat on scheme',
    });

    for (const side of state.sideSchemes || []) {
      const sideThreat = side.threat || 0;
      const isSideEligible = sideThreat > 0;
      targets.push({
        instanceId: side.instanceId,
        name: side.card.name,
        cardCode: side.card.code,
        cardType: 'side_scheme',
        currentValue: sideThreat,
        allocationCap: sideThreat,
        isEligible: isSideEligible,
        ineligibilityReason: isSideEligible ? undefined : 'No threat on scheme',
      });
    }
  }

  // 3. Enemies (Villain + Minions)
  if (includeEnemies) {
    if (state.villain) {
      const vTough = state.villain.statusCards.includes(StatusCard.TOUGH);
      targets.push({
        instanceId: state.villain.instanceId || 'villain',
        name: state.villain.card.name,
        cardCode: state.villain.card.code,
        cardType: 'villain',
        currentValue: state.villain.health,
        allocationCap: state.villain.health,
        hasTough: vTough,
        statusCards: state.villain.statusCards,
        isEligible: true,
      });
    }
    for (const p of state.players) {
      for (const m of p.engagedMinions) {
        const mHp = (m.card as MinionCard).health || 1;
        const currentDmg = m.tokens?.damage || 0;
        const currentHp = Math.max(0, mHp - currentDmg);
        const mTough = (m.statusCards || []).includes(StatusCard.TOUGH);
        targets.push({
          instanceId: m.instanceId,
          name: m.card.name,
          cardCode: m.card.code,
          cardType: 'minion',
          controllerPlayerId: p.id,
          controllerName: p.name,
          currentValue: currentHp,
          maxValue: mHp,
          allocationCap: currentHp,
          hasTough: mTough,
          statusCards: m.statusCards,
          isEligible: true,
        });
      }
    }
  }

  return targets;
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

  const gateParams = getStepGateParams(step);
  const targetStepId = gateParams.targetStepId as string | undefined;
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
    const statusParam = (gateParams.status as StatusCard) || StatusCard.TOUGH;
    const targetParam = (gateParams.target as string) || 'VILLAIN';
    if (targetParam === 'VILLAIN') {
      return state.villain.statusCards.includes(statusParam as StatusCard);
    }
    return false;
  }

  if (gate === 'IF_RESOURCE_MATCH') {
    const reqAspect = (((gateParams.resource || gateParams.aspect) as string) || '').toLowerCase();
    const requiredCount = (gateParams.count as number) || (gateParams.amount as number) || 1;
    const requirePrinted = Boolean(gateParams.printedResource);
    const requireOnly = Boolean(gateParams.only);

    if (context.resourcesSpent && context.resourcesSpent.length > 0) {
      const spent = context.resourcesSpent;
      const matchingCount = spent.filter((r) => {
        const lower = r.toLowerCase();
        return requirePrinted ? lower === reqAspect : lower === reqAspect || lower === 'wild';
      }).length;
      const passesOnly =
        !requireOnly ||
        spent.every((r) => {
          const lower = r.toLowerCase();
          return requirePrinted ? lower === reqAspect : lower === reqAspect || lower === 'wild';
        });
      return matchingCount >= requiredCount && passesOnly;
    }

    // 2. Check discarded cards in context or previousResult (e.g. Hulk 01050)
    const discarded: CardInstance[] = context.discardedCards || prevResult?.discardedCards || [];
    if (discarded.length > 0) {
      return discarded.some((inst) => {
        if (!inst?.card) return false;
        const res = inst.card.resources;
        const raw = inst.card.raw as any;
        const wildCount = res?.wild ?? raw?.resource_wild ?? 0;
        if (!requirePrinted && wildCount > 0) return true;
        const matchCount =
          res?.[reqAspect as keyof typeof res] ?? raw?.[`resource_${reqAspect}`] ?? 0;
        return typeof matchCount === 'number' && matchCount > 0;
      });
    }

    return false;
  }

  if (gate === 'IF_CARD_IN_PLAY') {
    const cardCode = (gateParams.cardCode as string) || (gateParams.code as string);
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
    const cardCode = (gateParams.cardCode as string) || (gateParams.code as string);
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
    if (step.condition === 'TARGET_TRAIT_MATCH') {
      const requiredTrait =
        (gateParams.trait as string) ||
        (Array.isArray(gateParams.traits) ? (gateParams.traits[0] as string) : undefined);
      const player = state.players.find((p) => p.id === context.playerId) || state.players[0];
      if (requiredTrait && player) {
        return hasPlayerTrait(player, requiredTrait);
      }
    }
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

    const effectParams = getStepEffectParams(step);
    const gateParams = getStepGateParams(step);
    const normalizedStep: AbilityStep = {
      ...step,
      effectParams,
      gateParams,
    };

    const stepContext: EffectExecutionContext = {
      ...context,
      previousResult: prevResult,
      targetInstanceId:
        effectParams.target === 'PREVIOUS_TARGET'
          ? (prevResult?.targetId ?? context.targetInstanceId)
          : context.targetInstanceId,
    };

    const res = executeStep(currentState, normalizedStep, stepContext);
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
    discardCardInstance(state, context.sourceCardInstance, context.playerId);
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

  const params = getStepEffectParams(step);
  const source = (params.source as string) || 'HAND';
  const rawCount = params.count;
  const isCountAll = rawCount === 'ALL';
  const count = typeof rawCount === 'number' ? rawCount : 1;
  const mode =
    (params.mode as string) ||
    (source === 'DECK' || source === 'ENCOUNTER_DECK' ? 'TOP' : 'CHOSEN');
  const fallback = params.fallback as string | undefined;
  const filter = (params.filter || step.filter) as any;

  // 1. DISCARD FROM HAND
  if (source === 'HAND') {
    const targetPlayers = resolvePlayerTargets(state, params.target as any, context);
    const targetPlayer = targetPlayers[0] || player;

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
    const matchingDestination = params.matchingDestination as string | undefined;
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
      const targetCard = player.tableau[targetIdx];
      discardCardInstance(state, targetCard, player.id);
      state.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        category: 'combat',
        key: 'player.tableau.discarded',
        params: { player: player.name, card: targetCard.card.name },
        onomatopoeia: 'TABLEAU DISCARDED!',
      });
      return {
        state,
        success: true,
        mutatedState: true,
        onomatopoeia: `DISCARDED ${targetCard.card.name.toUpperCase()}!`,
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
      discardCardInstance(state, cardInst, player.id);
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
    const targetHost = (params.target as string) || 'VILLAIN';
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

  step = {
    ...step,
    effectParams: getStepEffectParams(step),
    gateParams: getStepGateParams(step),
  };

  switch (step.effect) {
    case 'DISCARD':
    case 'DISCARD_CARDS': {
      return executeDiscard(state, step, context);
    }
    case 'DRAW': {
      const rawCount = step.effectParams?.count;
      let count =
        rawCount !== undefined
          ? resolveNumericAmount(rawCount, context, 1, {
              state,
              player,
              sourceCardInstance: context.sourceCardInstance,
              targetInstanceId:
                (step.effectParams?.targetInstanceId as string) || context.targetInstanceId,
            })
          : undefined;
      if (step.effectParams?.dynamicBonus) {
        const bonus = resolveNumericAmount(step.effectParams.dynamicBonus as any, context, 0, {
          state,
          player,
          sourceCardInstance: context.sourceCardInstance,
          targetInstanceId:
            (step.effectParams?.targetInstanceId as string) || context.targetInstanceId,
        });
        count = (count ?? 1) + bonus;
      }
      const limit = step.effectParams?.limit as 'HAND_SIZE' | 'PRINTED_HAND_SIZE' | undefined;
      const targetParam = step.effectParams?.target as string | undefined;
      const targetPlayerId =
        (step.effectParams?.targetPlayerId as string) ||
        (step.effectParams?.playerId as string) ||
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

      const resolvedPlayers = resolvePlayerTargets(state, targetParam as any, context);
      const targetPlayers = resolvedPlayers.length > 0 ? resolvedPlayers : [player];
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
      let amount = resolveNumericAmount(
        step.effectParams?.amount ?? step.effectParams?.baseAmount,
        context,
        0,
        {
          state,
          player,
          sourceCardInstance: context.sourceCardInstance,
          targetInstanceId:
            (step.effectParams?.targetInstanceId as string) || context.targetInstanceId,
        },
      );
      if (step.effectParams?.dynamicBonus) {
        const bonus = resolveNumericAmount(step.effectParams.dynamicBonus as any, context, 0, {
          state,
          player,
          sourceCardInstance: context.sourceCardInstance,
          targetInstanceId:
            (step.effectParams?.targetInstanceId as string) || context.targetInstanceId,
        });
        amount += bonus;
      }
      if (context.isFinalStep && step.effectParams?.finisherBonus) {
        amount += (step.effectParams.finisherBonus as number) || 0;
      }
      const targetParam = step.effectParams?.target as string | undefined;

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

      if (targetParam === 'ALL_HEROES_AND_ALLIES') {
        if (context.assignments && typeof context.assignments === 'object') {
          for (const [id, dmg] of Object.entries(context.assignments as Record<string, number>)) {
            if (dmg <= 0) continue;

            let ally: CardInstance | undefined;
            let allyController: PlayerState | undefined;
            for (const p of state.players) {
              const found = p.allies.find((a) => a.instanceId === id);
              if (found) {
                ally = found;
                allyController = p;
                break;
              }
            }

            if (ally && allyController) {
              const allyToughIdx = (ally.statusCards || []).indexOf(StatusCard.TOUGH);
              if (allyToughIdx !== -1) {
                ally.statusCards!.splice(allyToughIdx, 1);
              } else {
                const currentDmg = ally.tokens?.damage || 0;
                const newDmg = currentDmg + dmg;
                const allyHp = (ally.card as any).health || 1;
                if (newDmg >= allyHp) {
                  const idx = allyController.allies.indexOf(ally);
                  allyController.allies.splice(idx, 1);
                  processHostDefeated(state, ally, { player: allyController });
                  dispatchTrigger(state, 'CHARACTER_DEFEATED', {
                    targetPlayerId: allyController.id,
                    targetInstanceId: ally.instanceId,
                    targetType: 'ally',
                  });
                  const owner =
                    (ally.ownerId
                      ? state.players.find((pl) => pl.id === ally.ownerId)
                      : undefined) || allyController;
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
          let ally: CardInstance | undefined;
          let allyController: PlayerState | undefined;
          for (const p of state.players) {
            const found = p.allies.find((a) => a.instanceId === context.targetInstanceId);
            if (found) {
              ally = found;
              allyController = p;
              break;
            }
          }

          if (ally && allyController) {
            const allyToughIdx = (ally.statusCards || []).indexOf(StatusCard.TOUGH);
            if (allyToughIdx !== -1) {
              ally.statusCards!.splice(allyToughIdx, 1);
            } else {
              const currentDmg = ally.tokens?.damage || 0;
              const newDmg = currentDmg + amount;
              const allyHp = (ally.card as any).health || 1;
              if (newDmg >= allyHp) {
                const idx = allyController.allies.indexOf(ally);
                allyController.allies.splice(idx, 1);
                processHostDefeated(state, ally, { player: allyController });
                dispatchTrigger(state, 'CHARACTER_DEFEATED', {
                  targetPlayerId: allyController.id,
                  targetInstanceId: ally.instanceId,
                  targetType: 'ally',
                });
                const owner =
                  (ally.ownerId ? state.players.find((pl) => pl.id === ally.ownerId) : undefined) ||
                  allyController;
                owner.discard.push(ally);
              } else {
                ally.tokens = { ...ally.tokens, damage: newDmg };
              }
            }
          } else {
            const targetPlayer =
              state.players.find((pl) => pl.id === context.targetInstanceId) || player;
            const toughIdx = targetPlayer.statusCards.indexOf(StatusCard.TOUGH);
            if (toughIdx !== -1) {
              targetPlayer.statusCards.splice(toughIdx, 1);
            } else {
              targetPlayer.health = Math.max(0, targetPlayer.health - amount);
              if (targetPlayer.health <= 0) state.winner = 'VILLAIN';
            }
          }
        } else if (
          amount > 0 &&
          (context.interactivePrompt || (state as any).interactivePromptMode)
        ) {
          const targets = compileDistributionTargets(
            state,
            'ALL_HEROES_AND_ALLIES',
            'DAMAGE',
            'REMAINING_HP',
          );
          const config: DistributionPromptConfig = {
            totalBudget: amount,
            effectiveBudget: amount,
            budgetLabel: 'DAMAGE',
            unitSingular: 'DMG',
            unitPlural: 'DMG',
            exactMatchRequired: true,
            canCancel: false,
            allocationDomain: 'DAMAGE',
            targets,
          };
          const prompt: PendingDecisionPrompt = {
            promptId: `explosion_dist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            playerId: player.id,
            title: 'Explosion: Assign Damage',
            description: `Assign ${amount} damage among heroes and allies:`,
            sourceCardName: context.sourceCardInstance?.card.name || 'Explosion',
            sourceCardCode: context.sourceCardInstance?.card.code,
            sourceCardInstanceId: context.sourceCardInstance?.instanceId,
            kind: 'DISTRIBUTE_POINTS',
            distributionConfig: config,
            options: [
              {
                id: 'confirm_distribution',
                label: 'Confirm Assignment',
                effect: 'DISTRIBUTE_POINTS',
              },
            ],
          };
          state = enqueueDistributionPrompt(state, prompt);
          return {
            state,
            success: true,
            mutatedState: true,
            onomatopoeia: 'ASSIGN DAMAGE!',
          };
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
          params: { player: player.name, target: 'all_heroes_and_allies', amount },
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
        for (const p of state.players.filter((pl) => pl.currentForm === 'hero')) {
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
        step.effectParams?.target === 'TRIGGERING_MINION' ||
        step.effectParams?.target === 'TRIGGERING_ENEMY'
          ? context.targetInstanceId || (step.effectParams?.targetInstanceId as string)
          : (step.effectParams?.targetInstanceId as string) || context.targetInstanceId;

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
                step.effectParams?.overkill ||
                step.effectParams?.keyword === 'Overkill' ||
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
      const isAttack = Boolean(step.effectParams?.isAttack || context.isAttack);
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

    case 'DISTRIBUTE_AMOUNT': {
      const stepParams = getStepEffectParams(step);
      const budget = resolveNumericAmount(stepParams.budget ?? stepParams.amount ?? 0, context, 0, {
        state,
        player,
        sourceCardInstance: context.sourceCardInstance,
        targetInstanceId: (stepParams.targetInstanceId as string) || context.targetInstanceId,
      });
      const allocationDomain = (stepParams.allocationDomain as any) || 'DAMAGE';
      const targetScope =
        (stepParams.targetScope as string) ||
        (stepParams.target as string) ||
        'ALL_HEROES_AND_ALLIES';
      const capRule = (stepParams.capRule as string) || 'REMAINING_HP';
      const canCancel = Boolean(stepParams.canCancel);
      const exactMatchRequired = stepParams.exactMatchRequired !== false;

      // 1. If assignments already provided, execute immediately
      if (context.assignments && typeof context.assignments === 'object') {
        const assignments = context.assignments;
        for (const [targetId, amount] of Object.entries(assignments)) {
          if (amount <= 0) continue;

          if (allocationDomain === 'DAMAGE') {
            let ally: CardInstance | undefined;
            let allyController: PlayerState | undefined;
            for (const p of state.players) {
              const found = p.allies.find((a) => a.instanceId === targetId);
              if (found) {
                ally = found;
                allyController = p;
                break;
              }
            }

            if (ally && allyController) {
              const allyToughIdx = (ally.statusCards || []).indexOf(StatusCard.TOUGH);
              if (allyToughIdx !== -1) {
                ally.statusCards!.splice(allyToughIdx, 1);
              } else {
                const currentDmg = ally.tokens?.damage || 0;
                const newDmg = currentDmg + amount;
                const allyHp = (ally.card as any).health || 1;
                if (newDmg >= allyHp) {
                  const idx = allyController.allies.indexOf(ally);
                  allyController.allies.splice(idx, 1);
                  processHostDefeated(state, ally, { player: allyController });
                  dispatchTrigger(state, 'CHARACTER_DEFEATED', {
                    targetPlayerId: allyController.id,
                    targetInstanceId: ally.instanceId,
                    targetType: 'ally',
                  });
                  const owner =
                    (ally.ownerId
                      ? state.players.find((pl) => pl.id === ally.ownerId)
                      : undefined) || allyController;
                  owner.discard.push(ally);
                } else {
                  ally.tokens = { ...ally.tokens, damage: newDmg };
                }
              }
            } else {
              const targetPlayer =
                state.players.find(
                  (pl) =>
                    pl.id === targetId ||
                    pl.activeFormCard?.code === targetId ||
                    pl.hero?.code === targetId,
                ) || (targetId === player.id ? player : undefined);

              if (targetPlayer) {
                const toughIdx = targetPlayer.statusCards.indexOf(StatusCard.TOUGH);
                if (toughIdx !== -1) {
                  targetPlayer.statusCards.splice(toughIdx, 1);
                } else {
                  targetPlayer.health = Math.max(0, targetPlayer.health - amount);
                  if (targetPlayer.health <= 0) state.winner = 'VILLAIN';
                }
              } else if (
                targetId === state.villain?.instanceId ||
                targetId === 'villain' ||
                targetId === state.villain?.card?.code
              ) {
                const vToughIdx = state.villain.statusCards.indexOf(StatusCard.TOUGH);
                if (vToughIdx !== -1) {
                  state.villain.statusCards.splice(vToughIdx, 1);
                } else {
                  state.villain.health = Math.max(0, state.villain.health - amount);
                  if (state.villain.health <= 0) {
                    state = handleVillainDefeat(state, state.villain.instanceId);
                  }
                }
              } else {
                for (const p of state.players) {
                  const mIdx = p.engagedMinions.findIndex((m) => m.instanceId === targetId);
                  if (mIdx !== -1) {
                    const minion = p.engagedMinions[mIdx];
                    const mToughIdx = (minion.statusCards || []).indexOf(StatusCard.TOUGH);
                    if (mToughIdx !== -1) {
                      minion.statusCards!.splice(mToughIdx, 1);
                    } else {
                      const currentDmg = minion.tokens?.damage || 0;
                      const newDmg = currentDmg + amount;
                      const minionHp = (minion.card as MinionCard).health || 1;
                      if (newDmg >= minionHp) {
                        processHostDefeated(state, minion, { player: p });
                        p.engagedMinions.splice(mIdx, 1);
                        moveDefeatedCardToPile(state, minion, state.encounterDiscard);
                        dispatchTrigger(state, 'CHARACTER_DEFEATED', {
                          targetPlayerId: p.id,
                          targetInstanceId: minion.instanceId,
                          targetType: 'minion',
                        });
                      } else {
                        minion.tokens = { ...minion.tokens, damage: newDmg };
                      }
                    }
                    break;
                  }
                }
              }
            }
          } else if (allocationDomain === 'THREAT_REMOVAL') {
            if (
              targetId === 'main_scheme' ||
              targetId === state.mainScheme?.instanceId ||
              targetId === state.mainScheme?.card?.code
            ) {
              state.mainScheme.threat = Math.max(0, state.mainScheme.threat - amount);
            } else {
              const sideIdx = (state.sideSchemes || []).findIndex(
                (s) => s.instanceId === targetId || s.card.code === targetId,
              );
              if (sideIdx !== -1) {
                const side = state.sideSchemes![sideIdx];
                side.threat = Math.max(0, (side.threat || 0) - amount);
                if (side.threat <= 0) {
                  state.sideSchemes!.splice(sideIdx, 1);
                  dispatchTrigger(state, 'SCHEME_DEFEATED', {
                    targetPlayerId: player.id,
                    targetInstanceId: side.instanceId,
                    entityType: 'SCHEME',
                  });
                  state.encounterDiscard.push(side);
                }
              }
            }
          } else if (allocationDomain === 'HEAL') {
            let ally: CardInstance | undefined;
            for (const p of state.players) {
              const found = p.allies.find((a) => a.instanceId === targetId);
              if (found) {
                ally = found;
                break;
              }
            }
            if (ally) {
              const currentDmg = ally.tokens?.damage || 0;
              ally.tokens = { ...ally.tokens, damage: Math.max(0, currentDmg - amount) };
            } else {
              const targetPlayer = state.players.find(
                (pl) =>
                  pl.id === targetId ||
                  pl.activeFormCard?.code === targetId ||
                  pl.hero?.code === targetId,
              );
              if (targetPlayer) {
                targetPlayer.health = Math.min(
                  targetPlayer.maxHealth,
                  targetPlayer.health + amount,
                );
              }
            }
          } else if (allocationDomain === 'EXHAUST') {
            for (const p of state.players) {
              const c =
                p.tableau.find((i) => i.instanceId === targetId) ||
                p.allies.find((i) => i.instanceId === targetId);
              if (c) c.exhausted = true;
              if (p.id === targetId) p.exhausted = true;
            }
          } else if (allocationDomain === 'COUNTERS') {
            for (const p of state.players) {
              const c =
                p.tableau.find((i) => i.instanceId === targetId) ||
                p.allies.find((i) => i.instanceId === targetId);
              if (c) {
                c.tokens = { ...c.tokens, counters: (c.tokens?.counters || 0) + amount };
              }
            }
          }
        }

        const totalAssigned = Object.values(assignments).reduce((s, n) => s + (n || 0), 0);
        return {
          state,
          success: true,
          mutatedState: totalAssigned > 0,
          value: totalAssigned,
          onomatopoeia: 'DISTRIBUTED!',
        };
      }

      // 2. Interactive Prompt Mode if interactivePrompt requested or interactivePromptMode active
      if (budget > 0 && (context.interactivePrompt || (state as any).interactivePromptMode)) {
        const targets = compileDistributionTargets(state, targetScope, allocationDomain, capRule);
        const unitSingular =
          stepParams.unitSingular ||
          (allocationDomain === 'DAMAGE'
            ? 'DMG'
            : allocationDomain === 'THREAT_REMOVAL'
              ? 'THW'
              : 'PT');
        const unitPlural =
          stepParams.unitPlural ||
          (allocationDomain === 'DAMAGE'
            ? 'DMG'
            : allocationDomain === 'THREAT_REMOVAL'
              ? 'THW'
              : 'PTS');
        const config: DistributionPromptConfig = {
          totalBudget: budget,
          effectiveBudget: budget,
          budgetLabel: stepParams.budgetLabel || `${allocationDomain.replace('_', ' ')}`,
          unitSingular,
          unitPlural,
          exactMatchRequired,
          canCancel,
          allocationDomain,
          targets,
        };

        const prompt: PendingDecisionPrompt = {
          promptId: `dist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          playerId: player.id,
          title: stepParams.promptTitle || `Distribute ${config.budgetLabel}`,
          description:
            stepParams.promptDescription ||
            `Assign ${budget} ${unitPlural} among eligible targets:`,
          sourceCardName: context.sourceCardInstance?.card.name || 'Game Effect',
          sourceCardCode: context.sourceCardInstance?.card.code,
          sourceCardInstanceId: context.sourceCardInstance?.instanceId,
          kind: 'DISTRIBUTE_POINTS',
          distributionConfig: config,
          options: [
            {
              id: 'confirm_distribution',
              label: 'Confirm Assignment',
              effect: 'DISTRIBUTE_POINTS',
            },
          ],
        };

        state = enqueueDistributionPrompt(state, prompt);
        return {
          state,
          success: true,
          mutatedState: true,
          onomatopoeia: 'ASSIGN POINTS!',
        };
      }

      // 3. Headless fallback: deterministic default
      if (allocationDomain === 'DAMAGE') {
        const toughIdx = player.statusCards.indexOf(StatusCard.TOUGH);
        if (toughIdx !== -1) {
          player.statusCards.splice(toughIdx, 1);
        } else {
          player.health = Math.max(0, player.health - budget);
          if (player.health <= 0) state.winner = 'VILLAIN';
        }
      } else if (allocationDomain === 'THREAT_REMOVAL') {
        if (state.mainScheme) {
          state.mainScheme.threat = Math.max(0, state.mainScheme.threat - budget);
        }
      } else if (allocationDomain === 'HEAL') {
        player.health = Math.min(player.maxHealth, player.health + budget);
      }

      return {
        state,
        success: true,
        mutatedState: budget > 0,
        value: budget,
        onomatopoeia: 'POINTS ASSIGNED!',
      };
    }

    case 'HEAL_DAMAGE': {
      const amount = resolveNumericAmount(step.effectParams?.amount, context, 0, { state, player });
      const target = (step.effectParams?.target as string) || 'SELF';
      let healed = 0;

      const targetCharacters = resolveCharacterTargets(state, target as any, context);
      const charsToHeal =
        targetCharacters.length > 0
          ? targetCharacters
          : [
              {
                kind: 'character' as const,
                entityType:
                  player.currentForm === 'hero' ? ('hero' as const) : ('alter_ego' as const),
                entity: player,
                id: player.id,
                player,
              },
            ];

      let isFullyHealed = true;
      for (const targetChar of charsToHeal) {
        const ent: any = targetChar.entity;
        if (targetChar.entityType === 'villain') {
          const currentHp = ent.health;
          const maxHp = ent.maxHealth || 100;
          const h = Math.min(maxHp - currentHp, amount);
          ent.health += h;
          healed += h;
          if (ent.health < maxHp) isFullyHealed = false;
        } else if (targetChar.entityType === 'hero' || targetChar.entityType === 'alter_ego') {
          const currentHp = ent.health;
          const maxHp = ent.maxHealth;
          const h = Math.min(maxHp - currentHp, amount);
          ent.health += h;
          healed += h;
          if (ent.health < maxHp) isFullyHealed = false;
        } else if (targetChar.entityType === 'ally') {
          const currentDmg = ent.tokens?.damage || 0;
          const h = Math.min(currentDmg, amount);
          if (ent.tokens) ent.tokens.damage = Math.max(0, currentDmg - h);
          healed += h;
          if ((ent.tokens?.damage || 0) > 0) isFullyHealed = false;
        } else if (targetChar.entityType === 'minion') {
          const currentDmg = ent.tokens?.damage || 0;
          const h = Math.min(currentDmg, amount);
          if (ent.tokens) ent.tokens.damage = Math.max(0, currentDmg - h);
          healed += h;
          if ((ent.tokens?.damage || 0) > 0) isFullyHealed = false;
        }
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

      const isFullyHealedResult = isFullyHealed;
      const conditionMet = step.condition === 'FULLY_HEALED' ? isFullyHealedResult : undefined;

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
        context.remainingInterceptedValue ?? context.interceptedValue ?? context.damageAmount ?? 0;

      const hasInterceptContext =
        context.remainingInterceptedValue !== undefined ||
        context.interceptedValue !== undefined ||
        context.damageAmount !== undefined;

      const amountToPrevent =
        step.effectParams?.amount !== undefined
          ? step.effectParams.amount === 'ALL' || step.effectParams.preventAll
            ? currentVal
            : resolveNumericAmount(step.effectParams.amount, context, currentVal)
          : hasInterceptContext
            ? currentVal
            : step.effectParams?.preventAll
              ? 999
              : 3;

      const consumed = hasInterceptContext
        ? Math.min(currentVal, amountToPrevent)
        : amountToPrevent;
      const remaining = hasInterceptContext ? Math.max(0, currentVal - consumed) : 0;

      if (hasInterceptContext) {
        context.remainingInterceptedValue = remaining;
        if (context.damageAmount !== undefined) {
          context.damageAmount = remaining;
        }
      }

      const onomatopoeia = `PREVENTED ${consumed} DAMAGE!`;

      state.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        category: 'ability',
        key: 'combat.damage.prevented',
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

    case 'PREVENT_THREAT': {
      const currentVal =
        context.remainingInterceptedValue ?? context.threatAmount ?? context.interceptedValue ?? 0;

      const hasInterceptContext =
        context.remainingInterceptedValue !== undefined ||
        context.interceptedValue !== undefined ||
        context.threatAmount !== undefined;

      const amountToPrevent =
        step.effectParams?.amount !== undefined
          ? step.effectParams.amount === 'ALL' || step.effectParams.preventAll
            ? currentVal
            : resolveNumericAmount(step.effectParams.amount, context, currentVal)
          : hasInterceptContext
            ? currentVal
            : step.effectParams?.preventAll
              ? 999
              : 1;

      const consumed = hasInterceptContext
        ? Math.min(currentVal, amountToPrevent)
        : amountToPrevent;
      const remaining = hasInterceptContext ? Math.max(0, currentVal - consumed) : 0;

      if (hasInterceptContext) {
        context.remainingInterceptedValue = remaining;
        if (context.threatAmount !== undefined) {
          context.threatAmount = remaining;
        }
      }

      const onomatopoeia =
        context.threatAmount !== undefined
          ? consumed === currentVal
            ? 'THREAT PREVENTED!'
            : `PREVENTED ${consumed} THREAT!`
          : `PREVENTED ${consumed} THREAT!`;

      state.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        category: 'ability',
        key: 'card.effect.preventThreat',
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
      const resourceType = (step.effectParams?.resource as string) || 'wild';
      const amount = (step.effectParams?.amount as number) || 1;

      return {
        state,
        success: true,
        onomatopoeia: `+${amount} [${resourceType}] RESOURCE!`,
      };
    }

    case 'REMOVE_THREAT': {
      let amount = resolveNumericAmount(
        step.effectParams?.amount ?? step.effectParams?.baseAmount,
        context,
        1,
        { state, player },
      );
      if (step.effectParams?.dynamicBonus) {
        const bonus = resolveNumericAmount(step.effectParams.dynamicBonus as any, context, 0, {
          state,
          player,
          sourceCardInstance: context.sourceCardInstance,
          targetInstanceId:
            (step.effectParams?.targetInstanceId as string) || context.targetInstanceId,
        });
        amount += bonus;
      }
      if (context.isFinalStep && step.effectParams?.finisherBonus) {
        amount += (step.effectParams.finisherBonus as number) || 0;
      }
      const targetParam =
        (step.effectParams?.target as string) ||
        (step.effectParams?.targetInstanceId ? 'CHOSEN_SCHEME' : undefined) ||
        'MAIN_SCHEME';
      const targetContext: EffectContext = {
        ...context,
        targetInstanceId:
          (step.effectParams?.targetInstanceId as string) || context.targetInstanceId,
      };
      let removed = 0;
      let targetSchemeName = state.mainScheme?.card?.name || 'Main Scheme';
      let remainingThreat = state.mainScheme?.threat || 0;

      if (
        targetParam === 'CHOSEN_SCHEME' &&
        !step.effectParams?.targetInstanceId &&
        !context.targetInstanceId &&
        (state.sideSchemes || []).length > 0
      ) {
        const sideSchemes = state.sideSchemes || [];
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
      }

      const schemes = resolveSchemeTargets(state, targetParam as any, targetContext);
      const targetSchemes =
        schemes.length > 0
          ? schemes
          : [
              {
                kind: 'scheme' as const,
                entityType: 'main_scheme' as const,
                entity: state.mainScheme,
                id: state.mainScheme.instanceId || 'main_scheme',
              },
            ];

      for (const st of targetSchemes) {
        const scheme = st.entity;
        const current = scheme.threat || 0;
        const rem = Math.min(current, amount);
        scheme.threat = Math.max(0, current - amount);
        removed += rem;
        targetSchemeName = scheme.card?.name || 'Scheme';
        remainingThreat = scheme.threat;
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
      const statusParam = step.effectParams?.status;
      if (statusParam === 'TOUGH' || statusParam === StatusCard.TOUGH) status = StatusCard.TOUGH;
      if (statusParam === 'CONFUSED' || statusParam === StatusCard.CONFUSED)
        status = StatusCard.CONFUSED;
      if (statusParam === 'STUNNED' || statusParam === StatusCard.STUNNED)
        status = StatusCard.STUNNED;

      const target = (step.effectParams?.target as string) || 'VILLAIN';
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

      const targetParam = (step.effectParams?.target as string) || 'VILLAIN';
      const targetContext: EffectContext = {
        ...context,
        targetInstanceId:
          (step.effectParams?.targetInstanceId as string) || context.targetInstanceId,
      };
      const targetCharacters = resolveCharacterTargets(state, targetParam as any, targetContext);
      for (const targetChar of targetCharacters) {
        applyStatusToEntity(targetChar.entity);
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
      const requestedStatus = String(step.effectParams?.status || 'ALL');
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
      const target = String(step.effectParams?.target || 'VILLAIN');
      const targetPlayer =
        state.players.find((candidate) => candidate.id === context.targetPlayerId) || player;
      const targets: any[] = [];
      const resolved = resolveTargets(state, target as any, context);
      for (const r of resolved) {
        targets.push(r.entity);
      }
      if (targets.length === 0 && context.targetInstanceId) {
        const fallback = resolveEntityByInstanceId(state, context.targetInstanceId);
        if (fallback) targets.push(fallback.entity);
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
      const amount = (step.effectParams?.amount as number) || 4;
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
      const targetHost = step.effectParams?.target as string;
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
      const targetHost = (step.effectParams?.target as string) || 'SELF';
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
      const stepParams = getStepEffectParams(step);
      const targetParam =
        (stepParams.target as string) || (step.effectParams?.target as string) || 'SELF';
      const duration =
        (stepParams.duration as 'PHASE' | 'ROUND') ||
        (step.effectParams?.duration as 'PHASE' | 'ROUND') ||
        'PHASE';
      const sourceCardName =
        context.sourceCardInstance?.card.name || player.activeFormCard?.name || 'Stat Modifier';
      const sourceCardCode = context.sourceCardInstance?.card.code;

      if (
        targetParam === 'ALL_FRIENDLY_CHARACTERS' ||
        stepParams.atkBonus !== undefined ||
        stepParams.thwBonus !== undefined
      ) {
        const atkBonus =
          (stepParams.atkBonus as number) ||
          (step.effectParams?.atkBonus as number) ||
          (stepParams.stat === 'ATK' ? (stepParams.amount as number) : 0) ||
          0;
        const thwBonus =
          (stepParams.thwBonus as number) ||
          (step.effectParams?.thwBonus as number) ||
          (stepParams.stat === 'THW' ? (stepParams.amount as number) : 0) ||
          0;

        // Apply to player identity (Hero/Alter-Ego is a friendly character)
        if (!player.activeStatModifiers) player.activeStatModifiers = [];
        if (atkBonus) {
          player.activeStatModifiers.push({
            stat: 'ATK',
            amount: atkBonus,
            duration,
            sourceCardName,
            sourceCardCode,
          });
        }
        if (thwBonus) {
          player.activeStatModifiers.push({
            stat: 'THW',
            amount: thwBonus,
            duration,
            sourceCardName,
            sourceCardCode,
          });
        }

        // Apply to all allies
        for (const a of player.allies) {
          if (!a.activeStatModifiers) a.activeStatModifiers = [];
          if (atkBonus) {
            a.activeStatModifiers.push({
              stat: 'ATK',
              amount: atkBonus,
              duration,
              sourceCardName,
              sourceCardCode,
            });
          }
          if (thwBonus) {
            a.activeStatModifiers.push({
              stat: 'THW',
              amount: thwBonus,
              duration,
              sourceCardName,
              sourceCardCode,
            });
          }
        }

        return {
          state,
          success: true,
          mutatedState: true,
          onomatopoeia: `+${atkBonus} ATK / +${thwBonus} THW TO ALL CHARACTERS!`,
        };
      }

      if (
        targetParam === 'SELF' ||
        targetParam === 'TRIGGERING_HERO' ||
        targetParam === 'CHOSEN_CHARACTER' ||
        targetParam === 'CHOSEN_ALLY'
      ) {
        const stat = (stepParams.stat as any) || (step.effectParams?.stat as any) || 'ATK';
        const amount = (stepParams.amount as number) || (step.effectParams?.amount as number) || 1;

        // Resolve target card instance
        let targetCard = context.sourceCardInstance;
        if (!targetCard && context.sourceCardId) {
          targetCard =
            player.allies.find(
              (a) => a.instanceId === context.sourceCardId || a.card.code === context.sourceCardId,
            ) ||
            player.tableau.find(
              (t) => t.instanceId === context.sourceCardId || t.card.code === context.sourceCardId,
            );
        }

        if (targetCard) {
          if (!targetCard.activeStatModifiers) targetCard.activeStatModifiers = [];
          targetCard.activeStatModifiers.push({
            stat,
            amount,
            duration,
            sourceCardName,
            sourceCardCode,
          });

          return {
            state,
            success: true,
            mutatedState: true,
            onomatopoeia: `+${amount} ${stat}!`,
          };
        } else {
          // If target is player/hero identity
          if (!player.activeStatModifiers) player.activeStatModifiers = [];
          player.activeStatModifiers.push({
            stat,
            amount,
            duration,
            sourceCardName,
            sourceCardCode,
          });

          return {
            state,
            success: true,
            mutatedState: true,
            onomatopoeia: `+${amount} ${stat}!`,
          };
        }
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
      const targetParam = (step.effectParams?.target as string) || 'SELF_IDENTITY';
      let readyTargetName = player.name;

      const targets = resolveTargets(state, targetParam as any, context);
      if (targets.length === 0) {
        player.exhausted = false;
        readyTargetName = player.activeFormCard?.name || player.name;
      } else {
        const names: string[] = [];
        for (const t of targets) {
          if (t.kind === 'character') {
            if (t.entityType === 'hero' || t.entityType === 'alter_ego') {
              (t.entity as PlayerState).exhausted = false;
              names.push(
                (t.entity as PlayerState).activeFormCard?.name || (t.entity as PlayerState).name,
              );
            } else if (t.entityType === 'villain') {
              (t.entity as VillainState).exhausted = false;
              names.push((t.entity as VillainState).card?.name || 'Villain');
            } else {
              (t.entity as CardInstance).exhausted = false;
              names.push((t.entity as CardInstance).card?.name || 'Character');
            }
          } else if (t.kind === 'card') {
            t.entity.exhausted = false;
            names.push(t.entity.card?.name || 'Card');
          } else if (t.kind === 'player') {
            t.entity.exhausted = false;
            names.push(t.entity.activeFormCard?.name || t.entity.name);
          }
        }
        readyTargetName = names.join(', ') || player.name;
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
      const targetParam = (step.effectParams?.target as string) || 'SELF_IDENTITY';
      let exhaustTargetName = player.name;

      const targets = resolveTargets(state, targetParam as any, context);
      if (targets.length === 0) {
        player.exhausted = true;
        exhaustTargetName = player.activeFormCard?.name || player.name;
      } else {
        const names: string[] = [];
        for (const t of targets) {
          if (t.kind === 'character') {
            if (t.entityType === 'hero' || t.entityType === 'alter_ego') {
              (t.entity as PlayerState).exhausted = true;
              names.push(
                (t.entity as PlayerState).activeFormCard?.name || (t.entity as PlayerState).name,
              );
            } else if (t.entityType === 'villain') {
              (t.entity as VillainState).exhausted = true;
              names.push((t.entity as VillainState).card?.name || 'Villain');
            } else {
              (t.entity as CardInstance).exhausted = true;
              names.push((t.entity as CardInstance).card?.name || 'Character');
            }
          } else if (t.kind === 'card') {
            t.entity.exhausted = true;
            names.push(t.entity.card?.name || 'Card');
          } else if (t.kind === 'player') {
            t.entity.exhausted = true;
            names.push(t.entity.activeFormCard?.name || t.entity.name);
          }
        }
        exhaustTargetName = names.join(', ') || player.name;
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
      if (context.choice || step.effectParams?.stat) {
        const amount = (step.effectParams?.amount as number) || 2;
        const chosenStat =
          (context.choice as string) || (step.effectParams?.stat as string) || 'ATK';
        return executeEffect(
          state,
          {
            effect: 'MODIFY_STAT',
            effectParams: {
              stat: chosenStat,
              amount,
              duration: 'PHASE',
              target: 'SELF',
            },
          },
          context,
        );
      }

      let options = (step.effectParams?.options as any[]) || [];
      if (options.length > 0 && typeof options[0] === 'string') {
        const amt = (step.effectParams?.amount as number) || 2;
        options = options.map((opt: string) => ({
          id: opt,
          label: `+${amt} ${opt}`,
          description: `Boost ${opt} by ${amt} until end of phase`,
          effect: 'MODIFY_STAT',
          params: { stat: opt, amount: amt, duration: 'PHASE', target: 'SELF' },
        }));
      }
      const title =
        (step.effectParams?.title as string) ||
        (step.effectParams?.promptTitle as string) ||
        'Choose an Option';
      const description = (step.effectParams?.description as string) || '';
      const sourceCardName = context.sourceCardInstance?.card.name || step.id || 'Card Ability';
      const promptId = `prompt_${Date.now()}_${step.id || 'choice'}`;
      state = enqueueDecisionPrompt(state, {
        promptId,
        playerId: context.playerId || player.id,
        title,
        description,
        sourceCardName,
        sourceCardCode: context.sourceCardInstance?.card.code,
        sourceCardInstanceId: context.sourceCardInstance?.instanceId,
        triggerSourceCard: context.sourceCardInstance?.card,
        options,
        isVoluntary: (step.effectParams?.isVoluntary as boolean) ?? false,
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
        (step.effectParams?.defenderType as 'HERO' | 'ALLY' | 'UNDEFENDED') || 'UNDEFENDED';
      const allyInstanceId = step.effectParams?.allyInstanceId as string | undefined;
      const playerId = context.playerId || (step.effectParams?.playerId as string) || player.id;
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
        player.currentForm === 'hero'
          ? step.effectParams?.heroSteps
          : step.effectParams?.alterEgoSteps;
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
      const fromZone = (step.effectParams?.from as string) || 'SET_ASIDE';
      const toZone = (step.effectParams?.to as string) || 'ENGAGED_WITH_PLAYER';
      const filter = (step.effectParams?.filter || step.filter) as Record<string, any> | undefined;

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
        step.effectParams?.target === 'SELF' && context.sourceCardInstance
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
        (step.effectParams?.from as string) ||
        (step.effectParams?.count !== undefined ? 'DISCARD' : 'SET_ASIDE');
      const toDeck =
        (step.effectParams?.toDeck as string) ||
        (step.effectParams?.count !== undefined ? 'PLAYER_DECK' : 'ENCOUNTER_DECK');
      const filter = (step.effectParams?.filter || step.filter) as Record<string, any> | undefined;
      const count = step.effectParams?.count as number | undefined;
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
        step.effectParams?.amount ?? step.effectParams?.amountPerPlayer,
        context,
        1,
        { state, player },
      );
      const isPerPlayer = !!(step.effectParams?.perPlayer || step.effectParams?.amountPerPlayer);
      const amount = isPerPlayer ? baseAmount * state.players.length : baseAmount;
      const targetParam =
        (step.effectParams?.target as string) ||
        (step.effectParams?.targetInstanceId ? 'CHOSEN_SCHEME' : undefined) ||
        'MAIN_SCHEME';
      const targetContext: EffectContext = {
        ...context,
        targetInstanceId:
          (step.effectParams?.targetInstanceId as string) || context?.targetInstanceId,
      };

      if (targetParam === 'ALL_SIDE_SCHEMES') {
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
        (step.effectParams?.cardCode as string) ||
        (targetParam !== 'MAIN_SCHEME' &&
        targetParam !== 'THIS_SIDE_SCHEME' &&
        targetParam !== 'CHOSEN_SCHEME' &&
        /^\d{5}$/.test(targetParam)
          ? targetParam
          : undefined);
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

      const targetSchemes = resolveSchemeTargets(state, targetParam as any, targetContext);
      if (targetSchemes.length > 0) {
        for (const st of targetSchemes) {
          st.entity.threat = (st.entity.threat || 0) + amount;
          state.log.push({
            id: `log_${Date.now()}`,
            timestamp: Date.now(),
            round: state.roundNumber,
            phase: state.phase,
            key: 'scheme.threat.added',
            params: {
              target: st.entity.card?.name || 'Scheme',
              instanceId: st.entity.instanceId || 'scheme',
              amount,
              total: st.entity.threat,
            },
            onomatopoeia: `SCHEME THREAT +${amount}!`,
          });
        }
        return {
          state,
          success: true,
          mutatedState: amount > 0,
          value: amount,
          onomatopoeia: `SCHEME THREAT +${amount}!`,
        };
      }

      state.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        key: 'scheme.threat.target_missing',
        params: { target: targetParam, amount },
      });
      return {
        state,
        success: true,
        mutatedState: false,
        value: 0,
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
      const targetParam = (step.effectParams?.target as string) || 'SELF';
      const counterType = (step.effectParams?.counterType as string) || 'all_purpose';
      let amount = (step.effectParams?.amount as number) || 1;
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
      const targetParam = (step.effectParams?.target as string) || 'SELF';
      const counterType = (step.effectParams?.counterType as string) || 'all_purpose';
      let amount = (step.effectParams?.amount as number) || 1;
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
      const targetZone = (step.effectParams?.targetZone as string) || 'TABLEAU';
      const traitFilter = step.effectParams?.traitFilter as string | undefined;
      const counterType = step.effectParams?.counterType as string | undefined;
      const amountParam = step.effectParams?.amount;

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
      const autoResolveEnabled = state.options?.autoResolveUnambiguous !== false;
      const stepAutoSelect = step.effectParams?.autoSelectIfUnambiguous !== false;
      const allowAutoSelect = autoResolveEnabled && stepAutoSelect;

      const rawSource = step.effectParams?.source;
      const sourceZones: SearchZone[] = (
        Array.isArray(rawSource) ? rawSource : [rawSource || 'PLAYER_DECK']
      ) as SearchZone[];

      let resolvedLookCount: number | 'ALL' | undefined = undefined;
      if (step.effectParams?.lookCount === 'ALL') {
        resolvedLookCount = 'ALL';
      } else if (step.effectParams?.lookCount !== undefined) {
        resolvedLookCount = resolveNumericAmount(step.effectParams.lookCount, context, 0, {
          state,
          player,
        });
      }
      const isFullSearch =
        resolvedLookCount === undefined || resolvedLookCount === 'ALL' || resolvedLookCount === 0;
      const isLookCountSpliced =
        !isFullSearch && typeof resolvedLookCount === 'number' && resolvedLookCount > 0;

      let resolvedTakeCount: number | 'ALL' = 1;
      if (step.effectParams?.takeCount === 'ALL') {
        resolvedTakeCount = 'ALL';
      } else if (step.effectParams?.takeCount !== undefined) {
        resolvedTakeCount = resolveNumericAmount(step.effectParams.takeCount, context, 1, {
          state,
          player,
        });
      }
      const isTakeAll = resolvedTakeCount === 'ALL' || resolvedTakeCount === 0;
      const countToTake = isTakeAll ? 0 : Math.max(1, resolvedTakeCount as number);

      const filter =
        (step.effectParams?.filter || step.filter) ??
        (step.effectParams?.targetCardCode ||
        step.effectParams?.targetCardName ||
        step.effectParams?.trait ||
        step.effectParams?.type ||
        step.effectParams?.type_code ||
        step.effectParams?.cardType
          ? {
              targetCardCode: step.effectParams?.targetCardCode,
              targetCardName: step.effectParams?.targetCardName,
              trait: step.effectParams?.trait,
              type:
                step.effectParams?.type ||
                step.effectParams?.type_code ||
                step.effectParams?.cardType,
            }
          : undefined);

      const targetParam =
        (step.effectParams?.target as string) || (step.target as string) || 'SELF';
      let targetPlayerId: string | undefined =
        (step.effectParams?.targetPlayerId as string) || context.targetPlayerId;

      if (targetParam === 'CHOSEN_PLAYER' && state.players.length > 1 && !targetPlayerId) {
        const eligiblePlayers = state.players.filter((p) =>
          p.discard.some((c) => matchesCardFilter(c.card, filter, { state, player: p })),
        );

        if (allowAutoSelect && eligiblePlayers.length === 1) {
          targetPlayerId = eligiblePlayers[0].id;
        } else {
          const promptId = `prompt_${Date.now()}_choose_search_player`;
          const sourceCardName =
            context.sourceCardInstance?.card.name ||
            player.activeFormCard?.name ||
            'Search & Select';

          const prompt: PendingDecisionPrompt = {
            promptId,
            playerId: player.id,
            title: 'Choose a Player',
            description: 'Choose a player to return a card to their hand:',
            sourceCardName,
            sourceCardCode: context.sourceCardInstance?.card.code,
            sourceCardInstanceId: context.sourceCardInstance?.instanceId,
            options: state.players.map((p) => {
              const isEligible = eligiblePlayers.some((ep) => ep.id === p.id);
              return {
                id: `choose_player_${p.id}`,
                label: `${p.name} (${p.hero?.name || 'Hero'})`,
                description: `Choose ${p.name}`,
                effect: 'SEARCH',
                disabled: !isEligible,
                disabledReason: !isEligible ? 'No Tech upgrade in discard pile' : undefined,
                params: {
                  ...step.effectParams,
                  targetPlayerId: p.id,
                  target: 'CHOSEN_PLAYER',
                },
              };
            }),
          };

          state = enqueueDecisionPrompt(state, prompt);
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
            mutatedState: false,
            onomatopoeia: 'CHOOSE PLAYER!',
          };
        }
      }

      const targetPlayer =
        (targetPlayerId ? state.players.find((p) => p.id === targetPlayerId) : undefined) || player;

      const selectedDestination = (step.effectParams?.selectedDestination as string) || 'HAND';
      const unselectedDestination = step.effectParams?.unselectedDestination as
        string | null | undefined;
      const shuffleAfter =
        step.effectParams?.shuffleAfter !== undefined
          ? (step.effectParams.shuffleAfter as boolean)
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
      } else if (step.effectParams?.isVoluntary !== undefined) {
        isVoluntary = Boolean(step.effectParams.isVoluntary);
      } else if (isAction) {
        isVoluntary = true;
      }

      const promptTitle =
        (step.effectParams?.promptTitle as string) ||
        (context.sourceCardInstance
          ? `${context.sourceCardInstance.card.name}: Choose card(s)`
          : 'Search & Select: Choose card(s)');

      const cardOriginMap = new Map<string, SearchZone>();
      const getZonePile = (zone: SearchZone): { pile: CardInstance[]; isDeck: boolean } => {
        switch (zone) {
          case 'PLAYER_DISCARD':
            return { pile: targetPlayer.discard, isDeck: false };
          case 'PLAYER_HAND':
            return { pile: targetPlayer.hand, isDeck: false };
          case 'ENCOUNTER_DECK':
            return { pile: state.encounterDeck, isDeck: true };
          case 'ENCOUNTER_DISCARD':
            return { pile: state.encounterDiscard, isDeck: false };
          case 'PLAYER_DECK':
          default:
            return { pile: targetPlayer.deck, isDeck: true };
        }
      };

      const shuffleSearchedDecks = () => {
        if (sourceZones.includes('ENCOUNTER_DECK')) {
          state.encounterDeck.sort(() => Math.random() - 0.5);
        }
        if (sourceZones.includes('PLAYER_DECK')) {
          targetPlayer.deck.sort(() => Math.random() - 0.5);
        }
      };

      // Determine candidate pool
      let lookedCards: CardInstance[] = [];
      if (isLookCountSpliced) {
        let remainingToLook = resolvedLookCount as number;
        for (const zone of sourceZones) {
          if (remainingToLook <= 0) break;
          const { pile } = getZonePile(zone);
          const isDiscardZone = zone === 'PLAYER_DISCARD' || zone === 'ENCOUNTER_DISCARD';
          const shouldReverse = isDiscardZone && step.effectParams?.fromTop === true;
          const workingPile = shouldReverse ? [...pile].reverse() : pile;
          const sliceCount = Math.min(remainingToLook, workingPile.length);
          const spliced = workingPile.splice(0, sliceCount);
          if (shouldReverse) {
            const splicedIds = new Set(spliced.map((c) => c.instanceId));
            const actualPile = getZonePile(zone).pile;
            for (let i = actualPile.length - 1; i >= 0; i--) {
              if (splicedIds.has(actualPile[i].instanceId)) {
                actualPile.splice(i, 1);
              }
            }
          }
          for (const card of spliced) {
            cardOriginMap.set(card.instanceId, zone);
          }
          lookedCards.push(...spliced);
          remainingToLook -= sliceCount;
        }
      } else {
        for (const zone of sourceZones) {
          const { pile } = getZonePile(zone);
          const isDiscardZone = zone === 'PLAYER_DISCARD' || zone === 'ENCOUNTER_DISCARD';
          const shouldReverse = isDiscardZone && step.effectParams?.fromTop === true;
          const cardsToLook = shouldReverse ? [...pile].reverse() : pile;
          for (const card of cardsToLook) {
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
            if (origin === 'PLAYER_DISCARD') targetPlayer.discard.push(card);
            else if (origin === 'PLAYER_HAND') targetPlayer.hand.push(card);
            else if (origin === 'ENCOUNTER_DECK') state.encounterDeck.unshift(card);
            else if (origin === 'ENCOUNTER_DISCARD') state.encounterDiscard.push(card);
            else targetPlayer.deck.unshift(card);
          }
          return;
        }

        if (destination === 'REVEAL') {
          for (const card of cards) {
            resolveActiveEncounterCardAfterInterrupt(state, card, targetPlayer, false);
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
                    playerId: targetPlayer.id,
                    sourceCardInstance: card,
                  });
                }
              }
            } else {
              targetPlayer.tableau.push(card);
            }
          }
        } else if (destination === 'HAND') {
          targetPlayer.hand.push(...cards);
        } else if (destination === 'DISCARD') {
          for (const card of cards) {
            const origin = cardOriginMap.get(card.instanceId) || sourceZones[0];
            if (origin.startsWith('ENCOUNTER') || card.card.faction === 'encounter') {
              state.encounterDiscard.push(card);
            } else {
              targetPlayer.discard.push(card);
            }
          }
        } else if (destination === 'DECK_TOP') {
          for (const card of cards) {
            const origin = cardOriginMap.get(card.instanceId) || sourceZones[0];
            if (origin.startsWith('ENCOUNTER') || card.card.faction === 'encounter') {
              state.encounterDeck.unshift(card);
            } else {
              targetPlayer.deck.unshift(card);
            }
          }
        } else if (destination === 'DECK_BOTTOM') {
          for (const card of cards) {
            const origin = cardOriginMap.get(card.instanceId) || sourceZones[0];
            if (origin.startsWith('ENCOUNTER') || card.card.faction === 'encounter') {
              state.encounterDeck.push(card);
            } else {
              targetPlayer.deck.push(card);
            }
          }
        } else if (destination === 'DECK_SHUFFLE') {
          for (const card of cards) {
            const origin = cardOriginMap.get(card.instanceId) || sourceZones[0];
            if (origin.startsWith('ENCOUNTER') || card.card.faction === 'encounter') {
              state.encounterDeck.push(card);
              state.encounterDeck.sort(() => Math.random() - 0.5);
            } else {
              targetPlayer.deck.push(card);
              targetPlayer.deck.sort(() => Math.random() - 0.5);
            }
          }
        }
      };

      // Filter matching candidate cards
      let matchingCandidates = lookedCards.filter((c) =>
        matchCardFilter(c.card, filter, targetPlayer),
      );
      if (step.effectParams?.fromTop === true) {
        matchingCandidates = matchingCandidates.slice(0, countToTake);
      }

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
        (!step.effectParams?.isVoluntary &&
          allowAutoSelect &&
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
          targetPlayerId: targetPlayer.id,
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
            targetPlayerId: targetPlayer.id,
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
        playerId: context.playerId || player.id,
        title: promptTitle,
        description: `Select up to ${effectiveTakeCount} card(s):`,
        sourceCardName: context.sourceCardInstance?.card.name || 'Search & Select',
        sourceCardCode: context.sourceCardInstance?.card.code,
        sourceCardInstanceId: context.sourceCardInstance?.instanceId,
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
      const traitFilter = step.effectParams?.trait as string | undefined;
      const typeFilter =
        (step.effectParams?.type as string) ||
        (step.effectParams?.type_code as string) ||
        'upgrade';

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
      const specialId = (step.effectParams?.specialId as string) || 'WAKANDA_FOREVER';
      const handler = getSpecialHandler(specialId);
      if (!handler) {
        return {
          state,
          success: false,
          error: `Special handler not found for ${specialId}`,
        };
      }
      return handler.execute(state, context, step.effectParams);
    }

    case 'TRANSFER_DAMAGE': {
      let amount = resolveNumericAmount(
        step.effectParams?.amount ?? step.effectParams?.baseAmount,
        context,
        1,
        {
          state,
          player,
          sourceCardInstance: context.sourceCardInstance,
          targetInstanceId:
            (step.effectParams?.targetInstanceId as string) || context.targetInstanceId,
        },
      );
      if (step.effectParams?.dynamicBonus) {
        const bonus = resolveNumericAmount(step.effectParams.dynamicBonus as any, context, 0, {
          state,
          player,
          sourceCardInstance: context.sourceCardInstance,
          targetInstanceId:
            (step.effectParams?.targetInstanceId as string) || context.targetInstanceId,
        });
        amount += bonus;
      }
      if (context.isFinalStep && step.effectParams?.finisherBonus) {
        amount += (step.effectParams.finisherBonus as number) || 0;
      }

      const targetEnemyId =
        (step.effectParams?.targetInstanceId as string) || context.targetInstanceId;
      player.health = Math.min(getEffectiveMaxHealth(player, state), player.health + amount);
      if (
        targetEnemyId &&
        targetEnemyId !== 'villain' &&
        targetEnemyId !== state.villain.instanceId
      ) {
        let targetMinion: CardInstance | undefined;
        for (const p of state.players) {
          targetMinion = p.engagedMinions.find((m) => m.instanceId === targetEnemyId);
          if (targetMinion) break;
        }
        if (targetMinion) {
          dealDirectDamage(state, { type: 'MINION', instanceId: targetMinion.instanceId }, amount);
        } else {
          dealDirectDamage(state, 'VILLAIN', amount);
        }
      } else {
        dealDirectDamage(state, 'VILLAIN', amount);
      }

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
      const stepParams = getStepEffectParams(step);
      const amount = (stepParams.amount as number) || (step.effectParams?.amount as number) || 1;
      const targetParam =
        (stepParams.target as string) || (step.effectParams?.target as string) || 'CHOSEN_PLAYER';
      const duration = (stepParams.duration as 'PHASE' | 'ROUND' | 'TURN') || 'PHASE';
      const cardFilter = stepParams.cardFilter || (stepParams.filter as any) || step.filter;
      const targetPlayerId = (context.targetPlayerId || stepParams.targetPlayerId) as
        string | undefined;

      // In multiplayer mode, if targeting CHOSEN_PLAYER and no target player specified yet, prompt player to choose
      if (targetParam === 'CHOSEN_PLAYER' && state.players.length > 1 && !targetPlayerId) {
        const sourceCardName =
          context.sourceCardInstance?.card.name || player.activeFormCard?.name || 'Helicarrier';
        const promptId = `prompt_${Date.now()}_choose_cost_reduction_player`;
        state = enqueueDecisionPrompt(state, {
          promptId,
          playerId: player.id,
          title: 'Choose a Player',
          description: `Choose a player to reduce the resource cost of the next card they play this phase by ${amount}:`,
          sourceCardName,
          options: state.players.map((p) => ({
            id: `reduce_cost_${p.id}`,
            label: `${p.name} (${p.hero?.name || 'Hero'})`,
            description: `Give -${amount} cost reduction to ${p.name}`,
            effect: 'REDUCE_NEXT_CARD_COST',
            params: {
              amount,
              duration,
              cardFilter,
              targetPlayerId: p.id,
              target: 'CHOSEN_PLAYER',
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

      // Determine recipient player
      let targetPlayer = player;
      if (targetPlayerId) {
        const found = state.players.find((p) => p.id === targetPlayerId);
        if (found) targetPlayer = found;
      }

      const sourceCardName = context.sourceCardInstance?.card.name || 'Helicarrier';
      const sourceCardCode = context.sourceCardInstance?.card.code;

      const reduction: ActiveCostReduction = {
        id: `cost_red_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        sourceCardName,
        sourceCardCode,
        amount,
        duration,
        cardFilter,
        appliesTo: 'NEXT_CARD',
      };

      if (!targetPlayer.activeCostReductions) {
        targetPlayer.activeCostReductions = [];
      }
      targetPlayer.activeCostReductions.push(reduction);
      targetPlayer.costReductions = targetPlayer.activeCostReductions.reduce(
        (sum, r) => sum + r.amount,
        0,
      );

      state.log.push({
        id: `log_${Date.now()}_cost_red`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        category: 'ability',
        key: 'cost.reduced',
        params: {
          player: targetPlayer.name,
          source: sourceCardName,
          amount,
        },
        onomatopoeia: `${sourceCardName.toUpperCase()} DISCOUNT! -${amount} COST`,
      });

      return {
        state,
        success: true,
        mutatedState: true,
        onomatopoeia: `${sourceCardName.toUpperCase()} DISCOUNT! -${amount} COST`,
      };
    }

    case 'PLAY_FROM_ZONE': {
      const source = (step.effectParams?.source as string) || 'PLAYER_DISCARD';
      const filter = (step.effectParams?.filter || step.filter) as Record<string, any> | undefined;
      const costMode = (step.effectParams?.costMode as string) || 'PRINTED_COST';
      const costReduction = (step.effectParams?.costReduction as number) || 0;
      const destination = (step.effectParams?.destination as string) || 'TABLEAU';
      const control = (step.effectParams?.control as string) || 'SELF';
      const promptTitle =
        (step.effectParams?.promptTitle as string) ||
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

  if (typeof target === 'object' && target.type === 'MINION') {
    for (const p of state.players) {
      const minionIdx = p.engagedMinions.findIndex((m) => m.instanceId === target.instanceId);
      if (minionIdx !== -1) {
        const minion = p.engagedMinions[minionIdx];
        const toughIdx = (minion.statusCards || []).indexOf(StatusCard.TOUGH);
        if (toughIdx !== -1) {
          minion.statusCards!.splice(toughIdx, 1);
          return { damageDealt: 0, absorbedByTough: true };
        }
        const currentDmg = minion.tokens?.damage || 0;
        const newDmg = currentDmg + amount;
        const minionHp = (minion.card as MinionCard).health || 1;
        if (newDmg >= minionHp) {
          processHostDefeated(state, minion, { player: p });
          p.engagedMinions.splice(minionIdx, 1);
          moveDefeatedCardToPile(state, minion, state.encounterDiscard);
        } else {
          minion.tokens = { ...minion.tokens, damage: newDmg };
        }
        return { damageDealt: amount, absorbedByTough: false };
      }
    }
  }

  return { damageDealt: amount, absorbedByTough: false };
}
