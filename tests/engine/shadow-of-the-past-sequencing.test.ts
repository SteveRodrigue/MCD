import { describe, it, expect, beforeEach } from 'vitest';
import {
  GameState,
  CardInstance,
  CardType,
  SideSchemeCard,
  MinionCard,
} from '../../src/engine/models';
import { executeEffect } from '../../src/engine/effects';

describe('Shadow of the Past (01190) Sequencing & Generic Zone Primitives (ADR-0029)', () => {
  let state: GameState;
  let vultureCard: CardInstance;
  let highwayRobberyCard: CardInstance;
  let sweepingSwoopCard: CardInstance;
  let vulturesPlansCard: CardInstance;
  let businessProblemsCard: CardInstance;
  let shadowOfThePastCard: CardInstance;

  beforeEach(() => {
    vultureCard = {
      instanceId: 'vulture_1',
      card: {
        code: '01167',
        name: 'Vulture',
        type: CardType.MINION,
        setCode: 'spider_man_nemesis',
        traits: ['Criminal'],
        health: 3,
        attack: 2,
        scheme: 1,
      } as MinionCard,
    } as CardInstance;

    highwayRobberyCard = {
      instanceId: 'highway_robbery_1',
      card: {
        code: '01166',
        name: 'Highway Robbery',
        type: CardType.SIDE_SCHEME,
        setCode: 'spider_man_nemesis',
        baseThreat: 3,
        baseThreatFixed: false,
      } as SideSchemeCard,
    } as CardInstance;

    sweepingSwoopCard = {
      instanceId: 'sweeping_swoop_1',
      card: {
        code: '01168',
        name: 'Sweeping Swoop',
        type: CardType.TREACHERY,
        setCode: 'spider_man_nemesis',
      },
    } as CardInstance;

    vulturesPlansCard = {
      instanceId: 'vultures_plans_1',
      card: {
        code: '01169',
        name: "The Vulture's Plans",
        type: CardType.TREACHERY,
        setCode: 'spider_man_nemesis',
      },
    } as CardInstance;

    businessProblemsCard = {
      instanceId: 'business_problems_1',
      card: {
        code: '01170',
        name: 'Business Problems',
        type: CardType.OBLIGATION,
        setCode: 'spider_man_nemesis',
      },
    } as CardInstance;

    shadowOfThePastCard = {
      instanceId: 'shadow_1',
      card: {
        code: '01190',
        name: 'Shadow of the Past',
        type: CardType.TREACHERY,
      },
    } as CardInstance;

    state = {
      roundNumber: 1,
      phase: 'PLAYER',
      firstPlayerIndex: 0,
      activePlayerIndex: 0,
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          health: 10,
          maxHealth: 10,
          currentForm: 'hero',
          hero: { code: '01001a', name: 'Spider-Man', setCode: 'spider_man' },
          alterEgo: { code: '01001b', name: 'Peter Parker' },
          hand: [],
          deck: [],
          discard: [],
          tableau: [],
          engagedMinions: [],
          statusCards: [],
          dealtEncounterCards: [],
          setAsideCards: [
            vultureCard,
            highwayRobberyCard,
            sweepingSwoopCard,
            vulturesPlansCard,
            businessProblemsCard,
          ],
        } as any,
      ],
      villain: {
        instanceId: 'v1',
        health: 14,
        maxHealth: 14,
        statusCards: [],
        attachments: [],
        card: { code: '01094', name: 'Rhino', type: CardType.VILLAIN } as any,
      } as any,
      mainScheme: {
        instanceId: 'ms1',
        threat: 2,
        targetThreat: 7,
        card: { code: '01097', name: 'The Break-In!' } as any,
      } as any,
      sideSchemes: [],
      encounterDeck: [
        { instanceId: 'enc1', card: { code: '01103', name: 'Shocker' } } as CardInstance,
      ],
      encounterDiscard: [],
      log: [],
    } as any;
  });

  it('Standard Case: Spawns Nemesis Minion, Nemesis Scheme, Shuffles Remaining, and does NOT Surge', () => {
    const ability = {
      id: 'shadow_of_the_past_when_revealed',
      timing: 'WHEN_REVEALED' as const,
      trigger: 'WHEN_REVEALED' as const,
      steps: [
        {
          id: 'step_1_spawn_nemesis_minion',
          effect: 'PUT_INTO_PLAY',
          params: {
            from: 'SET_ASIDE',
            to: 'ENGAGED_WITH_PLAYER',
            filter: { type: 'minion', set: 'PLAYER_NEMESIS' },
          },
        },
        {
          id: 'step_2_spawn_nemesis_scheme',
          effect: 'PUT_INTO_PLAY',
          params: {
            from: 'SET_ASIDE',
            to: 'SIDE_SCHEMES',
            filter: { type: 'side_scheme', set: 'PLAYER_NEMESIS' },
          },
        },
        {
          id: 'step_3_shuffle_remaining_cards',
          effect: 'SHUFFLE_INTO_DECK',
          params: {
            from: 'SET_ASIDE',
            toDeck: 'ENCOUNTER_DECK',
            filter: { set: 'PLAYER_NEMESIS' },
          },
        },
        {
          id: 'step_4_fallback_surge',
          effect: 'TRIGGER_SURGE',
          gate: 'IF_FAILED' as const,
          params: {
            targetStepId: 'step_1_spawn_nemesis_minion',
          },
        },
      ],
    };

    const initialDealtCount = state.players[0].dealtEncounterCards.length;
    const res = executeEffect(state, ability as any, {
      playerId: 'p1',
      sourceCardInstance: shadowOfThePastCard,
    });

    expect(res.success).toBe(true);

    // 1. Minion in play engaged with player
    expect(res.state.players[0].engagedMinions.some((m) => m.card.code === '01167')).toBe(true);

    // 2. Side scheme in play with 3 threat (1 player * 3 base threat)
    expect(res.state.sideSchemes.some((s) => s.card.code === '01166')).toBe(true);
    expect(res.state.sideSchemes[0].threat).toBe(3);

    // 3. Remaining 3 cards shuffled into encounter deck (initial 1 + 3 = 4 cards in encounter deck)
    expect(res.state.encounterDeck.length).toBe(4);
    expect(res.state.encounterDeck.some((c) => c.card.code === '01168')).toBe(true);
    expect(res.state.encounterDeck.some((c) => c.card.code === '01169')).toBe(true);
    expect(res.state.encounterDeck.some((c) => c.card.code === '01170')).toBe(true);

    // 4. Set-aside cards cleanly pruned
    expect(res.state.players[0].setAsideCards.length).toBe(0);

    // 5. No Surge triggered!
    expect(res.state.players[0].dealtEncounterCards.length).toBe(initialDealtCount);
  });

  it('Fallback Surge Case: Triggers Surge when Nemesis Minion is not in Set-Aside area', () => {
    // Minion was already defeated / in encounter discard
    state.players[0].setAsideCards = [
      highwayRobberyCard,
      sweepingSwoopCard,
      vulturesPlansCard,
      businessProblemsCard,
    ];
    state.encounterDiscard.push(vultureCard);

    const ability = {
      id: 'shadow_of_the_past_when_revealed',
      timing: 'WHEN_REVEALED' as const,
      trigger: 'WHEN_REVEALED' as const,
      steps: [
        {
          id: 'step_1_spawn_nemesis_minion',
          effect: 'PUT_INTO_PLAY',
          params: {
            from: 'SET_ASIDE',
            to: 'ENGAGED_WITH_PLAYER',
            filter: { type: 'minion', set: 'PLAYER_NEMESIS' },
          },
        },
        {
          id: 'step_2_spawn_nemesis_scheme',
          effect: 'PUT_INTO_PLAY',
          params: {
            from: 'SET_ASIDE',
            to: 'SIDE_SCHEMES',
            filter: { type: 'side_scheme', set: 'PLAYER_NEMESIS' },
          },
        },
        {
          id: 'step_3_shuffle_remaining_cards',
          effect: 'SHUFFLE_INTO_DECK',
          params: {
            from: 'SET_ASIDE',
            toDeck: 'ENCOUNTER_DECK',
            filter: { set: 'PLAYER_NEMESIS' },
          },
        },
        {
          id: 'step_4_fallback_surge',
          effect: 'TRIGGER_SURGE',
          gate: 'IF_FAILED' as const,
          params: {
            targetStepId: 'step_1_spawn_nemesis_minion',
          },
        },
      ],
    };

    const initialDealtCount = state.players[0].dealtEncounterCards.length;
    const res = executeEffect(state, ability as any, {
      playerId: 'p1',
      sourceCardInstance: shadowOfThePastCard,
    });

    expect(res.success).toBe(true);

    // 1. Minion was NOT put into play from set-aside
    expect(res.state.players[0].engagedMinions.length).toBe(0);

    // 2. Step 4 gate IF_FAILED fired and triggered Surge!
    expect(res.state.players[0].dealtEncounterCards.length).toBe(initialDealtCount + 1);
  });
});
