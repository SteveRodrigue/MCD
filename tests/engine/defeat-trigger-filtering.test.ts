import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { GameState, HeroCard, AlterEgoCard } from '@engine/models';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { dispatchAction } from '@engine/pipeline';

describe('Defeat Trigger Filtering (Issue #167)', () => {
  let state: GameState;
  let spiderManHero: HeroCard;
  let peterParkerAlterEgo: AlterEgoCard;
  let captainMarvelHero: HeroCard;
  let carolDanversAlterEgo: AlterEgoCard;

  beforeEach(() => {
    spiderManHero = cardCatalog.getCard('01001a') as HeroCard;
    peterParkerAlterEgo = cardCatalog.getCard('01001b') as AlterEgoCard;
    captainMarvelHero = cardCatalog.getCard('01010a') as HeroCard;
    carolDanversAlterEgo = cardCatalog.getCard('01010b') as AlterEgoCard;

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
        {
          id: 'p2',
          name: 'Player 2',
          hero: captainMarvelHero,
          alterEgo: carolDanversAlterEgo,
          deckCards: Array(10).fill(cardCatalog.getCard('01013')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });

    state.players[0].currentForm = 'hero';
    state.players[0].activeFormCard = spiderManHero;
    state.players[1].currentForm = 'hero';
    state.players[1].activeFormCard = captainMarvelHero;
    state.mainScheme.threat = 5;
  });

  it('Interrogation Room (01063) does NOT trigger when an Ally is defeated', () => {
    // Put Interrogation Room in Player 1's tableau
    const roomCard = cardCatalog.getCard('01063')!;
    const roomInstance = createCardInstance(roomCard);
    state.players[0].tableau = [roomInstance];

    // Put Daredevil (01058, 3 HP) in Player 1's allies with 2 damage already
    const allyCard = cardCatalog.getCard('01058')!;
    const allyInstance = createCardInstance(allyCard);
    allyInstance.tokens = { damage: 2 };
    state.players[0].allies = [allyInstance];

    // Engage an Armored Guard (01120, 3 HP) so the minion survives
    const guardCard = cardCatalog.getCard('01120')!;
    const minionInstance = createCardInstance(guardCard);
    minionInstance.tokens = { damage: 0 };
    state.players[0].engagedMinions = [minionInstance];

    // Daredevil attacks Armored Guard and takes 1 consequential damage -> total damage 3 >= 3 -> defeated!
    const res = dispatchAction(state, {
      type: 'ALLY_ATTACK',
      playerId: 'p1',
      allyInstanceId: allyInstance.instanceId,
      targetType: 'minion',
      targetInstanceId: minionInstance.instanceId,
    });

    // Verify Ally was defeated and minion survived
    expect(res.result.success).toBe(true);
    expect(res.state.players[0].allies.length).toBe(0);
    expect(res.state.players[0].discard.some((c) => c.card.code === '01058')).toBe(true);
    expect(res.state.players[0].engagedMinions.length).toBe(1);

    // Assert: Interrogation Room did NOT trigger, no pending prompts
    expect(res.state.pendingDecisionQueue || []).toHaveLength(0);
    // Assert: Threat was not modified
    expect(res.state.mainScheme.threat).toBe(5);
  });

  it('Interrogation Room (01063) DOES trigger when a Minion is defeated by controlling player', () => {
    // Put Interrogation Room in Player 1's tableau
    const roomCard = cardCatalog.getCard('01063')!;
    const roomInstance = createCardInstance(roomCard);
    state.players[0].tableau = [roomInstance];

    // Engage a 1 HP minion (Hydra Bomber 01110)
    const bomberCard = cardCatalog.getCard('01110')!;
    const minionInstance = createCardInstance(bomberCard);
    minionInstance.tokens = { damage: 0 };
    state.players[0].engagedMinions = [minionInstance];

    // Player 1 attacks the minion (Spider-Man ATK: 2) -> minion defeated
    const res = dispatchAction(state, {
      type: 'BASIC_ATTACK',
      playerId: 'p1',
      targetType: 'minion',
      targetInstanceId: minionInstance.instanceId,
    });

    // Minion is defeated and placed in encounter discard
    expect(res.result.success).toBe(true);
    expect(res.state.players[0].engagedMinions.length).toBe(0);
    expect(res.state.encounterDiscard.some((c) => c.card.code === '01110')).toBe(true);

    // Interrogation Room response prompt should be queued!
    expect(res.state.pendingDecisionQueue).toHaveLength(1);
    const prompt = res.state.pendingDecisionQueue![0];
    expect(prompt.playerId).toBe('p1');
    expect(prompt.sourceCardCode).toBe('01063');

    // Resolve the prompt with "Yes"
    const acceptRes = dispatchAction(res.state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: 'p1',
      selectedOptionId: 'trigger_interrogation_room_response',
    });

    // Interrogation Room should now be exhausted, and 1 threat removed
    const updatedRoom = acceptRes.state.players[0].tableau.find((c) => c.card.code === '01063')!;
    expect(updatedRoom.exhausted).toBe(true);
    expect(acceptRes.state.mainScheme.threat).toBe(4);
  });

  it('Interrogation Room (01063) does NOT trigger when ANOTHER player defeats a minion', () => {
    // Player 1 controls Interrogation Room
    const roomCard = cardCatalog.getCard('01063')!;
    const roomInstance = createCardInstance(roomCard);
    state.players[0].tableau = [roomInstance];

    // Engage a 1 HP minion with Player 2 and make Player 2 active
    state.activePlayerIndex = 1;
    const bomberCard = cardCatalog.getCard('01110')!;
    const minionInstance = createCardInstance(bomberCard);
    minionInstance.tokens = { damage: 0 };
    state.players[1].engagedMinions = [minionInstance];

    // Player 2 attacks and defeats the minion
    const res = dispatchAction(state, {
      type: 'BASIC_ATTACK',
      playerId: 'p2',
      targetType: 'minion',
      targetInstanceId: minionInstance.instanceId,
    });

    // Minion is defeated
    expect(res.result.success).toBe(true);
    expect(res.state.players[1].engagedMinions.length).toBe(0);

    // Player 1 should NOT be prompted (Interrogation Room is "After you defeat a minion")
    expect(res.state.pendingDecisionQueue || []).toHaveLength(0);
    expect(res.state.mainScheme.threat).toBe(5);
  });

  it('Tigra (01051) does NOT heal when an Ally is defeated', () => {
    // Put Tigra (01051, 3 HP) in Player 1's allies with 1 damage
    const tigraCard = cardCatalog.getCard('01051')!;
    const tigraInstance = createCardInstance(tigraCard);
    tigraInstance.tokens = { damage: 1 };

    // Put Daredevil (01058, 3 HP) with 2 damage
    const daredevilCard = cardCatalog.getCard('01058')!;
    const daredevilInstance = createCardInstance(daredevilCard);
    daredevilInstance.tokens = { damage: 2 };

    state.players[0].allies = [tigraInstance, daredevilInstance];

    // Engage an Armored Guard (01120, 3 HP)
    const guardCard = cardCatalog.getCard('01120')!;
    const minionInstance = createCardInstance(guardCard);
    minionInstance.tokens = { damage: 0 };
    state.players[0].engagedMinions = [minionInstance];

    // Daredevil attacks minion, takes 1 consequential damage -> Daredevil is defeated
    const res = dispatchAction(state, {
      type: 'ALLY_ATTACK',
      playerId: 'p1',
      allyInstanceId: daredevilInstance.instanceId,
      targetType: 'minion',
      targetInstanceId: minionInstance.instanceId,
    });

    // Daredevil defeated
    expect(res.state.players[0].allies.length).toBe(1);
    expect(res.state.players[0].allies[0].card.code).toBe('01051');

    // Tigra should NOT trigger or heal (her trigger is "After Tigra attacks and defeats a minion")
    expect(res.state.pendingDecisionQueue || []).toHaveLength(0);
    expect(res.state.players[0].allies[0].tokens?.damage).toBe(1);
  });
});
