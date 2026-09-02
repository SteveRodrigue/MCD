import { describe, it, expect } from 'vitest';
import { setupGame, createCardInstance } from '../../src/engine/state/game-setup';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { dispatchAction } from '../../src/engine/pipeline/action-dispatcher';
import { HeroCard, AlterEgoCard } from '../../src/engine/models';

describe('Resource Payment Generator Validation (RR v1.8 p. 25, Issue #43)', () => {
  const smHero = cardCatalog.getCard('01001a') as HeroCard;
  const peterParkerAlterEgo = cardCatalog.getCard('01001b') as AlterEgoCard;

  it('1. Rejects Tac Team (01056) as a payment generator during PLAY_CARD', () => {
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

    // Flip to Hero form
    const heroState = dispatchAction(state, { type: 'CHANGE_FORM', playerId: 'p1' }).state;
    const player = heroState.players[0];

    // Put Tac Team in play (Attack counters, Action: Deal 2 damage)
    const tacTeam = createCardInstance(cardCatalog.getCard('01056')!);
    tacTeam.tokens = { damage: 0, threat: 0, counters: 3 };
    player.tableau.push(tacTeam);

    // Hand has First Aid (Cost 1)
    const firstAid = createCardInstance(cardCatalog.getCard('01074')!);
    player.hand = [firstAid];

    // Attempt to pay for First Aid using Tac Team (which is NOT a resource generator)
    const res = dispatchAction(heroState, {
      type: 'PLAY_CARD',
      playerId: 'p1',
      cardInstanceId: firstAid.instanceId,
      paymentCardInstanceIds: [],
      generatorInstanceIds: [tacTeam.instanceId],
    });

    // Must be rejected as illegal payment
    expect(res.result.success).toBe(false);
    expect(res.result.error).toContain('not a resource generator');

    // Tac Team must remain unexhausted with 3 counters intact
    const inPlayTac = res.state.players[0].tableau.find(
      (c) => c.instanceId === tacTeam.instanceId,
    )!;
    expect(inPlayTac.exhausted).toBeFalsy();
    expect(inPlayTac.tokens?.counters).toBe(3);
  });

  it('2. Accepts Web-Shooter (01008) as a genuine payment generator during PLAY_CARD', () => {
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

    // Flip to Hero form
    const heroState = dispatchAction(state, { type: 'CHANGE_FORM', playerId: 'p1' }).state;
    const player = heroState.players[0];

    // Put Web-Shooter in play (Hero Resource: Exhaust & spend 1 counter -> generate 1 wild resource)
    const webShooter = createCardInstance(cardCatalog.getCard('01008')!);
    webShooter.tokens = { damage: 0, threat: 0, counters: 3 };
    player.tableau.push(webShooter);

    const firstAid = createCardInstance(cardCatalog.getCard('01074')!); // Cost 1
    player.hand = [firstAid];

    // Pay using Web-Shooter
    const res = dispatchAction(heroState, {
      type: 'PLAY_CARD',
      playerId: 'p1',
      cardInstanceId: firstAid.instanceId,
      paymentCardInstanceIds: [],
      generatorInstanceIds: [webShooter.instanceId],
    });

    expect(res.result.success).toBe(true);
    const inPlayShooter = res.state.players[0].tableau.find(
      (c) => c.instanceId === webShooter.instanceId,
    )!;
    expect(inPlayShooter.exhausted).toBe(true);
    expect(inPlayShooter.tokens?.counters).toBe(2);
  });
});
