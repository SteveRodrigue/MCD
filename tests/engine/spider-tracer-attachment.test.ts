import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { GameState, HeroCard, AlterEgoCard, SideSchemeState } from '../../src/engine/models';
import { setupGame, createCardInstance } from '../../src/engine/state/game-setup';
import { dispatchAction, peekDecisionPrompt } from '../../src/engine/pipeline';

describe('Spider-Tracer & Engaged Minion Attachment Engine Invariants (Issue #134)', () => {
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
          name: 'Spider-Man',
          hero: spiderManHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
        {
          id: 'p2',
          name: 'Captain Marvel',
          hero: captainMarvelHero,
          alterEgo: carolDanversAlterEgo,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      skipMulligan: true,
    });

    state.players[0].currentForm = 'hero';
    state.players[0].activeFormCard = spiderManHero;
    state.players[1].currentForm = 'hero';
    state.players[1].activeFormCard = captainMarvelHero;
  });

  it('Test 1: Prompts choice between 2 minions engaged with active player, attaches to chosen, and logs card.attached.to_host', () => {
    const minionA = createCardInstance(cardCatalog.getCard('01101')!); // Hydra Mercenary
    const minionB = createCardInstance(cardCatalog.getCard('01110')!); // Armored Rhino
    state.players[0].engagedMinions = [minionA, minionB];

    const tracer = createCardInstance(cardCatalog.getCard('01007')!); // Spider-Tracer
    const paymentCard = createCardInstance(cardCatalog.getCard('01005')!);
    state.players[0].hand = [tracer, paymentCard];

    // Play without targetInstanceId -> enqueues prompt
    const playRes = dispatchAction(state, {
      type: 'PLAY_CARD',
      playerId: 'p1',
      cardInstanceId: tracer.instanceId,
      paymentCardInstanceIds: [paymentCard.instanceId],
    });

    expect(playRes.result.success).toBe(true);
    expect(peekDecisionPrompt(playRes.state)).toBeDefined();
    const prompt = peekDecisionPrompt(playRes.state)!;
    expect(prompt.options.some((o) => o.id === minionA.instanceId)).toBe(true);
    expect(prompt.options.some((o) => o.id === minionB.instanceId)).toBe(true);

    // Resolve choice for Minion A
    const resolveRes = dispatchAction(playRes.state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: 'p1',
      selectedOptionId: minionA.instanceId,
    });

    expect(resolveRes.result.success).toBe(true);
    const mAInState = resolveRes.state.players[0].engagedMinions.find(
      (m) => m.instanceId === minionA.instanceId,
    )!;
    const mBInState = resolveRes.state.players[0].engagedMinions.find(
      (m) => m.instanceId === minionB.instanceId,
    )!;
    expect(mAInState.attachments?.some((att) => att.card.code === '01007')).toBe(true);
    expect(mBInState.attachments || []).toHaveLength(0);

    // Verify card.attached.to_host log entry
    const attachLog = resolveRes.state.log.find((l) => l.key === 'card.attached.to_host');
    expect(attachLog).toBeDefined();
    expect(attachLog?.params?.player).toBe('Spider-Man');
    expect(attachLog?.params?.card).toBe('Spider-Tracer');
    expect(attachLog?.params?.host).toContain(minionA.card.name);
    expect(attachLog?.params?.target).toContain(minionA.card.name);

    // Also verify direct targeting bypassing prompt
    const tracer2 = createCardInstance(cardCatalog.getCard('01007')!);
    const payment2 = createCardInstance(cardCatalog.getCard('01005')!);
    resolveRes.state.players[0].hand = [tracer2, payment2];

    const directRes = dispatchAction(resolveRes.state, {
      type: 'PLAY_CARD',
      playerId: 'p1',
      cardInstanceId: tracer2.instanceId,
      paymentCardInstanceIds: [payment2.instanceId],
      targetInstanceId: minionB.instanceId,
    });

    expect(directRes.result.success).toBe(true);
    const mBAfterDirect = directRes.state.players[0].engagedMinions.find(
      (m) => m.instanceId === minionB.instanceId,
    )!;
    expect(mBAfterDirect.attachments?.some((att) => att.card.code === '01007')).toBe(true);
    const directLog = directRes.state.log[directRes.state.log.length - 1];
    expect(directLog.key).toBe('card.attached.to_host');
    expect(directLog.params?.card).toBe('Spider-Tracer');
    expect(directLog.params?.host).toContain(minionB.card.name);
  });

  it('Test 2: Attaches to minion engaged on another player only (tablewide minion legality satisfied)', () => {
    // P1 has 0 minions; P2 has 1 minion
    const minionC = createCardInstance(cardCatalog.getCard('01101')!);
    state.players[0].engagedMinions = [];
    state.players[1].engagedMinions = [minionC];

    const tracer = createCardInstance(cardCatalog.getCard('01007')!);
    const paymentCard = createCardInstance(cardCatalog.getCard('01005')!);
    state.players[0].hand = [tracer, paymentCard];

    // P1 plays Spider-Tracer -> exactly 1 minion in play tablewide, auto-attaches to Minion C on P2
    const res = dispatchAction(state, {
      type: 'PLAY_CARD',
      playerId: 'p1',
      cardInstanceId: tracer.instanceId,
      paymentCardInstanceIds: [paymentCard.instanceId],
    });

    expect(res.result.success).toBe(true);
    const p2Minion = res.state.players[1].engagedMinions[0];
    expect(p2Minion.attachments?.some((att) => att.card.code === '01007')).toBe(true);

    const logEntry = res.state.log.find((l) => l.key === 'card.attached.to_host');
    expect(logEntry).toBeDefined();
    expect(logEntry?.params?.player).toBe('Spider-Man');
    expect(logEntry?.params?.card).toBe('Spider-Tracer');
    expect(logEntry?.params?.host).toContain(minionC.card.name);
  });

  it('Test 3: Offers choices across both players when minions are engaged on both', () => {
    const minionA = createCardInstance(cardCatalog.getCard('01101')!); // P1 minion
    const minionB = createCardInstance(cardCatalog.getCard('01110')!); // P2 minion
    state.players[0].engagedMinions = [minionA];
    state.players[1].engagedMinions = [minionB];

    const tracer = createCardInstance(cardCatalog.getCard('01007')!);
    const paymentCard = createCardInstance(cardCatalog.getCard('01005')!);
    state.players[0].hand = [tracer, paymentCard];

    const playRes = dispatchAction(state, {
      type: 'PLAY_CARD',
      playerId: 'p1',
      cardInstanceId: tracer.instanceId,
      paymentCardInstanceIds: [paymentCard.instanceId],
    });

    expect(playRes.result.success).toBe(true);
    const prompt = peekDecisionPrompt(playRes.state);
    expect(prompt).toBeDefined();
    expect(prompt!.options.map((o) => o.id)).toEqual(
      expect.arrayContaining([minionA.instanceId, minionB.instanceId]),
    );

    // Resolve choice for Minion B on P2
    const resolveRes = dispatchAction(playRes.state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: 'p1',
      selectedOptionId: minionB.instanceId,
    });

    expect(resolveRes.result.success).toBe(true);
    const p2Minion = resolveRes.state.players[1].engagedMinions.find(
      (m) => m.instanceId === minionB.instanceId,
    )!;
    const p1Minion = resolveRes.state.players[0].engagedMinions.find(
      (m) => m.instanceId === minionA.instanceId,
    )!;
    expect(p2Minion.attachments?.some((att) => att.card.code === '01007')).toBe(true);
    expect(p1Minion.attachments || []).toHaveLength(0);

    const logEntry = resolveRes.state.log.find((l) => l.key === 'card.attached.to_host');
    expect(logEntry).toBeDefined();
    expect(logEntry?.params?.card).toBe('Spider-Tracer');
    expect(logEntry?.params?.host).toContain(minionB.card.name);
  });

  it('Test 4: Cross-player owner discard retention - Spider-Tracer owned by P1 on P2 minion routes to P1 discard on defeat', () => {
    const minionC = createCardInstance(cardCatalog.getCard('01101')!); // 3 HP
    state.players[0].engagedMinions = [];
    state.players[1].engagedMinions = [minionC];

    const tracer = createCardInstance(cardCatalog.getCard('01007')!);
    const paymentCard = createCardInstance(cardCatalog.getCard('01005')!);
    state.players[0].hand = [tracer, paymentCard];

    // P1 plays Spider-Tracer on P2's minion
    const playRes = dispatchAction(state, {
      type: 'PLAY_CARD',
      playerId: 'p1',
      cardInstanceId: tracer.instanceId,
      paymentCardInstanceIds: [paymentCard.instanceId],
    });

    expect(playRes.result.success).toBe(true);
    const p2MinionInState = playRes.state.players[1].engagedMinions[0];
    const attachedTracer = p2MinionInState.attachments?.find((att) => att.card.code === '01007');
    expect(attachedTracer).toBeDefined();
    expect((attachedTracer as any).ownerId).toBe('p1');

    // Defeat Minion C via P1 attacking it
    p2MinionInState.tokens = { damage: 1 }; // 1 + 2 = 3 (defeats 3 HP Hydra Mercenary)
    const attackRes = dispatchAction(playRes.state, {
      type: 'BASIC_ATTACK',
      playerId: 'p1',
      targetType: 'minion',
      targetInstanceId: p2MinionInState.instanceId,
    });

    expect(attackRes.result.success).toBe(true);
    // Minion C removed from P2's engaged minions
    expect(attackRes.state.players[1].engagedMinions).toHaveLength(0);

    // Spider-Tracer must be in P1's discard pile, NOT P2's discard pile
    expect(attackRes.state.players[0].discard.some((c) => c.card.code === '01007')).toBe(true);
    expect(attackRes.state.players[1].discard.some((c) => c.card.code === '01007')).toBe(false);
  });

  it('Test 5: Crisis side scheme gating on defeat - removes threat from Crisis side scheme when Main Scheme is blocked', () => {
    const minion = createCardInstance(cardCatalog.getCard('01101')!); // 3 HP
    const tracer = createCardInstance(cardCatalog.getCard('01007')!);
    tracer.ownerId = 'p1';
    minion.attachments = [tracer];
    state.players[0].engagedMinions = [minion];

    // Main scheme at 4 threat
    state.mainScheme.threat = 4;

    // Side scheme with Crisis icon: 01108 Crowd Control (3 threat, hasCrisis: true)
    const crisisSchemeCard = cardCatalog.getCard('01108')!;
    const crisisScheme: SideSchemeState = {
      instanceId: 'side_scheme_crowd_control',
      card: crisisSchemeCard as any,
      threat: 3,
    };
    state.sideSchemes = [crisisScheme];

    // Defeat minion (2 damage existing + 2 from attack = 4 >= 3 HP)
    minion.tokens = { damage: 2 };
    const res = dispatchAction(state, {
      type: 'BASIC_ATTACK',
      playerId: 'p1',
      targetType: 'minion',
      targetInstanceId: minion.instanceId,
    });

    expect(res.result.success).toBe(true);
    // Minion is defeated
    expect(res.state.players[0].engagedMinions).toHaveLength(0);

    // Main Scheme threat was NOT touched due to Crisis
    expect(res.state.mainScheme.threat).toBe(4);

    // Crisis side scheme received the 3 threat removal and was defeated (3 - 3 = 0)
    expect(res.state.sideSchemes).toHaveLength(0);
    // Spider-Tracer in P1 discard
    expect(res.state.players[0].discard.some((c) => c.card.code === '01007')).toBe(true);
  });

  it('Test 6: Multiple non-crisis schemes gating - queues choose_scheme prompt when both Main and Side schemes are eligible', () => {
    const minion = createCardInstance(cardCatalog.getCard('01101')!); // 3 HP
    const tracer = createCardInstance(cardCatalog.getCard('01007')!);
    tracer.ownerId = 'p1';
    minion.attachments = [tracer];
    state.players[0].engagedMinions = [minion];

    state.mainScheme.threat = 4;

    // Side scheme with NO Crisis icon: 01109 Bomb Scare (3 threat, hasCrisis: false)
    const nonCrisisSchemeCard = cardCatalog.getCard('01109')!;
    const nonCrisisScheme: SideSchemeState = {
      instanceId: 'side_scheme_bomb_scare',
      card: nonCrisisSchemeCard as any,
      threat: 3,
    };
    state.sideSchemes = [nonCrisisScheme];

    minion.tokens = { damage: 2 };
    const res = dispatchAction(state, {
      type: 'BASIC_ATTACK',
      playerId: 'p1',
      targetType: 'minion',
      targetInstanceId: minion.instanceId,
    });

    expect(res.result.success).toBe(true);
    // Both schemes eligible -> queues decision prompt to choose scheme
    const prompt = peekDecisionPrompt(res.state);
    expect(prompt).toBeDefined();
    expect(prompt?.title).toContain('Choose a Scheme');
    expect(prompt?.options.map((o) => o.id)).toEqual(
      expect.arrayContaining(['main_scheme', nonCrisisScheme.instanceId]),
    );

    // Resolve choice for Main Scheme
    const resolveRes = dispatchAction(res.state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: 'p1',
      selectedOptionId: 'main_scheme',
    });

    expect(resolveRes.result.success).toBe(true);
    // Main scheme threat reduced: 4 - 3 = 1
    expect(resolveRes.state.mainScheme.threat).toBe(1);
    // Bomb Scare threat unchanged: 3
    expect(resolveRes.state.sideSchemes[0].threat).toBe(3);
  });
});
