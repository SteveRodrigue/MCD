import { describe, it, expect } from 'vitest';
import { CardCatalog } from '../../src/data/importer/card-loader';
import { getStarterDeck, listStarterDecks } from '../../src/engine/decks/starter-decks';
import { setupGame } from '../../src/engine/state/game-setup';
import { getScenario } from '../../src/engine/scenarios/catalog';
import corePack from '../../data/upstream/pack/core.json';
import coreEncounterPack from '../../data/upstream/pack/core_encounter.json';

describe('Starter Deck Registry & Multi-Hero Integration', () => {
  const catalog = new CardCatalog([...corePack, ...coreEncounterPack]);

  it('lists all available Core Set starter decks', () => {
    const decks = listStarterDecks();
    expect(decks.length).toBeGreaterThanOrEqual(2);
    expect(decks.map((d) => d.id)).toContain('spider_man_justice');
    expect(decks.map((d) => d.id)).toContain('captain_marvel_leadership');
  });

  it('loads Spider-Man (Justice) deck with complete 40 cards, obligation, and nemesis set', () => {
    const starter = getStarterDeck('spider_man_justice')!;
    const deck = starter.loadDeck(catalog);

    expect(deck.hero.name).toBe('Spider-Man');
    expect(deck.alterEgo.name).toBe('Peter Parker');
    expect(deck.deckCards.length).toBe(40);
    expect(deck.obligation.name).toBe('Eviction Notice');
    expect(deck.nemesisCards.length).toBe(5);
    expect(deck.nemesisCards.map((c) => c.name)).toContain('Vulture');
  });

  it('loads Captain Marvel (Leadership) deck with complete 40 cards, obligation, and nemesis set', () => {
    const starter = getStarterDeck('captain_marvel_leadership')!;
    const deck = starter.loadDeck(catalog);

    expect(deck.hero.name).toBe('Captain Marvel');
    expect(deck.alterEgo.name).toBe('Carol Danvers');
    expect(deck.deckCards.length).toBe(40);
    expect(deck.obligation.name).toBe('Family Emergency');
    expect(deck.nemesisCards.length).toBe(5);
    expect(deck.nemesisCards.map((c) => c.name)).toContain('Yon-Rogg');
  });

  it('correctly sets up a 2-Hero game with Spider-Man and Captain Marvel', () => {
    const scenario = getScenario('rhino')!;
    const { villain, mainScheme, encounterCards } = scenario.createEncounterDeck(catalog);

    const smStarter = getStarterDeck('spider_man_justice')!;
    const cmStarter = getStarterDeck('captain_marvel_leadership')!;

    const smDeck = smStarter.loadDeck(catalog);
    const cmDeck = cmStarter.loadDeck(catalog);

    const gameState = setupGame({
      players: [
        {
          id: 'player_1',
          name: 'Hero Seat 1 (Spider-Man)',
          hero: smDeck.hero,
          alterEgo: smDeck.alterEgo,
          deckCards: smDeck.deckCards,
          obligation: smDeck.obligation,
          nemesisCards: smDeck.nemesisCards,
        },
        {
          id: 'player_2',
          name: 'Hero Seat 2 (Captain Marvel)',
          hero: cmDeck.hero,
          alterEgo: cmDeck.alterEgo,
          deckCards: cmDeck.deckCards,
          obligation: cmDeck.obligation,
          nemesisCards: cmDeck.nemesisCards,
        },
      ],
      villain,
      mainScheme,
      encounterCards,
    });

    // 2 Players initialized
    expect(gameState.players.length).toBe(2);
    expect(gameState.players[0].name).toContain('Spider-Man');
    expect(gameState.players[1].name).toContain('Captain Marvel');

    // Both obligations shuffled into encounter deck (30 base encounter cards + 2 obligations = 32)
    expect(gameState.encounterDeck.length).toBe(32);
    const obligationsInDeck = gameState.encounterDeck.filter(
      (c) => c.card.type === 'obligation' || (c.card as any).type_code === 'obligation',
    );
    expect(obligationsInDeck.length).toBe(2);

    // Both players have their own 5-card set-aside nemesis decks
    expect(gameState.players[0].setAsideCards.length).toBe(5);
    expect(gameState.players[0].setAsideCards.map((c) => c.card.name)).toContain('Vulture');

    expect(gameState.players[1].setAsideCards.length).toBe(5);
    expect(gameState.players[1].setAsideCards.map((c) => c.card.name)).toContain('Yon-Rogg');

    // Multi-hero scaling: Rhino I HP = 14 * 2 = 28 HP
    expect(gameState.villain.maxHealth).toBe(28);
    expect(gameState.villain.health).toBe(28);

    // Scheme target threat = 7 * 2 = 14
    expect(gameState.mainScheme.targetThreat).toBe(14);
  });
});
