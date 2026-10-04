import {
  GameState,
  CardInstance,
  PlayerState,
  StatusCard,
  ConditionGate,
  StepResolutionResult,
  getActiveVillain,
  getVillainsInPlay,
} from '../models';
import { AbilityStep } from '../models/abilities';
import { getStepGateParams } from '../../data/supplemental/schema';
import { hasPlayerTrait } from './stat-calculator';

/**
 * Minimal context the gate evaluator needs. `EffectExecutionContext` satisfies it structurally,
 * and the CONSTANT stat-calculator loop supplies only `playerId`.
 */
export interface StepGateContext {
  playerId: string;
  resourcesSpent?: string[];
  discardedCards?: CardInstance[];
}

/**
 * Single canonical evaluation of a step's `gate` (RR v1.8 p. 2, 24), shared by the sequential
 * effect pipeline and the CONSTANT stat-calculator loop (Issue #122, ADR-0019).
 *
 * Result-based gates (`THEN`, `IF_PREVIOUS_SUCCESS`, `IF_AMOUNT_ZERO`, `IF_ZERO_HEALED`,
 * `IF_FAILED`) read `prevResult` / `stepResultsMap`. CONSTANT steps have no previous step, so
 * callers pass no result and these gates do not apply.
 */
export function evaluateStepGate(
  gate: ConditionGate | undefined,
  prevResult: StepResolutionResult | undefined,
  state: GameState,
  step: AbilityStep,
  context: StepGateContext,
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
      return getActiveVillain(state).statusCards.includes(statusParam as StatusCard);
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
      const inVillainAttachments = getVillainsInPlay(state).some((v) =>
        v.attachments?.some((a) => a.card?.code === cardCode),
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
      const inVillainAttachments = getVillainsInPlay(state).some((v) =>
        v.attachments?.some((a) => a.card?.code === cardCode),
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

  // Exact negation of IF_CONDITION_MET for the same `condition` / `gateParams`: use it for the
  // "otherwise / instead" branch of a printed "if X ... instead" ability.
  if (gate === 'IF_CONDITION_NOT_MET') {
    return !evaluateStepGate('IF_CONDITION_MET', prevResult, state, step, context, stepResultsMap);
  }

  if (gate === 'IF_CONDITION_MET') {
    if (step.condition === 'TARGET_TRAIT_MATCH') {
      const requiredTrait =
        (gateParams.trait as string) ||
        (Array.isArray(gateParams.traits) ? (gateParams.traits[0] as string) : undefined);
      const player = state.players.find((p) => p.id === context.playerId) || state.players[0];
      if (requiredTrait && player) {
        return hasPlayerTrait(player, requiredTrait, state);
      }
    }
    return !!evaluatedResult && evaluatedResult.conditionMet === true;
  }

  if (gate === 'IF_FORM') {
    const player = state.players.find((p) => p.id === context.playerId) || state.players[0];
    return !!player && evaluateFormGate(player, gateParams);
  }

  return true;
}

/**
 * True when the step carries a gate that depends only on the current game state (never on a
 * previous step's result) and that gate is closed right now, so the step cannot run. Lets callers
 * that look ahead at an ability's steps (chosen-target pre-selection) ignore steps that will be
 * skipped, e.g. the non-Aerial branch of an "if you have Aerial ... instead" ability.
 */
export function isStepGateClosedByState(
  step: AbilityStep,
  state: GameState,
  context: StepGateContext,
): boolean {
  const gate = step.gate;
  if (!gate) return false;
  const isStateOnly =
    gate === 'IF_FORM' ||
    gate === 'IF_CARD_IN_PLAY' ||
    gate === 'IF_CARD_NOT_IN_PLAY' ||
    ((gate === 'IF_CONDITION_MET' || gate === 'IF_CONDITION_NOT_MET') &&
      step.condition === 'TARGET_TRAIT_MATCH');
  return isStateOnly && !evaluateStepGate(gate, undefined, state, step, context);
}

/**
 * `IF_FORM` gate: true when the player's current identity form matches `gateParams.form`
 * (`hero` or `alter_ego`; `alter-ego` is accepted as an alias). Needs only the player, so
 * trait and stat calculators can evaluate it without a `GameState`.
 */
export function evaluateFormGate(
  player: PlayerState,
  gateParams: Record<string, unknown>,
): boolean {
  const targetForm = ((gateParams.form as string) || '').toLowerCase();
  if (!targetForm) return false;
  const currentForm = (player.currentForm || 'hero').toLowerCase();
  return (
    currentForm === targetForm ||
    (targetForm === 'alter_ego' && currentForm === 'alter-ego') ||
    (targetForm === 'alter-ego' && currentForm === 'alter_ego')
  );
}
