import { describe, it, expect } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { setupGame } from '@engine/state/game-setup';
import { executeStep } from '@engine/effects';
import type { AbilityStep, AlterEgoCard, HeroCard } from '@engine/models';

// executeStep handles every schema effect explicitly: constant effects are no-ops, and an effect
// without a handler throws instead of resolving silently (AUD-20261017-232534 F010-C).
describe('executeStep dispatch', () => {
  const newState = () =>
    setupGame({
      scenarioId: 'rhino',
      skipMulligan: true,
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: cardCatalog.getCard('01001a') as HeroCard,
          alterEgo: cardCatalog.getCard('01001b') as AlterEgoCard,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
    });

  it.each(['MODIFY_HAND_SIZE', 'MODIFY_MAX_HEALTH', 'CANNOT_TAKE_DAMAGE', 'MODIFY_ALLY_LIMIT'])(
    'a constant %s step changes nothing when executed',
    (effect) => {
      const state = newState();
      const before = JSON.stringify(state);
      const result = executeStep(state, { effect, effectParams: {} } as AbilityStep, {
        playerId: 'p1',
      });
      expect(result.success).toBe(true);
      expect(result.mutatedState).toBe(false);
      expect(JSON.stringify(result.state)).toBe(before);
    },
  );

  it('throws on an effect that has no handler', () => {
    const step = { effect: 'NOT_A_REAL_EFFECT', effectParams: {} } as unknown as AbilityStep;
    expect(() => executeStep(newState(), step, { playerId: 'p1' })).toThrow(
      "executeStep: no handler for effect 'NOT_A_REAL_EFFECT'",
    );
  });
});
