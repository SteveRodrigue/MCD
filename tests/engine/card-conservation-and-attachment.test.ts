import { describe, it, expect } from 'vitest';
import { setupGame, createCardInstance } from '../../src/engine/state/game-setup';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { dispatchAction } from '../../src/engine/pipeline/action-dispatcher';
import { assertCardConservation, attachCardToHost } from '../../src/engine/state/state-validator';
import { HeroCard, AlterEgoCard } from '../../src/engine/models';

describe('Universal Card Conservation & Attachment Deduplication (RR v1.8 p. 5, Issue #44, ADR-0040)', () => {
  const smHero = cardCatalog.getCard('01001a') as HeroCard;
  const peterParkerAlterEgo = cardCatalog.getCard('01001b') as AlterEgoCard;

  it('1. Passes assertCardConservation on initial game setup and fails on duplicate injection', () => {
    const state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: smHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      skipMulligan: true,
    });

    // Invariant check on clean game state: must succeed
    expect(() => assertCardConservation(state)).not.toThrow();

    // Intentionally create duplicate card instance
    const card = state.players[0].hand[0];
    state.players[0].tableau.push(card); // Same instanceId in hand and tableau!

    // Must throw a critical invariant violation error
    expect(() => assertCardConservation(state)).toThrowError(/CRITICAL INVARIANT VIOLATION/);
  });

  it('2. Attaches encounter cards to Villain with zero duplicates (Issue #44)', () => {
    const state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: smHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      skipMulligan: true,
    });

    // Create 2 encounter attachments: Armored Rhino Suit (01103) & Charge (01102)
    const armor = createCardInstance(cardCatalog.getCard('01103')!);
    const charge = createCardInstance(cardCatalog.getCard('01102')!);

    // Attach both to Rhino using atomic transfer / ATTACH_TO_HOST
    attachCardToHost(state, armor, 'VILLAIN');
    attachCardToHost(state, charge, 'VILLAIN');

    // Villain must have exactly 2 attachments (zero duplication!)
    expect(state.villain.attachments).toHaveLength(2);
    expect(state.villain.attachments.map((a) => a.card.code)).toEqual(['01103', '01102']);

    // Attempting to attach the same armor instance again must not duplicate
    attachCardToHost(state, armor, 'VILLAIN');
    expect(state.villain.attachments).toHaveLength(2);

    // Global card conservation invariant must pass
    expect(() => assertCardConservation(state)).not.toThrow();
  });

  it('3. Plays Webbed Up (01009) onto minion with exact 1 attachment and zero duplicates', () => {
    const state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: smHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      skipMulligan: true,
    });

    const heroState = dispatchAction(state, { type: 'CHANGE_FORM', playerId: 'p1' }).state;
    const player = heroState.players[0];

    // Spawn an engaged minion (Hydra Mercenary 01110)
    const minion = createCardInstance(cardCatalog.getCard('01110')!);
    player.engagedMinions.push(minion);

    // Give player Webbed Up (01009) and payment
    const webbedUp = createCardInstance(cardCatalog.getCard('01009')!);
    const payment = createCardInstance(cardCatalog.getCard('01005')!);
    const payment2 = createCardInstance(cardCatalog.getCard('01005')!);
    const payment3 = createCardInstance(cardCatalog.getCard('01005')!);
    const payment4 = createCardInstance(cardCatalog.getCard('01005')!);
    player.hand = [webbedUp, payment, payment2, payment3, payment4];

    // Play Webbed Up targeting minion
    const res = dispatchAction(heroState, {
      type: 'PLAY_CARD',
      playerId: 'p1',
      cardInstanceId: webbedUp.instanceId,
      targetInstanceId: minion.instanceId,
      paymentCardInstanceIds: [
        payment.instanceId,
        payment2.instanceId,
        payment3.instanceId,
        payment4.instanceId,
      ],
    });

    expect(res.result.success).toBe(true);

    // Verify minion has exactly 1 attached card
    const targetMinion = res.state.players[0].engagedMinions.find(
      (m) => m.instanceId === minion.instanceId,
    )!;
    expect(targetMinion.attachments).toHaveLength(1);
    expect(targetMinion.attachments?.[0]?.card.code).toBe('01009');

    // Invariant check must pass
    expect(() => assertCardConservation(res.state)).not.toThrow();
  });

  it('4. Automatically removes card from previous host when re-attaching', () => {
    const state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: smHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      skipMulligan: true,
    });

    const upgrade = createCardInstance(cardCatalog.getCard('01008')!);

    // Attach to player first
    attachCardToHost(state, upgrade, 'HERO', 'p1');
    expect(state.players[0].attachments).toHaveLength(1);
    expect(state.villain.attachments).toHaveLength(0);

    // Re-attach to villain
    attachCardToHost(state, upgrade, 'VILLAIN');
    expect(state.players[0].attachments).toHaveLength(0); // Cleanly removed from player
    expect(state.villain.attachments).toHaveLength(1); // Attached to villain
    expect(state.villain.attachments[0].instanceId).toBe(upgrade.instanceId);

    // Invariant check passes
    expect(() => assertCardConservation(state)).not.toThrow();
  });
});
