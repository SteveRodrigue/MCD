import { describe, it, expect, beforeEach } from 'vitest';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { CardType, NormalizedCard } from '@engine/models';
import { executeEffect } from '@engine/effects';

describe('Universal DISCARD Primitive Engine (RR v1.8 p. 10, Issue #66)', () => {
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

  function createTestGame() {
    return setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: spiderManHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: [cardCatalog.getCard('01005')!, cardCatalog.getCard('01006')!],
        },
      ],
      villain: rhinoVillain,
      mainScheme,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });
  }

  it('discards cards from HAND at random (mode: RANDOM)', () => {
    const state = createTestGame();
    const player = state.players[0];
    const initialHandCount = player.hand.length;
    expect(initialHandCount).toBeGreaterThanOrEqual(2);

    const res = executeEffect(
      state,
      {
        effect: 'DISCARD',
        params: {
          source: 'HAND',
          mode: 'RANDOM',
          count: 2,
        },
      },
      { playerId: 'p1' },
    );

    expect(res.success).toBe(true);
    expect(res.mutatedState).toBe(true);
    expect(player.hand.length).toBe(initialHandCount - 2);
    expect(player.discard.length).toBe(2);
    expect(res.onomatopoeia).toContain('RANDOM DISCARD');
  });

  it('discards cards from HAND in standard order', () => {
    const state = createTestGame();
    const player = state.players[0];
    const initialHandCount = player.hand.length;
    const firstCard = player.hand[0];

    const res = executeEffect(
      state,
      {
        effect: 'DISCARD',
        params: {
          source: 'HAND',
          count: 1,
        },
      },
      { playerId: 'p1' },
    );

    expect(res.success).toBe(true);
    expect(player.hand.length).toBe(initialHandCount - 1);
    expect(player.discard).toContain(firstCard);
  });

  it('discards cards from player DECK (milling)', () => {
    const state = createTestGame();
    const player = state.players[0];
    player.deck = [
      createCardInstance(cardCatalog.getCard('01005')!),
      createCardInstance(cardCatalog.getCard('01006')!),
    ];
    const initialDeckCount = player.deck.length;
    const initialDiscardCount = player.discard.length;

    const res = executeEffect(
      state,
      {
        effect: 'DISCARD',
        params: {
          source: 'DECK',
          count: 2,
        },
      },
      { playerId: 'p1' },
    );

    expect(res.success).toBe(true);
    expect(player.deck.length).toBe(initialDeckCount - 2);
    expect(player.discard.length).toBe(initialDiscardCount + 2);
  });

  it('discards cards from ENCOUNTER_DECK', () => {
    const state = createTestGame();
    const initialEncounterDeckCount = state.encounterDeck.length;
    const initialEncounterDiscardCount = state.encounterDiscard.length;

    const res = executeEffect(
      state,
      {
        effect: 'DISCARD',
        params: {
          source: 'ENCOUNTER_DECK',
          count: 2,
        },
      },
      { playerId: 'p1' },
    );

    expect(res.success).toBe(true);
    expect(state.encounterDeck.length).toBe(initialEncounterDeckCount - 2);
    expect(state.encounterDiscard.length).toBe(initialEncounterDiscardCount + 2);
  });

  it('discards upgrade or support from TABLEAU when present', () => {
    const state = createTestGame();
    const player = state.players[0];

    const testUpgrade: NormalizedCard = {
      ...cardCatalog.getCard('01005')!,
      code: 'test_upgrade',
      name: 'Web-Shooter',
      type: CardType.UPGRADE,
    };
    const inst = createCardInstance(testUpgrade);
    player.tableau = [inst];

    const res = executeEffect(
      state,
      {
        effect: 'DISCARD',
        params: {
          source: 'TABLEAU',
          filter: {
            cardTypes: ['upgrade', 'support'],
          },
          fallback: 'SURGE',
        },
      },
      { playerId: 'p1' },
    );

    expect(res.success).toBe(true);
    expect(player.tableau.length).toBe(0);
    expect(player.discard).toContain(inst);
    expect(res.onomatopoeia).toContain('DISCARDED WEB-SHOOTER');
    expect(player.dealtEncounterCards.length).toBe(0); // No surge because card was discarded
  });

  it('triggers SURGE fallback when TABLEAU has no matching cards', () => {
    const state = createTestGame();
    const player = state.players[0];
    player.tableau = []; // Empty tableau
    const initialDealtCount = player.dealtEncounterCards.length;

    const res = executeEffect(
      state,
      {
        effect: 'DISCARD',
        params: {
          source: 'TABLEAU',
          filter: {
            cardTypes: ['upgrade', 'support'],
          },
          fallback: 'SURGE',
        },
      },
      { playerId: 'p1' },
    );

    expect(res.success).toBe(true);
    expect(res.onomatopoeia).toBe('SURGE!');
    expect(player.dealtEncounterCards.length).toBe(initialDealtCount + 1);
  });

  it('discards card instance via source: SELF', () => {
    const state = createTestGame();
    const player = state.players[0];

    const testCard: NormalizedCard = {
      ...cardCatalog.getCard('01005')!,
      code: 'test_self_card',
      name: 'Test Self Discard Card',
      type: CardType.UPGRADE,
    };
    const inst = createCardInstance(testCard);
    player.tableau = [inst];

    const res = executeEffect(
      state,
      {
        effect: 'DISCARD',
        params: {
          source: 'SELF',
        },
      },
      { playerId: 'p1', sourceCardInstance: inst },
    );

    expect(res.success).toBe(true);
    expect(player.tableau.length).toBe(0);
    expect(player.discard).toContain(inst);
  });

  it('discards villain attachment via source: HOST', () => {
    const state = createTestGame();
    const attachmentCard = cardCatalog.getCard('01100')!;
    const inst = createCardInstance(attachmentCard);
    state.villain.attachments = [inst];

    const res = executeEffect(
      state,
      {
        effect: 'DISCARD',
        params: {
          source: 'HOST',
        },
      },
      { playerId: 'p1', sourceCardInstance: inst },
    );

    expect(res.success).toBe(true);
    expect(state.villain.attachments.length).toBe(0);
    expect(state.encounterDiscard).toContain(inst);
  });

  it('discards cards tucked under villain via source: CARDS_UNDER_HOST', () => {
    const state = createTestGame();
    const encounterCard = createCardInstance(cardCatalog.getCard('01101')!); // Minion
    state.villain.cardsUnderneath = [encounterCard];

    const res = executeEffect(
      state,
      {
        effect: 'DISCARD',
        params: {
          source: 'CARDS_UNDER_HOST',
          target: 'VILLAIN',
        },
      },
      { playerId: 'p1' },
    );

    expect(res.success).toBe(true);
    expect(state.villain.cardsUnderneath?.length).toBe(0);
    expect(state.encounterDiscard).toContain(encounterCard);
  });

  it('executes Black Cat (01002) two-pile split via universal DISCARD with matchingDestination: HAND', () => {
    const state = createTestGame();
    const player = state.players[0];

    // Card 1: Mental resource (01005 Web-Shooter has mental resource)
    const mentalCard = createCardInstance(cardCatalog.getCard('01005')!);
    // Card 2: Energy resource (01006 Aunt May has energy resource)
    const nonMentalCard = createCardInstance(cardCatalog.getCard('01006')!);

    player.deck = [mentalCard, nonMentalCard];
    const initialHandCount = player.hand.length;

    const res = executeEffect(
      state,
      {
        effect: 'DISCARD',
        params: {
          source: 'DECK',
          count: 2,
          filter: {
            resource: 'mental',
          },
          matchingDestination: 'HAND',
        },
      },
      { playerId: 'p1' },
    );

    expect(res.success).toBe(true);
    // Universal DISCARD resolves immediately without opening decision prompt
    expect(res.state.pendingDecisionPrompt).toBeUndefined();

    // Mental card added to hand
    expect(player.hand.length).toBe(initialHandCount + 1);
    expect(player.hand.map((c) => c.instanceId)).toContain(mentalCard.instanceId);
    // Non-mental card discarded to discard pile
    expect(player.discard.map((c) => c.instanceId)).toContain(nonMentalCard.instanceId);
  });
});
