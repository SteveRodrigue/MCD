import { GameState } from '../models/state';
import { EffectExecutionContext, EffectResult } from '../effects';

export interface SpecialAbilityHandler {
  id: string;
  validatePlayCondition: (state: GameState, context: EffectExecutionContext) => boolean;
  execute: (
    state: GameState,
    context: EffectExecutionContext,
    payload?: Record<string, unknown>,
  ) => EffectResult;
}

const specialHandlers = new Map<string, SpecialAbilityHandler>();

export function registerSpecialHandler(handler: SpecialAbilityHandler): void {
  specialHandlers.set(handler.id.toUpperCase(), handler);
}

export function getSpecialHandler(id: string): SpecialAbilityHandler | undefined {
  return specialHandlers.get(id.toUpperCase());
}

/** Removes every registered handler (the content loader re-registers the loaded packs' handlers). */
export function clearSpecialHandlers(): void {
  specialHandlers.clear();
}
