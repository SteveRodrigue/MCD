import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { GameState, HeroCard, AlterEgoCard } from '@engine/models';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { dispatchAction } from '@engine/pipeline';
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
    expect(state.pendingDecisionPrompt).toBeDefined();
    expect(state.pendingDecisionPrompt!.title).toContain('Hydra Bomber');
    expect(state.pendingDecisionPrompt!.options.length).toBe(2);

    // Player resolves decision: chooses "take_damage"
    const res = dispatchAction(state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: 'p1',
      selectedOptionId: 'take_damage',
    });

    expect(res.result.success).toBe(true);
    expect(res.state.pendingDecisionPrompt).toBeUndefined();
    // Player takes 2 damage (10 - 2 = 8)
    expect(res.state.players[0].health).toBe(initialHp - 2);
  });

  it('01191 Exhaustion: PLAYER_CHOICE resolves "Exhaust Identity"', () => {
    const exhaustionCard = cardCatalog.getCard('01191')!;
    const exhaustionInstance = createCardInstance(exhaustionCard);

    const ability = exhaustionCard.enrichment!.abilities![0];
    state.players[0].exhausted = false;

    executeEffect(state, ability, {
      playerId: 'p1',
      sourceCardInstance: exhaustionInstance,
    });

    expect(state.pendingDecisionPrompt).toBeDefined();

    // Choose to exhaust identity
    const res = dispatchAction(state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: 'p1',
      selectedOptionId: 'exhaust_identity',
    });

    expect(res.result.success).toBe(true);
    expect(res.state.pendingDecisionPrompt).toBeUndefined();
    expect(res.state.players[0].exhausted).toBe(true);
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
    expect(playRes.state.pendingDecisionPrompt).toBeDefined();
    expect(playRes.state.pendingDecisionPrompt!.options.length).toBe(3);

    // Choose "draw_3_cards"
    const resolveRes = dispatchAction(playRes.state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: 'p1',
      selectedOptionId: 'draw_3_cards',
    });

    expect(resolveRes.result.success).toBe(true);
    expect(resolveRes.state.pendingDecisionPrompt).toBeUndefined();
    // Hand should now contain 3 newly drawn cards
    expect(resolveRes.state.players[0].hand.length).toBe(3);
    expect(resolveRes.state.players[0].deck.length).toBe(initialDeckSize - 3);
  });
});
