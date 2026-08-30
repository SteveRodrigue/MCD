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

describe('Mulligan Phase State Machine & Rules (RR v1.8 p. 23)', () => {
  let catalog: CardCatalog;

  beforeEach(() => {
    resetInstanceCounter();
    catalog = new CardCatalog([...corePack, ...coreEncounterPack]);
  });

  it('moves rejected cards directly into player discard pile and draws replacements from deck (NO shuffle)', () => {
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
    expect(player.discard).toHaveLength(0);

    // Choose 2 cards to mulligan
    const discardedCard0 = player.hand[0];
    const discardedCard1 = player.hand[1];
    const discardIds = [discardedCard0.instanceId, discardedCard1.instanceId];

    const { state: nextState, result } = dispatchAction(initialState, {
      type: 'RESOLVE_MULLIGAN',
      playerId: 'player_1',
      discardCardInstanceIds: discardIds,
    });

    expect(result.success).toBe(true);

    const updatedPlayer = nextState.players[0];
    // Hand size remains 6
    expect(updatedPlayer.hand).toHaveLength(6);

    // Deck size decreases by 2 (drawn replacements from top of deck)
    expect(updatedPlayer.deck).toHaveLength(32);

    // Discard pile now contains the 2 rejected mulligan cards
    expect(updatedPlayer.discard).toHaveLength(2);
    expect(updatedPlayer.discard.map((c) => c.instanceId)).toEqual(discardIds);

    // Mulligan is marked complete and game transitions to PLAYER_PHASE Round 1 with discard intact
    expect(nextState.setupState?.mulliganCompleted['player_1']).toBe(true);
    expect(nextState.setupState?.stage).toBe('GAME_READY');
    expect(nextState.phase).toBe(GamePhase.PLAYER_PHASE);
    expect(nextState.roundNumber).toBe(1);
  });

  it('handles multi-player mulligan and preserves each player discard pile into Round 1', () => {
    const scenario = getScenario('rhino')!;
    const { villain, mainScheme, encounterCards } = scenario.createEncounterDeck(catalog);

    const d1 = getStarterDeck('spider_man_justice')!.loadDeck(catalog);
    const d2 = getStarterDeck('captain_marvel_leadership')!.loadDeck(catalog);

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
    expect(step1.state.players[0].discard).toHaveLength(0);

    // Player 2 completes mulligan with 3 cards discarded
    const p2Hand = step1.state.players[1].hand;
    const p2DiscardIds = [p2Hand[0].instanceId, p2Hand[1].instanceId, p2Hand[2].instanceId];
    const step2 = dispatchAction(step1.state, {
      type: 'RESOLVE_MULLIGAN',
      playerId: 'player_2',
      discardCardInstanceIds: p2DiscardIds,
    });

    expect(step2.result.success).toBe(true);
    // Now all players done -> Transition to PLAYER_PHASE Round 1
    expect(step2.state.phase).toBe(GamePhase.PLAYER_PHASE);
    expect(step2.state.setupState?.stage).toBe('GAME_READY');

    // Verify Player 1 has 0 in discard and Player 2 has 3 in discard
    expect(step2.state.players[0].discard).toHaveLength(0);
    expect(step2.state.players[1].discard).toHaveLength(3);
    expect(step2.state.players[1].deck).toHaveLength(31); // 40 - 6 - 3 = 31
  });
});
