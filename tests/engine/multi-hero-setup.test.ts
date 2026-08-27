import { describe, it, expect, beforeEach } from 'vitest';
import { CardCatalog } from '../../src/data/importer/card-loader';
import {
  setupGame,
  resetInstanceCounter,
  getScenario,
  getStarterDeck,
  GamePhase,
} from '../../src/engine';

import corePack from '../../data/upstream/pack/core.json';
import coreEncounterPack from '../../data/upstream/pack/core_encounter.json';

describe('Multi-Hero Solo Mode & Scenario Setup', () => {
  let catalog: CardCatalog;

  beforeEach(() => {
    resetInstanceCounter();
    catalog = new CardCatalog([...corePack, ...coreEncounterPack]);
  });

  it('correctly scales 1-Player Solo Setup (Rhino 14 HP, Scheme 7 Threat)', () => {
    const scenario = getScenario('rhino')!;
    const { villain, mainScheme, encounterCards } = scenario.createEncounterDeck(catalog);

    const starterDeck = getStarterDeck('spider_man_justice')!;
    const deck = starterDeck.loadDeck(catalog);

    const state = setupGame({
      players: [
        {
          id: 'player_1',
          name: 'Spider-Man (Player 1)',
          hero: deck.hero,
          alterEgo: deck.alterEgo,
          deckCards: deck.deckCards,
        },
      ],
      villain,
      mainScheme,
      encounterCards,
    });

    expect(state.players).toHaveLength(1);
    expect(state.phase).toBe(GamePhase.SETUP_PHASE);
    expect(state.setupState?.stage).toBe('MULLIGAN_PHASE');

    // 1 Player: Rhino HP is 14 (14 * 1), Scheme limit is 7 (7 * 1)
    expect(state.villain.health).toBe(14);
    expect(state.villain.maxHealth).toBe(14);
    expect(state.mainScheme.targetThreat).toBe(7);
    expect(state.mainScheme.threat).toBe(0);

    // Peter Parker draws 6 starting hand cards
    expect(state.players[0].hand).toHaveLength(6);
    expect(state.players[0].deck).toHaveLength(34); // 40 - 6
    expect(state.players[0].currentForm).toBe('alter_ego');
  });

  it('correctly scales 2-Player Multi-Hero Solo Setup (Rhino 28 HP, Scheme 14 Threat)', () => {
    const scenario = getScenario('rhino')!;
    const { villain, mainScheme, encounterCards } = scenario.createEncounterDeck(catalog);

    const deck1 = getStarterDeck('spider_man_justice')!.loadDeck(catalog);
    const deck2 = getStarterDeck('captain_marvel_leadership')!.loadDeck(catalog);

    const state = setupGame({
      players: [
        {
          id: 'player_1',
          name: 'Hero 1 (Spider-Man)',
          hero: deck1.hero,
          alterEgo: deck1.alterEgo,
          deckCards: deck1.deckCards,
        },
        {
          id: 'player_2',
          name: 'Hero 2 (Captain Marvel)',
          hero: deck2.hero,
          alterEgo: deck2.alterEgo,
          deckCards: deck2.deckCards,
        },
      ],
      villain,
      mainScheme,
      encounterCards,
    });

    expect(state.players).toHaveLength(2);

    // 2 Players: Rhino HP is 28 (14 * 2), Scheme limit is 14 (7 * 2)
    expect(state.villain.health).toBe(28);
    expect(state.villain.maxHealth).toBe(28);
    expect(state.mainScheme.targetThreat).toBe(14);

    // Both players draw 6 starting cards
    expect(state.players[0].hand).toHaveLength(6);
    expect(state.players[1].hand).toHaveLength(6);
  });

  it('correctly scales 4-Player Multi-Hero Solo Setup (Rhino 56 HP, Scheme 28 Threat)', () => {
    const scenario = getScenario('rhino')!;
    const { villain, mainScheme, encounterCards } = scenario.createEncounterDeck(catalog);

    const deckIds = [
      'spider_man_justice',
      'captain_marvel_leadership',
      'she_hulk_aggression',
      'black_panther_protection',
    ];

    const state = setupGame({
      players: deckIds.map((deckId, i) => {
        const d = getStarterDeck(deckId)!.loadDeck(catalog);
        return {
          id: `player_${i + 1}`,
          name: `Hero Seat ${i + 1} (${d.hero.name})`,
          hero: d.hero,
          alterEgo: d.alterEgo,
          deckCards: d.deckCards,
        };
      }),
      villain,
      mainScheme,
      encounterCards,
    });

    expect(state.players).toHaveLength(4);

    // 4 Players: Rhino HP is 56 (14 * 4), Scheme limit is 28 (7 * 4)
    expect(state.villain.health).toBe(56);
    expect(state.villain.maxHealth).toBe(56);
    expect(state.mainScheme.targetThreat).toBe(28);
  });
});
