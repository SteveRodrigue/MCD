import { describe, it, expect, beforeEach } from 'vitest';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { dispatchAction } from '@engine/pipeline/action-dispatcher';
import { executeEffect } from '@engine/effects';
import { peekDecisionPrompt } from '@engine/pipeline/prompt-queue';

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

  function play(discardCodes: string[]) {
    const state = createTestState();
    const player = state.players[0];
    player.currentForm = 'alter_ego';
    const ak = createCardInstance(ancestralKnowledgeCard);
    const payCard = createCardInstance(cardCatalog.getCard('01005')!);
    player.hand = [ak, payCard];
    const discard = discardCodes.map((c) => createCardInstance(cardCatalog.getCard(c)!));
    player.discard = [...discard];
    player.deck = [];
    const res = dispatchAction(state, {
      type: 'PLAY_CARD',
      playerId: 'p1',
      cardInstanceId: ak.instanceId,
      paymentCardInstanceIds: [payCard.instanceId],
    });
    expect(res.result.success).toBe(true);
    return { state: res.state, discard, ak, payCard };
  }

  const confirm = (state: any, ids: string[]) =>
    dispatchAction(state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: 'p1',
      selectedOptionId: 'confirm_selection',
      selectedOptionIds: ids,
    });

  it('opens a "up to 3" prompt even with 2 cards to choose from (no auto-take)', () => {
    const { state, discard } = play(['01006', '01007']);
    // the payment card 01005 is in the discard pile too: 3 candidates, 0 to 3 may be chosen
    const prompt = peekDecisionPrompt(state)!;
    expect(prompt).toBeDefined();
    expect(prompt.selection).toMatchObject({ min: 0, max: 3, distinctBy: 'NAME' });
    expect(prompt.options.some((o) => o.id === discard[0].instanceId)).toBe(true);
    expect(state.players[0].deck).toHaveLength(0);
  });

  it('shuffles only the chosen cards into the deck and leaves the others in the discard pile', () => {
    const { state, discard, ak } = play(['01006', '01007', '01008', '01046', '01047']);
    const res = confirm(state, [discard[0].instanceId, discard[2].instanceId]);
    expect(res.result.success).toBe(true);
    const p = res.state.players[0];
    expect(p.deck.map((c) => c.instanceId).sort()).toEqual(
      [discard[0].instanceId, discard[2].instanceId].sort(),
    );
    const discardIds = p.discard.map((c) => c.instanceId);
    expect(discardIds).toContain(ak.instanceId);
    expect(discardIds).toContain(discard[1].instanceId);
    expect(discardIds).not.toContain(discard[0].instanceId);
    expect(peekDecisionPrompt(res.state)).toBeUndefined();
  });

  it('moves exactly the 3 chosen cards when more than 3 are available', () => {
    const { state, discard } = play(['01006', '01007', '01008', '01046', '01047']);
    const ids = discard.slice(0, 3).map((c) => c.instanceId);
    const res = confirm(state, ids);
    expect(res.result.success).toBe(true);
    expect(res.state.players[0].deck.map((c) => c.instanceId).sort()).toEqual([...ids].sort());
  });

  it('allows choosing no card at all', () => {
    const { state, discard } = play(['01006', '01007']);
    const res = confirm(state, []);
    expect(res.result.success).toBe(true);
    expect(res.state.players[0].deck).toHaveLength(0);
    expect(res.state.players[0].discard.map((c) => c.instanceId)).toContain(discard[0].instanceId);
  });

  it('rejects more than 3 cards, unknown ids and duplicates of one id', () => {
    const { state, discard } = play(['01006', '01007', '01008', '01046', '01047']);
    const four = discard.slice(0, 4).map((c) => c.instanceId);
    expect(confirm(state, four).result.success).toBe(false);
    expect(confirm(state, ['nope']).result.success).toBe(false);
    expect(confirm(state, [discard[0].instanceId, discard[0].instanceId]).result.success).toBe(
      false,
    );
    expect(peekDecisionPrompt(state)).toBeDefined();
  });

  it('cannot choose two cards with the same name', () => {
    const { state, discard } = play(['01006', '01006', '01007']);
    expect(discard[0].card.name).toBe(discard[1].card.name);
    const bad = confirm(state, [discard[0].instanceId, discard[1].instanceId]);
    expect(bad.result.success).toBe(false);
    const ok = confirm(state, [discard[0].instanceId, discard[2].instanceId]);
    expect(ok.result.success).toBe(true);
    expect(ok.state.players[0].deck).toHaveLength(2);
  });

  it('logs a search that finds nothing, opens no prompt and changes no zone', () => {
    const state = createTestState();
    const player = state.players[0];
    player.currentForm = 'alter_ego';
    player.discard = [];
    player.deck = [];
    const ak = createCardInstance(ancestralKnowledgeCard);
    const ability = ancestralKnowledgeCard.enrichment!.abilities![0];
    const res = executeEffect(state, ability, { playerId: 'p1', sourceCardInstance: ak });
    expect(res.success).toBe(true);
    expect(peekDecisionPrompt(res.state)).toBeUndefined();
    expect(res.state.log.some((l) => l.key === 'card.search.nothingFound')).toBe(true);
    expect(res.state.players[0].deck).toHaveLength(0);
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
});
