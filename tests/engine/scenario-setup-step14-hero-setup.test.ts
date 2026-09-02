import { describe, it, expect } from 'vitest';
import { setupGame } from '../../src/engine/state/game-setup';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { HeroCard, AlterEgoCard } from '../../src/engine/models';

describe('Scenario Setup Step 14: Resolve Character Setup Abilities (RR v1.8 p. 27, Issue #16)', () => {
  const bpIdentity = {
    hero: cardCatalog.getCard('01040a') as HeroCard,
    alterEgo: cardCatalog.getCard('01040b') as AlterEgoCard,
  };
  const smIdentity = {
    hero: cardCatalog.getCard('01001a') as HeroCard,
    alterEgo: cardCatalog.getCard('01001b') as AlterEgoCard,
  };

  const bpDeckCards = [
    ...Array(11).fill(cardCatalog.getCard('01044')!), // Vibranium (Resource)
    cardCatalog.getCard('01046')!, // Energy Daggers (Upgrade)
    cardCatalog.getCard('01047')!, // Panther Claws (Upgrade)
    cardCatalog.getCard('01048')!, // Tactical Genius (Upgrade)
    cardCatalog.getCard('01049')!, // Panther Suit (Upgrade)
  ];

  it("automatically resolves T'Challa setup ability (01040b) putting 1 Black Panther upgrade into tableau", () => {
    const state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Black Panther',
          hero: bpIdentity.hero,
          alterEgo: bpIdentity.alterEgo,
          deckCards: bpDeckCards,
        },
      ],
      shuffleFn: (arr) => arr,
      skipMulligan: true,
    });

    const player = state.players[0];

    // 1. T'Challa Alter-Ego hand size is 6. Hand took 6 cards from the 15-card deck.
    // 2. Step 14 searched deck for 1 Black Panther upgrade and put it into tableau.
    // Therefore, tableau should contain exactly 1 Black Panther upgrade!
    expect(player.tableau.length).toBe(1);
    const tableauCard = player.tableau[0];
    expect(tableauCard.card.traits).toContain('Black Panther');
    expect(['01046', '01047', '01048', '01049']).toContain(tableauCard.card.code);

    // Total cards accounted for = hand (6) + tableau (1) + deck (8) = 15 total cards
    expect(player.hand.length).toBe(6);
    expect(player.deck.length).toBe(8);
  });

  it('supports selecting a specific setup card via chosenSetupCardCode', () => {
    const state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Black Panther',
          hero: bpIdentity.hero,
          alterEgo: bpIdentity.alterEgo,
          deckCards: bpDeckCards,
          chosenSetupCardCode: '01047', // Panther Claws specifically
        } as any,
      ],
      shuffleFn: (arr) => arr,
      skipMulligan: true,
    });

    const player = state.players[0];
    expect(player.tableau.length).toBe(1);
    expect(player.tableau[0].card.code).toBe('01047');
    expect(player.tableau[0].card.name).toBe('Panther Claws');
  });

  it('leaves heroes without Setup abilities unaffected (Spider-Man 01001b)', () => {
    const smDeckCards = Array(15).fill(cardCatalog.getCard('01005')!); // Web-Shooter

    const state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: smIdentity.hero,
          alterEgo: smIdentity.alterEgo,
          deckCards: smDeckCards,
        },
      ],
      shuffleFn: (arr) => arr,
      skipMulligan: true,
    });

    const player = state.players[0];
    // Peter Parker has handSize 6, no Setup ability. Tableau has 0 cards.
    expect(player.tableau.length).toBe(0);
    expect(player.hand.length).toBe(6);
    expect(player.deck.length).toBe(9);
  });

  it('resolves setup abilities in player order across multiple players', () => {
    const smDeckCards = Array(15).fill(cardCatalog.getCard('01005')!);

    const state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: smIdentity.hero,
          alterEgo: smIdentity.alterEgo,
          deckCards: smDeckCards,
        },
        {
          id: 'p2',
          name: 'Black Panther',
          hero: bpIdentity.hero,
          alterEgo: bpIdentity.alterEgo,
          deckCards: bpDeckCards,
          chosenSetupCardCode: '01046', // Energy Daggers
        } as any,
      ],
      shuffleFn: (arr) => arr,
      skipMulligan: true,
    });

    // Player 1 (Spider-Man): 0 tableau
    expect(state.players[0].tableau.length).toBe(0);

    // Player 2 (Black Panther): 1 Energy Daggers in tableau
    expect(state.players[1].tableau.length).toBe(1);
    expect(state.players[1].tableau[0].card.code).toBe('01046');
  });
});
