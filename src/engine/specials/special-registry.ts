import { GameState } from '../models/state';
import { EffectExecutionContext, EffectResult } from '../effects';
import { peekDecisionPrompt } from '../pipeline/prompt-queue';

export interface SpecialAbilityHandler {
  id: string;
  validatePlayCondition: (state: GameState, context: EffectExecutionContext) => boolean;
  execute: (state: GameState, context: EffectExecutionContext, payload?: any) => EffectResult;
  /** Continues a sequence that paused on a decision prompt (see `GameState.pendingSpecialSequence`). */
  resume?: (state: GameState, context: EffectExecutionContext) => EffectResult;
}

const specialHandlers = new Map<string, SpecialAbilityHandler>();

export function registerSpecialHandler(handler: SpecialAbilityHandler): void {
  specialHandlers.set(handler.id.toUpperCase(), handler);
}

export function getSpecialHandler(id: string): SpecialAbilityHandler | undefined {
  return specialHandlers.get(id.toUpperCase());
}

export function getAllSpecialHandlers(): SpecialAbilityHandler[] {
  return Array.from(specialHandlers.values());
}

/**
 * Resumes a special-ability sequence that paused on a decision prompt, once every queued prompt
 * has been answered. No-op when nothing is pending or a prompt is still waiting (#207).
 */
export function resumePendingSpecialSequence(state: GameState): GameState {
  const pending = state.pendingSpecialSequence;
  if (!pending || peekDecisionPrompt(state)) return state;
  const handler = getSpecialHandler(pending.specialId);
  if (!handler?.resume) {
    delete state.pendingSpecialSequence;
    return state;
  }
  return handler.resume(state, { playerId: pending.playerId }).state;
}
