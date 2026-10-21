import type { GameState } from '@engine/models';

function copyPlain(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(copyPlain);
  const proto = Object.getPrototypeOf(value);
  // Class instances (the card catalog) stay shared.
  if (proto !== Object.prototype && proto !== null) return value;
  const copy: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) copy[key] = copyPlain(item);
  return copy;
}

/**
 * A mutable copy of an engine state, for tests that arrange a state by writing to it. The engine
 * returns frozen states that share unchanged branches (ADR-0089), so writing to one throws.
 */
export function thaw(state: GameState): GameState {
  return copyPlain(state) as GameState;
}
