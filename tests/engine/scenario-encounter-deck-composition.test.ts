import { describe, it, expect } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { setupGame } from '../../src/engine/state/game-setup';
import { HeroCard, AlterEgoCard } from '../../src/engine/models';

describe('Scenario Encounter Deck Composition & Card Quantities (RR v1.8 p. 27, Issue #80)', () => {
  it('expands Standard Encounter Set (7 cards total: 3 singletons + 2 pairs)', () => {
    const standardCards = (cardCatalog as any).getExpandedCardsBySet
      ? (cardCatalog as any).getExpandedCardsBySet('standard')
      : cardCatalog.getCardsBySet('standard');

    expect(standardCards.length).toBe(7);

    const counts: Record<string, number> = {};
    for (const card of standardCards) {
      counts[card.code] = (counts[card.code] || 0) + 1;
    }

    // 01186 Advance (Quantity: 2)
    expect(counts['01186']).toBe(2);
    // 01187 Assault (Quantity: 2)
    expect(counts['01187']).toBe(2);
    // 01188 Caught Off Guard (Quantity: 1)
    expect(counts['01188']).toBe(1);
    // 01189 Gang-Up (Quantity: 1)
    expect(counts['01189']).toBe(1);
    // 01190 Shadow of the Past (Quantity: 1)
    expect(counts['01190']).toBe(1);
  });

  it('expands Bomb Scare Modular Set (6 cards total: 2 singletons + 2 pairs)', () => {
    const bombScareCards = (cardCatalog as any).getExpandedCardsBySet
      ? (cardCatalog as any).getExpandedCardsBySet('bomb_scare')
      : cardCatalog.getCardsBySet('bomb_scare');

    expect(bombScareCards.length).toBe(6);

    const counts: Record<string, number> = {};
    for (const card of bombScareCards) {
      counts[card.code] = (counts[card.code] || 0) + 1;
    }

    // 01109 Bomb Scare (Quantity: 1)
    expect(counts['01109']).toBe(1);
    // 01110 Hydra Bomber (Quantity: 2)
    expect(counts['01110']).toBe(2);
    // 01111 Explosion (Quantity: 1)
    expect(counts['01111']).toBe(1);
    // 01112 False Alarm (Quantity: 2)
    expect(counts['01112']).toBe(2);
  });

  it('expands Rhino Encounter Deck cards (17 cards non-villain/non-main-scheme)', () => {
    const rhinoCards = (cardCatalog as any).getExpandedCardsBySet
      ? (cardCatalog as any).getExpandedCardsBySet('rhino')
      : cardCatalog.getCardsBySet('rhino');

    const encounterDeckCards = rhinoCards.filter(
      (c: any) => c.type !== 'villain' && c.type !== 'main_scheme',
    );

    expect(encounterDeckCards.length).toBe(17);

    const counts: Record<string, number> = {};
    for (const card of encounterDeckCards) {
      counts[card.code] = (counts[card.code] || 0) + 1;
    }

    // 01098 Armored Rhino Suit (Quantity: 1)
    expect(counts['01098']).toBe(1);
    // 01099 Charge (Quantity: 2)
    expect(counts['01099']).toBe(2);
    // 01100 Enhanced Ivory Horn (Quantity: 1)
    expect(counts['01100']).toBe(1);
    // 01101 Hydra Mercenary (Quantity: 2)
    expect(counts['01101']).toBe(2);
    // 01102 Sandman (Quantity: 1)
    expect(counts['01102']).toBe(1);
    // 01103 Shocker (Quantity: 1)
    expect(counts['01103']).toBe(1);
    // 01104 Hard to Keep Down (Quantity: 2)
    expect(counts['01104']).toBe(2);
    // 01105 "I'm Tough" (Quantity: 2)
    expect(counts['01105']).toBe(2);
    // 01106 Stampede (Quantity: 3)
    expect(counts['01106']).toBe(3);
    // 01107 Breakin' & Takin' (Quantity: 1)
    expect(counts['01107']).toBe(1);
    // 01108 Crowd Control (Quantity: 1)
    expect(counts['01108']).toBe(1);
  });

  it('initializes canonical Rhino encounter deck size in solo game (30 base + 1 obligation = 31 cards)', () => {
    const spiderManHero = cardCatalog.getCard('01001a') as HeroCard;
    const peterParkerAlterEgo = cardCatalog.getCard('01001b') as AlterEgoCard;
    const obligation = cardCatalog.getCard('01165')!;

    const state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: spiderManHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: Array(15).fill(cardCatalog.getCard('01005')!),
          obligation,
        },
      ],
      skipMulligan: true,
    });

    // 17 Rhino + 7 Standard + 6 Bomb Scare = 30 base cards
    // 30 base cards + 1 player obligation = 31 total cards
    expect(state.encounterDeck.length).toBe(31);

    // Verify copies of Advance (2) and Assault (2) are in the deck
    const advanceCopies = state.encounterDeck.filter((c) => c.card.code === '01186');
    expect(advanceCopies.length).toBe(2);

    const assaultCopies = state.encounterDeck.filter((c) => c.card.code === '01187');
    expect(assaultCopies.length).toBe(2);

    // Verify copies of Stampede (3)
    const stampedeCopies = state.encounterDeck.filter((c) => c.card.code === '01106');
    expect(stampedeCopies.length).toBe(3);

    // Verify copies of Hydra Bomber (2) and False Alarm (2)
    const hydraBomberCopies = state.encounterDeck.filter((c) => c.card.code === '01110');
    expect(hydraBomberCopies.length).toBe(2);

    const falseAlarmCopies = state.encounterDeck.filter((c) => c.card.code === '01112');
    expect(falseAlarmCopies.length).toBe(2);
  });
});
