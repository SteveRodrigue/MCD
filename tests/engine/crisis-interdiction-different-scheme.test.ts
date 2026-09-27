import { describe, it, expect } from 'vitest';
import { dispatchAction } from '../../src/engine/pipeline/action-dispatcher';
import { executeSequence } from '../../src/engine/effects';
import { getCardEnrichment } from '../../src/data/supplemental';
import { CardType } from '../../src/engine/models/enums';
import type {
  GameState,
  PlayerState,
  CardInstance,
  SideSchemeState,
} from '../../src/engine/models';

function createCaptainMarvelPlayer(aerial: boolean = true): PlayerState {
  return {
    id: 'player-1',
    name: 'Captain Marvel',
    hero: {
      code: '01010a',
      name: 'Captain Marvel',
      type: 'hero',
      traits: aerial ? ['Avenger', 'Aerial'] : ['Avenger'],
      attack: 2,
      thwart: 2,
      defense: 1,
      health: 12,
      hitPoints: 12,
    } as any,
    alterEgo: {
      code: '01010b',
      name: 'Carol Danvers',
      type: 'alter_ego',
      traits: ['S.H.I.E.L.D.', 'Soldier'],
      health: 12,
      hitPoints: 12,
      recover: 4,
    } as any,
    currentForm: 'hero',
    health: 12,
    maxHealth: 12,
    deck: [],
    hand: [],
    discard: [],
    tableau: [],
    allies: [],
    engagedMinions: [],
    activeFormCard: {
      code: '01010a',
      name: 'Captain Marvel',
      type: 'hero',
      traits: aerial ? ['Avenger', 'Aerial'] : ['Avenger'],
    } as any,
    availableForms: [],
    exhausted: false,
    statusCards: [],
  } as any as PlayerState;
}

function createMockState(options: {
  aerial?: boolean;
  mainThreat?: number;
  sideSchemes?: SideSchemeState[];
}): GameState {
  const player = createCaptainMarvelPlayer(options.aerial ?? true);
  return {
    scenarioId: 'rhino',
    scenario: { id: 'rhino', name: 'Rhino' } as any,
    villain: {
      id: 'rhino-1',
      card: { code: '01094', name: 'Rhino', hitPoints: 14 } as any,
      health: 14,
      maxHealth: 14,
      statusCards: [],
      attachments: [],
    } as any,
    mainScheme: {
      id: 'main-scheme',
      instanceId: 'main-scheme',
      card: { code: '01097', name: 'The Break-In!' } as any,
      threat: options.mainThreat ?? 5,
      targetThreat: 7,
    } as any,
    sideSchemes: options.sideSchemes || [],
    players: [player],
    activePlayerId: player.id,
    phase: 'PLAYER_PHASE' as any,
    roundNumber: 1,
    firstPlayerIndex: 0,
    log: [],
  } as any as GameState;
}

function createCrisisInterdictionCard(): CardInstance {
  const enrichment = getCardEnrichment('01012')!;
  return {
    instanceId: 'crisis-card-1',
    card: {
      code: '01012',
      name: 'Crisis Interdiction',
      type: CardType.EVENT,
      cost: 0,
      faction: 'hero',
      enrichment,
    } as any,
    ownerId: 'player-1',
    exhausted: false,
  };
}

describe('Crisis Interdiction (01012) — Generic distinctFrom: PREVIOUS_TARGET', () => {
  it('1) Solo Scheme Fizzle: Captain Marvel with Aerial plays Crisis Interdiction when only Main Scheme is in play', () => {
    const state = createMockState({ aerial: true, mainThreat: 5, sideSchemes: [] });
    const crisisCard = createCrisisInterdictionCard();
    state.players[0].hand.push(crisisCard);

    const res = dispatchAction(state, {
      type: 'PLAY_CARD',
      playerId: 'player-1',
      cardInstanceId: crisisCard.instanceId,
      paymentCardInstanceIds: [],
    });

    expect(res.result.success).toBe(true);
    // Step 1 removes 2 threat from Main Scheme (5 -> 3)
    // Step 2 fizzles because no different scheme is in play (removes 0 threat)
    expect(res.state.mainScheme.threat).toBe(3);
    expect(res.state.pendingDecisionPrompt).toBeUndefined();

    // Verify directly via executeSequence
    const enrichment = getCardEnrichment('01012')!;
    const directState = createMockState({ aerial: true, mainThreat: 5, sideSchemes: [] });
    const seqRes = executeSequence(directState, enrichment.abilities![0].steps, {
      playerId: 'player-1',
    });
    expect(seqRes.success).toBe(true);
    expect(seqRes.state.mainScheme.threat).toBe(3);
  });

  it('2) Auto-Target Single Different Scheme: Main Scheme + 1 Side Scheme in play. Step 1 targets Side Scheme, Step 2 automatically removes 2 from Main Scheme', () => {
    const sideScheme: SideSchemeState = {
      instanceId: 'side-1',
      card: { code: '01098', name: 'Crowd Control' } as any,
      threat: 4,
    };
    const state = createMockState({ aerial: true, mainThreat: 5, sideSchemes: [sideScheme] });
    const crisisCard = createCrisisInterdictionCard();
    state.players[0].hand.push(crisisCard);

    const res = dispatchAction(state, {
      type: 'PLAY_CARD',
      playerId: 'player-1',
      cardInstanceId: crisisCard.instanceId,
      paymentCardInstanceIds: [],
      targetInstanceId: 'side-1',
    });

    expect(res.result.success).toBe(true);
    // Step 1 removes 2 from Side Scheme (4 -> 2)
    expect(res.state.sideSchemes[0].threat).toBe(2);
    // Step 2 automatically removes 2 from Main Scheme without prompting
    expect(res.state.mainScheme.threat).toBe(3);
    expect(res.state.pendingDecisionPrompt).toBeUndefined();
  });

  it('2b) Auto-Target Single Different Scheme: Step 1 targets Main Scheme, Step 2 automatically removes 2 from Side Scheme', () => {
    const sideScheme: SideSchemeState = {
      instanceId: 'side-1',
      card: { code: '01098', name: 'Crowd Control' } as any,
      threat: 4,
    };
    const state = createMockState({ aerial: true, mainThreat: 5, sideSchemes: [sideScheme] });
    const crisisCard = createCrisisInterdictionCard();
    state.players[0].hand.push(crisisCard);

    const res = dispatchAction(state, {
      type: 'PLAY_CARD',
      playerId: 'player-1',
      cardInstanceId: crisisCard.instanceId,
      paymentCardInstanceIds: [],
      targetInstanceId: 'main-scheme',
    });

    expect(res.result.success).toBe(true);
    // Step 1 removes 2 from Main Scheme (5 -> 3)
    expect(res.state.mainScheme.threat).toBe(3);
    // Step 2 automatically removes 2 from Side Scheme without prompting
    expect(res.state.sideSchemes[0].threat).toBe(2);
    expect(res.state.pendingDecisionPrompt).toBeUndefined();
  });

  it('3) Multi-Scheme Decision Prompt Exclusion: Main Scheme + 2 Side Schemes in play. Step 1 targets Side A; Step 2 enqueues prompt with Main Scheme and Side B (Side A excluded)', () => {
    const sideA: SideSchemeState = {
      instanceId: 'side-A',
      card: { code: 'side_a_code', name: 'Side Scheme A' } as any,
      threat: 4,
    };
    const sideB: SideSchemeState = {
      instanceId: 'side-B',
      card: { code: 'side_b_code', name: 'Side Scheme B' } as any,
      threat: 4,
    };
    const state = createMockState({ aerial: true, mainThreat: 5, sideSchemes: [sideA, sideB] });
    const crisisCard = createCrisisInterdictionCard();
    state.players[0].hand.push(crisisCard);

    const res = dispatchAction(state, {
      type: 'PLAY_CARD',
      playerId: 'player-1',
      cardInstanceId: crisisCard.instanceId,
      paymentCardInstanceIds: [],
      targetInstanceId: 'side-A',
    });

    expect(res.result.success).toBe(true);
    // Step 1 removes 2 from Side A (4 -> 2)
    expect(res.state.sideSchemes.find((s) => s.instanceId === 'side-A')?.threat).toBe(2);
    // Main Scheme and Side B are unaffected before prompt resolution
    expect(res.state.mainScheme.threat).toBe(5);
    expect(res.state.sideSchemes.find((s) => s.instanceId === 'side-B')?.threat).toBe(4);

    // Decision prompt must be pending
    expect(res.state.pendingDecisionPrompt).toBeDefined();
    const prompt = res.state.pendingDecisionPrompt!;
    const optionIds = prompt.options.map((o) => o.id);

    // Side Scheme A must be excluded
    expect(optionIds).not.toContain('side-A');
    // Must contain Main Scheme and Side Scheme B
    expect(optionIds).toContain('main_scheme');
    expect(optionIds).toContain('side-B');
    expect(prompt.options.length).toBe(2);
  });

  it('4) Prompt Resolution: Resolving that prompt removes 2 threat from the selected different scheme', () => {
    const sideA: SideSchemeState = {
      instanceId: 'side-A',
      card: { code: 'side_a_code', name: 'Side Scheme A' } as any,
      threat: 4,
    };
    const sideB: SideSchemeState = {
      instanceId: 'side-B',
      card: { code: 'side_b_code', name: 'Side Scheme B' } as any,
      threat: 4,
    };
    const state = createMockState({ aerial: true, mainThreat: 5, sideSchemes: [sideA, sideB] });
    const crisisCard = createCrisisInterdictionCard();
    state.players[0].hand.push(crisisCard);

    const playRes = dispatchAction(state, {
      type: 'PLAY_CARD',
      playerId: 'player-1',
      cardInstanceId: crisisCard.instanceId,
      paymentCardInstanceIds: [],
      targetInstanceId: 'side-A',
    });

    expect(playRes.state.pendingDecisionPrompt).toBeDefined();

    // Player selects Side Scheme B
    const resolveRes = dispatchAction(playRes.state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: 'player-1',
      selectedOptionId: 'side-B',
    });

    expect(resolveRes.result.success).toBe(true);
    expect(resolveRes.state.pendingDecisionPrompt).toBeUndefined();

    // Side Scheme A threat was reduced by 2 in Step 1 (4 -> 2)
    expect(resolveRes.state.sideSchemes.find((s) => s.instanceId === 'side-A')?.threat).toBe(2);
    // Side Scheme B threat was reduced by 2 from prompt resolution (4 -> 2)
    expect(resolveRes.state.sideSchemes.find((s) => s.instanceId === 'side-B')?.threat).toBe(2);
    // Main Scheme threat remains untouched (5)
    expect(resolveRes.state.mainScheme.threat).toBe(5);
  });

  it('4b) Prompt Resolution: Resolving that prompt selecting Main Scheme removes 2 threat from Main Scheme', () => {
    const sideA: SideSchemeState = {
      instanceId: 'side-A',
      card: { code: 'side_a_code', name: 'Side Scheme A' } as any,
      threat: 4,
    };
    const sideB: SideSchemeState = {
      instanceId: 'side-B',
      card: { code: 'side_b_code', name: 'Side Scheme B' } as any,
      threat: 4,
    };
    const state = createMockState({ aerial: true, mainThreat: 5, sideSchemes: [sideA, sideB] });
    const crisisCard = createCrisisInterdictionCard();
    state.players[0].hand.push(crisisCard);

    const playRes = dispatchAction(state, {
      type: 'PLAY_CARD',
      playerId: 'player-1',
      cardInstanceId: crisisCard.instanceId,
      paymentCardInstanceIds: [],
      targetInstanceId: 'side-A',
    });

    // Player selects Main Scheme
    const resolveRes = dispatchAction(playRes.state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: 'player-1',
      selectedOptionId: 'main_scheme',
    });

    expect(resolveRes.result.success).toBe(true);
    expect(resolveRes.state.pendingDecisionPrompt).toBeUndefined();

    // Side Scheme A threat was reduced by 2 in Step 1 (4 -> 2)
    expect(resolveRes.state.sideSchemes.find((s) => s.instanceId === 'side-A')?.threat).toBe(2);
    // Main Scheme threat was reduced by 2 from prompt resolution (5 -> 3)
    expect(resolveRes.state.mainScheme.threat).toBe(3);
    // Side Scheme B threat remains untouched (4)
    expect(resolveRes.state.sideSchemes.find((s) => s.instanceId === 'side-B')?.threat).toBe(4);
  });

  it('5) Non-Aerial Gating: Captain Marvel without Aerial plays Crisis Interdiction. Step 1 removes 2 threat, Step 2 does not run', () => {
    const sideScheme: SideSchemeState = {
      instanceId: 'side-1',
      card: { code: '01098', name: 'Crowd Control' } as any,
      threat: 4,
    };
    const state = createMockState({ aerial: false, mainThreat: 5, sideSchemes: [sideScheme] });
    const crisisCard = createCrisisInterdictionCard();
    state.players[0].hand.push(crisisCard);

    const res = dispatchAction(state, {
      type: 'PLAY_CARD',
      playerId: 'player-1',
      cardInstanceId: crisisCard.instanceId,
      paymentCardInstanceIds: [],
      targetInstanceId: 'main-scheme',
    });

    expect(res.result.success).toBe(true);
    // Step 1 removes 2 from Main Scheme (5 -> 3)
    expect(res.state.mainScheme.threat).toBe(3);
    // Step 2 does not run because player lacks Aerial trait -> Side Scheme threat remains 4
    expect(res.state.sideSchemes[0].threat).toBe(4);
    expect(res.state.pendingDecisionPrompt).toBeUndefined();
  });
});
