import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '@data/importer/card-loader';
import {
  GameState,
  HeroCard,
  AlterEgoCard,
  setupGame,
  resetInstanceCounter,
  createCardInstance,
  dispatchAction,
  updateGameState,
  resolveActiveEncounterCardAfterInterrupt,
  getActiveMainScheme,
} from '@engine/index';
import {
  executeVillainAttackAgainstPlayer,
  executeVillainSchemeAgainstPlayer,
  executeMinionAttackAgainstPlayer,
  executeMinionSchemeAgainstPlayer,
} from '@engine/pipeline/villain-phase';
import { recordBasicAction, recordCardPlay, recordAbilityUsage } from '@engine/pipeline/stats';
import { executeEffect } from '@engine/effects';
import { StatusCard } from '@engine/models';
import { getActiveVillain } from '@engine/index';
import { thaw } from '../../support/thaw-state';

describe('Engine Card Play and Usage Stats (#315)', () => {
  let state: GameState;

  beforeEach(() => {
    resetInstanceCounter();
    state = setupGame({
      catalog: cardCatalog,
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: cardCatalog.getCard('01001a') as HeroCard,
          alterEgo: cardCatalog.getCard('01001b') as AlterEgoCard,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });
    // Set to hero form
    state.players[0].currentForm = 'hero';
    state.players[0].activeFormCard = state.players[0].hero;
  });

  const p1 = () => state.players[0];

  it('initializes game stats on setupGame', () => {
    expect(state.stats).toBeDefined();
    expect(state.stats?.totalActionsExecuted).toBe(0);
    expect(state.stats?.basicActions.heroAttack).toBe(0);
    expect(state.stats?.cards).toEqual({});
  });

  it('PLAY_CARD increments played count for player cards', () => {
    const webShooterCard = cardCatalog.getCard('01008')!; // Web-Shooter, cost 1
    const resourceCard = cardCatalog.getCard('01005')!; // Energy

    const playedInst = createCardInstance(webShooterCard);
    const payInst = createCardInstance(resourceCard);

    p1().hand = [playedInst, payInst];

    const res = dispatchAction(state, {
      type: 'PLAY_CARD',
      playerId: p1().id,
      cardInstanceId: playedInst.instanceId,
      paymentCardInstanceIds: [payInst.instanceId],
    });

    expect(res.result.success).toBe(true);
    expect(res.state.stats?.cards['01008']?.played).toBe(1);
    expect(res.state.stats?.totalActionsExecuted).toBeGreaterThanOrEqual(1);
  });

  it('Encounter card reveal increments played count for encounter cards', () => {
    const treacheryCard = cardCatalog.getCard('01103')!; // False Alarm
    const encInst = createCardInstance(treacheryCard);

    resolveActiveEncounterCardAfterInterrupt(state, encInst, p1(), false);

    expect(state.stats?.cards['01103']?.played).toBe(1);
  });

  it('USE_CARD_ABILITY and triggered abilities record ability usage', () => {
    const webShooterCard = cardCatalog.getCard('01008')!;
    const webShooterInst = createCardInstance(webShooterCard);
    webShooterInst.counters = { 'web-counter': 3 };
    p1().tableau.push(webShooterInst);

    const abId = webShooterCard.enrichment?.abilities?.[0]?.id || '01008_res';

    const res = dispatchAction(state, {
      type: 'USE_CARD_ABILITY',
      playerId: p1().id,
      cardInstanceId: webShooterInst.instanceId,
      abilityId: abId,
    });

    expect(res.result.success).toBe(true);
    expect(res.state.stats?.cards['01008']?.abilitiesUsed[abId]).toBe(1);
  });

  it('Basic actions increment character and global action counters', () => {
    // 1. BASIC_ATTACK
    p1().exhausted = false;
    const attackRes = dispatchAction(state, {
      type: 'BASIC_ATTACK',
      playerId: p1().id,
      targetType: 'villain',
    });
    expect(attackRes.result.success).toBe(true);
    expect(attackRes.state.stats?.basicActions.heroAttack).toBe(1);
    expect(attackRes.state.stats?.cards['01001a']?.basicActions?.attack).toBe(1);

    // 2. BASIC_THWART
    const thwartArmed = thaw(attackRes.state);
    thwartArmed.players[0].exhausted = false;
    getActiveMainScheme(thwartArmed).threat = 5;
    const thwartRes = dispatchAction(thwartArmed, {
      type: 'BASIC_THWART',
      playerId: p1().id,
      targetType: 'main_scheme',
    });
    expect(thwartRes.result.success).toBe(true);
    expect(thwartRes.state.stats?.basicActions.heroThwart).toBe(1);
    expect(thwartRes.state.stats?.cards['01001a']?.basicActions?.thwart).toBe(1);

    // 3. CHANGE_FORM to alter-ego
    const changeArmed = thaw(thwartRes.state);
    changeArmed.players[0].basicChangeFormUsedThisRound = false;
    const changeRes = dispatchAction(changeArmed, {
      type: 'CHANGE_FORM',
      playerId: p1().id,
    });
    expect(changeRes.result.success).toBe(true);
    expect(changeRes.state.stats?.basicActions.changeForm).toBe(1);
    expect(changeRes.state.stats?.cards['01001b']?.basicActions?.changeForm).toBe(1);

    // 4. BASIC_RECOVER
    const recoverArmed = thaw(changeRes.state);
    recoverArmed.players[0].exhausted = false;
    recoverArmed.players[0].recoveryUsedThisRound = false;
    recoverArmed.players[0].health = 5;
    const recoverRes = dispatchAction(recoverArmed, {
      type: 'BASIC_RECOVER',
      playerId: p1().id,
    });
    expect(recoverRes.result.success).toBe(true);
    expect(recoverRes.state.stats?.basicActions.alterEgoRecover).toBe(1);
    expect(recoverRes.state.stats?.cards['01001b']?.basicActions?.recover).toBe(1);

    // 5. ALLY_ATTACK & ALLY_THWART
    const allyCard = cardCatalog.getCard('01011')!; // Black Cat (01011)
    const allyInst = createCardInstance(allyCard);
    const allyArmed = thaw(recoverRes.state);
    allyArmed.players[0].allies.push(allyInst);

    const allyAttackRes = dispatchAction(allyArmed, {
      type: 'ALLY_ATTACK',
      playerId: p1().id,
      allyInstanceId: allyInst.instanceId,
      targetType: 'villain',
    });
    expect(allyAttackRes.result.success).toBe(true);
    expect(allyAttackRes.state.stats?.basicActions.allyAttack).toBe(1);
    expect(allyAttackRes.state.stats?.cards['01011']?.basicActions?.attack).toBe(1);

    const thwartReady = thaw(allyAttackRes.state);
    thwartReady.players[0].allies.find((a) => a.instanceId === allyInst.instanceId)!.exhausted =
      false;
    getActiveMainScheme(thwartReady).threat = 5;
    const allyThwartRes = dispatchAction(thwartReady, {
      type: 'ALLY_THWART',
      playerId: p1().id,
      allyInstanceId: allyInst.instanceId,
      targetType: 'main_scheme',
    });
    expect(allyThwartRes.result.success).toBe(true);
    expect(allyThwartRes.state.stats?.basicActions.allyThwart).toBe(1);
    expect(allyThwartRes.state.stats?.cards['01011']?.basicActions?.thwart).toBe(1);

    // 6. Villain and Minion basic actions
    const villainCardCode = state.villains[0].card.code;
    const afterAllies = thaw(allyThwartRes.state);
    executeVillainAttackAgainstPlayer(afterAllies, afterAllies.players[0]);
    expect(afterAllies.stats?.basicActions.villainAttack).toBe(1);
    expect(afterAllies.stats?.cards[villainCardCode]?.basicActions?.attack).toBe(1);

    executeVillainSchemeAgainstPlayer(afterAllies, afterAllies.players[0]);
    expect(afterAllies.stats?.basicActions.villainScheme).toBe(1);
    expect(afterAllies.stats?.cards[villainCardCode]?.basicActions?.scheme).toBe(1);

    const minionCard = cardCatalog.getCard('01109')!; // Armored Guard
    const minionInst = createCardInstance(minionCard);
    executeMinionAttackAgainstPlayer(afterAllies, minionInst, afterAllies.players[0]);
    expect(afterAllies.stats?.basicActions.minionAttack).toBe(1);
    expect(afterAllies.stats?.cards['01109']?.basicActions?.attack).toBe(1);

    executeMinionSchemeAgainstPlayer(afterAllies, minionInst, afterAllies.players[0]);
    expect(afterAllies.stats?.basicActions.minionScheme).toBe(1);
    expect(afterAllies.stats?.cards['01109']?.basicActions?.scheme).toBe(1);
  });

  it('DECLARE_DEFENDER with HERO records heroDefense', () => {
    const res = dispatchAction(state, {
      type: 'DECLARE_DEFENDER',
      playerId: p1().id,
      defenderType: 'HERO',
    });

    expect(res.state.stats?.basicActions.heroDefense).toBe(1);
    expect(res.state.stats?.cards['01001a']?.basicActions?.defense).toBe(1);
  });

  it('custom / synthetic card codes record without errors', () => {
    recordCardPlay(state, 'custom_card_99999');
    recordAbilityUsage(state, 'custom_card_99999', 'custom_ab_1');
    recordBasicAction(state, 'heroAttack', 'custom_card_99999');

    expect(state.stats?.cards['custom_card_99999']?.played).toBe(1);
    expect(state.stats?.cards['custom_card_99999']?.abilitiesUsed['custom_ab_1']).toBe(1);
    expect(state.stats?.cards['custom_card_99999']?.basicActions?.attack).toBe(1);
  });

  it('updateGameState keeps state.stats when the update does not touch them', () => {
    recordCardPlay(state, '01001a');
    recordBasicAction(state, 'heroAttack', '01001a');

    const next = updateGameState(state, (draft) => {
      draft.roundNumber += 1;
    });
    expect(next.stats).toBe(state.stats);
    expect(next.stats?.cards['01001a']?.played).toBe(1);
  });

  it('a cancelled encounter reveal does not count as played', () => {
    const encInst = createCardInstance(cardCatalog.getCard('01103')!);

    resolveActiveEncounterCardAfterInterrupt(state, encInst, p1(), true);

    expect(state.stats?.cards['01103']).toBeUndefined();
  });

  it('a Stunned hero attack and a Confused villain scheme are not counted', () => {
    p1().exhausted = false;
    p1().statusCards = [StatusCard.STUNNED];
    const attackRes = dispatchAction(state, {
      type: 'BASIC_ATTACK',
      playerId: p1().id,
      targetType: 'villain',
    });
    expect(attackRes.result.success).toBe(true);
    expect(attackRes.state.stats?.basicActions.heroAttack).toBe(0);

    const afterAttack = thaw(attackRes.state);
    const villain = getActiveVillain(afterAttack);
    villain.statusCards = [StatusCard.CONFUSED];
    executeVillainSchemeAgainstPlayer(afterAttack, afterAttack.players[0]);
    expect(afterAttack.stats?.basicActions.villainScheme).toBe(0);
  });

  it('synthetic ability ids not declared on the source card are not counted', () => {
    const webShooterInst = createCardInstance(cardCatalog.getCard('01008')!);
    p1().tableau.push(webShooterInst);

    executeEffect(
      state,
      { id: 'prompt_123_hero', timing: 'ACTION', steps: [] },
      { playerId: p1().id, sourceCardInstance: webShooterInst },
    );

    expect(state.stats?.cards['01008']).toBeUndefined();
  });
});
