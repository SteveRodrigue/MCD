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

  it('looks at top 3 cards with Trait: Tech filter (1 Tech, 2 non-Tech): prompts only for Tech card and discards all non-selected looked cards', () => {
    const techCard: NormalizedCard = { ...cardCatalog.getCard('01005')!, code: 'tech_a', name: 'Arc Reactor', type: CardType.UPGRADE, traits: ['Tech'] };
    const nonTech1: NormalizedCard = { ...cardCatalog.getCard('01005')!, code: 'event_b', name: 'Repulsor Blast', type: CardType.EVENT, traits: ['Attack'] };
    const nonTech2: NormalizedCard = { ...cardCatalog.getCard('01005')!, code: 'event_c', name: 'First Aid', type: CardType.EVENT };
    const deckD: NormalizedCard = { ...cardCatalog.getCard('01005')!, code: 'card_d', name: 'Card Delta' };

    const state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Iron Man',
          hero: spiderManHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: [techCard, nonTech1, nonTech2, deckD],
        },
      ],
      villain: rhinoVillain,
      mainScheme,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });

    const player = state.players[0];
    const instTech = createCardInstance(techCard);
    const instNonTech1 = createCardInstance(nonTech1);
    const instNonTech2 = createCardInstance(nonTech2);
    const instD = createCardInstance(deckD);
    player.deck = [instTech, instNonTech1, instNonTech2, instD]; // Top 3: instTech, instNonTech1, instNonTech2
    player.hand = [];
    player.discard = [];

    // Trigger SEARCH_AND_SELECT with lookCount 3 and filter on Trait: Tech (Tony Stark Futurist)
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
              filter: {
                trait: 'Tech',
              },
              takeCount: 1,
              selectedDestination: 'HAND',
              unselectedDestination: 'DISCARD',
              shuffleAfter: false,
              promptTitle: 'Futurist: Choose 1 Tech card to add to hand',
            },
          },
        ],
      },
      { playerId: 'p1' },
    );

    expect(effectRes.success).toBe(true);
    expect(effectRes.state.pendingDecisionPrompt).toBeDefined();
    // Only 1 option presented: instTech (the other 2 non-Tech cards are filtered out)
    expect(effectRes.state.pendingDecisionPrompt?.options.length).toBe(1);
    expect(effectRes.state.pendingDecisionPrompt?.options[0].id).toBe(instTech.instanceId);

    // Player selects the Tech card
    const resolveRes = dispatchAction(effectRes.state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: 'p1',
      selectedOptionId: instTech.instanceId,
    });

    expect(resolveRes.result.success).toBe(true);
    expect(resolveRes.state.pendingDecisionPrompt).toBeUndefined();

    // 1. Chosen Tech card is in hand
    expect(resolveRes.state.players[0].hand.length).toBe(1);
    expect(resolveRes.state.players[0].hand[0].instanceId).toBe(instTech.instanceId);

    // 2. Both non-Tech looked cards are in discard pile
    expect(resolveRes.state.players[0].discard.length).toBe(2);
    const discardIds = resolveRes.state.players[0].discard.map((c) => c.instanceId);
    expect(discardIds).toContain(instNonTech1.instanceId);
    expect(discardIds).toContain(instNonTech2.instanceId);

    // 3. Card Delta remains in deck untouched
    expect(resolveRes.state.players[0].deck.length).toBe(1);
    expect(resolveRes.state.players[0].deck[0].instanceId).toBe(instD.instanceId);
  });

  it('looks at top 3 cards with Trait: Tech filter (0 Tech cards): automatically discards all 3 looked cards', () => {
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
    player.deck = [instA, instB, instC, instD];
    player.hand = [];
    player.discard = [];

    // Trigger Futurist with 0 matching tech cards in top 3
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
              filter: {
                trait: 'Tech',
              },
              takeCount: 1,
              selectedDestination: 'HAND',
              unselectedDestination: 'DISCARD',
              shuffleAfter: false,
            },
          },
        ],
      },
      { playerId: 'p1' },
    );

    expect(effectRes.success).toBe(true);
    // No prompt is enqueued since 0 cards matched
    expect(effectRes.state.pendingDecisionPrompt).toBeUndefined();

    // Hand remains empty
    expect(effectRes.state.players[0].hand.length).toBe(0);

    // All 3 looked non-matching cards are discarded
    expect(effectRes.state.players[0].discard.length).toBe(3);
    const discardIds = effectRes.state.players[0].discard.map((c) => c.instanceId);
    expect(discardIds).toContain(instA.instanceId);
    expect(discardIds).toContain(instB.instanceId);
    expect(discardIds).toContain(instC.instanceId);

    // Card Delta remains in deck
    expect(effectRes.state.players[0].deck.length).toBe(1);
    expect(effectRes.state.players[0].deck[0].instanceId).toBe(instD.instanceId);
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

  it('searches deck for a Black Panther upgrade and puts it directly into tableau (T Challa King of Wakanda Setup)', () => {
    const bpSuit: NormalizedCard = { ...cardCatalog.getCard('01005')!, code: '01046', name: 'Panther Spacesuit', type: CardType.UPGRADE, traits: ['Black Panther', 'Armor'] };
    const filler1: NormalizedCard = { ...cardCatalog.getCard('01005')!, code: 'filler_1', name: 'Filler 1' };

    const state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: "T'Challa",
          hero: spiderManHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: [filler1, bpSuit],
        },
      ],
      villain: rhinoVillain,
      mainScheme,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });

    const player = state.players[0];
    const instFiller = createCardInstance(filler1);
    const instSuit = createCardInstance(bpSuit);
    player.deck = [instFiller, instSuit];
    player.tableau = [];

    const effectRes = executeEffect(
      state,
      {
        id: 't_challa_foresight',
        timing: 'SETUP',
        steps: [
          {
            effect: 'SEARCH_AND_SELECT',
            params: {
              source: 'PLAYER_DECK',
              filter: {
                trait: 'Black Panther',
                type: 'upgrade',
              },
              takeCount: 1,
              selectedDestination: 'TABLEAU',
              unselectedDestination: null,
              shuffleAfter: true,
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
      selectedOptionId: instSuit.instanceId,
    });

    expect(resolveRes.result.success).toBe(true);
    // BP Suit is in tableau
    expect(resolveRes.state.players[0].tableau.length).toBe(1);
    expect(resolveRes.state.players[0].tableau[0].instanceId).toBe(instSuit.instanceId);
    // Filler remains in deck
    expect(resolveRes.state.players[0].deck.length).toBe(1);
    expect(resolveRes.state.players[0].deck[0].instanceId).toBe(instFiller.instanceId);
  });

  it('searches encounter deck for a Masters of Evil minion and puts it into play (Masters of Evil Encounter Side Scheme)', () => {
    const minionTigerShark: NormalizedCard = { ...cardCatalog.getCard('01005')!, code: 'tiger_shark', name: 'Tiger Shark', type: CardType.MINION, traits: ['Masters of Evil'] };
    const encounterTreachery: NormalizedCard = { ...cardCatalog.getCard('01005')!, code: 'enc_treachery', name: 'Stampede', type: CardType.TREACHERY };

    const state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Iron Man',
          hero: spiderManHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: [cardCatalog.getCard('01005')!],
        },
      ],
      villain: rhinoVillain,
      mainScheme,
      encounterCards: [minionTigerShark, encounterTreachery],
      skipMulligan: true,
    });

    const instMinion = createCardInstance(minionTigerShark);
    const instTreachery = createCardInstance(encounterTreachery);
    state.encounterDeck = [instTreachery, instMinion];
    state.encounterDiscard = [];

    const effectRes = executeEffect(
      state,
      {
        id: 'masters_of_evil_when_revealed',
        timing: 'WHEN_REVEALED',
        steps: [
          {
            effect: 'SEARCH_AND_SELECT',
            params: {
              source: 'ENCOUNTER_DECK',
              filter: {
                trait: 'Masters of Evil',
                type: 'minion',
              },
              takeCount: 1,
              selectedDestination: 'TABLEAU',
              unselectedDestination: null,
              shuffleAfter: true,
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
      selectedOptionId: instMinion.instanceId,
    });

    expect(resolveRes.result.success).toBe(true);
    // Minion is put into play
    expect(resolveRes.state.players[0].tableau.some((c) => c.instanceId === instMinion.instanceId)).toBe(true);
    // Treachery remains in encounter deck
    expect(resolveRes.state.encounterDeck.length).toBe(1);
    expect(resolveRes.state.encounterDeck[0].instanceId).toBe(instTreachery.instanceId);
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
});
