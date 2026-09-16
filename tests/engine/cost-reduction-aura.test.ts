import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import {
  HeroCard,
  AlterEgoCard,
  VillainCard,
  MainSchemeCard,
  CardType,
  NormalizedCard,
  GamePhase,
} from '@engine/models';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { dispatchAction } from '@engine/pipeline/action-dispatcher';
import { canPlayCard, evaluateCardPlayability } from '@engine/pipeline/legality-checker';
import { getEffectiveCardCost } from '@engine/pipeline/cost-engine';
import { endPlayerPhase } from '@engine/pipeline/player-phase';

describe('Feature Delivery: Universal Cost Reduction Aura & Helicarrier (Issue #46 / RR v1.8)', () => {
  const spiderManHero = cardCatalog.getCard('01001a') as HeroCard;
  const peterParkerAlterEgo = cardCatalog.getCard('01001b') as AlterEgoCard;
  const captainMarvelHero = cardCatalog.getCard('01010a') as HeroCard;
  const carolDanversAlterEgo = cardCatalog.getCard('01010b') as AlterEgoCard;
  const rhinoVillain = cardCatalog.getCard('01094') as VillainCard;
  const mainScheme = cardCatalog.getCard('01097b') as MainSchemeCard;

  const sampleResourceCard: NormalizedCard = {
    ...cardCatalog.getCard('01005')!,
    code: 'res_sample_01',
    name: 'Energy Resource',
    type: CardType.RESOURCE,
    cost: 0,
    resources: { physical: 0, energy: 1, mental: 0, wild: 0, total: 1 },
  };

  const sampleCardCost2: NormalizedCard = {
    ...cardCatalog.getCard('01005')!,
    code: 'card_cost_2',
    name: 'Cost Two Upgrade',
    type: CardType.UPGRADE,
    cost: 2,
    resources: { physical: 1, energy: 0, mental: 0, wild: 0, total: 1 },
  };

  const sampleCardCost1: NormalizedCard = {
    ...cardCatalog.getCard('01005')!,
    code: 'card_cost_1',
    name: 'Cost One Upgrade',
    type: CardType.UPGRADE,
    cost: 1,
    resources: { physical: 0, energy: 0, mental: 1, wild: 0, total: 1 },
  };

  const sampleCardCost0: NormalizedCard = {
    ...cardCatalog.getCard('01005')!,
    code: 'card_cost_0',
    name: 'Free Upgrade',
    type: CardType.UPGRADE,
    cost: 0,
    resources: { physical: 0, energy: 0, mental: 0, wild: 1, total: 1 },
    enrichment: {
      abilities: [],
    },
  };

  let gameState = setupGame({
    players: [
      {
        id: 'p1',
        name: 'Spider-Man',
        hero: spiderManHero,
        alterEgo: peterParkerAlterEgo,
        deckCards: [],
      },
    ],
    villain: rhinoVillain,
    mainScheme: mainScheme,
    skipMulligan: true,
  });

  beforeEach(() => {
    gameState = setupGame({
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: spiderManHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: [],
        },
      ],
      villain: rhinoVillain,
      mainScheme: mainScheme,
      skipMulligan: true,
    });
    gameState.phase = GamePhase.PLAYER_PHASE;
    gameState.activePlayerIndex = 0;
  });

  it('1. Helicarrier exhausts and places ActiveCostReduction aura on player', () => {
    const p1 = gameState.players[0];
    const helicarrierCard = cardCatalog.getCard('01092')!;
    const helicarrierInst = createCardInstance(helicarrierCard);
    p1.tableau.push(helicarrierInst);

    expect(helicarrierInst.exhausted).toBe(false);
    expect(p1.activeCostReductions?.length || 0).toBe(0);

    const res = dispatchAction(gameState, {
      type: 'USE_CARD_ABILITY',
      playerId: p1.id,
      cardInstanceId: helicarrierInst.instanceId,
      abilityId: 'helicarrier_action',
    });

    expect(res.result.success).toBe(true);
    expect(res.state.players[0].tableau[0].exhausted).toBe(true);

    const updatedP1 = res.state.players[0];
    expect(updatedP1.activeCostReductions?.length).toBe(1);
    const reduction = updatedP1.activeCostReductions![0];
    expect(reduction.amount).toBe(1);
    expect(reduction.sourceCardName).toBe('Helicarrier');
    expect(reduction.duration).toBe('PHASE');
    expect(reduction.appliesTo).toBe('NEXT_CARD');
    expect(updatedP1.costReductions).toBe(1);
  });

  it('2. Playing a card with cost > 1 applies reduction and requires fewer resources', () => {
    const p1 = gameState.players[0];
    const cardToPlay = createCardInstance(sampleCardCost2);
    const paymentCard = createCardInstance(sampleResourceCard);
    p1.hand = [cardToPlay, paymentCard];

    // Initially costs 2 resources: 1 payment card is not enough
    const checkBefore = canPlayCard(gameState, p1.id, cardToPlay.instanceId, [
      paymentCard.instanceId,
    ]);
    expect(checkBefore.allowed).toBe(false);
    expect(checkBefore.reason).toContain('Need 2, but selected payment provides 1');

    // Add Helicarrier discount aura
    p1.activeCostReductions = [
      {
        id: 'red_test_1',
        sourceCardName: 'Helicarrier',
        sourceCardCode: '01092',
        amount: 1,
        duration: 'PHASE',
        appliesTo: 'NEXT_CARD',
      },
    ];
    p1.costReductions = 1;

    // With 1 discount, effective cost is 1: 1 payment card is now enough!
    const effective = getEffectiveCardCost(gameState, p1, cardToPlay);
    expect(effective.effectiveCost).toBe(1);
    expect(effective.baseCost).toBe(2);
    expect(effective.totalReduction).toBe(1);

    const checkAfter = canPlayCard(gameState, p1.id, cardToPlay.instanceId, [
      paymentCard.instanceId,
    ]);
    expect(checkAfter.allowed).toBe(true);

    // Play card
    const playRes = dispatchAction(gameState, {
      type: 'PLAY_CARD',
      playerId: p1.id,
      cardInstanceId: cardToPlay.instanceId,
      paymentCardInstanceIds: [paymentCard.instanceId],
    });

    expect(playRes.result.success).toBe(true);
    const postP1 = playRes.state.players[0];
    // Card is in tableau
    expect(postP1.tableau.some((c) => c.instanceId === cardToPlay.instanceId)).toBe(true);
    // Payment card is in discard
    expect(postP1.discard.some((c) => c.instanceId === paymentCard.instanceId)).toBe(true);
    // Discount was consumed!
    expect(postP1.activeCostReductions?.length || 0).toBe(0);
    expect(postP1.costReductions).toBe(0);
  });

  it('3. Playing a 1-cost card with 1 reduction reduces cost to 0 (free play)', () => {
    const p1 = gameState.players[0];
    const cardToPlay = createCardInstance(sampleCardCost1);
    p1.hand = [cardToPlay]; // No payment cards in hand

    p1.activeCostReductions = [
      {
        id: 'red_test_free',
        sourceCardName: 'Helicarrier',
        sourceCardCode: '01092',
        amount: 1,
        duration: 'PHASE',
        appliesTo: 'NEXT_CARD',
      },
    ];
    p1.costReductions = 1;

    const effective = getEffectiveCardCost(gameState, p1, cardToPlay);
    expect(effective.effectiveCost).toBe(0);

    const playability = evaluateCardPlayability(gameState, p1.id, cardToPlay);
    expect(playability.isPlayable).toBe(true);

    const check = canPlayCard(gameState, p1.id, cardToPlay.instanceId, []);
    expect(check.allowed).toBe(true);

    const playRes = dispatchAction(gameState, {
      type: 'PLAY_CARD',
      playerId: p1.id,
      cardInstanceId: cardToPlay.instanceId,
      paymentCardInstanceIds: [],
    });

    expect(playRes.result.success).toBe(true);
    const postP1 = playRes.state.players[0];
    expect(postP1.tableau.some((c) => c.instanceId === cardToPlay.instanceId)).toBe(true);
    expect(postP1.activeCostReductions?.length || 0).toBe(0);
    expect(postP1.costReductions).toBe(0);
  });

  it('4. Playing a 0-cost card consumes the general next card reduction (RR v1.8)', () => {
    const p1 = gameState.players[0];
    const freeCard = createCardInstance(sampleCardCost0);
    p1.hand = [freeCard];

    p1.activeCostReductions = [
      {
        id: 'red_test_zero',
        sourceCardName: 'Helicarrier',
        sourceCardCode: '01092',
        amount: 1,
        duration: 'PHASE',
        appliesTo: 'NEXT_CARD',
      },
    ];
    p1.costReductions = 1;

    // Playing 0 cost card
    const playRes = dispatchAction(gameState, {
      type: 'PLAY_CARD',
      playerId: p1.id,
      cardInstanceId: freeCard.instanceId,
      paymentCardInstanceIds: [],
    });

    expect(playRes.result.success).toBe(true);
    const postP1 = playRes.state.players[0];
    // Reduction is consumed!
    expect(postP1.activeCostReductions?.length || 0).toBe(0);
    expect(postP1.costReductions).toBe(0);
  });

  it('5. Phase transition prunes unconsumed PHASE cost reductions', () => {
    const p1 = gameState.players[0];
    p1.activeCostReductions = [
      {
        id: 'red_test_phase',
        sourceCardName: 'Helicarrier',
        sourceCardCode: '01092',
        amount: 1,
        duration: 'PHASE',
        appliesTo: 'NEXT_CARD',
      },
    ];
    p1.costReductions = 1;

    // Transition to villain phase
    const villainState = endPlayerPhase(gameState);
    const postP1 = villainState.players[0];

    expect(postP1.activeCostReductions?.length || 0).toBe(0);
    expect(postP1.costReductions).toBe(0);
  });

  it('6. Multiple cost reductions stack additively', () => {
    const p1 = gameState.players[0];
    const cardCost3: NormalizedCard = {
      ...sampleCardCost2,
      code: 'card_cost_3',
      name: 'Expensive Card',
      cost: 3,
    };
    const cardInst = createCardInstance(cardCost3);

    p1.activeCostReductions = [
      {
        id: 'red_1',
        sourceCardName: 'Helicarrier 1',
        amount: 1,
        duration: 'PHASE',
        appliesTo: 'NEXT_CARD',
      },
      {
        id: 'red_2',
        sourceCardName: 'Helicarrier 2',
        amount: 1,
        duration: 'PHASE',
        appliesTo: 'NEXT_CARD',
      },
    ];
    p1.costReductions = 2;

    const effective = getEffectiveCardCost(gameState, p1, cardInst);
    expect(effective.baseCost).toBe(3);
    expect(effective.totalReduction).toBe(2);
    expect(effective.effectiveCost).toBe(1);
    expect(effective.reductions.length).toBe(2);
  });

  it('7. Multiplayer CHOSEN_PLAYER decision prompt routing', () => {
    const multiGameState = setupGame({
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: spiderManHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: [],
        },
        {
          id: 'p2',
          name: 'Captain Marvel',
          hero: captainMarvelHero,
          alterEgo: carolDanversAlterEgo,
          deckCards: [],
        },
      ],
      villain: rhinoVillain,
      mainScheme: mainScheme,
      skipMulligan: true,
    });
    multiGameState.phase = GamePhase.PLAYER_PHASE;
    multiGameState.activePlayerIndex = 0;

    const p1 = multiGameState.players[0];
    const helicarrierCard = cardCatalog.getCard('01092')!;
    const helicarrierInst = createCardInstance(helicarrierCard);
    p1.tableau.push(helicarrierInst);

    // In 2-player mode, Helicarrier action enqueues a decision prompt to choose player
    const res = dispatchAction(multiGameState, {
      type: 'USE_CARD_ABILITY',
      playerId: p1.id,
      cardInstanceId: helicarrierInst.instanceId,
      abilityId: 'helicarrier_action',
    });

    expect(res.result.success).toBe(true);
    expect(res.state.pendingDecisionQueue?.length || 0).toBeGreaterThanOrEqual(1);

    const prompt = res.state.pendingDecisionQueue![0];
    expect(prompt.title).toContain('Choose a Player');
    expect(prompt.options.length).toBe(2);

    // Resolve decision selecting Player 2
    const resolveRes = dispatchAction(res.state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: p1.id,
      selectedOptionId: prompt.options.find((o) => o.id.includes('p2'))!.id,
    });

    expect(resolveRes.result.success).toBe(true);
    const postP1 = resolveRes.state.players[0];
    const postP2 = resolveRes.state.players[1];

    // P1 did NOT receive the discount; P2 received the discount!
    expect(postP1.activeCostReductions?.length || 0).toBe(0);
    expect(postP2.activeCostReductions?.length).toBe(1);
    expect(postP2.activeCostReductions![0].sourceCardName).toBe('Helicarrier');
    expect(postP2.costReductions).toBe(1);
  });
});
