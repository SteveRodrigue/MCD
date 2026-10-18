import type { GameState } from '../../src/engine/models';

/**
 * Catalog cards are shared, frozen definitions (AUD-20261017-232534 F005). A test that needs a
 * different printed value replaces the card with an overridden copy everywhere the state
 * references it (hero, active form, card instances) instead of mutating the shared object.
 */
export function overrideCard<T extends object>(
  state: GameState,
  card: T,
  overrides: Record<string, unknown>,
): T {
  const copy = { ...card, ...overrides } as T;
  replaceReferences(state, card, copy);
  return copy;
}

function replaceReferences(node: unknown, from: object, to: object): void {
  if (node === null || typeof node !== 'object' || Object.isFrozen(node)) return;
  const record = node as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (record[key] === from) record[key] = to;
    else replaceReferences(record[key], from, to);
  }
}
