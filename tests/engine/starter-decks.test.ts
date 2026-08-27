import { describe, it, expect } from 'vitest';
import { CardCatalog } from '../../src/data/importer/card-loader';
import { getStarterDeck, listStarterDecks } from '../../src/engine/decks/starter-decks';
import { slugify, generateDeckFilename } from '../../src/engine/decks/deck-utils';
import { setupGame } from '../../src/engine/state/game-setup';
import { getScenario } from '../../src/engine/scenarios/catalog';
import corePack from '../../data/upstream/pack/core.json';
import coreEncounterPack from '../../data/upstream/pack/core_encounter.json';

describe('Data-Driven Starter Deck Registry & Multi-Hero Integration (ADR-0016)', () => {
  const catalog = new CardCatalog([...corePack, ...coreEncounterPack]);

  it('lists all 5 individual Core Set starter decks from data/prebuilt_decks/', () => {
    const decks = listStarterDecks();
    expect(decks.length).toBe(5);
    const ids = decks.map((d) => d.id);
    expect(ids).toContain('spider_man_justice');
    expect(ids).toContain('captain_marvel_leadership');
    expect(ids).toContain('she_hulk_aggression');
    expect(ids).toContain('iron_man_aggression');
    expect(ids).toContain('black_panther_protection');
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

  it('loads She-Hulk (Aggression) deck with complete 40 cards, obligation, and nemesis set', () => {
    const starter = getStarterDeck('she_hulk_aggression')!;
    const deck = starter.loadDeck(catalog);

    expect(deck.hero.name).toBe('She-Hulk');
    expect(deck.alterEgo.name).toBe('Jennifer Walters');
    expect(deck.deckCards.length).toBe(40);
    expect(deck.obligation.name).toBe('Legal Work');
    expect(deck.nemesisCards.length).toBe(5);
    expect(deck.nemesisCards.map((c) => c.name)).toContain('Titania');
  });

  it('loads Iron Man (Aggression) deck with complete 40 cards, obligation, and nemesis set', () => {
    const starter = getStarterDeck('iron_man_aggression')!;
    const deck = starter.loadDeck(catalog);

    expect(deck.hero.name).toBe('Iron Man');
    expect(deck.alterEgo.name).toBe('Tony Stark');
    expect(deck.deckCards.length).toBe(40);
    expect(deck.obligation.name).toBe('Business Problems');
    expect(deck.nemesisCards.length).toBe(5);
    expect(deck.nemesisCards.map((c) => c.name)).toContain('Whiplash');
  });

  it('loads Black Panther (Protection) deck with complete 40 cards, obligation, and nemesis set', () => {
    const starter = getStarterDeck('black_panther_protection')!;
    const deck = starter.loadDeck(catalog);

    expect(deck.hero.name).toBe('Black Panther');
    expect(deck.alterEgo.name).toBe("T'Challa");
    expect(deck.deckCards.length).toBe(40);
    expect(deck.obligation.name).toBe('Affairs of State');
    expect(deck.nemesisCards.length).toBe(5);
    expect(deck.nemesisCards.map((c) => c.name)).toContain('Killmonger');
  });

  it('generates collision-resistant filesystem-safe filenames per ADR-0016', () => {
    expect(slugify('Spider-Man / Peter Parker: Heroic!')).toBe('spider-man-peter-parker-heroic');

    const spideyDeck = getStarterDeck('spider_man_justice')!.rawDeck;

    // Prebuilt naming
    const prebuiltName = generateDeckFilename(spideyDeck, 'prebuilt');
    expect(prebuiltName).toBe('core_spider_man_justice.json');

    // MarvelCDB import naming
    const mcdbName = generateDeckFilename(spideyDeck, 'marvelcdb');
    expect(mcdbName).toBe('mcdb_5_spider-man-justice-starter-deck.json');

    // User custom deck naming with suffix
    const userName = generateDeckFilename(spideyDeck, 'user', 'a7f9');
    expect(userName).toBe('user_spider_man_spider-man-justice-starter-deck_a7f9.json');
  });

  it('correctly sets up a 4-Hero game with 4 distinct Core Set starter decks', () => {
    const scenario = getScenario('rhino')!;
    const { villain, mainScheme, encounterCards } = scenario.createEncounterDeck(catalog);

    const smDeck = getStarterDeck('spider_man_justice')!.loadDeck(catalog);
    const cmDeck = getStarterDeck('captain_marvel_leadership')!.loadDeck(catalog);
    const shDeck = getStarterDeck('she_hulk_aggression')!.loadDeck(catalog);
    const bpDeck = getStarterDeck('black_panther_protection')!.loadDeck(catalog);

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
        {
          id: 'player_3',
          name: 'Hero Seat 3 (She-Hulk)',
          hero: shDeck.hero,
          alterEgo: shDeck.alterEgo,
          deckCards: shDeck.deckCards,
          obligation: shDeck.obligation,
          nemesisCards: shDeck.nemesisCards,
        },
        {
          id: 'player_4',
          name: 'Hero Seat 4 (Black Panther)',
          hero: bpDeck.hero,
          alterEgo: bpDeck.alterEgo,
          deckCards: bpDeck.deckCards,
          obligation: bpDeck.obligation,
          nemesisCards: bpDeck.nemesisCards,
        },
      ],
      villain,
      mainScheme,
      encounterCards,
    });

    // 4 Players initialized
    expect(gameState.players.length).toBe(4);

    // 4 obligations shuffled into encounter deck (30 base encounter cards + 4 obligations = 34)
    expect(gameState.encounterDeck.length).toBe(34);
    const obligationsInDeck = gameState.encounterDeck.filter(
      (c) => c.card.type === 'obligation' || (c.card as any).type_code === 'obligation',
    );
    expect(obligationsInDeck.length).toBe(4);

    // Each player has their own 5-card set-aside nemesis deck
    expect(gameState.players[0].setAsideCards.map((c) => c.card.name)).toContain('Vulture');
    expect(gameState.players[1].setAsideCards.map((c) => c.card.name)).toContain('Yon-Rogg');
    expect(gameState.players[2].setAsideCards.map((c) => c.card.name)).toContain('Titania');
    expect(gameState.players[3].setAsideCards.map((c) => c.card.name)).toContain('Killmonger');

    // Multi-hero scaling: Rhino I HP = 14 * 4 = 56 HP
    expect(gameState.villain.maxHealth).toBe(56);
    expect(gameState.villain.health).toBe(56);

    // Scheme target threat = 7 * 4 = 28
    expect(gameState.mainScheme.targetThreat).toBe(28);
  });
});
