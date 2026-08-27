import { describe, it, expect, beforeEach } from 'vitest';
import { CardCatalog } from '../../src/data/importer/card-loader';
import {
  setupGame,
  resetInstanceCounter,
  getScenario,
  getStarterDeck,
  dispatchAction,
  GamePhase,
} from '../../src/engine';

import corePack from '../../data/upstream/pack/core.json';
import coreEncounterPack from '../../data/upstream/pack/core_encounter.json';

describe('Mulligan Phase State Machine & Rules', () => {
  let catalog: CardCatalog;

  beforeEach(() => {
    resetInstanceCounter();
    catalog = new CardCatalog([...corePack, ...coreEncounterPack]);
  });

  it('allows a player to discard 2 cards and redraw 2 cards, shuffling discards back into deck', () => {
    const scenario = getScenario('rhino')!;
    const { villain, mainScheme, encounterCards } = scenario.createEncounterDeck(catalog);

    const starterDeck = getStarterDeck('spider_man_justice')!;
    const deck = starterDeck.loadDeck(catalog);

    const initialState = setupGame({
      players: [
        {
          id: 'player_1',
          name: 'Peter Parker',
          hero: deck.hero,
          alterEgo: deck.alterEgo,
          deckCards: deck.deckCards,
        },
      ],
      villain,
      mainScheme,
      encounterCards,
    });

    const player = initialState.players[0];
    expect(player.hand).toHaveLength(6);
    expect(player.deck).toHaveLength(34);

    // Choose 2 cards to mulligan
    const discardIds = [player.hand[0].instanceId, player.hand[1].instanceId];

    const { state: nextState, result } = dispatchAction(initialState, {
      type: 'RESOLVE_MULLIGAN',
      playerId: 'player_1',
      discardCardInstanceIds: discardIds,
    });

    expect(result.success).toBe(true);

    const updatedPlayer = nextState.players[0];
    // Hand size remains 6
    expect(updatedPlayer.hand).toHaveLength(6);

    // Deck size remains 34 (discards are shuffled back into deck)
    expect(updatedPlayer.deck).toHaveLength(34);

    // Discard pile remains 0 (mulligan cards are NOT in the discard pile)
    expect(updatedPlayer.discard).toHaveLength(0);

    // Mulligan is marked complete and game transitions to PLAYER_PHASE Round 1
    expect(nextState.setupState?.mulliganCompleted['player_1']).toBe(true);
    expect(nextState.setupState?.stage).toBe('GAME_READY');
    expect(nextState.phase).toBe(GamePhase.PLAYER_PHASE);
    expect(nextState.roundNumber).toBe(1);
  });

  it('handles multi-player sequential/parallel mulligan before transitioning to Round 1', () => {
    const scenario = getScenario('rhino')!;
    const { villain, mainScheme, encounterCards } = scenario.createEncounterDeck(catalog);

    const starterDeck = getStarterDeck('spider_man_justice')!;
    const d1 = starterDeck.loadDeck(catalog);
    const d2 = starterDeck.loadDeck(catalog);

    const initialState = setupGame({
      players: [
        {
          id: 'player_1',
          name: 'Hero 1',
          hero: d1.hero,
          alterEgo: d1.alterEgo,
          deckCards: d1.deckCards,
        },
        {
          id: 'player_2',
          name: 'Hero 2',
          hero: d2.hero,
          alterEgo: d2.alterEgo,
          deckCards: d2.deckCards,
        },
      ],
      villain,
      mainScheme,
      encounterCards,
    });

    // Player 1 completes mulligan with 0 cards discarded (keep all 6)
    const step1 = dispatchAction(initialState, {
      type: 'RESOLVE_MULLIGAN',
      playerId: 'player_1',
      discardCardInstanceIds: [],
    });

    expect(step1.result.success).toBe(true);
    // Still in SETUP_PHASE because Player 2 has not mulliganed yet
    expect(step1.state.phase).toBe(GamePhase.SETUP_PHASE);
    expect(step1.state.setupState?.mulliganCompleted['player_1']).toBe(true);
    expect(step1.state.setupState?.mulliganCompleted['player_2']).toBeUndefined();

    // Player 2 completes mulligan with 3 cards discarded
    const p2Hand = step1.state.players[1].hand;
    const step2 = dispatchAction(step1.state, {
      type: 'RESOLVE_MULLIGAN',
      playerId: 'player_2',
      discardCardInstanceIds: [p2Hand[0].instanceId, p2Hand[1].instanceId, p2Hand[2].instanceId],
    });

    expect(step2.result.success).toBe(true);
    // Now all players done -> Transition to PLAYER_PHASE Round 1
    expect(step2.state.phase).toBe(GamePhase.PLAYER_PHASE);
    expect(step2.state.setupState?.stage).toBe('GAME_READY');
  });
});
