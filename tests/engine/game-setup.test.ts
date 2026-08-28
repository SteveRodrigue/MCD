import { describe, it, expect, beforeEach } from 'vitest';
import { CardCatalog } from '@data/importer/card-loader';
import {
  setupGame,
  resetInstanceCounter,
  GamePhase,
  VillainCard,
  MainSchemeCard,
} from '@engine/index';

import corePack from '../../data/upstream/pack/core.json';
import coreEncounterPack from '../../data/upstream/pack/core_encounter.json';

describe('Game Setup Sequence (Learn to Play & RR v1.8)', () => {
  const catalog = new CardCatalog([...corePack, ...coreEncounterPack]);

  beforeEach(() => {
    resetInstanceCounter();
  });

  function createSpiderManJusticeDeck() {
    const spiderManIdentity = catalog.getHeroIdentity('spider_man')!;
    // Spider-Man signature cards (15 cards)
    const signatureCards = catalog.getCardsBySet('spider_man').flatMap((c) => {
      if (c.type === 'hero' || c.type === 'alter_ego') return [];
      return Array(c.quantity).fill(c);
    });

    // Justice + Basic cards to form a 40-card deck
    const justiceCards = catalog.getCardsByFaction('justice' as any).flatMap((c) => Array(c.quantity).fill(c));
    const basicCards = catalog.getCardsByFaction('basic' as any).flatMap((c) => Array(c.quantity).fill(c));

    const fullDeck = [...signatureCards, ...justiceCards, ...basicCards].slice(0, 40);
    return { identity: spiderManIdentity, deck: fullDeck };
  }

  function createCaptainMarvelLeadershipDeck() {
    const cmIdentity = catalog.getHeroIdentity('captain_marvel')!;
    const signatureCards = catalog.getCardsBySet('captain_marvel').flatMap((c) => {
      if (c.type === 'hero' || c.type === 'alter_ego') return [];
      return Array(c.quantity).fill(c);
    });
    const leadershipCards = catalog
      .getCardsByFaction('leadership' as any)
      .flatMap((c) => Array(c.quantity).fill(c));
    const basicCards = catalog
      .getCardsByFaction('basic' as any)
      .flatMap((c) => Array(c.quantity).fill(c));
    const fullDeck = [...signatureCards, ...leadershipCards, ...basicCards].slice(0, 40);
    return { identity: cmIdentity, deck: fullDeck };
  }

  function createRhinoEncounterDeck() {
    const rhinoCards = catalog.getCardsBySet('rhino').filter((c) => c.type !== 'villain');
    const standardCards = catalog.getCardsBySet('standard');
    const bombScareCards = catalog.getCardsBySet('bomb_scare');

    const encounterCards = [...rhinoCards, ...standardCards, ...bombScareCards].flatMap((c) =>
      Array(c.quantity).fill(c),
    );

    const rhinoVillain = catalog.getCard('01094') as VillainCard; // Rhino I
    const mainScheme = catalog.getCard('01097b') as MainSchemeCard; // The Break-In! (Stage 1B)

    return { villain: rhinoVillain, mainScheme, encounterCards };
  }

  it('correctly initializes a Solo game (Spider-Man vs Rhino)', () => {
    const { identity, deck } = createSpiderManJusticeDeck();
    const { villain, mainScheme, encounterCards } = createRhinoEncounterDeck();

    const gameState = setupGame({
      id: 'test_game_1',
      players: [
        {
          id: 'player_1',
          name: 'Player 1',
          hero: identity.hero,
          alterEgo: identity.alterEgo,
          deckCards: deck,
        },
      ],
      villain,
      mainScheme,
      encounterCards,
      // Pass no-op shuffle for deterministic testing
      shuffleFn: (arr) => arr,
    });

    // 1. Game State Headers
    expect(gameState.id).toBe('test_game_1');
    expect(gameState.phase).toBe(GamePhase.SETUP_PHASE);
    expect(gameState.setupState?.stage).toBe('MULLIGAN_PHASE');
    expect(gameState.roundNumber).toBe(1);
    expect(gameState.winner).toBeNull();
    expect(gameState.firstPlayerIndex).toBe(0);
    expect(gameState.activePlayerIndex).toBe(0);

    // 2. Player State Verification
    expect(gameState.players.length).toBe(1);
    const player = gameState.players[0];
    expect(player.id).toBe('player_1');
    expect(player.currentForm).toBe('alter_ego'); // Starts in Alter-Ego form
    expect(player.health).toBe(10);
    expect(player.maxHealth).toBe(10);
    expect(player.exhausted).toBe(false);
    expect(player.formChangedThisRound).toBe(false);
    expect(player.recoveryUsedThisRound).toBe(false);

    // Peter Parker has hand size 6
    expect(player.hand.length).toBe(6);
    expect(player.deck.length).toBe(34); // 40 - 6 = 34
    expect(player.discard.length).toBe(0);
    expect(player.tableau.length).toBe(0);
    expect(player.allies.length).toBe(0);
    expect(player.engagedMinions.length).toBe(0);

    // 3. Villain State Verification
    expect(gameState.villain.card.code).toBe('01094');
    expect(gameState.villain.card.name).toBe('Rhino');
    expect(gameState.villain.health).toBe(14); // 14 * 1 player
    expect(gameState.villain.maxHealth).toBe(14);
    expect(gameState.villain.exhausted).toBe(false);

    // 4. Main Scheme Verification
    expect(gameState.mainScheme.card.name).toBe('The Break-In!');
    expect(gameState.mainScheme.threat).toBe(0); // Starts with 0 threat
    expect(gameState.mainScheme.targetThreat).toBe(7); // 7 * 1 player

    // 5. Encounter Deck Verification
    expect(gameState.encounterDeck.length).toBe(encounterCards.length);
    expect(gameState.encounterDiscard.length).toBe(0);
    expect(gameState.accelerationTokens).toBe(0);
    expect(gameState.sideSchemes.length).toBe(0);

    // 6. Log verification
    expect(gameState.log.length).toBe(1);
    expect(gameState.log[0].key).toBe('game.setup.complete');
  });

  it('correctly scales hit points and threat for a 2-Player game', () => {
    const sm = createSpiderManJusticeDeck();
    const cm = createCaptainMarvelLeadershipDeck();
    const { villain, mainScheme, encounterCards } = createRhinoEncounterDeck();

    const gameState = setupGame({
      players: [
        {
          id: 'player_1',
          name: 'Player 1 (Spider-Man)',
          hero: sm.identity.hero,
          alterEgo: sm.identity.alterEgo,
          deckCards: sm.deck,
        },
        {
          id: 'player_2',
          name: 'Player 2 (Captain Marvel)',
          hero: cm.identity.hero,
          alterEgo: cm.identity.alterEgo,
          deckCards: cm.deck,
        },
      ],
      villain,
      mainScheme,
      encounterCards,
      shuffleFn: (arr) => arr,
    });

    expect(gameState.players.length).toBe(2);

    // 2-Player Scaling:
    // Rhino I: 14 HP per hero = 28 HP
    expect(gameState.villain.health).toBe(28);
    expect(gameState.villain.maxHealth).toBe(28);

    // Main Scheme: 7 threat per hero = 14 target threat
    expect(gameState.mainScheme.targetThreat).toBe(14);
  });

  it('correctly shuffles Obligation into encounter deck and sets aside Nemesis Set (Step 10 & 11 of Setup)', () => {
    const { identity, deck } = createSpiderManJusticeDeck();
    const { villain, mainScheme, encounterCards } = createRhinoEncounterDeck();

    const obligation = catalog.getCard('01165')!;
    const nemesisCards = catalog.getCardsBySet('spider_man_nemesis').flatMap((c) => Array(c.quantity).fill(c));

    const gameState = setupGame({
      players: [
        {
          id: 'player_1',
          name: 'Player 1',
          hero: identity.hero,
          alterEgo: identity.alterEgo,
          deckCards: deck,
          obligation,
          nemesisCards,
        },
      ],
      villain,
      mainScheme,
      encounterCards,
      shuffleFn: (arr) => arr,
    });

    const player = gameState.players[0];

    // 1. Nemesis Set must be set aside out of play (5 cards: Highway Robbery, Vulture, 2x Sweeping Swoop, The Vulture's Plans)
    expect(player.setAsideCards.length).toBe(5);
    const setAsideCodes = player.setAsideCards.map((c) => c.card.code);
    expect(setAsideCodes).toContain('01166'); // Highway Robbery
    expect(setAsideCodes).toContain('01167'); // Vulture
    expect(setAsideCodes).toContain('01168'); // Sweeping Swoop
    expect(setAsideCodes).toContain('01169'); // The Vulture's Plans

    // 2. Obligation (Eviction Notice 01165) must be in the encounter deck
    const encounterDeckCodes = gameState.encounterDeck.map((c) => c.card.code);
    expect(encounterDeckCodes).toContain('01165');
  });

  it('strictly enforces Hero Unicity Constraint per RR v1.8 (no duplicate heroes in same game)', () => {
    const { identity, deck } = createSpiderManJusticeDeck();
    const { villain, mainScheme, encounterCards } = createRhinoEncounterDeck();

    expect(() =>
      setupGame({
        players: [
          {
            id: 'player_1',
            name: 'Hero Seat 1 (Spider-Man)',
            hero: identity.hero,
            alterEgo: identity.alterEgo,
            deckCards: deck,
          },
          {
            id: 'player_2',
            name: 'Hero Seat 2 (Spider-Man Clone)',
            hero: identity.hero,
            alterEgo: identity.alterEgo,
            deckCards: deck,
          },
        ],
        villain,
        mainScheme,
        encounterCards,
      }),
    ).toThrowError(/Unicity constraint violation/);
  });

  it('throws an error if any card in the game is missing supplemental data (unscanned card safety)', () => {
    const { identity, deck } = createSpiderManJusticeDeck();
    const { villain, mainScheme, encounterCards } = createRhinoEncounterDeck();

    // Create an artificial unscanned card without enrichment
    const unscannedCard = {
      ...deck[0],
      code: 'unscanned_99999',
      name: 'Unscanned Card',
      enrichment: undefined,
    };

    expect(() =>
      setupGame({
        players: [
          {
            id: 'player_1',
            name: 'Player 1',
            hero: identity.hero,
            alterEgo: identity.alterEgo,
            deckCards: [unscannedCard, ...deck.slice(1)],
          },
        ],
        villain,
        mainScheme,
        encounterCards,
      }),
    ).toThrowError(/Supplemental data is missing for card unscanned_99999 \(Unscanned Card\)/);
  });
});
