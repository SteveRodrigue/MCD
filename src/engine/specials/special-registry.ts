import { GameState } from '../models/state';
import { EffectExecutionContext, EffectResult } from '../effects';

export interface SpecialAbilityHandler {
  id: string;
  validatePlayCondition: (state: GameState, context: EffectExecutionContext) => boolean;
  execute: (state: GameState, context: EffectExecutionContext, payload?: any) => EffectResult;
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
