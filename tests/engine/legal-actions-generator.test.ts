import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { GameState, HeroCard, AlterEgoCard } from '../../src/engine/models';
import { setupGame } from '../../src/engine/state/game-setup';
import { getLegalActionsForPlayer } from '../../src/engine/pipeline/legal-actions-generator';

describe('Legal Actions Generator (The Daily Bugle Action Bulletins)', () => {
  let state: GameState;
  let ironManHero: HeroCard;
  let tonyStarkAlterEgo: AlterEgoCard;

  beforeEach(() => {
    ironManHero = cardCatalog.getCard('01029a') as HeroCard;
    tonyStarkAlterEgo = cardCatalog.getCard('01029b') as AlterEgoCard;

    state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Tony Stark',
          hero: ironManHero,
          alterEgo: tonyStarkAlterEgo,
          deckCards: Array(15).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });
  });

  it('discovers legal actions for Alter-Ego at start of turn', () => {
    const p1 = state.players[0];
    p1.currentForm = 'alter_ego';
    p1.activeFormCard = tonyStarkAlterEgo;

    // Put an upgrade and payment resources in hand
    p1.hand = [
      { instanceId: 'u1', card: cardCatalog.getCard('01035')!, exhausted: false }, // Arc Reactor (Cost 2)
      { instanceId: 'r1', card: cardCatalog.getCard('01005')!, exhausted: false },
      { instanceId: 'r2', card: cardCatalog.getCard('01005')!, exhausted: false },
    ];

    const report = getLegalActionsForPlayer(state, p1.id);

    expect(report.isPlayerTurn).toBe(true);
    expect(report.activeActionCount).toBeGreaterThan(0);

    // 1. Change form is available
    const changeForm = report.identityActions.find((a) => a.action.type === 'CHANGE_FORM');
    expect(changeForm).toBeDefined();
    expect(changeForm?.headline).toBe('Suit Up (Hero Form)');

    // 2. Play Arc Reactor is available
    const playArc = report.handCardActions.find((a) => (a.action as any).cardInstanceId === 'u1');
    expect(playArc).toBeDefined();

    // 3. End Turn is always available
    expect(report.turnAction).toBeDefined();
    expect(report.turnAction?.action.type).toBe('END_PLAYER_TURN');
  });

  it('discovers Hero actions (Attack, Thwart, Arc Reactor in tableau) in Hero form', () => {
    const p1 = state.players[0];
    p1.currentForm = 'hero';
    p1.activeFormCard = ironManHero;
    p1.exhausted = false;
    p1.hand = [];

    // Add Arc Reactor in tableau
    p1.tableau.push({
      instanceId: 'arc_inst',
      card: cardCatalog.getCard('01035')!,
      exhausted: false,
    });

    state.mainScheme.threat = 2;

    const report = getLegalActionsForPlayer(state, p1.id);

    // Basic Attack on Villain
    const basicAtk = report.identityActions.find((a) => a.action.type === 'BASIC_ATTACK');
    expect(basicAtk).toBeDefined();

    // Basic Thwart on Main Scheme
    const basicThw = report.identityActions.find((a) => a.action.type === 'BASIC_THWART');
    expect(basicThw).toBeDefined();

    // Arc Reactor Activate in Board Actions
    const arcActivate = report.boardActions.find(
      (a) => (a.action as any).cardInstanceId === 'arc_inst',
    );
    expect(arcActivate).toBeDefined();
  });

  it('reports activeActionCount === 0 when exhausted, hand empty, and form already changed', () => {
    const p1 = state.players[0];
    p1.currentForm = 'hero';
    p1.activeFormCard = ironManHero;
    p1.exhausted = true; // Exhausted hero
    p1.formChangedThisRound = true; // Cannot flip again
    p1.hand = []; // No hand cards
    p1.tableau = []; // No tableau actions
    p1.allies = []; // No allies

    const report = getLegalActionsForPlayer(state, p1.id);

    expect(report.activeActionCount).toBe(0);
    expect(report.identityActions).toHaveLength(0);
    expect(report.handCardActions).toHaveLength(0);
    expect(report.boardActions).toHaveLength(0);
    expect(report.turnAction).toBeDefined(); // Only End Turn remains!
  });

  it('excludes Resource cards (Energy, Genius, Strength) from playable hand actions (RR v1.8 p. 24)', () => {
    const p1 = state.players[0];
    p1.currentForm = 'hero';
    p1.activeFormCard = ironManHero;
    p1.exhausted = true;
    p1.formChangedThisRound = true;

    // Hand contains ONLY resource cards
    p1.hand = [
      { instanceId: 'res1', card: cardCatalog.getCard('01088')!, exhausted: false }, // Energy
      { instanceId: 'res2', card: cardCatalog.getCard('01089')!, exhausted: false }, // Genius
      { instanceId: 'res3', card: cardCatalog.getCard('01090')!, exhausted: false }, // Strength
    ];

    const report = getLegalActionsForPlayer(state, p1.id);

    // Resource cards should NOT be listed as playable hand actions!
    expect(report.handCardActions).toHaveLength(0);
    expect(report.activeActionCount).toBe(0);
  });

  it('disallows basic thwart and excludes Thwart action when main scheme has 0 threat (RR v1.8 p. 29)', () => {
    const p1 = state.players[0];
    p1.currentForm = 'hero';
    p1.activeFormCard = ironManHero;
    p1.exhausted = false;
    state.mainScheme.threat = 0;
    state.sideSchemes = [];

    const report = getLegalActionsForPlayer(state, p1.id);
    const thwartAction = report.identityActions.find((a) => a.action.type === 'BASIC_THWART');
    expect(thwartAction).toBeUndefined();
  });

  it('populates cardCode across identity, hand, and board action items for UI thumbnail rendering', () => {
    const p1 = state.players[0];
    p1.currentForm = 'hero';
    p1.activeFormCard = ironManHero;
    p1.exhausted = false;

    p1.hand = [
      { instanceId: 'ev1', card: cardCatalog.getCard('01036')!, exhausted: false }, // Mark V Armor (Cost 3)
      { instanceId: 'r1', card: cardCatalog.getCard('01005')!, exhausted: false },
      { instanceId: 'r2', card: cardCatalog.getCard('01005')!, exhausted: false },
      { instanceId: 'r3', card: cardCatalog.getCard('01005')!, exhausted: false },
    ];
    p1.tableau = [
      { instanceId: 'arc_inst', card: cardCatalog.getCard('01035')!, exhausted: false },
    ];

    const report = getLegalActionsForPlayer(state, p1.id);

    // Identity action (Flip to Alter-Ego) has cardCode for target form
    const changeForm = report.identityActions.find((a) => a.action.type === 'CHANGE_FORM');
    expect(changeForm?.cardCode).toBe('01029b');

    // Basic attack has hero cardCode
    const basicAtk = report.identityActions.find((a) => a.action.type === 'BASIC_ATTACK');
    expect(basicAtk?.cardCode).toBe('01029a');

    // Hand card action has cardCode
    const playBlast = report.handCardActions.find(
      (a) => (a.action as any).cardInstanceId === 'ev1',
    );
    expect(playBlast?.cardCode).toBe('01036');

    // Board action has cardCode
    const boardArc = report.boardActions.find(
      (a) => (a.action as any).cardInstanceId === 'arc_inst',
    );
    expect(boardArc?.cardCode).toBe('01035');
  });
});
