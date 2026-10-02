import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import {
  GameState,
  HeroCard,
  AlterEgoCard,
  SideSchemeCard,
  CardType,
  Keyword,
  CardInstance,
} from '@engine/models';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { canBasicThwart, hasCrisisInPlay } from '@engine/pipeline/legality-checker';
import { dispatchAction, peekDecisionPrompt } from '@engine/pipeline';
import { executeSequence } from '@engine/effects';
import { resolveActiveEncounterCardAfterInterrupt } from '@engine/pipeline/villain-phase';

describe('Keyword Icon: Crisis (Rules Reference v1.8 p. 11)', () => {
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

  it('1) Crowd Control (01108) data invariant: base threat 2, hasCrisis true, no When Revealed ability', () => {
    const crowdControl = cardCatalog.getCard('01108') as SideSchemeCard;
    expect(crowdControl).toBeDefined();
    expect(crowdControl.baseThreat).toBe(2);
    expect(crowdControl.hasCrisis).toBe(true);
    expect(crowdControl.enrichment?.abilities).toEqual([]);
  });

  it('2) Crowd Control (01108) with Crisis icon prevents basic thwart on main scheme', () => {
    const sideSchemeCard = cardCatalog.getCard('01108') as SideSchemeCard;
    const sideSchemeInstance = createCardInstance(sideSchemeCard);

    state.sideSchemes = [
      {
        instanceId: sideSchemeInstance.instanceId,
        card: sideSchemeCard,
        threat: 2,
      },
    ];

    state.mainScheme.threat = 5;

    // Cannot thwart main scheme while Crisis is active
    const check = canBasicThwart(state, 'p1', 'main_scheme');
    expect(check.allowed).toBe(false);
    expect(check.reason).toContain('Crisis');

    // Attempting to dispatch basic thwart on main scheme fails
    const res = dispatchAction(state, {
      type: 'BASIC_THWART',
      playerId: 'p1',
      targetType: 'main_scheme',
    });
    expect(res.result.success).toBe(false);

    // Can thwart the side scheme directly
    const sideCheck = canBasicThwart(state, 'p1', 'side_scheme', sideSchemeInstance.instanceId);
    expect(sideCheck.allowed).toBe(true);

    // Defeating Crisis side scheme unlocks thwarting main scheme
    state.sideSchemes = [];
    const unlockedCheck = canBasicThwart(state, 'p1', 'main_scheme');
    expect(unlockedCheck.allowed).toBe(true);
  });

  it('3) Generic In-Play: Crisis icon on an attachment on Villain blocks main scheme threat removal', () => {
    // Attachment with scheme_crisis: 1 (or crisis keyword) attached to Villain
    const crisisAttachment: CardInstance = {
      instanceId: 'crisis-att-1',
      card: {
        code: 'test-att-crisis',
        name: 'Team Leader',
        type: CardType.ATTACHMENT,
        hasCrisis: true,
        scheme_crisis: 1,
        keywords: [Keyword.CRISIS],
        traits: ['Title'],
        resources: { physical: 0, energy: 0, mental: 0, wild: 0 },
      } as any,
      ownerId: 'encounter',
      exhausted: false,
    };

    state.villain.attachments = [crisisAttachment];
    state.mainScheme.threat = 5;

    expect(hasCrisisInPlay(state)).toBe(true);

    const check = canBasicThwart(state, 'p1', 'main_scheme');
    expect(check.allowed).toBe(false);
    expect(check.reason).toContain('Crisis');
  });

  it('4) Generic In-Play: Crisis icon on an Environment card blocks main scheme threat removal', () => {
    const crisisEnv: CardInstance = {
      instanceId: 'crisis-env-1',
      card: {
        code: 'test-env-crisis',
        name: 'Crisis Zone',
        type: CardType.ENVIRONMENT,
        hasCrisis: true,
        scheme_crisis: 1,
        keywords: [Keyword.CRISIS],
        traits: ['Location'],
        resources: { physical: 0, energy: 0, mental: 0, wild: 0 },
      } as any,
      ownerId: 'encounter',
      exhausted: false,
    };

    state.environments = [crisisEnv];
    state.mainScheme.threat = 5;

    expect(hasCrisisInPlay(state)).toBe(true);

    const check = canBasicThwart(state, 'p1', 'main_scheme');
    expect(check.allowed).toBe(false);
    expect(check.reason).toContain('Crisis');
  });

  it('5) Generic In-Play: Crisis icon on a player tableau card blocks main scheme threat removal', () => {
    const crisisUpgrade: CardInstance = {
      instanceId: 'crisis-upg-1',
      card: {
        code: '44051',
        name: 'Ambush',
        type: CardType.UPGRADE,
        hasCrisis: true,
        scheme_crisis: 1,
        keywords: [Keyword.CRISIS],
        traits: ['Condition'],
        resources: { physical: 0, energy: 0, mental: 0, wild: 0 },
      } as any,
      ownerId: 'p1',
      exhausted: false,
    };

    state.players[0].tableau = [crisisUpgrade];
    state.mainScheme.threat = 5;

    expect(hasCrisisInPlay(state)).toBe(true);

    const check = canBasicThwart(state, 'p1', 'main_scheme');
    expect(check.allowed).toBe(false);
    expect(check.reason).toContain('Crisis');
  });

  it('6) CHOSEN_SCHEME with Crisis icon and 1 side scheme: automatically removes threat from side scheme, never Main Scheme', () => {
    const crowdControlCard = cardCatalog.getCard('01108') as SideSchemeCard;
    state.sideSchemes = [
      {
        instanceId: 'side-cc',
        card: crowdControlCard,
        threat: 2,
      },
    ];
    state.mainScheme.threat = 5;

    // Execute REMOVE_THREAT with target: CHOSEN_SCHEME (like For Justice!)
    const result = executeSequence(
      state,
      [
        {
          effect: 'REMOVE_THREAT',
          effectParams: { amount: 2, target: 'CHOSEN_SCHEME' },
        },
      ],
      {
        playerId: 'p1',
        sourceCardInstance: {
          instanceId: 'for-justice-inst',
          card: { code: '01060', name: 'For Justice!', faction: 'justice' } as any,
          ownerId: 'p1',
          exhausted: false,
        },
      },
    );

    expect(result.success).toBe(true);
    // Decision prompt must NOT be enqueued because Main Scheme is blocked by Crisis and only 1 side scheme exists
    expect(peekDecisionPrompt(result.state)).toBeUndefined();
    // Threat was removed from Crowd Control, defeating it!
    expect(result.state.sideSchemes.length).toBe(0);
    // Main Scheme threat was untouched
    expect(result.state.mainScheme.threat).toBe(5);
  });

  it('7) CHOSEN_SCHEME with Crisis icon and multiple side schemes: prompt contains ONLY side schemes, NEVER Main Scheme', () => {
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

    const result = executeSequence(
      state,
      [
        {
          effect: 'REMOVE_THREAT',
          effectParams: { amount: 1, target: 'CHOSEN_SCHEME' },
        },
      ],
      {
        playerId: 'p1',
        sourceCardInstance: {
          instanceId: 'surveillance-team-inst',
          card: { code: '01064', name: 'Surveillance Team', faction: 'justice' } as any,
          ownerId: 'p1',
          exhausted: false,
        },
      },
    );

    expect(result.success).toBe(true);
    expect(peekDecisionPrompt(result.state)).toBeDefined();

    const prompt = peekDecisionPrompt(result.state)!;
    const optionIds = prompt.options.map((o) => o.id);

    // Must NOT contain main scheme
    expect(optionIds).not.toContain('main_scheme');
    // Must contain both side schemes
    expect(optionIds).toContain('side-cc');
    expect(optionIds).toContain('side-bs');
    expect(prompt.options.length).toBe(2);
  });

  it('8) Direct Main Scheme player threat removal is blocked when Crisis is active', () => {
    const crowdControlCard = cardCatalog.getCard('01108') as SideSchemeCard;
    state.sideSchemes = [
      {
        instanceId: 'side-cc',
        card: crowdControlCard,
        threat: 2,
      },
    ];
    state.mainScheme.threat = 5;

    const result = executeSequence(
      state,
      [
        {
          effect: 'REMOVE_THREAT',
          effectParams: { amount: 2, target: 'MAIN_SCHEME' },
        },
      ],
      {
        playerId: 'p1',
        sourceCardInstance: {
          instanceId: 'test-player-card',
          card: { code: 'test-card', name: 'Test Player Event', faction: 'hero' } as any,
          ownerId: 'p1',
          exhausted: false,
        },
      },
    );

    expect(result.success).toBe(true);
    // Main Scheme threat remains untouched
    expect(result.state.mainScheme.threat).toBe(5);
    // Crisis block logged
    expect(result.state.log.some((l) => l.onomatopoeia === 'CRISIS BLOCKS!')).toBe(true);
  });

  it('9) Ability with ignoresCrisis: true can remove threat from Main Scheme even while Crisis is active', () => {
    const crowdControlCard = cardCatalog.getCard('01108') as SideSchemeCard;
    state.sideSchemes = [
      {
        instanceId: 'side-cc',
        card: crowdControlCard,
        threat: 2,
      },
    ];
    state.mainScheme.threat = 5;

    const result = executeSequence(
      state,
      [
        {
          effect: 'REMOVE_THREAT',
          effectParams: { amount: 2, target: 'MAIN_SCHEME', ignoresCrisis: true },
        },
      ],
      {
        playerId: 'p1',
        sourceCardInstance: {
          instanceId: 'test-vision-card',
          card: { code: 'vision-card', name: 'Vision Event', faction: 'protection' } as any,
          ownerId: 'p1',
          exhausted: false,
        },
      },
    );

    expect(result.success).toBe(true);
    // Main Scheme threat was reduced (5 -> 3)
    expect(result.state.mainScheme.threat).toBe(3);
  });

  it('10) Issue #160: Crowd Control (01108) revealed in a 2-player game initializes with strictly 4 threat (2 * 2 players)', () => {
    const captainMarvelHero = cardCatalog.getCard('01010a') as HeroCard;
    const carolDanversAlterEgo = cardCatalog.getCard('01010b') as AlterEgoCard;

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
          hero: captainMarvelHero,
          alterEgo: carolDanversAlterEgo,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });

    const crowdControlCard = cardCatalog.getCard('01108') as SideSchemeCard;
    const crowdControlInstance = createCardInstance(crowdControlCard);

    resolveActiveEncounterCardAfterInterrupt(
      twoPlayerState,
      crowdControlInstance,
      twoPlayerState.players[0],
      false,
    );

    expect(twoPlayerState.sideSchemes.length).toBe(1);
    expect(twoPlayerState.sideSchemes[0].card.code).toBe('01108');
    // Exactly 2 threat per player * 2 players = 4 threat (no phantom When Revealed addition)
    expect(twoPlayerState.sideSchemes[0].threat).toBe(4);
  });
});
