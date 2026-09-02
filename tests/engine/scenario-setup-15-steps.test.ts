import { describe, it, expect } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import {
  HeroCard,
  AlterEgoCard,
  Keyword,
  VillainCard,
  MainSchemeCard,
  CardType,
} from '@engine/models';
import { setupGame } from '@engine/state/game-setup';
import { ScenarioRegistry } from '@engine/scenarios';

describe('Milestone 2C: Official 15-Step Scenario Setup State Machine (RR v1.8 p. 27–28)', () => {
  const spiderManHero = cardCatalog.getCard('01001a') as HeroCard;
  const peterParkerAlterEgo = cardCatalog.getCard('01001b') as AlterEgoCard;
  const rhinoVillain = cardCatalog.getCard('01094') as VillainCard;
  const mainScheme = cardCatalog.getCard('01097b') as MainSchemeCard;

  it('Step 1: Puts cards with the Permanent keyword directly into play in player tableau', () => {
    // Create a mock card with Permanent keyword
    const permanentCard = {
      ...cardCatalog.getCard('01005')!,
      code: 'mock_permanent',
      name: 'Permanent Upgrade',
      keywords: [Keyword.PERMANENT],
    };
    const standardCard = cardCatalog.getCard('01005')!;

    const state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: spiderManHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: [
            permanentCard,
            standardCard,
            standardCard,
            standardCard,
            standardCard,
            standardCard,
            standardCard,
          ],
        },
      ],
      villain: rhinoVillain,
      mainScheme,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });

    // Permanent card starts directly in player tableau
    expect(state.players[0].tableau.some((c) => c.card.code === 'mock_permanent')).toBe(true);
    // Permanent card is NOT in draw deck or hand
    expect(state.players[0].deck.some((c) => c.card.code === 'mock_permanent')).toBe(false);
    expect(state.players[0].hand.some((c) => c.card.code === 'mock_permanent')).toBe(false);
  });

  it('Step 4 & Step 11: Shuffles 0-to-many obligations into encounter deck', () => {
    const obligation1 = {
      ...cardCatalog.getCard('01005')!,
      code: 'ob_1',
      name: 'Eviction Notice',
      type: CardType.OBLIGATION,
    };
    const obligation2 = {
      ...cardCatalog.getCard('01005')!,
      code: 'ob_2',
      name: 'Family Emergency',
      type: CardType.OBLIGATION,
    };

    const state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: spiderManHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
          obligations: [obligation1, obligation2],
        },
      ],
      villain: rhinoVillain,
      mainScheme,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });

    // Both obligations are shuffled into the encounter deck
    expect(state.encounterDeck.some((c) => c.card.code === 'ob_1')).toBe(true);
    expect(state.encounterDeck.some((c) => c.card.code === 'ob_2')).toBe(true);
  });

  it('Step 8: Sets Villain Stage cards correctly across Skirmish, Standard, and Expert modes', () => {
    const rhinoPlugin = ScenarioRegistry.get('rhino');

    // Skirmish Mode (Stage I only)
    const skirmishState = setupGame({
      scenarioId: 'rhino',
      difficulty: 'SKIRMISH',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: spiderManHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: rhinoVillain,
      mainScheme,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
    });
    expect(skirmishState.villain.card.code).toBe('01094'); // Stage I
    expect(skirmishState.villain.health).toBe(14); // 14 x 1

    // Defeating Stage I in Skirmish triggers immediate Victory
    const skirmishResult = rhinoPlugin.onVillainDefeated(
      skirmishState,
      skirmishState.villain.instanceId!,
    );
    expect(skirmishResult.victory).toBe(true);
    expect(skirmishState.winner).toBe('HEROES');

    // Expert Mode (Stage II -> III)
    const expertState = setupGame({
      scenarioId: 'rhino',
      difficulty: 'EXPERT',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: spiderManHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01095') as VillainCard,
      mainScheme,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
    });

    expect(expertState.villain.card.code).toBe('01095'); // Starts on Stage II
    expect(expertState.villain.health).toBe(15); // 15 x 1

    // Defeating Stage II in Expert advances to Stage III
    const expertResult = rhinoPlugin.onVillainDefeated(
      expertState,
      expertState.villain.instanceId!,
    );
    expect(expertResult.advancedStage).toBe(true);
    expect(expertState.villain.card.code).toBe('01096'); // Stage III
    expect(expertState.villain.health).toBe(16); // 16 x 1
  });
});
