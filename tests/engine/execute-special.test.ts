import { describe, it, expect } from 'vitest';
import { executeEffect } from '@engine/effects';
import { EffectTypeSchema } from '../../src/data/supplemental/schema';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { setupGame } from '@engine/state/game-setup';

describe('EXECUTE_SPECIAL (#254)', () => {
  it('has no effect type named after a card', () => {
    expect(EffectTypeSchema.options).not.toContain('EXECUTE_WAKANDA_FOREVER');
  });

  it('fails when specialId is missing (no hidden default)', () => {
    const state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Black Panther',
          hero: cardCatalog.getCard('01040a')!,
          alterEgo: cardCatalog.getCard('01040b')!,
          deckCards: [cardCatalog.getCard('01044')!],
        },
      ] as any,
      villain: cardCatalog.getCard('01094')! as any,
      mainScheme: cardCatalog.getCard('01097')! as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });
    const result = executeEffect(state, { effect: 'EXECUTE_SPECIAL' } as any, { playerId: 'p1' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/specialId/);
  });

  it('declares Wakanda Forever! 01043a-d through EXECUTE_SPECIAL with an explicit specialId', () => {
    for (const code of ['01043a', '01043b', '01043c', '01043d']) {
      const step = cardCatalog.getCard(code)!.enrichment!.abilities![0].steps[0] as any;
      expect(step.effect).toBe('EXECUTE_SPECIAL');
      expect(step.effectParams.specialId).toBe('WAKANDA_FOREVER');
    }
  });
});
