import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { GameState, HeroCard, AlterEgoCard, SideSchemeCard } from '@engine/models';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { dispatchAction, peekDecisionPrompt } from '@engine/pipeline';

describe('Crisis Scheme Targeting (Issue #181, RR v1.8 p. 11)', () => {
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
          name: 'Spider-Man',
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

  it('Test 1: Surveillance Team with 1 Crisis side scheme -> targets side scheme, Main Scheme unaffected', () => {
    const crowdControlCard = cardCatalog.getCard('01108') as SideSchemeCard;
    state.sideSchemes = [
      {
        instanceId: 'side-cc',
        card: crowdControlCard,
        threat: 2,
      },
    ];
    state.mainScheme.threat = 5;

    const player = state.players[0];
    const survTeam = createCardInstance(cardCatalog.getCard('01064')!);
    survTeam.tokens = { damage: 0, threat: 0, counters: 3 };
    player.tableau.push(survTeam);

    const res = dispatchAction(state, {
      type: 'USE_CARD_ABILITY',
      playerId: 'p1',
      cardInstanceId: survTeam.instanceId,
      abilityId: 'surveillance_team_action',
    });

    expect(res.result.success).toBe(true);
    // Auto-targets the single eligible side scheme without prompting
    expect(peekDecisionPrompt(res.state)).toBeUndefined();

    // Side scheme threat reduced from 2 to 1
    const sideScheme = res.state.sideSchemes.find((s) => s.instanceId === 'side-cc');
    expect(sideScheme).toBeDefined();
    expect(sideScheme!.threat).toBe(1);

    // Main scheme remains unaffected
    expect(res.state.mainScheme.threat).toBe(5);

    // Surveillance Team used 1 counter and is exhausted
    const inPlaySurv = res.state.players[0].tableau.find(
      (c) => c.instanceId === survTeam.instanceId,
    )!;
    expect(inPlaySurv.tokens?.counters).toBe(2);
    expect(inPlaySurv.exhausted).toBe(true);
  });

  it('Test 2: Surveillance Team with 2 side schemes during Crisis -> creates prompt with exactly the 2 side schemes (Main Scheme excluded)', () => {
    const crowdControlCard = cardCatalog.getCard('01108') as SideSchemeCard;
    const bombScareCard = cardCatalog.getCard('01109') as SideSchemeCard;
    state.sideSchemes = [
      {
        instanceId: 'side-cc',
        card: crowdControlCard,
        threat: 2,
      },
      {
        instanceId: 'side-bs',
        card: bombScareCard,
        threat: 3,
      },
    ];
    state.mainScheme.threat = 5;

    const player = state.players[0];
    const survTeam = createCardInstance(cardCatalog.getCard('01064')!);
    survTeam.tokens = { damage: 0, threat: 0, counters: 3 };
    player.tableau.push(survTeam);

    const res = dispatchAction(state, {
      type: 'USE_CARD_ABILITY',
      playerId: 'p1',
      cardInstanceId: survTeam.instanceId,
      abilityId: 'surveillance_team_action',
    });

    expect(res.result.success).toBe(true);
    const prompt = peekDecisionPrompt(res.state);
    expect(prompt).toBeDefined();

    const optionIds = prompt!.options.map((o) => o.id);
    expect(optionIds).toHaveLength(2);
    expect(optionIds).toContain('side-cc');
    expect(optionIds).toContain('side-bs');
    expect(optionIds).not.toContain('main_scheme');
    if (res.state.mainScheme.instanceId) {
      expect(optionIds).not.toContain(res.state.mainScheme.instanceId);
    }
  });

  it('Test 3: Surveillance Team with Main Scheme + 1 non-Crisis side scheme -> creates prompt offering both Main Scheme and Side Scheme', () => {
    const bombScareCard = cardCatalog.getCard('01109') as SideSchemeCard;
    state.sideSchemes = [
      {
        instanceId: 'side-bs',
        card: bombScareCard,
        threat: 3,
      },
    ];
    state.mainScheme.threat = 5;

    const player = state.players[0];
    const survTeam = createCardInstance(cardCatalog.getCard('01064')!);
    survTeam.tokens = { damage: 0, threat: 0, counters: 3 };
    player.tableau.push(survTeam);

    const res = dispatchAction(state, {
      type: 'USE_CARD_ABILITY',
      playerId: 'p1',
      cardInstanceId: survTeam.instanceId,
      abilityId: 'surveillance_team_action',
    });

    expect(res.result.success).toBe(true);
    const prompt = peekDecisionPrompt(res.state);
    expect(prompt).toBeDefined();

    const optionIds = prompt!.options.map((o) => o.id);
    expect(optionIds).toHaveLength(2);
    expect(optionIds).toContain('side-bs');
    const mainId = res.state.mainScheme.instanceId || 'main_scheme';
    expect(optionIds.some((id) => id === 'main_scheme' || id === mainId)).toBe(true);
  });

  it('Test 4: Defeating Crisis side scheme re-enables Main Scheme targeting', () => {
    const crowdControlCard = cardCatalog.getCard('01108') as SideSchemeCard;
    state.sideSchemes = [
      {
        instanceId: 'side-cc',
        card: crowdControlCard,
        threat: 1,
      },
    ];
    state.mainScheme.threat = 5;

    const player = state.players[0];
    const survTeam = createCardInstance(cardCatalog.getCard('01064')!);
    survTeam.tokens = { damage: 0, threat: 0, counters: 3 };
    player.tableau.push(survTeam);

    // Action 1: Defeat the Crisis side scheme (threat 1 -> 0)
    const res1 = dispatchAction(state, {
      type: 'USE_CARD_ABILITY',
      playerId: 'p1',
      cardInstanceId: survTeam.instanceId,
      abilityId: 'surveillance_team_action',
    });

    expect(res1.result.success).toBe(true);
    // Side scheme is defeated and removed from play
    expect(res1.state.sideSchemes).toHaveLength(0);
    expect(res1.state.mainScheme.threat).toBe(5);

    // Ready Surveillance Team for second activation
    const inPlaySurv = res1.state.players[0].tableau.find(
      (c) => c.instanceId === survTeam.instanceId,
    )!;
    inPlaySurv.exhausted = false;

    // Action 2: With Crisis side scheme gone, Surveillance Team targets Main Scheme
    const res2 = dispatchAction(res1.state, {
      type: 'USE_CARD_ABILITY',
      playerId: 'p1',
      cardInstanceId: survTeam.instanceId,
      abilityId: 'surveillance_team_action',
    });

    expect(res2.result.success).toBe(true);
    expect(peekDecisionPrompt(res2.state)).toBeUndefined();
    // Main scheme threat reduced from 5 to 4
    expect(res2.state.mainScheme.threat).toBe(4);
    const inPlaySurv2 = res2.state.players[0].tableau.find(
      (c) => c.instanceId === survTeam.instanceId,
    )!;
    expect(inPlaySurv2.tokens?.counters).toBe(1);
    expect(inPlaySurv2.exhausted).toBe(true);
  });
});
