import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { GameState, HeroCard, AlterEgoCard } from '@engine/models';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { dispatchAction, initiateEnemyAttack, resolveDefenderDeclaration } from '@engine/pipeline';
import { getLegalActionsForPlayer } from '@engine/pipeline/legal-actions-generator';
import { step6_passFirstPlayerAndRoundUpkeep } from '@engine/pipeline/round-upkeep';

describe('Issue #95: Ally Attachment Rules Compliance & Cascading Cleanup', () => {
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

  it('1. RR v1.8 Ruling: Player cannot voluntarily discard an attached upgrade at will', () => {
    const daredevilCard = cardCatalog.getCard('01058')!;
    const daredevil = createCardInstance(daredevilCard);
    const inspiredCard = cardCatalog.getCard('01074')!;
    const inspired = createCardInstance(inspiredCard);

    daredevil.attachments = [inspired];
    state.players[0].allies = [daredevil];

    // Query legal actions for player
    const report = getLegalActionsForPlayer(state, 'p1');
    const legalActions = report.allActions.map((item) => item.action);

    // Assert that no action permits arbitrary discard of Inspired or Daredevil
    const voluntaryDiscards = legalActions.filter(
      (a) =>
        a.type === 'SPEND_RESOURCES_TO_DISCARD_ATTACHMENT' ||
        (a as any).cardInstanceId === inspired.instanceId ||
        (a as any).sourceInstanceId === inspired.instanceId,
    );
    expect(voluntaryDiscards.length).toBe(0);
  });

  it('2. Consequential damage defeat from ALLY_ATTACK cleanly discards attached upgrade', () => {
    const daredevilCard = cardCatalog.getCard('01058')!; // HP: 3, ATK cost: 1
    const daredevil = createCardInstance(daredevilCard);
    const inspiredCard = cardCatalog.getCard('01074')!;
    const inspired = createCardInstance(inspiredCard);

    daredevil.attachments = [inspired];
    // Put Daredevil 1 damage away from defeat (HP 3, tokens.damage = 2)
    daredevil.tokens = { damage: 2 };
    state.players[0].allies = [daredevil];

    const res = dispatchAction(state, {
      type: 'ALLY_ATTACK',
      playerId: 'p1',
      allyInstanceId: daredevil.instanceId,
      targetType: 'villain',
    });

    expect(res.result.success).toBe(true);
    // Ally must be removed from play
    expect(res.state.players[0].allies.length).toBe(0);
    // Ally is in player discard
    expect(res.state.players[0].discard.some((c) => c.instanceId === daredevil.instanceId)).toBe(
      true,
    );
    // Inspired attachment must be cleanly discarded into player discard
    expect(res.state.players[0].discard.some((c) => c.instanceId === inspired.instanceId)).toBe(
      true,
    );
    // Discarded Daredevil's attachment array should be emptied in returned state
    const discardedDaredevil = res.state.players[0].discard.find(
      (c) => c.instanceId === daredevil.instanceId,
    );
    expect(discardedDaredevil?.attachments?.length).toBe(0);
  });

  it('3. Consequential damage defeat from ALLY_THWART cleanly discards attached upgrade', () => {
    const daredevilCard = cardCatalog.getCard('01058')!; // HP: 3, THW cost: 1
    const daredevil = createCardInstance(daredevilCard);
    const inspiredCard = cardCatalog.getCard('01074')!;
    const inspired = createCardInstance(inspiredCard);

    daredevil.attachments = [inspired];
    daredevil.tokens = { damage: 2 };
    state.players[0].allies = [daredevil];
    state.mainScheme.threat = 5;

    const res = dispatchAction(state, {
      type: 'ALLY_THWART',
      playerId: 'p1',
      allyInstanceId: daredevil.instanceId,
      targetType: 'main_scheme',
      targetInstanceId: state.mainScheme.instanceId,
    });

    expect(res.result.success).toBe(true);
    expect(res.state.players[0].allies.length).toBe(0);
    expect(res.state.players[0].discard.some((c) => c.instanceId === daredevil.instanceId)).toBe(
      true,
    );
    expect(res.state.players[0].discard.some((c) => c.instanceId === inspired.instanceId)).toBe(
      true,
    );
    const discardedDaredevilThw = res.state.players[0].discard.find(
      (c) => c.instanceId === daredevil.instanceId,
    );
    expect(discardedDaredevilThw?.attachments?.length).toBe(0);
  });

  it('4. Defending an enemy attack that defeats the ally cleanly discards attached upgrade', () => {
    const daredevilCard = cardCatalog.getCard('01058')!; // HP: 3
    const daredevil = createCardInstance(daredevilCard);
    const inspiredCard = cardCatalog.getCard('01074')!;
    const inspired = createCardInstance(inspiredCard);

    daredevil.attachments = [inspired];
    daredevil.tokens = { damage: 2 }; // 1 HP remaining, Rhino base ATK is 2 -> will defeat Daredevil
    state.players[0].allies = [daredevil];

    // Ensure encounter deck has a 0-boost card for determinism
    const zeroBoostCard = cardCatalog.getCard('01097b')!;
    state.encounterDeck = [createCardInstance(zeroBoostCard), ...state.encounterDeck];

    const s1 = initiateEnemyAttack(state, { type: 'VILLAIN' }, 'p1');

    // Player chooses Daredevil Ally Defend
    const s2 = resolveDefenderDeclaration(s1, {
      type: 'ALLY',
      playerId: 'p1',
      allyInstanceId: daredevil.instanceId,
    });

    // Daredevil is defeated
    expect(s2.players[0].allies.length).toBe(0);
    expect(s2.players[0].discard.some((c) => c.instanceId === daredevil.instanceId)).toBe(true);
    // Inspired is in player discard
    expect(s2.players[0].discard.some((c) => c.instanceId === inspired.instanceId)).toBe(true);
    expect(daredevil.attachments?.length).toBe(0);
  });

  it('5. Round-end dismissal (e.g. Nick Fury) cleanly discards attached upgrade', () => {
    const nickFuryCard = cardCatalog.getCard('01084')!; // Nick Fury has ROUND_END DISCARD SELF
    const nickFury = createCardInstance(nickFuryCard);
    const inspiredCard = cardCatalog.getCard('01074')!;
    const inspired = createCardInstance(inspiredCard);

    nickFury.attachments = [inspired];
    state.players[0].allies = [nickFury];

    // Step 6: End of round upkeep
    const nextState = step6_passFirstPlayerAndRoundUpkeep(state);

    // Nick Fury dismissed
    expect(nextState.players[0].allies.some((a) => a.instanceId === nickFury.instanceId)).toBe(
      false,
    );
    expect(nextState.players[0].discard.some((c) => c.instanceId === nickFury.instanceId)).toBe(
      true,
    );
    // Inspired attachment discarded
    expect(nextState.players[0].discard.some((c) => c.instanceId === inspired.instanceId)).toBe(
      true,
    );
    expect(nickFury.attachments?.length).toBe(0);
  });

  it('6. Multiplayer cross-player attachment routes each card to its respective owner discard pile', () => {
    const ironManHero = cardCatalog.getCard('01029a') as HeroCard;
    const tonyStarkAlterEgo = cardCatalog.getCard('01029b') as AlterEgoCard;

    const twoPlayerState = setupGame({
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
          hero: ironManHero,
          alterEgo: tonyStarkAlterEgo,
          deckCards: Array(10).fill(cardCatalog.getCard('01034')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });

    twoPlayerState.players[0].currentForm = 'hero';
    twoPlayerState.players[1].currentForm = 'hero';
    // Set active player to Player 2
    twoPlayerState.activePlayerIndex = 1;

    // Player 2 controls an ally (Daredevil)
    const daredevilCard = cardCatalog.getCard('01058')!;
    const daredevil = createCardInstance(daredevilCard);
    (daredevil as any).ownerId = 'p2';
    daredevil.tokens = { damage: 2 }; // 1 HP left
    twoPlayerState.players[1].allies = [daredevil];

    // Player 1 played Inspired and attached it to Player 2's Daredevil
    const inspiredCard = cardCatalog.getCard('01074')!;
    const inspired = createCardInstance(inspiredCard);
    (inspired as any).ownerId = 'p1';
    daredevil.attachments = [inspired];

    // Player 2's Daredevil attacks and suffers consequential damage, defeating him
    const res = dispatchAction(twoPlayerState, {
      type: 'ALLY_ATTACK',
      playerId: 'p2',
      allyInstanceId: daredevil.instanceId,
      targetType: 'villain',
    });

    expect(res.result.success).toBe(true);
    // Daredevil is removed from Player 2's allies
    expect(res.state.players[1].allies.length).toBe(0);
    // Daredevil routed to Player 2's discard pile
    expect(res.state.players[1].discard.some((c) => c.instanceId === daredevil.instanceId)).toBe(
      true,
    );
    // Inspired routed to Player 1's discard pile!
    expect(res.state.players[0].discard.some((c) => c.instanceId === inspired.instanceId)).toBe(
      true,
    );
    expect(res.state.players[1].discard.some((c) => c.instanceId === inspired.instanceId)).toBe(
      false,
    );
  });
});
