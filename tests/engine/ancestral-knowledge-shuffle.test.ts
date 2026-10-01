import { describe, it, expect, beforeEach } from 'vitest';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { dispatchAction } from '@engine/pipeline/action-dispatcher';

describe('Ancestral Knowledge (01042) - Deck Shuffle Destination (Fixes #189, RR v1.8)', () => {
  let bpAlterEgo: any;
  let bpHero: any;
  let rhinoVillain: any;
  let mainScheme: any;
  let ancestralKnowledgeCard: any;

  beforeEach(() => {
    bpHero = cardCatalog.getCard('01040a')!;
    bpAlterEgo = cardCatalog.getCard('01040b')!;
    rhinoVillain = cardCatalog.getCard('01094')!;
    mainScheme = cardCatalog.getCard('01097')!;
    ancestralKnowledgeCard = cardCatalog.getCard('01042')!;
  });

  function createTestState() {
    return setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: "T'Challa",
          hero: bpHero,
          alterEgo: bpAlterEgo,
          deckCards: [],
        },
      ],
      villain: rhinoVillain,
      mainScheme,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });
  }

  it('plays Ancestral Knowledge as Alter-Ego Action from hand, pays cost, and shuffles <= 3 cards into deck', () => {
    const state = createTestState();
    const player = state.players[0];
    player.currentForm = 'alter_ego';

    const akInstance = createCardInstance(ancestralKnowledgeCard);
    const payCard = createCardInstance(cardCatalog.getCard('01005')!);
    player.hand = [akInstance, payCard];

    const discardCard1 = createCardInstance(cardCatalog.getCard('01006')!);
    const discardCard2 = createCardInstance(cardCatalog.getCard('01007')!);
    player.discard = [discardCard1, discardCard2];
    player.deck = [];

    const playResult = dispatchAction(state, {
      type: 'PLAY_CARD',
      playerId: 'p1',
      cardInstanceId: akInstance.instanceId,
      paymentCardInstanceIds: [payCard.instanceId],
    });

    expect(playResult.result.success).toBe(true);

    const updatedPlayer = playResult.state.players[0];

    // The 2 cards from discard plus the payment card were shuffled into the deck (total <= 3)
    expect(updatedPlayer.deck.length).toBe(3);
    const deckIds = updatedPlayer.deck.map((c) => c.instanceId);
    expect(deckIds).toContain(discardCard1.instanceId);
    expect(deckIds).toContain(discardCard2.instanceId);
    expect(deckIds).toContain(payCard.instanceId);

    // The played Ancestral Knowledge card ends up in discard
    const discardIds = updatedPlayer.discard.map((c) => c.instanceId);
    expect(discardIds).toContain(akInstance.instanceId);

    // Original discard cards and payCard are now in deck
    expect(discardIds).not.toContain(discardCard1.instanceId);
    expect(discardIds).not.toContain(discardCard2.instanceId);
    expect(discardIds).not.toContain(payCard.instanceId);
  });

  it('prompts when discard pile has more cards than takeCount, shuffles chosen card, and leaves unselected cards in discard', () => {
    const state = createTestState();
    const player = state.players[0];
    player.currentForm = 'alter_ego';

    const akInstance = createCardInstance(ancestralKnowledgeCard);
    const payCard = createCardInstance(cardCatalog.getCard('01005')!);
    player.hand = [akInstance, payCard];

    const d1 = createCardInstance(cardCatalog.getCard('01006')!);
    const d2 = createCardInstance(cardCatalog.getCard('01007')!);
    const d3 = createCardInstance(cardCatalog.getCard('01008')!);
    const d4 = createCardInstance(cardCatalog.getCard('01046')!);
    const d5 = createCardInstance(cardCatalog.getCard('01047')!);
    player.discard = [d1, d2, d3, d4, d5];
    player.deck = [];

    const playResult = dispatchAction(state, {
      type: 'PLAY_CARD',
      playerId: 'p1',
      cardInstanceId: akInstance.instanceId,
      paymentCardInstanceIds: [payCard.instanceId],
    });

    expect(playResult.result.success).toBe(true);
    // Since there are 5 cards in discard (plus payCard discarded upon payment = 6), and takeCount is 3, prompt is enqueued
    expect(playResult.state.pendingDecisionPrompt).toBeDefined();
    const prompt = playResult.state.pendingDecisionPrompt!;
    expect(prompt.options.some((o) => o.id === d1.instanceId)).toBe(true);
    expect(prompt.options.some((o) => o.id === 'pass_search')).toBe(true);

    // Select d1
    const resolveResult = dispatchAction(playResult.state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: 'p1',
      selectedOptionId: d1.instanceId,
    });

    expect(resolveResult.result.success).toBe(true);
    const updatedPlayer = resolveResult.state.players[0];

    // d1 was shuffled into deck
    expect(updatedPlayer.deck.some((c) => c.instanceId === d1.instanceId)).toBe(true);

    // Unselected cards remain in discard
    const discardIds = updatedPlayer.discard.map((c) => c.instanceId);
    expect(discardIds).not.toContain(d1.instanceId);
    expect(discardIds).toContain(d2.instanceId);
    expect(discardIds).toContain(d3.instanceId);
    expect(discardIds).toContain(d4.instanceId);
    expect(discardIds).toContain(d5.instanceId);
  });

  it('cannot be played in Hero form (Alter-Ego Action timing restriction)', () => {
    const state = createTestState();
    const player = state.players[0];
    player.currentForm = 'hero';

    const akInstance = createCardInstance(ancestralKnowledgeCard);
    const payCard = createCardInstance(cardCatalog.getCard('01005')!);
    player.hand = [akInstance, payCard];

    const playResult = dispatchAction(state, {
      type: 'PLAY_CARD',
      playerId: 'p1',
      cardInstanceId: akInstance.instanceId,
      paymentCardInstanceIds: [payCard.instanceId],
    });

    expect(playResult.result.success).toBe(false);
  });

  it('allows passing the search prompt without shuffling cards into deck', () => {
    const state = createTestState();
    const player = state.players[0];
    player.currentForm = 'alter_ego';

    const akInstance = createCardInstance(ancestralKnowledgeCard);
    const payCard = createCardInstance(cardCatalog.getCard('01005')!);
    player.hand = [akInstance, payCard];

    const d1 = createCardInstance(cardCatalog.getCard('01006')!);
    const d2 = createCardInstance(cardCatalog.getCard('01007')!);
    const d3 = createCardInstance(cardCatalog.getCard('01008')!);
    const d4 = createCardInstance(cardCatalog.getCard('01046')!);
    player.discard = [d1, d2, d3, d4];
    player.deck = [];

    const playResult = dispatchAction(state, {
      type: 'PLAY_CARD',
      playerId: 'p1',
      cardInstanceId: akInstance.instanceId,
      paymentCardInstanceIds: [payCard.instanceId],
    });

    expect(playResult.state.pendingDecisionPrompt).toBeDefined();

    // Select pass_search
    const passResult = dispatchAction(playResult.state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: 'p1',
      selectedOptionId: 'pass_search',
    });

    expect(passResult.result.success).toBe(true);
    const updatedPlayer = passResult.state.players[0];

    // No cards moved to deck
    expect(updatedPlayer.deck.length).toBe(0);

    // Cards remain in discard
    const discardIds = updatedPlayer.discard.map((c) => c.instanceId);
    expect(discardIds).toContain(d1.instanceId);
    expect(discardIds).toContain(d2.instanceId);
    expect(discardIds).toContain(d3.instanceId);
    expect(discardIds).toContain(d4.instanceId);
  });
});
