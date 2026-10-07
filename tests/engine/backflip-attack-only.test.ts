import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { AlterEgoCard, GameState, HeroCard } from '@engine/models';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { dispatchTrigger } from '@engine/triggers/trigger-dispatcher';
import { peekDecisionPrompt } from '@engine/pipeline/prompt-queue';

/**
 * #256: Backflip (01003) prevents "damage from an attack" only. Damage that is not from an
 * attack (a treachery, an effect) must not offer it.
 */
describe('Backflip (01003) reacts only to damage from an attack (#256)', () => {
  let state: GameState;

  beforeEach(() => {
    state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: cardCatalog.getCard('01001a') as HeroCard,
          alterEgo: cardCatalog.getCard('01001b') as AlterEgoCard,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as never,
      mainScheme: cardCatalog.getCard('01097b') as never,
      encounterCards: Array(10).fill(cardCatalog.getCard('01108')!),
      skipMulligan: true,
      skipScenarioPlugin: true,
    });
    state.players[0].hand = [createCardInstance(cardCatalog.getCard('01003')!)];
  });

  it('is offered for damage from an attack', () => {
    const result = dispatchTrigger(state, 'DAMAGE_WOULD_BE_TAKEN', {
      targetPlayerId: 'p1',
      damageAmount: 3,
      damageSource: 'ATTACK',
    });
    expect(result.hasPendingPrompt).toBe(true);
    expect(peekDecisionPrompt(state)).toBeDefined();
  });

  it('is not offered for damage that is not from an attack', () => {
    const result = dispatchTrigger(state, 'DAMAGE_WOULD_BE_TAKEN', {
      targetPlayerId: 'p1',
      damageAmount: 3,
    });
    expect(result.hasPendingPrompt).toBeFalsy();
    expect(peekDecisionPrompt(state)).toBeUndefined();
  });

  it('Cosmic Flight (any damage) keeps no damage-source restriction', () => {
    const flight = cardCatalog.getCard('01017')!;
    const ability = flight.enrichment?.abilities?.find((a) => a.id === 'cosmic_flight_prevent');
    expect(ability?.triggerFilter?.damageSource).toBeUndefined();
  });
});
