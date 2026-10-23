import { kernel } from '../kernel';
import type { GameState } from '../models';
import type { DefeatSource } from './trigger-dispatcher';

export interface DefeatDispatch {
  targetPlayerId: string;
  targetInstanceId: string;
  entityType?: 'CHARACTER' | 'SCHEME';
  targetType?: 'VILLAIN' | 'MINION' | 'ALLY' | 'HERO' | 'SCHEME';
  defeatSource?: DefeatSource;
}

/**
 * The one place a defeat is announced (#247): DEFEATED, then CHARACTER_DEFEATED (or
 * SCHEME_DEFEATED for a scheme), both carrying the defeat source when the caller knows it.
 *
 * Call it once the defeat has happened (stage advance, elimination, discard): a Response is used
 * after its triggering condition has occurred (RR v1.8 Response, #359). An Interrupt to the defeat
 * runs earlier, in `processHostDefeated`.
 */
export function dispatchDefeat(state: GameState, defeat: DefeatDispatch): void {
  const entityType = defeat.entityType ?? 'CHARACTER';
  const context = {
    targetPlayerId: defeat.targetPlayerId,
    sourceInstanceId: defeat.targetInstanceId,
    targetInstanceId: defeat.targetInstanceId,
    entityType,
    targetType: defeat.targetType,
    ...(defeat.defeatSource ? { defeatSource: defeat.defeatSource } : {}),
  };
  kernel.dispatchTrigger(state, 'DEFEATED', context);
  kernel.dispatchTrigger(
    state,
    entityType === 'CHARACTER' ? 'CHARACTER_DEFEATED' : 'SCHEME_DEFEATED',
    context,
  );
}
