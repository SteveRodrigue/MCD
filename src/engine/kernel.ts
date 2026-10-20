/**
 * Engine kernel (ADR-0088): late-bound entry points for the rules' recursion.
 *
 * Triggers execute effects, effects dispatch triggers and pipeline steps call both. Importing
 * each other directly made one 31-module import cycle that worked only through load order. The
 * recursive calls go through `kernel.<entry>(...)` instead. This module is a leaf (type imports
 * only); each owner module binds its entry with `bindKernel` when it loads, and `engine/boot.ts`
 * loads every owner. Tests wrap one entry with `tests/helpers/kernel-spy.ts`.
 */
import type {
  executeEffect,
  hasPendingSequence,
  resumePendingSequence,
  discardHostAttachmentsAndTuckedCards,
} from './effects';
import type { abilityHasValidTarget } from './effects/target-choice';
import type { runStepHandler } from './effects/handlers';
import type { dispatchTrigger, matchesTriggerFilter } from './triggers/trigger-dispatcher';
import type {
  enqueueDecisionPrompt,
  peekDecisionPrompt,
  refreshPromptOptionAvailability,
} from './pipeline/prompt-queue';
import type { resolveActiveEncounterCardAfterInterrupt } from './pipeline/villain-phase';
import type {
  continueAttackAfterInitiation,
  getAttackOutcomeFacts,
  finishPendingDamagePlacements,
} from './pipeline/combat-pipeline';
import type { finishPendingThreatPlacements } from './pipeline/threat-pipeline';
import type { discardResolvedObligation } from './pipeline/obligations';
import type { handleVillainDefeat } from './pipeline/scenario-helpers';
import type { applyDamageToTarget, defeatMinionsBeyondHitPoints } from './pipeline/damage-pipeline';
import type { dispatchAction } from './pipeline/action-dispatcher';
import type { evaluateDynamicAmount } from './effects/dynamic-formula-evaluator';
import type { evaluateStepGate } from './pipeline/step-gate-evaluator';

export interface Kernel {
  executeEffect: typeof executeEffect;
  hasPendingSequence: typeof hasPendingSequence;
  resumePendingSequence: typeof resumePendingSequence;
  discardHostAttachmentsAndTuckedCards: typeof discardHostAttachmentsAndTuckedCards;
  abilityHasValidTarget: typeof abilityHasValidTarget;
  runStepHandler: typeof runStepHandler;
  dispatchTrigger: typeof dispatchTrigger;
  matchesTriggerFilter: typeof matchesTriggerFilter;
  enqueueDecisionPrompt: typeof enqueueDecisionPrompt;
  peekDecisionPrompt: typeof peekDecisionPrompt;
  refreshPromptOptionAvailability: typeof refreshPromptOptionAvailability;
  resolveActiveEncounterCardAfterInterrupt: typeof resolveActiveEncounterCardAfterInterrupt;
  continueAttackAfterInitiation: typeof continueAttackAfterInitiation;
  getAttackOutcomeFacts: typeof getAttackOutcomeFacts;
  finishPendingDamagePlacements: typeof finishPendingDamagePlacements;
  finishPendingThreatPlacements: typeof finishPendingThreatPlacements;
  discardResolvedObligation: typeof discardResolvedObligation;
  handleVillainDefeat: typeof handleVillainDefeat;
  applyDamageToTarget: typeof applyDamageToTarget;
  defeatMinionsBeyondHitPoints: typeof defeatMinionsBeyondHitPoints;
  dispatchAction: typeof dispatchAction;
  evaluateDynamicAmount: typeof evaluateDynamicAmount;
  evaluateStepGate: typeof evaluateStepGate;
}

export type KernelEntry = keyof Kernel;

/** Every entry, for the boot test and `resetKernel`. */
export const KERNEL_ENTRIES: readonly KernelEntry[] = [
  'executeEffect',
  'hasPendingSequence',
  'resumePendingSequence',
  'discardHostAttachmentsAndTuckedCards',
  'abilityHasValidTarget',
  'runStepHandler',
  'dispatchTrigger',
  'matchesTriggerFilter',
  'enqueueDecisionPrompt',
  'peekDecisionPrompt',
  'refreshPromptOptionAvailability',
  'resolveActiveEncounterCardAfterInterrupt',
  'continueAttackAfterInitiation',
  'getAttackOutcomeFacts',
  'finishPendingDamagePlacements',
  'finishPendingThreatPlacements',
  'discardResolvedObligation',
  'handleVillainDefeat',
  'applyDamageToTarget',
  'defeatMinionsBeyondHitPoints',
  'dispatchAction',
  'evaluateDynamicAmount',
  'evaluateStepGate',
];

function unbound(name: KernelEntry): never {
  throw new Error(`kernel.${name} is not bound: import '@engine/boot' before using the engine`);
}

const unboundStubs = new WeakSet<object>();

function makeUnbound<K extends KernelEntry>(name: K): Kernel[K] {
  const stub = (..._args: unknown[]) => unbound(name);
  unboundStubs.add(stub);
  return stub as unknown as Kernel[K];
}

/** True once an owner module has bound the entry (a spy wrapping a bound entry counts as bound). */
export function isKernelBound(name: KernelEntry): boolean {
  return !unboundStubs.has(kernel[name]);
}

/** The late-bound entry points. Read at call time, so a rebound entry is seen by every caller. */
export const kernel = Object.fromEntries(
  KERNEL_ENTRIES.map((name) => [name, makeUnbound(name)]),
) as unknown as Kernel;

/** Owner modules bind their entries as they load. */
export function bindKernel(entries: Partial<Kernel>): void {
  Object.assign(kernel, entries);
}

/** Restores one entry (or all) to the unbound state. Test helper. */
export function resetKernel(name?: KernelEntry): void {
  for (const entry of name ? [name] : KERNEL_ENTRIES) {
    (kernel as unknown as Record<string, unknown>)[entry] = makeUnbound(entry);
  }
}
