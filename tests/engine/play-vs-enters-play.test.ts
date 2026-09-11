/**
 * Contract tests for ADR-0048: CARD_PLAYED vs ENTERS_PLAY trigger semantics.
 *
 * Verifies RR v1.8 invariant:
 *   - CARD_PLAYED fires when a card is played from hand (cost paid).
 *   - ENTERS_PLAY fires when any permanent card enters an in-play zone.
 *   - Black Cat FORCED_RESPONSE @ CARD_PLAYED fires when played from hand.
 *   - Nick Fury FORCED_RESPONSE @ ENTERS_PLAY fires via PLAY_CARD.
 *   - Spider-Woman RESPONSE @ ENTERS_PLAY creates an optional prompt on play.
 *   - Attachment upgrades (Spider-Tracer, Inspired) still attach correctly
 *     after the timing: ACTION change (regression check).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CardCatalog } from '@data/importer/card-loader';
import {
  setupGame,
  resetInstanceCounter,
  dispatchAction,
  VillainCard,
  MainSchemeCard,
  createCardInstance,
} from '@engine/index';
import corePack from '../../data/upstream/pack/core.json';
import coreEncounterPack from '../../data/upstream/pack/core_encounter.json';

describe('ADR-0048: CARD_PLAYED vs ENTERS_PLAY trigger contract (RR v1.8 pp.11,21)', () => {
  const catalog = new CardCatalog([...corePack, ...coreEncounterPack]);
  let gameState: ReturnType<typeof setupGame>;

  beforeEach(() => {
    resetInstanceCounter();

    const identity = catalog.getHeroIdentity('spider_man')!;
    const signatureCards = catalog.getCardsBySet('spider_man').flatMap((c) => {
      if (c.type === 'hero' || c.type === 'alter_ego') return [];
      return Array(c.quantity).fill(c);
    });
    const justiceCards = catalog
      .getCardsByFaction('justice' as any)
      .flatMap((c) => Array(c.quantity).fill(c));
    const basicCards = catalog
      .getCardsByFaction('basic' as any)
      .flatMap((c) => Array(c.quantity).fill(c));
    const deck = [...signatureCards, ...justiceCards, ...basicCards].slice(0, 40);

    const rhinoCards = catalog.getCardsBySet('rhino').filter((c) => c.type !== 'villain');
    const standardCards = catalog.getCardsBySet('standard');
    const bombScareCards = catalog.getCardsBySet('bomb_scare');
    const encounterCards = [...rhinoCards, ...standardCards, ...bombScareCards].flatMap((c) =>
      Array(c.quantity).fill(c),
    );

    const villain = catalog.getCard('01094') as VillainCard;
    const mainScheme = catalog.getCard('01097b') as MainSchemeCard;

    gameState = setupGame({
      players: [
        {
          id: 'p1',
          name: 'Peter Parker',
          hero: identity.hero,
          alterEgo: identity.alterEgo,
          deckCards: deck,
        },
      ],
      villain,
      mainScheme,
      encounterCards,
      shuffleFn: (arr) => arr,
    });

    gameState.players[0].currentForm = 'hero';
    gameState.players[0].activeFormCard = gameState.players[0].hero;
  });

  function makePaymentCards(count: number) {
    return Array(count)
      .fill(null)
      .map(() => createCardInstance(catalog.getCard('01005')!));
  }

  it('A: Black Cat FORCED_RESPONSE @ CARD_PLAYED executes immediately when played from hand', () => {
    const blackCat = catalog.getCard('01002')!;
    const blackCatInst = createCardInstance(blackCat);
    const payment = makePaymentCards(4);
    const initialDeck = gameState.players[0].deck.length;

    gameState.players[0].hand = [blackCatInst, ...payment];

    const res = dispatchAction(gameState, {
      type: 'PLAY_CARD',
      playerId: 'p1',
      cardInstanceId: blackCatInst.instanceId,
      paymentCardInstanceIds: payment.map((c) => c.instanceId),
    });

    expect(res.result.success).toBe(true);
    // Black Cat's FORCED_RESPONSE discards top 2 cards from deck — deck must shrink
    expect(res.state.players[0].deck.length).toBeLessThanOrEqual(initialDeck - 2);
    // FORCED_RESPONSE executes automatically — no pending prompt after play
    expect(res.state.pendingDecisionPrompt).toBeUndefined();
  });

  it('E: Nick Fury FORCED_RESPONSE @ ENTERS_PLAY opens 3-choice prompt when played', () => {
    const nickFury = catalog.getCard('01084')!;
    const nickFuryInst = createCardInstance(nickFury);
    const payment = makePaymentCards(4);

    gameState.players[0].hand = [nickFuryInst, ...payment];

    const res = dispatchAction(gameState, {
      type: 'PLAY_CARD',
      playerId: 'p1',
      cardInstanceId: nickFuryInst.instanceId,
      paymentCardInstanceIds: payment.map((c) => c.instanceId),
    });

    expect(res.result.success).toBe(true);
    expect(res.state.pendingDecisionPrompt).toBeDefined();
    expect(res.state.pendingDecisionPrompt!.options.length).toBe(3);
    const optionIds = res.state.pendingDecisionPrompt!.options.map((o) => o.id);
    expect(optionIds).toContain('draw_3_cards');
    expect(optionIds).toContain('remove_2_threat');
    expect(optionIds).toContain('deal_4_damage');
  });

  it('F: Spider-Woman RESPONSE @ ENTERS_PLAY opens optional confuse prompt when played', () => {
    const spiderWoman = catalog.getCard('01011')!;
    const swInst = createCardInstance(spiderWoman);
    const payment = makePaymentCards(3);

    gameState.players[0].hand = [swInst, ...payment];

    const res = dispatchAction(gameState, {
      type: 'PLAY_CARD',
      playerId: 'p1',
      cardInstanceId: swInst.instanceId,
      paymentCardInstanceIds: payment.map((c) => c.instanceId),
    });

    expect(res.result.success).toBe(true);
    expect(res.state.pendingDecisionPrompt).toBeDefined();
    expect(res.state.pendingDecisionPrompt!.description).toBe(
      'ENTERS_PLAY -> ADD_STATUS (CONFUSED)',
    );
    expect(res.state.pendingDecisionPrompt!.isVoluntary).toBe(true);
  });

  it('H: Spider-Tracer attaches to a minion correctly after ACTION timing change (regression)', () => {
    const spiderTracer = catalog.getCard('01007')!;
    const tracerInst = createCardInstance(spiderTracer);
    const payment = makePaymentCards(1);

    const minionCard = catalog.getCard('01185')!;
    const minionInst = createCardInstance(minionCard);
    gameState.players[0].engagedMinions = [minionInst];
    gameState.players[0].hand = [tracerInst, ...payment];

    const res = dispatchAction(gameState, {
      type: 'PLAY_CARD',
      playerId: 'p1',
      cardInstanceId: tracerInst.instanceId,
      paymentCardInstanceIds: payment.map((c) => c.instanceId),
      targetInstanceId: minionInst.instanceId,
    });

    expect(res.result.success).toBe(true);
    const minion = res.state.players[0].engagedMinions.find(
      (m) => m.instanceId === minionInst.instanceId,
    );
    expect(minion?.attachments?.some((a) => a.instanceId === tracerInst.instanceId)).toBe(true);
  });

  it('I: Inspired attaches to an ally correctly after ACTION timing change (regression)', () => {
    const inspired = catalog.getCard('01074')!;
    const inspiredInst = createCardInstance(inspired);
    const payment = makePaymentCards(2);

    const spiderWoman = catalog.getCard('01011')!;
    const allyInst = createCardInstance(spiderWoman);
    gameState.players[0].allies = [allyInst];
    gameState.players[0].hand = [inspiredInst, ...payment];

    const res = dispatchAction(gameState, {
      type: 'PLAY_CARD',
      playerId: 'p1',
      cardInstanceId: inspiredInst.instanceId,
      paymentCardInstanceIds: payment.map((c) => c.instanceId),
      targetInstanceId: allyInst.instanceId,
    });

    expect(res.result.success).toBe(true);
    const ally = res.state.players[0].allies.find((a) => a.instanceId === allyInst.instanceId);
    expect(ally?.attachments?.some((a) => a.instanceId === inspiredInst.instanceId)).toBe(true);
  });

  it('G: Nick Fury FORCED_RESPONSE @ ENTERS_PLAY does NOT re-trigger when a second ally is played (#93)', () => {
    const nickFury = catalog.getCard('01084')!;
    const nickFuryInst = createCardInstance(nickFury);
    const payment1 = makePaymentCards(4);
    gameState.players[0].hand = [nickFuryInst, ...payment1];

    const res1 = dispatchAction(gameState, {
      type: 'PLAY_CARD',
      playerId: 'p1',
      cardInstanceId: nickFuryInst.instanceId,
      paymentCardInstanceIds: payment1.map((c) => c.instanceId),
    });

    expect(res1.result.success).toBe(true);
    expect(res1.state.players[0].allies.some((a) => a.instanceId === nickFuryInst.instanceId)).toBe(
      true,
    );
    expect(res1.state.pendingDecisionPrompt).toBeDefined();

    // Resolve Nick Fury's 3-choice prompt
    const res2 = dispatchAction(res1.state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: 'p1',
      selectedOptionId: 'draw_3_cards',
    });
    expect(res2.result.success).toBe(true);
    expect(res2.state.pendingDecisionPrompt).toBeUndefined();

    // Step 2: Play Mockingbird as a second ally
    const mockingbird = catalog.getCard('01083')!;
    const mockingbirdInst = createCardInstance(mockingbird);
    const payment2 = makePaymentCards(3);
    res2.state.players[0].hand = [mockingbirdInst, ...payment2];

    const res3 = dispatchAction(res2.state, {
      type: 'PLAY_CARD',
      playerId: 'p1',
      cardInstanceId: mockingbirdInst.instanceId,
      paymentCardInstanceIds: payment2.map((c) => c.instanceId),
      targetInstanceId: res2.state.villain.instanceId,
    });

    expect(res3.result.success).toBe(true);
    // Nick Fury must NOT have reopened his 3-choice prompt
    if (res3.state.pendingDecisionPrompt) {
      expect(res3.state.pendingDecisionPrompt.sourceCardName).not.toBe('Nick Fury');
    }
  });

  it('J: Black Cat FORCED_RESPONSE @ CARD_PLAYED does NOT re-trigger when a second card is played', () => {
    const blackCat = catalog.getCard('01002')!;
    const blackCatInst = createCardInstance(blackCat);
    const payment1 = makePaymentCards(4);

    gameState.players[0].hand = [blackCatInst, ...payment1];
    const initialDeck = gameState.players[0].deck.length;

    const res1 = dispatchAction(gameState, {
      type: 'PLAY_CARD',
      playerId: 'p1',
      cardInstanceId: blackCatInst.instanceId,
      paymentCardInstanceIds: payment1.map((c) => c.instanceId),
    });

    expect(res1.result.success).toBe(true);
    const deckAfterBlackCat = res1.state.players[0].deck.length;
    expect(deckAfterBlackCat).toBeLessThan(initialDeck);

    // Play Mockingbird as a second card
    const mockingbird = catalog.getCard('01083')!;
    const mockingbirdInst = createCardInstance(mockingbird);
    const payment2 = makePaymentCards(3);
    res1.state.players[0].hand = [mockingbirdInst, ...payment2];

    const res2 = dispatchAction(res1.state, {
      type: 'PLAY_CARD',
      playerId: 'p1',
      cardInstanceId: mockingbirdInst.instanceId,
      paymentCardInstanceIds: payment2.map((c) => c.instanceId),
      targetInstanceId: res1.state.villain.instanceId,
    });

    expect(res2.result.success).toBe(true);
    // Mockingbird does not discard cards from player deck.
    // If Black Cat incorrectly re-triggered, deck length would decrease by 2 again!
    expect(res2.state.players[0].deck.length).toBe(deckAfterBlackCat);
  });
});
