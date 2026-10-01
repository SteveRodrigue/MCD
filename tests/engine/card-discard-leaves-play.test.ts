import { describe, it, expect, beforeEach } from 'vitest';
import {
  GameState,
  GamePhase,
  CardType,
  FactionCode,
  CardInstance,
  PlayerState,
  StatusCard,
  AttackExecutionContext,
} from '../../src/engine/models';
import { dispatchAction } from '../../src/engine/pipeline/action-dispatcher';
import { discardCardInstance, resetCardState, executeEffect } from '../../src/engine/effects';
import { applyCalculatedAttackDamage } from '../../src/engine/pipeline/combat-pipeline';

describe('Universal Card State Reset on Discard / Leaves Play (Issue #157, RR v1.8 p. 15)', () => {
  let state: GameState;
  let player1: PlayerState;
  let player2: PlayerState;

  const createCardInstance = (
    instanceId: string,
    code: string,
    name: string,
    type: CardType,
    cost: number = 0,
    abilities: any[] = [],
  ): CardInstance => ({
    instanceId,
    card: {
      code,
      name,
      type,
      faction: FactionCode.LEADERSHIP,
      packCode: 'core',
      position: 1,
      quantity: 1,
      deckLimit: 3,
      isUnique: false,
      cost,
      text: '',
      traits: [],
      keywords: [],
      resources: { physical: 1, energy: 0, mental: 0, wild: 0, total: 1 },
      isLandscape: false,
      orientation: 'portrait',
      raw: {} as any,
      enrichment: {
        abilities,
      },
    },
  });

  const createMakeTheCall = (instanceId: string): CardInstance =>
    createCardInstance(instanceId, '01071', 'Make the Call', CardType.EVENT, 0, [
      {
        id: 'make_the_call',
        timing: 'ACTION',
        steps: [
          {
            effect: 'PLAY_FROM_ZONE',
            effectParams: {
              source: 'ANY_PLAYER_DISCARD',
              filter: { types: ['ally'] },
              costMode: 'PRINTED_COST',
              destination: 'TABLEAU',
              control: 'SELF',
            },
          },
        ],
      },
    ]);

  beforeEach(() => {
    player1 = {
      id: 'player_1',
      name: 'Spider-Man',
      hero: {} as any,
      alterEgo: {} as any,
      availableForms: [],
      activeFormCard: { code: '01001a', name: 'Spider-Man', type: CardType.HERO } as any,
      currentForm: 'hero',
      health: 10,
      maxHealth: 10,
      exhausted: false,
      statusCards: [],
      hand: [],
      deck: [],
      discard: [],
      tableau: [],
      allies: [],
      engagedMinions: [],
      recoveryUsedThisRound: false,
      dealtEncounterCards: [],
      setAsideCards: [],
      basicChangeFormUsedThisRound: false,
      formChangedThisRound: false,
    } as unknown as PlayerState;

    player2 = {
      id: 'player_2',
      name: 'Captain Marvel',
      hero: {} as any,
      alterEgo: {} as any,
      availableForms: [],
      activeFormCard: { code: '01010a', name: 'Captain Marvel', type: CardType.HERO } as any,
      currentForm: 'hero',
      health: 12,
      maxHealth: 12,
      exhausted: false,
      statusCards: [],
      hand: [],
      deck: [],
      discard: [],
      tableau: [],
      allies: [],
      engagedMinions: [],
      recoveryUsedThisRound: false,
      dealtEncounterCards: [],
      setAsideCards: [],
      basicChangeFormUsedThisRound: false,
      formChangedThisRound: false,
    } as unknown as PlayerState;

    state = {
      id: 'test_game',
      roundNumber: 1,
      phase: GamePhase.PLAYER_PHASE,
      firstPlayerIndex: 0,
      activePlayerIndex: 0,
      players: [player1, player2],
      villain: {
        instanceId: 'villain_inst',
        code: '01094',
        name: 'Rhino',
        card: {
          code: '01094',
          name: 'Rhino',
          type: CardType.VILLAIN,
        } as any,
        stage: 'I',
        health: 14,
        maxHealth: 14,
        scheme: 1,
        attack: 2,
        statusCards: [],
        attachments: [],
        tough: false,
      } as any,
      mainScheme: {
        code: '01097',
        name: 'The Break-In!',
        stage: '1A',
        threat: 0,
        targetThreat: 7,
        accelerationTokens: 0,
        crisisTokens: 0,
      } as any,
      sideSchemes: [],
      encounterDeck: [],
      encounterDiscard: [],
      victoryDisplay: [],
      log: [],
    } as unknown as GameState;
  });

  it('1. Ally Defeat via Consequential Damage & Replay: resets state on defeat and enters play ready with 0 damage', () => {
    // Maria Hill ally (health 2, attackCost 2 so 2 consequential damage is lethal)
    const mariaHill = createCardInstance('maria_inst', '01019', 'Maria Hill', CardType.ALLY, 2, []);
    (mariaHill.card as any).health = 2;
    (mariaHill.card as any).attack = 1;
    (mariaHill.card as any).attackCost = 2;
    mariaHill.statusCards = [StatusCard.CONFUSED];
    mariaHill.tokens = { damage: 0, counters: 1 };
    mariaHill.attachments = [
      createCardInstance('att_1', 'att_code', 'Attachment', CardType.UPGRADE),
    ];

    player1.allies = [mariaHill];

    // Player 1 commands Maria Hill to attack Rhino
    const attackRes = dispatchAction(state, {
      type: 'ALLY_ATTACK',
      playerId: 'player_1',
      allyInstanceId: 'maria_inst',
      targetType: 'villain',
      targetInstanceId: '01094',
    });

    expect(attackRes.result.success).toBe(true);

    const p1 = attackRes.state.players[0];
    // Maria Hill is removed from allies
    expect(p1.allies.some((a) => a.instanceId === 'maria_inst')).toBe(false);

    // Maria Hill is in discard pile with completely reset transient state
    const discardedMaria = p1.discard.find((c) => c.instanceId === 'maria_inst');
    expect(discardedMaria).toBeDefined();
    expect(discardedMaria?.exhausted).toBe(false);
    expect(discardedMaria?.tokens?.damage ?? 0).toBe(0);
    expect(discardedMaria?.statusCards?.length ?? 0).toBe(0);
    expect(discardedMaria?.attachments?.length ?? 0).toBe(0);
    expect(discardedMaria?.cardsUnderneath?.length ?? 0).toBe(0);

    // Now play Make the Call targeting Maria Hill from discard
    const makeTheCall = createMakeTheCall('mtc_inst');
    const res1 = createCardInstance('res_1', '01088', 'Resource 1', CardType.RESOURCE, 0);
    const res2 = createCardInstance('res_2', '01089', 'Resource 2', CardType.RESOURCE, 0);

    p1.hand = [makeTheCall, res1, res2];

    const replayRes = dispatchAction(attackRes.state, {
      type: 'PLAY_CARD',
      playerId: 'player_1',
      cardInstanceId: 'mtc_inst',
      paymentCardInstanceIds: ['res_1', 'res_2'],
      targetInstanceId: 'maria_inst',
    });

    expect(replayRes.result.success).toBe(true);

    const p1AfterReplay = replayRes.state.players[0];
    const replayedMaria = p1AfterReplay.allies.find((a) => a.instanceId === 'maria_inst');
    expect(replayedMaria).toBeDefined();
    // Maria enters play ready and with 0 damage (RR v1.8 p. 11, 24)
    expect(replayedMaria?.exhausted).toBe(false);
    expect(replayedMaria?.tokens?.damage ?? 0).toBe(0);
    expect(replayedMaria?.statusCards?.length ?? 0).toBe(0);
    expect(p1AfterReplay.discard.some((c) => c.instanceId === 'maria_inst')).toBe(false);
  });

  it('2. Ally Defeat via Enemy Attack Defending: resets damage, status cards, and exhausted state in discard', () => {
    const ally = createCardInstance('ally_inst', '01020', 'Defender Ally', CardType.ALLY, 3, []);
    (ally.card as any).health = 3;
    ally.exhausted = true;
    ally.statusCards = [StatusCard.STUNNED];
    ally.tokens = { damage: 1 };
    ally.activeStatModifiers = [{ stat: 'ATK', amount: 1, duration: 'ROUND' }];

    player1.allies = [ally];

    // Ally defends against villain attack and takes 5 damage (lethal)
    const attackContext: AttackExecutionContext = {
      attackId: 'test_attack',
      attackerType: 'VILLAIN',
      targetPlayerId: 'player_1',
      baseAttack: 5,
      defender: { type: 'ALLY', playerId: 'player_1', allyInstanceId: 'ally_inst' },
      boostQueue: [],
      totalBoostIcons: 0,
      phase: 'CALCULATE_DAMAGE',
    };

    applyCalculatedAttackDamage(state, player1, attackContext, 5);

    // Ally removed from allies and placed in discard
    expect(player1.allies.some((a) => a.instanceId === 'ally_inst')).toBe(false);
    const discardedAlly = player1.discard.find((c) => c.instanceId === 'ally_inst');
    expect(discardedAlly).toBeDefined();

    // Verify all transient state is cleanly reset per RR v1.8 p. 15
    expect(discardedAlly?.exhausted).toBe(false);
    expect(discardedAlly?.tokens?.damage ?? 0).toBe(0);
    expect(discardedAlly?.statusCards?.length ?? 0).toBe(0);
    expect(discardedAlly?.activeStatModifiers?.length ?? 0).toBe(0);
    expect(discardedAlly?.attachments?.length ?? 0).toBe(0);
    expect(discardedAlly?.cardsUnderneath?.length ?? 0).toBe(0);
  });

  it('3. Upgrade / Support Discard & Leaves Play: resets counters, exhausted state, and stat modifiers', () => {
    const upgrade = createCardInstance('ws_inst', '01008', 'Web-Shooter', CardType.UPGRADE, 1, []);
    upgrade.exhausted = true;
    upgrade.tokens = { counters: 2 };
    upgrade.counters = { web: 2 };
    upgrade.activeStatModifiers = [{ stat: 'THW', amount: 2, duration: 'ROUND' }];
    upgrade.statusCards = [StatusCard.CONFUSED];

    player1.tableau = [upgrade];

    // Explicitly discard the upgrade via discardCardInstance
    discardCardInstance(state, upgrade, player1.id);

    expect(player1.tableau.some((c) => c.instanceId === 'ws_inst')).toBe(false);
    const discarded = player1.discard.find((c) => c.instanceId === 'ws_inst');
    expect(discarded).toBeDefined();

    // Transient attributes must be reset
    expect(discarded?.exhausted).toBe(false);
    expect(discarded?.tokens?.counters ?? 0).toBe(0);
    expect(Object.keys(discarded?.counters || {}).length).toBe(0);
    expect(discarded?.activeStatModifiers?.length ?? 0).toBe(0);
    expect(discarded?.statusCards?.length ?? 0).toBe(0);
  });

  it('4. Cross-Player Ownership Preservation: defeated ally routes to original owner discard with clean state', () => {
    // Maria Hill belongs to Player 1, currently in Player 1's discard
    const mariaHill = createCardInstance('maria_p1', '01019', 'Maria Hill', CardType.ALLY, 2, []);
    (mariaHill.card as any).health = 2;
    (mariaHill.card as any).thwartCost = 2;
    mariaHill.ownerId = 'player_1';
    player1.discard = [mariaHill];

    // Player 2 plays Make the Call targeting Maria Hill in Player 1's discard
    state.activePlayerIndex = 1;
    const makeTheCall = createMakeTheCall('mtc_p2');
    const res1 = createCardInstance('p2_res1', '01088', 'Resource 1', CardType.RESOURCE, 0);
    const res2 = createCardInstance('p2_res2', '01089', 'Resource 2', CardType.RESOURCE, 0);

    player2.hand = [makeTheCall, res1, res2];

    const playRes = dispatchAction(state, {
      type: 'PLAY_CARD',
      playerId: 'player_2',
      cardInstanceId: 'mtc_p2',
      paymentCardInstanceIds: ['p2_res1', 'p2_res2'],
      targetInstanceId: 'maria_p1',
    });

    expect(playRes.result.success).toBe(true);

    const p2AfterPlay = playRes.state.players[1];
    const playedAlly = p2AfterPlay.allies.find((a) => a.instanceId === 'maria_p1');
    expect(playedAlly).toBeDefined();
    expect(playedAlly?.ownerId).toBe('player_1');
    expect(playedAlly?.exhausted).toBe(false);

    // Player 2 commands Maria Hill to thwart, taking fatal consequential damage
    playRes.state.mainScheme.threat = 3;
    const thwartRes = dispatchAction(playRes.state, {
      type: 'ALLY_THWART',
      playerId: 'player_2',
      allyInstanceId: 'maria_p1',
      targetType: 'main_scheme',
      targetInstanceId: '01097',
    });

    expect(thwartRes.result.success).toBe(true);

    const p1End = thwartRes.state.players[0];
    const p2End = thwartRes.state.players[1];

    // Spliced from Player 2's allies
    expect(p2End.allies.some((a) => a.instanceId === 'maria_p1')).toBe(false);
    // NOT in Player 2's discard
    expect(p2End.discard.some((a) => a.instanceId === 'maria_p1')).toBe(false);
    // Placed in Player 1's discard with ownerId preserved and state reset
    const returnedAlly = p1End.discard.find((a) => a.instanceId === 'maria_p1');
    expect(returnedAlly).toBeDefined();
    expect(returnedAlly?.ownerId).toBe('player_1');
    expect(returnedAlly?.exhausted).toBe(false);
    expect(returnedAlly?.tokens?.damage ?? 0).toBe(0);
    expect(returnedAlly?.statusCards?.length ?? 0).toBe(0);
  });

  it('5. PUT_INTO_PLAY effect handler: resets card state and enters play ready with uses initialized', () => {
    // Web-Shooter in setAsideCards with dirty transient state
    const webShooter = createCardInstance(
      'ws_dirty',
      '01008',
      'Web-Shooter',
      CardType.UPGRADE,
      1,
      [],
    );
    webShooter.card.enrichment = {
      abilities: [],
      uses: { counterType: 'web', count: 3 } as any,
    };
    webShooter.exhausted = true;
    webShooter.tokens = { damage: 3, counters: 10 };
    webShooter.statusCards = [StatusCard.STUNNED];
    webShooter.activeStatModifiers = [{ stat: 'THW', amount: -2, duration: 'ROUND' }];

    player1.setAsideCards = [webShooter];

    const ability = {
      id: 'test_put_into_play',
      timing: 'ACTION' as const,
      steps: [
        {
          effect: 'PUT_INTO_PLAY',
          effectParams: {
            from: 'SET_ASIDE',
            to: 'TABLEAU',
            filter: { code: '01008' },
          },
        },
      ],
    };

    const result = executeEffect(state, ability, { playerId: 'player_1' });
    expect(result.success).toBe(true);

    const inPlayShooter = result.state.players[0].tableau.find((c) => c.instanceId === 'ws_dirty');
    expect(inPlayShooter).toBeDefined();
    // Enters play ready with clean state and properly initialized uses counters
    expect(inPlayShooter?.exhausted).toBe(false);
    expect(inPlayShooter?.tokens?.damage ?? 0).toBe(0);
    expect(inPlayShooter?.statusCards?.length ?? 0).toBe(0);
    expect(inPlayShooter?.activeStatModifiers?.length ?? 0).toBe(0);
    expect(inPlayShooter?.counters?.web).toBe(3);
  });

  it('6. resetCardState helper: preserves immutable identity attributes (instanceId, card, ownerId)', () => {
    const card = createCardInstance('card_1', '01019', 'Maria Hill', CardType.ALLY, 2, []);
    card.ownerId = 'player_orig';
    card.exhausted = true;
    card.tokens = { damage: 4, threat: 2, counters: 5 };
    card.counters = { charge: 3 };
    card.statusCards = [StatusCard.TOUGH, StatusCard.CONFUSED];
    card.activeStatModifiers = [{ stat: 'ATK', amount: 2, duration: 'ROUND' }];
    card.attachments = [createCardInstance('att_1', 'att_c', 'Att', CardType.UPGRADE)];
    card.cardsUnderneath = [createCardInstance('under_1', 'und_c', 'Under', CardType.EVENT)];

    resetCardState(card);

    // Invariants: Identity preserved
    expect(card.instanceId).toBe('card_1');
    expect(card.card.code).toBe('01019');
    expect(card.ownerId).toBe('player_orig');

    // Reset properties
    expect(card.exhausted).toBe(false);
    expect(Object.keys(card.tokens || {}).length).toBe(0);
    expect(Object.keys(card.counters || {}).length).toBe(0);
    expect(card.statusCards).toEqual([]);
    expect(card.activeStatModifiers).toEqual([]);
    expect(card.attachments).toEqual([]);
    expect(card.cardsUnderneath).toEqual([]);
  });
});
