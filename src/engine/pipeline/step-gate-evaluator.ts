import {
  GameState,
  CardInstance,
  PlayerState,
  StepResolutionResult,
  getVillainsInPlay,
} from '../models';
import { AbilityStep } from '../models/abilities';
import { getStepGateParams, GATE_REGISTRY, AttackerKind } from '../../data/supplemental/schema';
import { hasPlayerTrait } from './stat-calculator';

/**
 * Minimal context the gate evaluator needs. `EffectExecutionContext` satisfies it structurally,
 * and the CONSTANT stat-calculator loop supplies only `playerId` or `player`.
 */
export interface StepGateContext {
  playerId: string;
  player?: PlayerState;
  resourcesSpent?: string[];
  discardedCards?: CardInstance[];
  /** Who is making the attack being resolved (set while resolving boost cards). */
  attackerType?: 'VILLAIN' | 'MINION';
  /** Who defended that attack; `UNDEFENDED` when no hero or ally was declared. */
  defenderType?: 'HERO' | 'ALLY' | 'UNDEFENDED';
  /**
   * Final damage the attack being resolved dealt to the defending character (after DEF, Tough and
   * prevention). Set only while a deferred boost ability resolves after step 6.
   */
  activationDamage?: number;
}

/**
 * Single canonical evaluation of a step's `gate` (RR v1.8 p. 2, 24), shared by the sequential
 * effect pipeline and the CONSTANT stat-calculator loop (Issue #122, ADR-0019, ADR-0080).
 *
 * Result-based gates (`THEN`, `IF_RESULT`) read `prevResult` / `stepResultsMap`. CONSTANT steps
 * have no previous step, so callers pass no result and these gates do not apply.
 */
export function evaluateStepGate(
  step: AbilityStep,
  prevResult: StepResolutionResult | undefined,
  state: GameState,
  context: StepGateContext,
  stepResultsMap?: Map<string, StepResolutionResult>,
): boolean {
  if (!step.gate) return true;

  const gateParams = getStepGateParams(step);
  const targetStepId = gateParams.step as string | undefined;
  const rawResult = targetStepId ? stepResultsMap?.get(targetStepId) : prevResult;
  const evaluatedResult = rawResult?.skipped ? undefined : rawResult;

  let gateSatisfied: boolean;

  switch (step.gate) {
    case 'THEN': {
      gateSatisfied = Boolean(
        evaluatedResult && evaluatedResult.success && evaluatedResult.mutatedState,
      );
      break;
    }

    case 'IF_RESULT': {
      if (!evaluatedResult || !evaluatedResult.facts) {
        gateSatisfied = false;
        break;
      }
      const rawFact = (gateParams.result ?? gateParams.fact) as string | undefined;
      const normalizedFact = rawFact?.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase();
      switch (normalizedFact) {
        case 'TARGET_DEFEATED':
        case 'DEFEATED':
          gateSatisfied = Boolean(
            evaluatedResult.facts.targetDefeated ??
            evaluatedResult.facts.defeated ??
            evaluatedResult.facts.villainDefeated,
          );
          break;
        case 'EXCESS_DAMAGE_DEALT':
        case 'EXCESS_DAMAGE':
          gateSatisfied = (evaluatedResult.facts.excessDamage ?? 0) > 0;
          break;
        case 'FULLY_HEALED':
          gateSatisfied = Boolean(evaluatedResult.facts.fullyHealed);
          break;
        case 'SCHEME_EMPTY':
        case 'THREAT_ZERO':
          gateSatisfied = Boolean(
            evaluatedResult.facts.schemeEmpty ?? evaluatedResult.facts.threatZero,
          );
          break;
        case 'STATUS_APPLIED':
        case 'STATUS_ADDED':
          gateSatisfied = Boolean(
            evaluatedResult.facts.statusApplied ?? evaluatedResult.facts.statusAdded,
          );
          break;
        case 'ALREADY_HAD_STATUS':
          gateSatisfied = Boolean(evaluatedResult.facts.alreadyHadStatus);
          break;
        case 'STATUS_REMOVED':
          gateSatisfied = Boolean(evaluatedResult.facts.statusRemoved);
          break;
        case 'AMOUNT_ZERO':
          gateSatisfied = Boolean(evaluatedResult.facts.amountZero);
          break;
        default:
          gateSatisfied = false;
          break;
      }
      break;
    }

    case 'IF_FORM': {
      const player =
        context.player ||
        state?.players?.find((p) => p.id === context.playerId) ||
        state?.players?.[0];
      gateSatisfied = Boolean(player && evaluateFormGate(player, gateParams.form as string));
      break;
    }

    case 'IF_PLAYER_HAS_TRAIT': {
      const player =
        context.player ||
        state?.players?.find((p) => p.id === context.playerId) ||
        state?.players?.[0];
      const trait = gateParams.trait as string | undefined;
      gateSatisfied = Boolean(player && trait && state && hasPlayerTrait(player, trait, state));
      break;
    }

    case 'IF_ZONE_EMPTY': {
      gateSatisfied = isZoneEmpty(state, gateParams.zone as string | undefined, context.playerId);
      break;
    }

    case 'IF_CARD_IN_PLAY': {
      const cardCode = (gateParams.cardCode ?? (gateParams as Record<string, unknown>).cardId) as
        string | undefined;
      if (!cardCode || !state) {
        gateSatisfied = false;
        break;
      }
      const matchesCard = (c: { card?: { code?: string; id?: string } } | undefined) =>
        c?.card?.code === cardCode || c?.card?.id === cardCode;

      const inSideSchemes = state.sideSchemes?.some(matchesCard);
      const inVillainAttachments = getVillainsInPlay(state).some((v) =>
        v.attachments?.some(matchesCard),
      );
      const inPlayerZones = state.players?.some((p) =>
        [
          ...(p.tableau || []),
          ...(p.allies || []),
          ...(p.engagedMinions || []),
          ...(p.attachments || []),
        ].some(matchesCard),
      );
      gateSatisfied = Boolean(inSideSchemes || inVillainAttachments || inPlayerZones);
      break;
    }

    case 'IF_RESOURCE_MATCH': {
      const reqAspect = ((gateParams.resource as string) || '').toLowerCase();
      const requiredCount = (gateParams.count as number) || 1;
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
        gateSatisfied = matchingCount >= requiredCount && passesOnly;
      } else {
        const discarded: CardInstance[] =
          context.discardedCards || evaluatedResult?.discardedCards || [];
        if (discarded.length > 0) {
          gateSatisfied = discarded.some((inst) => {
            if (!inst?.card) return false;
            const res = inst.card.resources;
            const raw = inst.card.raw as any;
            const wildCount = res?.wild ?? raw?.resource_wild ?? 0;
            if (!requirePrinted && wildCount > 0) return true;
            const matchCount =
              res?.[reqAspect as keyof typeof res] ?? raw?.[`resource_${reqAspect}`] ?? 0;
            return typeof matchCount === 'number' && matchCount > 0;
          });
        } else {
          gateSatisfied = false;
        }
      }
      break;
    }

    case 'IF_UNDEFENDED_ATTACK': {
      if (context.defenderType !== 'UNDEFENDED') {
        gateSatisfied = false;
        break;
      }
      const kind = gateParams.attackerKind as AttackerKind | undefined;
      gateSatisfied = !kind || kind === 'ANY_ENEMY' || kind === context.attackerType;
      break;
    }

    case 'IF_ACTIVATION_DEALT_DAMAGE': {
      gateSatisfied = (context.activationDamage ?? 0) > 0;
      break;
    }

    default:
      throw new Error(`Unknown step gate: ${(step as any).gate}`);
  }

  // 4. If the gate has a form qualifier, it must also match
  if (gateParams.form && step.gate !== 'IF_FORM') {
    const player =
      context.player ||
      state?.players?.find((p) => p.id === context.playerId) ||
      state?.players?.[0];
    if (!player || !evaluateFormGate(player, gateParams.form as string)) {
      gateSatisfied = false;
    }
  }

  // 5. negate inverts the final value
  if (gateParams.negate) {
    gateSatisfied = !gateSatisfied;
  }

  return gateSatisfied;
}

/**
 * `IF_ZONE_EMPTY` gate: true when the zone named by `zone` holds no cards.
 */
export function isZoneEmpty(
  state: GameState | undefined,
  zone: string | undefined,
  playerId: string,
): boolean {
  if (!state) return false;
  switch (zone) {
    case 'SIDE_SCHEMES':
      return (state.sideSchemes || []).length === 0;
    case 'ENCOUNTER_DECK':
      return state.encounterDeck.length === 0;
    case 'ENCOUNTER_DISCARD':
      return state.encounterDiscard.length === 0;
    case 'HAND':
    case 'DECK':
    case 'DISCARD': {
      const player = state.players?.find((p) => p.id === playerId);
      if (!player) return false;
      const pile = zone === 'HAND' ? player.hand : zone === 'DECK' ? player.deck : player.discard;
      return pile.length === 0;
    }
    default:
      return false;
  }
}

/**
 * True when the step carries a gate that depends only on the current game state (never on a
 * previous step's result) and that gate is closed right now, so the step cannot run.
 */
export function isStepGateClosedByState(
  step: AbilityStep,
  state: GameState,
  context: StepGateContext,
): boolean {
  const gate = step.gate;
  if (!gate) return false;
  const meta = GATE_REGISTRY[gate];
  if (!meta || meta.kind !== 'STATE') return false;
  return !evaluateStepGate(step, undefined, state, context);
}

/**
 * `IF_FORM` gate / form qualifier: true when the player's current identity form matches `form`
 * (`HERO` or `ALTER_EGO`). Converts uppercase supplemental enum to player state representation.
 */
export function evaluateFormGate(
  player: PlayerState,
  formOrParams?: string | Record<string, unknown>,
): boolean {
  if (!formOrParams) return false;
  const rawForm =
    typeof formOrParams === 'object' ? (formOrParams.form as string | undefined) : formOrParams;
  if (!rawForm) return false;
  const current = (player.currentForm || 'hero').toLowerCase().replace('-', '_');
  const target = rawForm.toLowerCase().replace('-', '_');
  return current === target;
}
