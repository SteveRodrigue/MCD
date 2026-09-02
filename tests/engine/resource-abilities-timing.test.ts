import { describe, it, expect } from 'vitest';
import { setupGame, createCardInstance } from '../../src/engine/state/game-setup';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { getLegalActionsForPlayer } from '../../src/engine/pipeline/legal-actions-generator';
import { dispatchAction } from '../../src/engine/pipeline/action-dispatcher';
import { HeroCard, AlterEgoCard } from '../../src/engine/models';

describe('Resource Abilities Timing, Stance Isolation & Form Gating (RR v1.8 p. 25, Issue #42, ADR-0039)', () => {
  const smHero = cardCatalog.getCard('01001a') as HeroCard;
  const peterParkerAlterEgo = cardCatalog.getCard('01001b') as AlterEgoCard;
  const ironManHero = cardCatalog.getCard('01029a') as HeroCard;
  const tonyStarkAlterEgo = cardCatalog.getCard('01029b') as AlterEgoCard;

  it('1. Excludes Web-Shooter (01008) from board turn actions in both Hero and Alter-Ego forms', () => {
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

    const player = state.players[0];
    const webShooter = createCardInstance(cardCatalog.getCard('01008')!); // Web-Shooter (HERO_RESOURCE)
    webShooter.tokens = { damage: 0, threat: 0, counters: 3 };
    player.tableau.push(webShooter);

    // In Alter-Ego form: Web-Shooter must NOT appear in board actions
    let legal = getLegalActionsForPlayer(state, player.id);
    let webShooterAction = legal.boardActions.find(
      (a) => a.id.includes('01008') || a.headline.includes('Web-Shooter'),
    );
    expect(webShooterAction).toBeUndefined();

    // Flip to Hero form
    const heroRes = dispatchAction(state, { type: 'CHANGE_FORM', playerId: player.id });
    expect(heroRes.state.players[0].currentForm).toBe('hero');

    // In Hero form: Web-Shooter must STILL NOT appear in standalone board actions (only during payment)
    legal = getLegalActionsForPlayer(heroRes.state, player.id);
    webShooterAction = legal.boardActions.find(
      (a) => a.id.includes('01008') || a.headline.includes('Web-Shooter'),
    );
    expect(webShooterAction).toBeUndefined();
  });

  it('2. Allows Web-Shooter (HERO_RESOURCE) as generator when paying for cards in Hero form', () => {
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

    const webShooter = createCardInstance(cardCatalog.getCard('01008')!);
    webShooter.tokens = { damage: 0, threat: 0, counters: 3 };
    player.tableau.push(webShooter);

    // Add a 1-cost card to hand (First Aid 01074)
    const firstAid = createCardInstance(cardCatalog.getCard('01074')!); // Cost 1
    player.hand = [firstAid];

    // Play First Aid (Cost 1): Pay using Web-Shooter (generator)
    const res = dispatchAction(heroState, {
      type: 'PLAY_CARD',
      playerId: 'p1',
      cardInstanceId: firstAid.instanceId,
      paymentCardInstanceIds: [],
      generatorInstanceIds: [webShooter.instanceId],
    });

    expect(
      res.state.players[0].tableau.find((c) => c.instanceId === webShooter.instanceId)?.exhausted,
    ).toBe(true);
    expect(
      res.state.players[0].tableau.find((c) => c.instanceId === webShooter.instanceId)?.tokens
        ?.counters,
    ).toBe(2);
  });

  it('3. Excludes Pepper Potts (01033) from board turn actions', () => {
    const state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Iron Man',
          hero: ironManHero,
          alterEgo: tonyStarkAlterEgo,
          deckCards: Array(10).fill(cardCatalog.getCard('01030')!),
        },
      ],
      skipMulligan: true,
    });

    const player = state.players[0];
    const pepper = createCardInstance(cardCatalog.getCard('01033')!); // Pepper Potts (RESOURCE)
    player.tableau.push(pepper);

    // In Alter-Ego
    let legal = getLegalActionsForPlayer(state, player.id);
    let pepperAction = legal.boardActions.find(
      (a) => a.id.includes('01033') || a.headline.includes('Pepper Potts'),
    );
    expect(pepperAction).toBeUndefined();

    // In Hero
    const heroRes = dispatchAction(state, { type: 'CHANGE_FORM', playerId: player.id });
    legal = getLegalActionsForPlayer(heroRes.state, player.id);
    pepperAction = legal.boardActions.find(
      (a) => a.id.includes('01033') || a.headline.includes('Pepper Potts'),
    );
    expect(pepperAction).toBeUndefined();
  });

  it('4. Rejects Web-Shooter (HERO_RESOURCE) when paying for cards in Alter-Ego form', () => {
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

    const player = state.players[0]; // In Alter-Ego form
    const webShooter = createCardInstance(cardCatalog.getCard('01008')!);
    webShooter.tokens = { damage: 0, threat: 0, counters: 3 };
    player.tableau.push(webShooter);

    const firstAid = createCardInstance(cardCatalog.getCard('01074')!); // Cost 1
    player.hand = [firstAid];

    // Playing First Aid in Alter-Ego with Web-Shooter should fail or not exhaust Web-Shooter
    const res = dispatchAction(state, {
      type: 'PLAY_CARD',
      playerId: 'p1',
      cardInstanceId: firstAid.instanceId,
      paymentCardInstanceIds: [],
      generatorInstanceIds: [webShooter.instanceId],
    });

    // In Alter-Ego, Web-Shooter is HERO_RESOURCE and cannot be used
    expect(
      res.state.players[0].tableau.find((c) => c.instanceId === webShooter.instanceId)?.exhausted,
    ).toBeFalsy();
  });
});
