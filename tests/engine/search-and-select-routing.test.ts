import { describe, it, expect, beforeEach } from 'vitest';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { CardType, NormalizedCard } from '@engine/models';
import { executeEffect } from '@engine/effects';
import { dispatchAction } from '@engine/pipeline/action-dispatcher';

describe('SEARCH_AND_SELECT Two-Pile Destination Routing & Specific Card Picking (RR v1.8 p. 19, 26, ADR-0030, ADR-0032)', () => {
  let spiderManHero: any;
  let peterParkerAlterEgo: any;
  let rhinoVillain: any;
  let mainScheme: any;

  beforeEach(() => {
    spiderManHero = cardCatalog.getCard('01001a')!;
    peterParkerAlterEgo = cardCatalog.getCard('01001b')!;
    rhinoVillain = cardCatalog.getCard('01094')!;
    mainScheme = cardCatalog.getCard('01097')!;
  });

  it('looks at top 3 cards, routes selected card to HAND, and unselected cards to DISCARD (Tony Stark Futurist)', () => {
    const cardA: NormalizedCard = { ...cardCatalog.getCard('01005')!, code: 'card_a', name: 'Card Alpha' };
    const cardB: NormalizedCard = { ...cardCatalog.getCard('01005')!, code: 'card_b', name: 'Card Beta' };
    const cardC: NormalizedCard = { ...cardCatalog.getCard('01005')!, code: 'card_c', name: 'Card Gamma' };
    const cardD: NormalizedCard = { ...cardCatalog.getCard('01005')!, code: 'card_d', name: 'Card Delta' };

    const state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Iron Man',
          hero: spiderManHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: [cardA, cardB, cardC, cardD],
        },
      ],
      villain: rhinoVillain,
      mainScheme,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });

    const player = state.players[0];
    const instA = createCardInstance(cardA);
    const instB = createCardInstance(cardB);
    const instC = createCardInstance(cardC);
    const instD = createCardInstance(cardD);
    player.deck = [instA, instB, instC, instD]; // Top is instA
    player.hand = [];
    player.discard = [];

    // Trigger SEARCH_AND_SELECT with lookCount 3
    const effectRes = executeEffect(
      state,
      {
        id: 'futurist_ability',
        timing: 'ALTER_EGO_ACTION',
        steps: [
          {
            effect: 'SEARCH_AND_SELECT',
            params: {
              source: 'PLAYER_DECK',
              lookCount: 3,
              takeCount: 1,
              selectedDestination: 'HAND',
              unselectedDestination: 'DISCARD',
              shuffleAfter: false,
              promptTitle: 'Futurist: Choose 1 card to add to hand',
            },
          },
        ],
      },
      { playerId: 'p1' },
    );

    expect(effectRes.success).toBe(true);
    expect(effectRes.state.pendingDecisionPrompt).toBeDefined();
    expect(effectRes.state.pendingDecisionPrompt?.options.length).toBe(3);

    // Options correspond to top 3 cards (Card Alpha, Card Beta, Card Gamma)
    const optionCardIds = effectRes.state.pendingDecisionPrompt!.options.map((o) => o.id);
    expect(optionCardIds).toContain(instA.instanceId);
    expect(optionCardIds).toContain(instB.instanceId);
    expect(optionCardIds).toContain(instC.instanceId);

    // Player selects Card Beta (instB)
    const resolveRes = dispatchAction(effectRes.state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: 'p1',
      selectedOptionId: instB.instanceId,
    });

    expect(resolveRes.result.success).toBe(true);
    expect(resolveRes.state.pendingDecisionPrompt).toBeUndefined();

    // 1. Chosen card (Card Beta) is in hand
    expect(resolveRes.state.players[0].hand.length).toBe(1);
    expect(resolveRes.state.players[0].hand[0].instanceId).toBe(instB.instanceId);

    // 2. Unchosen looked cards (Card Alpha, Card Gamma) are in discard pile
    expect(resolveRes.state.players[0].discard.length).toBe(2);
    const discardIds = resolveRes.state.players[0].discard.map((c) => c.instanceId);
    expect(discardIds).toContain(instA.instanceId);
    expect(discardIds).toContain(instC.instanceId);

    // 3. Card Delta remains in deck untouched
    expect(resolveRes.state.players[0].deck.length).toBe(1);
    expect(resolveRes.state.players[0].deck[0].instanceId).toBe(instD.instanceId);
  });

  it('searches entire deck for a specific named card and leaves all other cards in deck untouched (unselectedDestination: null, shuffleAfter: true)', () => {
    const shieldCard: NormalizedCard = { ...cardCatalog.getCard('01005')!, code: 'cap_shield', name: "Captain America's Shield", type: CardType.UPGRADE };
    const filler1: NormalizedCard = { ...cardCatalog.getCard('01005')!, code: 'filler_1', name: 'Filler 1' };
    const filler2: NormalizedCard = { ...cardCatalog.getCard('01005')!, code: 'filler_2', name: 'Filler 2' };

    const state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Captain America',
          hero: spiderManHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: [filler1, shieldCard, filler2],
        },
      ],
      villain: rhinoVillain,
      mainScheme,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });

    const player = state.players[0];
    const instF1 = createCardInstance(filler1);
    const instShield = createCardInstance(shieldCard);
    const instF2 = createCardInstance(filler2);
    player.deck = [instF1, instShield, instF2];
    player.hand = [];
    player.discard = [];

    // Trigger specific search for Captain America's Shield
    const effectRes = executeEffect(
      state,
      {
        id: 'fetch_shield',
        timing: 'ACTION',
        steps: [
          {
            effect: 'SEARCH_AND_SELECT',
            params: {
              source: 'PLAYER_DECK',
              filter: {
                targetCardCode: 'cap_shield',
              },
              takeCount: 1,
              selectedDestination: 'HAND',
              unselectedDestination: null,
              shuffleAfter: true,
            },
          },
        ],
      },
      { playerId: 'p1' },
    );

    // If prompt was enqueued
    let finalState = effectRes.state;
    if (finalState.pendingDecisionPrompt) {
      const res = dispatchAction(finalState, {
        type: 'RESOLVE_DECISION_PROMPT',
        playerId: 'p1',
        selectedOptionId: instShield.instanceId,
      });
      finalState = res.state;
    }

    // Shield should be in hand
    expect(finalState.players[0].hand.length).toBe(1);
    expect(finalState.players[0].hand[0].instanceId).toBe(instShield.instanceId);

    // Other 2 cards remain in deck
    expect(finalState.players[0].deck.length).toBe(2);
    expect(finalState.players[0].discard.length).toBe(0);
  });

  it('preserves exact deck ordering when unselected cards return to DECK_TOP', () => {
    const cardA: NormalizedCard = { ...cardCatalog.getCard('01005')!, code: 'card_a', name: 'Card Alpha' };
    const cardB: NormalizedCard = { ...cardCatalog.getCard('01005')!, code: 'card_b', name: 'Card Beta' };
    const cardC: NormalizedCard = { ...cardCatalog.getCard('01005')!, code: 'card_c', name: 'Card Gamma' };

    const state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: spiderManHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: [cardA, cardB, cardC],
        },
      ],
      villain: rhinoVillain,
      mainScheme,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });

    const player = state.players[0];
    const instA = createCardInstance(cardA);
    const instB = createCardInstance(cardB);
    const instC = createCardInstance(cardC);
    player.deck = [instA, instB, instC]; // Top is instA, middle is instB, bottom is instC
    player.hand = [];

    // Look at top 3 cards, select 1 to hand, return unchosen 2 to DECK_TOP in original relative order
    const effectRes = executeEffect(
      state,
      {
        id: 'scry_and_return',
        timing: 'ACTION',
        steps: [
          {
            effect: 'SEARCH_AND_SELECT',
            params: {
              source: 'PLAYER_DECK',
              lookCount: 3,
              takeCount: 1,
              selectedDestination: 'HAND',
              unselectedDestination: 'DECK_TOP',
              shuffleAfter: false,
            },
          },
        ],
      },
      { playerId: 'p1' },
    );

    // Player picks Card Beta (instB)
    const resolveRes = dispatchAction(effectRes.state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: 'p1',
      selectedOptionId: instB.instanceId,
    });

    expect(resolveRes.state.players[0].hand[0].instanceId).toBe(instB.instanceId);

    // Deck should have [instA, instC] preserving original relative order
    expect(resolveRes.state.players[0].deck.length).toBe(2);
    expect(resolveRes.state.players[0].deck[0].instanceId).toBe(instA.instanceId);
    expect(resolveRes.state.players[0].deck[1].instanceId).toBe(instC.instanceId);
  });

  it('routes unselected cards to DECK_BOTTOM without shuffling', () => {
    const cardA: NormalizedCard = { ...cardCatalog.getCard('01005')!, code: 'card_a', name: 'Card Alpha' };
    const cardB: NormalizedCard = { ...cardCatalog.getCard('01005')!, code: 'card_b', name: 'Card Beta' };
    const cardC: NormalizedCard = { ...cardCatalog.getCard('01005')!, code: 'card_c', name: 'Card Gamma' };
    const cardD: NormalizedCard = { ...cardCatalog.getCard('01005')!, code: 'card_d', name: 'Card Delta' };

    const state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: spiderManHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: [cardA, cardB, cardC, cardD],
        },
      ],
      villain: rhinoVillain,
      mainScheme,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });

    const player = state.players[0];
    const instA = createCardInstance(cardA);
    const instB = createCardInstance(cardB);
    const instC = createCardInstance(cardC);
    const instD = createCardInstance(cardD);
    player.deck = [instA, instB, instC, instD]; // Top is instA, instB, instC, instD
    player.hand = [];

    // Look at top 2 (instA, instB), pick instA to HAND, send instB to DECK_BOTTOM
    const effectRes = executeEffect(
      state,
      {
        id: 'look_and_bottom',
        timing: 'ACTION',
        steps: [
          {
            effect: 'SEARCH_AND_SELECT',
            params: {
              source: 'PLAYER_DECK',
              lookCount: 2,
              takeCount: 1,
              selectedDestination: 'HAND',
              unselectedDestination: 'DECK_BOTTOM',
              shuffleAfter: false,
            },
          },
        ],
      },
      { playerId: 'p1' },
    );

    // Pick instA
    const resolveRes = dispatchAction(effectRes.state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: 'p1',
      selectedOptionId: instA.instanceId,
    });

    expect(resolveRes.state.players[0].hand[0].instanceId).toBe(instA.instanceId);

    // Deck should have instC, instD on top, and instB at bottom
    expect(resolveRes.state.players[0].deck.length).toBe(3);
    expect(resolveRes.state.players[0].deck[0].instanceId).toBe(instC.instanceId);
    expect(resolveRes.state.players[0].deck[1].instanceId).toBe(instD.instanceId);
    expect(resolveRes.state.players[0].deck[2].instanceId).toBe(instB.instanceId);
  });

  it('searches discard pile for any Tech upgrade and puts it into hand (e.g. Pepper Potts / Tech search)', () => {
    const techCard: NormalizedCard = { ...cardCatalog.getCard('01005')!, code: 'tech_upgrade', name: 'Arc Reactor', type: CardType.UPGRADE, traits: ['Tech'] };
    const eventCard: NormalizedCard = { ...cardCatalog.getCard('01005')!, code: 'event_card', name: 'Repulsor Blast', type: CardType.EVENT };

    const state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Iron Man',
          hero: spiderManHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: [techCard, eventCard],
        },
      ],
      villain: rhinoVillain,
      mainScheme,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });

    const player = state.players[0];
    const instTech = createCardInstance(techCard);
    const instEvent = createCardInstance(eventCard);
    player.discard = [instTech, instEvent];
    player.hand = [];

    // Retrieve Tech Upgrade from discard
    const effectRes = executeEffect(
      state,
      {
        id: 'retrieve_tech',
        timing: 'ACTION',
        steps: [
          {
            effect: 'SEARCH_AND_SELECT',
            params: {
              source: 'PLAYER_DISCARD',
              filter: {
                trait: 'Tech',
                type: CardType.UPGRADE,
              },
              takeCount: 1,
              selectedDestination: 'HAND',
              unselectedDestination: null,
              shuffleAfter: false,
            },
          },
        ],
      },
      { playerId: 'p1' },
    );

    expect(effectRes.state.pendingDecisionPrompt).toBeDefined();

    const resolveRes = dispatchAction(effectRes.state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: 'p1',
      selectedOptionId: instTech.instanceId,
    });

    expect(resolveRes.result.success).toBe(true);
    expect(resolveRes.state.players[0].hand.length).toBe(1);
    expect(resolveRes.state.players[0].hand[0].instanceId).toBe(instTech.instanceId);
    expect(resolveRes.state.players[0].discard.length).toBe(1);
    expect(resolveRes.state.players[0].discard[0].instanceId).toBe(instEvent.instanceId);
  });

  it('supports voluntary pass and cancellation during search', () => {
    const cardA: NormalizedCard = { ...cardCatalog.getCard('01005')!, code: 'card_a', name: 'Card Alpha' };

    const state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: spiderManHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: [cardA],
        },
      ],
      villain: rhinoVillain,
      mainScheme,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });

    const player = state.players[0];
    const instA = createCardInstance(cardA);
    player.deck = [instA];
    player.hand = [];

    const effectRes = executeEffect(
      state,
      {
        id: 'voluntary_search',
        timing: 'ACTION',
        steps: [
          {
            effect: 'SEARCH_AND_SELECT',
            params: {
              source: 'PLAYER_DECK',
              lookCount: 1,
              takeCount: 1,
              selectedDestination: 'HAND',
              unselectedDestination: 'DISCARD',
              isVoluntary: true,
            },
          },
        ],
      },
      { playerId: 'p1' },
    );

    expect(effectRes.state.pendingDecisionPrompt).toBeDefined();
    expect(effectRes.state.pendingDecisionPrompt?.options.some((o) => o.id === 'pass_search')).toBe(true);

    const resolveRes = dispatchAction(effectRes.state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: 'p1',
      selectedOptionId: 'pass_search',
    });

    expect(resolveRes.result.success).toBe(true);
    expect(resolveRes.state.players[0].hand.length).toBe(0);
  });
});
