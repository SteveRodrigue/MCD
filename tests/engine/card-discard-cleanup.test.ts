import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import {
  GamePhase,
  GameState,
  HeroCard,
  AlterEgoCard,
  CardType,
  FactionCode,
  StatusCard,
} from '../../src/engine/models';
import { setupGame } from '../../src/engine/state/game-setup';
import { createCardInstance } from '../../src/engine/state/card-instance';
import { dispatchAction } from '../../src/engine/pipeline';
import { drawPlayerCard, exhaustPlayerDeck } from '../../src/engine/pipeline/deck-exhaustion';
import { executeEffect, discardCardInstance } from '../../src/engine/effects';
import { thaw } from '../support/thaw-state';

describe('Universal Discard and Leaves-Play Cleanup Invariants (Issue #388, RR v1.8 p. 15)', () => {
  let state: GameState;
  let spiderManHero: HeroCard;
  let peterParkerAlterEgo: AlterEgoCard;

  beforeEach(() => {
    spiderManHero = cardCatalog.getCard('01001a') as HeroCard;
    peterParkerAlterEgo = cardCatalog.getCard('01001b') as AlterEgoCard;

    state = setupGame({
      catalog: cardCatalog,
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Peter Parker',
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

    state.phase = GamePhase.PLAYER_PHASE;
    state.players[0].currentForm = 'hero';
    state.players[0].activeFormCard = spiderManHero;
    state.players[0].exhausted = false;
  });

  it('depletes Web-Shooter (01008) to 0 counters and discards with exhausted: false', () => {
    const p1 = state.players[0];
    const webShooter = createCardInstance(cardCatalog.getCard('01008')!);
    webShooter.tokens = { ...webShooter.tokens, counters: 1 };
    webShooter.counters = { web: 1 };
    p1.tableau.push(webShooter);

    const playableCard = createCardInstance({
      code: 'test_1cost_upgrade',
      name: 'Test 1-Cost Upgrade',
      type: CardType.UPGRADE,
      faction: FactionCode.BASIC,
      cost: 1,
      text: 'A test upgrade.',
      enrichment: { abilities: [] },
    } as any);
    p1.hand = [playableCard];

    const res = dispatchAction(state, {
      type: 'PLAY_CARD',
      playerId: p1.id,
      cardInstanceId: playableCard.instanceId,
      paymentCardInstanceIds: [],
      generatorInstanceIds: [webShooter.instanceId],
    });

    expect(res.result.success).toBe(true);

    // Web-Shooter removed from tableau
    expect(res.state.players[0].tableau.some((c) => c.instanceId === webShooter.instanceId)).toBe(
      false,
    );

    // Web-Shooter in discard pile must NOT be exhausted and must have tokens/counters cleared
    const discardedShooter = res.state.players[0].discard.find(
      (c) => c.instanceId === webShooter.instanceId,
    );
    expect(discardedShooter).toBeDefined();
    expect(discardedShooter?.exhausted).toBe(false);
    expect(discardedShooter?.tokens?.counters ?? 0).toBe(0);
    expect(discardedShooter?.counters?.web).toBeUndefined();
  });

  it('draws depleted Web-Shooter into hand in ready state (exhausted: false) after deck reshuffle', () => {
    const p1 = state.players[0];
    const webShooter = createCardInstance(cardCatalog.getCard('01008')!);
    webShooter.tokens = { ...webShooter.tokens, counters: 1 };
    webShooter.counters = { web: 1 };
    p1.tableau.push(webShooter);

    const playableCard = createCardInstance({
      code: 'test_1cost_upgrade',
      name: 'Test 1-Cost Upgrade',
      type: CardType.UPGRADE,
      faction: FactionCode.BASIC,
      cost: 1,
      text: 'A test upgrade.',
      enrichment: { abilities: [] },
    } as any);
    p1.hand = [playableCard];

    const res = dispatchAction(state, {
      type: 'PLAY_CARD',
      playerId: p1.id,
      cardInstanceId: playableCard.instanceId,
      paymentCardInstanceIds: [],
      generatorInstanceIds: [webShooter.instanceId],
    });

    expect(res.result.success).toBe(true);
    const mutableState = thaw(res.state);
    const pState = mutableState.players[0];

    // Empty the deck and reshuffle discard
    pState.deck = [];
    exhaustPlayerDeck(mutableState, pState.id);

    // Find Web-Shooter in deck
    const wsInDeck = pState.deck.find((c) => c.card.code === '01008');
    expect(wsInDeck).toBeDefined();
    expect(wsInDeck?.exhausted).toBe(false);

    // Place Web-Shooter on top of deck and draw it
    pState.deck = [wsInDeck!, ...pState.deck.filter((c) => c.instanceId !== wsInDeck!.instanceId)];
    const drawn = drawPlayerCard(mutableState, pState.id);
    expect(drawn?.card.code).toBe('01008');
    expect(drawn?.exhausted).toBe(false);
  });

  it('cleans up all transient state when an exhausted card with tokens and attachments is discarded', () => {
    const p1 = state.players[0];
    const ally = createCardInstance(cardCatalog.getCard('01011')!); // Black Cat
    ally.exhausted = true;
    ally.tokens = { damage: 1, threat: 0, counters: 2 };
    ally.counters = { test_counter: 2 };
    ally.statusCards = [StatusCard.TOUGH];
    ally.activeStatModifiers = [{ stat: 'ATTACK', amount: 1, duration: 'ROUND' }];

    const attachment = createCardInstance(cardCatalog.getCard('01008')!);
    attachment.exhausted = true;
    ally.attachments = [attachment];

    p1.allies.push(ally);

    discardCardInstance(state, ally, p1.id);

    const discardedAlly = p1.discard.find((c) => c.instanceId === ally.instanceId);
    expect(discardedAlly).toBeDefined();
    expect(discardedAlly?.exhausted).toBe(false);
    expect(discardedAlly?.tokens?.damage ?? 0).toBe(0);
    expect(discardedAlly?.tokens?.counters ?? 0).toBe(0);
    expect(discardedAlly?.statusCards).toEqual([]);
    expect(discardedAlly?.activeStatModifiers).toEqual([]);
    expect(discardedAlly?.attachments).toEqual([]);

    // Attachment must also be cleaned up in discard
    const discardedAtt = p1.discard.find((c) => c.instanceId === attachment.instanceId);
    expect(discardedAtt).toBeDefined();
    expect(discardedAtt?.exhausted).toBe(false);
  });

  it('cleans up card state when returned to hand via RETURN_TO_HAND', () => {
    const p1 = state.players[0];
    const ally = createCardInstance(cardCatalog.getCard('01011')!); // Black Cat
    ally.exhausted = true;
    ally.tokens = { damage: 1, counters: 2 };
    ally.statusCards = [StatusCard.TOUGH];
    p1.allies.push(ally);

    executeEffect(
      state,
      {
        id: 'test_return_to_hand',
        timing: 'HERO_ACTION',
        steps: [{ effect: 'RETURN_TO_HAND' }],
      },
      { playerId: p1.id, sourceCardInstance: ally },
    );

    expect(p1.allies.some((c) => c.instanceId === ally.instanceId)).toBe(false);
    const inHand = p1.hand.find((c) => c.instanceId === ally.instanceId);
    expect(inHand).toBeDefined();
    expect(inHand?.exhausted).toBe(false);
    expect(inHand?.statusCards).toEqual([]);
    expect(inHand?.tokens?.damage ?? 0).toBe(0);
  });
});
