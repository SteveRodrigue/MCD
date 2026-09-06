import { describe, it, expect, beforeEach } from 'vitest';
import {
  GameState,
  GamePhase,
  CardType,
  FactionCode,
  CardInstance,
  PlayerState,
} from '../../src/engine/models';
import { dispatchAction } from '../../src/engine/pipeline/action-dispatcher';
import { canPlayCard } from '../../src/engine/pipeline/legality-checker';

describe('Make the Call & PLAY_CARD_FROM_ZONE (ADR-0047)', () => {
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
        code: '01094',
        name: 'Rhino',
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
      log: [],
    } as unknown as GameState;
  });

  it('plays an ally from player discard directly via Option B (atomic targeted dispatch)', () => {
    // Make the Call event
    const makeTheCall = createCardInstance(
      'mtc_inst',
      '01071',
      'Make the Call',
      CardType.EVENT,
      0,
      [
        {
          id: 'make_the_call',
          timing: 'ACTION',
          steps: [
            {
              effect: 'PLAY_CARD_FROM_ZONE',
              params: {
                source: 'ANY_PLAYER_DISCARD',
                filter: { types: ['ally'] },
                costMode: 'PRINTED_COST',
                destination: 'TABLEAU',
                control: 'SELF',
              },
            },
          ],
        },
      ],
    );

    // Maria Hill ally in discard (cost 2)
    const mariaHill = createCardInstance('maria_inst', '01019', 'Maria Hill', CardType.ALLY, 2, []);

    // 2 payment cards in hand
    const res1 = createCardInstance('res_1', '01088', 'Resource 1', CardType.RESOURCE, 0);
    const res2 = createCardInstance('res_2', '01089', 'Resource 2', CardType.RESOURCE, 0);

    player1.hand = [makeTheCall, res1, res2];
    player1.discard = [mariaHill];

    // Dispatch PLAY_CARD for Make the Call targeting Maria Hill in discard with 2 payment cards
    const { state: nextState, result } = dispatchAction(state, {
      type: 'PLAY_CARD',
      playerId: 'player_1',
      cardInstanceId: 'mtc_inst',
      paymentCardInstanceIds: ['res_1', 'res_2'],
      targetInstanceId: 'maria_inst',
    });

    expect(result.success).toBe(true);

    const p1 = nextState.players[0];
    // Maria Hill enters player 1's allies array
    expect(p1.allies.some((a) => a.instanceId === 'maria_inst')).toBe(true);
    // Maria Hill spliced from discard
    expect(p1.discard.some((a) => a.instanceId === 'maria_inst')).toBe(false);
    // Make the Call and resources were discarded
    expect(p1.discard.some((c) => c.instanceId === 'mtc_inst')).toBe(true);
    expect(p1.discard.some((c) => c.instanceId === 'res_1')).toBe(true);
    expect(p1.discard.some((c) => c.instanceId === 'res_2')).toBe(true);
    expect(p1.hand.length).toBe(0);
  });

  it('plays an ally from another player discard under calling player control', () => {
    const makeTheCall = createCardInstance(
      'mtc_inst',
      '01071',
      'Make the Call',
      CardType.EVENT,
      0,
      [
        {
          id: 'make_the_call',
          timing: 'ACTION',
          steps: [
            {
              effect: 'PLAY_CARD_FROM_ZONE',
              params: {
                source: 'ANY_PLAYER_DISCARD',
                filter: { types: ['ally'] },
                costMode: 'PRINTED_COST',
                destination: 'TABLEAU',
                control: 'SELF',
              },
            },
          ],
        },
      ],
    );

    // Nick Fury ally in Player 2 discard
    const nickFury = createCardInstance('nick_inst', '01084', 'Nick Fury', CardType.ALLY, 4, []);
    player2.discard = [nickFury];

    // Player 1 has 4 resources
    const resCards = [
      createCardInstance('r1', '01088', 'R1', CardType.RESOURCE, 0),
      createCardInstance('r2', '01088', 'R2', CardType.RESOURCE, 0),
      createCardInstance('r3', '01088', 'R3', CardType.RESOURCE, 0),
      createCardInstance('r4', '01088', 'R4', CardType.RESOURCE, 0),
    ];
    player1.hand = [makeTheCall, ...resCards];

    const { state: nextState, result } = dispatchAction(state, {
      type: 'PLAY_CARD',
      playerId: 'player_1',
      cardInstanceId: 'mtc_inst',
      paymentCardInstanceIds: ['r1', 'r2', 'r3', 'r4'],
      targetInstanceId: 'nick_inst',
    });

    expect(result.success).toBe(true);

    const p1 = nextState.players[0];
    const p2 = nextState.players[1];

    // Nick Fury is in Player 1's allies
    expect(p1.allies.some((a) => a.instanceId === 'nick_inst')).toBe(true);
    // Spliced from Player 2 discard
    expect(p2.discard.some((a) => a.instanceId === 'nick_inst')).toBe(false);
  });

  it('prompts via Option A when targetInstanceId is omitted and resolves selection', () => {
    const makeTheCall = createCardInstance(
      'mtc_inst',
      '01071',
      'Make the Call',
      CardType.EVENT,
      0,
      [
        {
          id: 'make_the_call',
          timing: 'ACTION',
          steps: [
            {
              effect: 'PLAY_CARD_FROM_ZONE',
              params: {
                source: 'ANY_PLAYER_DISCARD',
                filter: { types: ['ally'] },
                costMode: 'PRINTED_COST',
                destination: 'TABLEAU',
                control: 'SELF',
              },
            },
          ],
        },
      ],
    );

    const hawkeye = createCardInstance('hawk_inst', '01066', 'Hawkeye', CardType.ALLY, 3, []);
    player1.discard = [hawkeye];

    const res1 = createCardInstance('res_1', '01088', 'Res 1', CardType.RESOURCE, 0);
    const res2 = createCardInstance('res_2', '01088', 'Res 2', CardType.RESOURCE, 0);
    const res3 = createCardInstance('res_3', '01088', 'Res 3', CardType.RESOURCE, 0);
    player1.hand = [makeTheCall, res1, res2, res3];

    // Dispatch without targetInstanceId -> enqueues decision prompt
    const { state: promptState } = dispatchAction(state, {
      type: 'PLAY_CARD',
      playerId: 'player_1',
      cardInstanceId: 'mtc_inst',
      paymentCardInstanceIds: [],
    });

    expect(promptState.pendingDecisionPrompt).toBeDefined();
    expect(promptState.pendingDecisionPrompt?.options.some((o) => o.id === 'hawk_inst')).toBe(true);

    // Resolve decision prompt selecting Hawkeye
    const { state: resolvedState, result: resolveResult } = dispatchAction(promptState, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: 'player_1',
      selectedOptionId: 'hawk_inst',
    });

    expect(resolveResult.success).toBe(true);
    const p1 = resolvedState.players[0];
    expect(p1.allies.some((a) => a.instanceId === 'hawk_inst')).toBe(true);
    expect(p1.discard.some((a) => a.instanceId === 'hawk_inst')).toBe(false);
  });

  it('allows playing a card with sourceZone directly via canPlayCard and PLAY_CARD (Lockjaw pattern)', () => {
    // Lockjaw ally in discard (cost 4)
    const lockjaw = createCardInstance('lockjaw_inst', '05018', 'Lockjaw', CardType.ALLY, 4, []);
    player1.discard = [lockjaw];

    const resCards = [
      createCardInstance('r1', '01088', 'R1', CardType.RESOURCE, 0),
      createCardInstance('r2', '01088', 'R2', CardType.RESOURCE, 0),
      createCardInstance('r3', '01088', 'R3', CardType.RESOURCE, 0),
      createCardInstance('r4', '01088', 'R4', CardType.RESOURCE, 0),
    ];
    player1.hand = [...resCards];

    // Check canPlayCard with sourceZone: PLAYER_DISCARD
    const check = canPlayCard(
      state,
      'player_1',
      'lockjaw_inst',
      ['r1', 'r2', 'r3', 'r4'],
      [],
      'PLAYER_DISCARD',
    );
    expect(check.allowed).toBe(true);

    // Dispatch PLAY_CARD with sourceZone: PLAYER_DISCARD
    const { state: nextState, result } = dispatchAction(state, {
      type: 'PLAY_CARD',
      playerId: 'player_1',
      cardInstanceId: 'lockjaw_inst',
      paymentCardInstanceIds: ['r1', 'r2', 'r3', 'r4'],
      sourceZone: 'PLAYER_DISCARD',
    });

    expect(result.success).toBe(true);
    const p1 = nextState.players[0];
    expect(p1.allies.some((a) => a.instanceId === 'lockjaw_inst')).toBe(true);
    expect(p1.discard.some((a) => a.instanceId === 'lockjaw_inst')).toBe(false);
  });

  it('rejects playing ally if ally limit is reached', () => {
    // Fill allies to limit 3
    player1.allies = [
      createCardInstance('a1', '01', 'A1', CardType.ALLY, 1),
      createCardInstance('a2', '02', 'A2', CardType.ALLY, 1),
      createCardInstance('a3', '03', 'A3', CardType.ALLY, 1),
    ];

    const lockjaw = createCardInstance('lockjaw_inst', '05018', 'Lockjaw', CardType.ALLY, 4, []);
    player1.discard = [lockjaw];

    const check = canPlayCard(state, 'player_1', 'lockjaw_inst', [], [], 'PLAYER_DISCARD');
    expect(check.allowed).toBe(false);
    expect(check.reason).toContain('Ally limit reached');
  });
});
