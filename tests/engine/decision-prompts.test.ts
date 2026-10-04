import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { GameState, HeroCard, AlterEgoCard } from '@engine/models';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { dispatchAction, peekDecisionPrompt } from '@engine/pipeline';
import { executeEffect } from '@engine/effects';

describe('Interactive Decision Prompt Modal State Machine (ADR-0020)', () => {
  let state: GameState;
  let spiderManHero: HeroCard;
  let peterParkerAlterEgo: AlterEgoCard;

  beforeEach(() => {
    spiderManHero = cardCatalog.getCard('01001a') as HeroCard;
    peterParkerAlterEgo = cardCatalog.getCard('01001b') as AlterEgoCard;

    state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Player 1',
          hero: spiderManHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });

    state.players[0].currentForm = 'hero';
    state.players[0].activeFormCard = spiderManHero;
  });

  it('01110 Hydra Bomber: PLAYER_CHOICE modal opens and resolves "Take 2 Damage"', () => {
    const bomberCard = cardCatalog.getCard('01110')!;
    const bomberInstance = createCardInstance(bomberCard);

    // Execute When Revealed ability on Hydra Bomber
    const ability = bomberCard.enrichment!.abilities![0];
    const initialHp = state.players[0].health;

    executeEffect(state, ability, {
      playerId: 'p1',
      sourceCardInstance: bomberInstance,
    });

    // Verify Decision Prompt is opened
    expect(peekDecisionPrompt(state)).toBeDefined();
    expect(peekDecisionPrompt(state)!.title).toContain('Hydra Bomber');
    expect(peekDecisionPrompt(state)!.options.length).toBe(2);

    // Player resolves decision: chooses "take_damage"
    const res = dispatchAction(state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: 'p1',
      selectedOptionId: 'take_damage',
    });

    expect(res.result.success).toBe(true);
    expect(peekDecisionPrompt(res.state)).toBeUndefined();
    // Player takes 2 damage (10 - 2 = 8)
    expect(res.state.players[0].health).toBe(initialHp - 2);
  });

  it('01110 Hydra Bomber: PLAYER_CHOICE modal resolves "Place 1 Threat on Main Scheme"', () => {
    state.mainScheme.threat = 2;

    const bomberCard = cardCatalog.getCard('01110')!;
    const bomberInstance = createCardInstance(bomberCard);

    // Execute When Revealed ability on Hydra Bomber
    const ability = bomberCard.enrichment!.abilities![0];

    executeEffect(state, ability, {
      playerId: 'p1',
      sourceCardInstance: bomberInstance,
    });

    // Verify Decision Prompt is opened
    expect(peekDecisionPrompt(state)).toBeDefined();

    // Player resolves decision: chooses "place_threat"
    const res = dispatchAction(state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: 'p1',
      selectedOptionId: 'place_threat',
    });

    expect(res.result.success).toBe(true);
    expect(peekDecisionPrompt(res.state)).toBeUndefined();
    expect(res.state.mainScheme.threat).toBe(3);
  });

  it('01191 Exhaustion: exhausts the revealing identity with no choice and no damage', () => {
    const exhaustionCard = cardCatalog.getCard('01191')!;
    const exhaustionInstance = createCardInstance(exhaustionCard);

    const abilities = exhaustionCard.enrichment!.abilities!;
    expect(abilities).toHaveLength(1);
    expect(abilities[0].trigger).toBe('WHEN_REVEALED');

    state.players[0].exhausted = false;
    const healthBefore = state.players[0].health;

    executeEffect(state, abilities[0], {
      playerId: 'p1',
      sourceCardInstance: exhaustionInstance,
    });

    expect(peekDecisionPrompt(state)).toBeUndefined();
    expect(state.players[0].exhausted).toBe(true);
    expect(state.players[0].health).toBe(healthBefore);
  });

  it('01084 Nick Fury: CARD_PLAYED opens tactical choice and resolves "Draw 3 Cards"', () => {
    const nickFuryCard = cardCatalog.getCard('01084')!;
    const nickFuryInstance = createCardInstance(nickFuryCard);
    const payCards = Array(4)
      .fill(null)
      .map(() => createCardInstance(cardCatalog.getCard('01005')!));

    state.players[0].hand = [nickFuryInstance, ...payCards];
    const initialDeckSize = state.players[0].deck.length;

    // Play Nick Fury
    const playRes = dispatchAction(state, {
      type: 'PLAY_CARD',
      playerId: 'p1',
      cardInstanceId: nickFuryInstance.instanceId,
      paymentCardInstanceIds: payCards.map((c) => c.instanceId),
    });

    expect(playRes.result.success).toBe(true);
    expect(peekDecisionPrompt(playRes.state)).toBeDefined();
    expect(peekDecisionPrompt(playRes.state)!.options.length).toBe(3);

    // Choose "draw_3_cards"
    const resolveRes = dispatchAction(playRes.state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: 'p1',
      selectedOptionId: 'draw_3_cards',
    });

    expect(resolveRes.result.success).toBe(true);
    expect(peekDecisionPrompt(resolveRes.state)).toBeUndefined();
    expect(resolveRes.state.players[0].hand.length).toBe(3);
    expect(resolveRes.state.players[0].deck.length).toBe(initialDeckSize - 3);
  });

  it('01010b Carol Danvers Commander: in 1-player mode draws 1 card directly without prompt', () => {
    const carolAlterEgo = cardCatalog.getCard('01010b') as AlterEgoCard;
    const carolHero = cardCatalog.getCard('01010a') as HeroCard;
    state.players[0].hero = carolHero;
    state.players[0].alterEgo = carolAlterEgo;
    state.players[0].currentForm = 'alter_ego';
    state.players[0].activeFormCard = carolAlterEgo;

    const initialHand = state.players[0].hand.length;
    const initialDeck = state.players[0].deck.length;

    const res = dispatchAction(state, {
      type: 'USE_CARD_ABILITY',
      playerId: 'p1',
      cardInstanceId: '01010b',
      abilityId: 'commander',
    });

    expect(res.result.success).toBe(true);
    // 1-player mode should not open prompt
    expect(peekDecisionPrompt(res.state)).toBeUndefined();
    expect(res.state.players[0].hand.length).toBe(initialHand + 1);
    expect(res.state.players[0].deck.length).toBe(initialDeck - 1);
  });

  it('01010b Carol Danvers Commander: in 2+ player mode enqueues CHOSEN_PLAYER prompt and resolves for target player', () => {
    const carolAlterEgo = cardCatalog.getCard('01010b') as AlterEgoCard;
    const carolHero = cardCatalog.getCard('01010a') as HeroCard;
    state.players[0].hero = carolHero;
    state.players[0].alterEgo = carolAlterEgo;
    state.players[0].currentForm = 'alter_ego';
    state.players[0].activeFormCard = carolAlterEgo;

    // Add Player 2
    state.players.push({
      ...state.players[0],
      id: 'p2',
      name: 'Player 2',
      hero: spiderManHero,
      alterEgo: peterParkerAlterEgo,
      activeFormCard: spiderManHero,
      hand: [],
      deck: Array(10).fill(cardCatalog.getCard('01005')!),
    });

    const res = dispatchAction(state, {
      type: 'USE_CARD_ABILITY',
      playerId: 'p1',
      cardInstanceId: '01010b',
      abilityId: 'commander',
    });

    expect(res.result.success).toBe(true);
    // In 2-player mode, prompt MUST be opened to choose player
    expect(peekDecisionPrompt(res.state)).toBeDefined();
    expect(peekDecisionPrompt(res.state)!.title).toContain('Choose a Player');
    expect(peekDecisionPrompt(res.state)!.options.length).toBe(2);

    // Resolve decision for Player 2
    const resolveRes = dispatchAction(res.state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: 'p1',
      selectedOptionId: 'draw_p2',
    });

    expect(resolveRes.result.success).toBe(true);
    expect(peekDecisionPrompt(resolveRes.state)).toBeUndefined();
    // Player 2 drew 1 card
    expect(resolveRes.state.players[1].hand.length).toBe(1);
    expect(resolveRes.state.players[1].deck.length).toBe(9);
  });

  it('01091 Avengers Mansion: in 2+ player mode enqueues CHOSEN_PLAYER prompt and resolves for chosen player', () => {
    // Add Player 2
    state.players.push({
      ...state.players[0],
      id: 'p2',
      name: 'Player 2',
      hero: spiderManHero,
      alterEgo: peterParkerAlterEgo,
      activeFormCard: spiderManHero,
      hand: [],
      deck: Array(10).fill(cardCatalog.getCard('01005')!),
    });

    const mansionCard = cardCatalog.getCard('01091')!;
    const mansionInstance = createCardInstance(mansionCard);
    state.players[0].tableau.push(mansionInstance);

    const res = dispatchAction(state, {
      type: 'USE_CARD_ABILITY',
      playerId: 'p1',
      cardInstanceId: mansionInstance.instanceId,
      abilityId: 'avengers_mansion',
    });

    expect(res.result.success).toBe(true);
    expect(peekDecisionPrompt(res.state)).toBeDefined();
    expect(peekDecisionPrompt(res.state)!.title).toContain('Choose a Player');

    // Resolve for Player 2
    const resolveRes = dispatchAction(res.state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: 'p1',
      selectedOptionId: 'draw_p2',
    });

    expect(resolveRes.result.success).toBe(true);
    expect(peekDecisionPrompt(resolveRes.state)).toBeUndefined();
    expect(resolveRes.state.players[1].hand.length).toBe(1);
    expect(resolveRes.state.players[0].tableau[0].exhausted).toBe(true);
  });

  it('DISTRIBUTE_POINTS prompt resolves damage assignments across multiple targets (ADR-0064)', () => {
    // Add ally to player 1
    const catCard = cardCatalog.getCard('01002') || cardCatalog.getCard('01005')!;
    const allyInst = createCardInstance(catCard);
    (allyInst.card as any).health = 3;
    state.players[0].allies.push(allyInst);

    const initialHeroHp = state.players[0].health;

    // Enqueue distribution prompt
    const enqueuedState = dispatchAction(state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: 'p1',
      selectedOptionId: 'pass',
    }).state;

    // Direct effect test with DISTRIBUTE_AMOUNT and interactive prompt
    const ability = {
      id: 'test_explosion',
      timing: 'WHEN_REVEALED' as const,
      steps: [
        {
          effect: 'DISTRIBUTE_AMOUNT' as const,
          effectParams: {
            budget: 3,
            allocationDomain: 'DAMAGE' as const,
            targetScope: 'ALL_HEROES_AND_ALLIES',
            capRule: 'REMAINING_HP',
          },
        },
      ],
    };

    // Interactive prompt execution
    const promptRes = executeEffect(enqueuedState, ability, {
      playerId: 'p1',
      interactivePrompt: true,
    });

    expect(peekDecisionPrompt(promptRes.state)).toBeDefined();
    expect(peekDecisionPrompt(promptRes.state)?.kind).toBe('DISTRIBUTE_POINTS');
    expect(peekDecisionPrompt(promptRes.state)?.distributionConfig?.effectiveBudget).toBe(3);

    // Resolve with assignments: 2 damage to Hero, 1 damage to Ally
    const resolveAction = dispatchAction(promptRes.state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: 'p1',
      selectedOptionId: 'confirm_distribution',
      assignments: {
        p1: 2,
        [allyInst.instanceId]: 1,
      },
    });

    expect(resolveAction.result.success).toBe(true);
    expect(peekDecisionPrompt(resolveAction.state)).toBeUndefined();
    expect(resolveAction.state.players[0].health).toBe(initialHeroHp - 2);
    expect(resolveAction.state.players[0].allies[0].tokens?.damage).toBe(1);
  });

  it('DISTRIBUTE_POINTS auto-bypasses prompt when effectiveBudget is 0 (ADR-0064)', () => {
    // Threat removal when main scheme has 0 threat and no side schemes
    state.mainScheme.threat = 0;
    state.sideSchemes = [];

    const ability = {
      id: 'test_threat_dist',
      timing: 'ACTION' as const,
      steps: [
        {
          effect: 'DISTRIBUTE_AMOUNT' as const,
          effectParams: {
            budget: 4,
            allocationDomain: 'THREAT_REMOVAL' as const,
            targetScope: 'ALL_SCHEMES',
          },
        },
      ],
    };

    const res = executeEffect(state, ability, {
      playerId: 'p1',
      interactivePrompt: true,
    });

    // Auto-bypasses prompt because total capacity is 0
    expect(peekDecisionPrompt(res.state)).toBeUndefined();
  });
});
