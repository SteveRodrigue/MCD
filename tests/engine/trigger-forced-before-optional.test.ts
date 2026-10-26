import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import {
  GameState,
  HeroCard,
  AlterEgoCard,
  NormalizedCard,
  getActiveMainScheme,
} from '@engine/models';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { dispatchAction, initiateEnemyAttack, peekDecisionPrompt } from '@engine/pipeline';
import { spyKernel } from '../helpers/kernel-spy';
import { newRhinoGame } from '../support/game-fixtures';
import { executeVillainSchemeAgainstPlayer } from '@engine/pipeline/villain-phase';

// Issue #361: Forced abilities resolve before optional ones, the first player orders simultaneous
// Forced abilities whoever controls them (RR v1.8 "Forced"; ADR-0032).

const INTERROGATION_ROOM = '01063';
const HYDRA_BOMBER = '01110'; // 1 HP minion

/** A support whose Forced Response draws 1 card after any minion is defeated. */
function forcedDrawSupport(id: string, name: string): NormalizedCard {
  const base = cardCatalog.getCard(INTERROGATION_ROOM) as NormalizedCard;
  return {
    ...base,
    name,
    enrichment: {
      ...base.enrichment,
      abilities: [
        {
          id,
          timing: 'FORCED_RESPONSE',
          trigger: 'CHARACTER_DEFEATED',
          triggerFilter: { targetType: 'MINION', targetPlayerScope: 'ANY' },
          steps: [{ effect: 'DRAW', effectParams: { count: 1 } }],
        },
      ],
    },
  } as NormalizedCard;
}

describe('Forced before optional in one trigger window (#361)', () => {
  let state: GameState;
  /** Queue length each time an ability's effect starts, keyed by ability id. */
  let queueLengthAtExecution: Record<string, number>;

  beforeEach(() => {
    queueLengthAtExecution = {};
    spyKernel('executeEffect', (original) => (s, ability, ctx) => {
      queueLengthAtExecution[ability.id ?? ''] = s.pendingDecisionQueue?.length ?? 0;
      return original(s, ability, ctx);
    });
    const spiderMan = cardCatalog.getCard('01001a') as HeroCard;
    const captainMarvel = cardCatalog.getCard('01010a') as HeroCard;
    state = setupGame({
      catalog: cardCatalog,
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Player 1',
          hero: spiderMan,
          alterEgo: cardCatalog.getCard('01001b') as AlterEgoCard,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
        {
          id: 'p2',
          name: 'Player 2',
          hero: captainMarvel,
          alterEgo: cardCatalog.getCard('01010b') as AlterEgoCard,
          deckCards: Array(10).fill(cardCatalog.getCard('01013')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as never,
      mainScheme: cardCatalog.getCard('01097b') as never,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });
    state.players[0].currentForm = 'hero';
    state.players[0].activeFormCard = spiderMan;
    state.players[1].currentForm = 'hero';
    state.players[1].activeFormCard = captainMarvel;
    getActiveMainScheme(state).threat = 5; // Interrogation Room needs a scheme with threat
    const minion = createCardInstance(cardCatalog.getCard(HYDRA_BOMBER)!);
    state.players[0].engagedMinions = [minion];
  });

  const interrogationRoom = () => createCardInstance(cardCatalog.getCard(INTERROGATION_ROOM)!);
  const defeatMinion = () =>
    dispatchAction(state, {
      type: 'BASIC_ATTACK',
      playerId: 'p1',
      targetType: 'minion',
      targetInstanceId: state.players[0].engagedMinions[0].instanceId,
    });

  it('P1 optional Response + P2 Forced Response: Forced resolves before the prompt is queued', () => {
    state.players[0].tableau = [interrogationRoom()];
    state.players[1].tableau = [createCardInstance(forcedDrawSupport('p2_forced', 'Forced B'))];
    const handBefore = state.players[1].hand.length;

    const res = defeatMinion();

    expect(queueLengthAtExecution['p2_forced']).toBe(0);
    expect(res.state.players[1].hand.length).toBe(handBefore + 1);
    expect(res.state.pendingDecisionQueue).toHaveLength(1);
    expect(res.state.pendingDecisionQueue![0].sourceCardCode).toBe(INTERROGATION_ROOM);
  });

  it('P1 Forced Response + P2 optional Response: Forced resolves before the prompt is queued', () => {
    state.players[0].tableau = [createCardInstance(forcedDrawSupport('p1_forced', 'Forced A'))];
    state.players[1].tableau = [interrogationRoom()];
    state.firstPlayerIndex = 1;
    state.activePlayerIndex = 1;
    state.players[1].engagedMinions = state.players[0].engagedMinions;
    state.players[0].engagedMinions = [];
    const handBefore = state.players[0].hand.length;

    const res = dispatchAction(state, {
      type: 'BASIC_ATTACK',
      playerId: 'p2',
      targetType: 'minion',
      targetInstanceId: state.players[1].engagedMinions[0].instanceId,
    });

    expect(queueLengthAtExecution['p1_forced']).toBe(0);
    expect(res.state.players[0].hand.length).toBe(handBefore + 1);
    expect(res.state.pendingDecisionQueue).toHaveLength(1);
    expect(res.state.pendingDecisionQueue![0].playerId).toBe('p2');
  });

  it('two simultaneous Forced abilities: the first player orders them, the optional prompt comes last', () => {
    state.players[0].tableau = [
      createCardInstance(forcedDrawSupport('p1_forced', 'Forced A')),
      interrogationRoom(),
    ];
    const p2Forced = createCardInstance(forcedDrawSupport('p2_forced', 'Forced B'));
    state.players[1].tableau = [p2Forced];
    const p1Hand = state.players[0].hand.length;
    const p2Hand = state.players[1].hand.length;

    const res = defeatMinion();

    // Nothing has resolved yet: the first player (p1) must order the two Forced abilities.
    expect(queueLengthAtExecution['p1_forced']).toBeUndefined();
    expect(queueLengthAtExecution['p2_forced']).toBeUndefined();
    const ordering = res.state.pendingDecisionQueue![0];
    expect(ordering.playerId).toBe('p1');
    expect(ordering.isVoluntary).toBe(false);
    expect(ordering.simultaneousPrompts!.every((p) => p.forced)).toBe(true);
    expect(ordering.options.map((o) => o.label).join(' ')).toContain('Player 2');

    // The first player picks the ability controlled by Player 2 first.
    const pickP2 = ordering.options.find(
      (o) => o.params?.sourceCardInstanceId === p2Forced.instanceId,
    )!;
    expect(pickP2.label).toContain('Player 2');
    const afterFirst = dispatchAction(res.state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: 'p1',
      selectedOptionId: pickP2.id,
    });
    expect(afterFirst.state.players[1].hand.length).toBe(p2Hand + 1);
    // Only one Forced ability is left, so it resolves without a second ordering prompt;
    // the optional Interrogation Room prompt is then the only one pending.
    expect(afterFirst.state.players[0].hand.length).toBe(p1Hand + 1);
    expect(afterFirst.state.pendingDecisionQueue).toHaveLength(1);
    expect(afterFirst.state.pendingDecisionQueue![0].sourceCardCode).toBe(INTERROGATION_ROOM);
  });

  it('identical Forced abilities on copies controlled by different players still prompt', () => {
    state.players[0].tableau = [createCardInstance(forcedDrawSupport('same_forced', 'Twin'))];
    state.players[1].tableau = [createCardInstance(forcedDrawSupport('same_forced', 'Twin'))];

    const res = defeatMinion();

    const ordering = res.state.pendingDecisionQueue![0];
    expect(ordering.options).toHaveLength(2);
    expect(ordering.options[0].label).toContain('Player 1');
    expect(ordering.options[1].label).toContain('Player 2');
  });

  it('single player: Forced resolves before the optional prompt without any ordering prompt', () => {
    state.players = [state.players[0]];
    state.players[0].tableau = [
      interrogationRoom(),
      createCardInstance(forcedDrawSupport('solo_forced', 'Forced Solo')),
    ];
    const handBefore = state.players[0].hand.length;

    const res = defeatMinion();

    expect(queueLengthAtExecution['solo_forced']).toBe(0);
    expect(res.state.players[0].hand.length).toBe(handBefore + 1);
    expect(res.state.pendingDecisionQueue).toHaveLength(1);
    expect(res.state.pendingDecisionQueue![0].sourceCardCode).toBe(INTERROGATION_ROOM);
  });

  it('two optional Responses from two players both queue, first player first', () => {
    state.players[0].tableau = [interrogationRoom()];
    const second = forcedDrawSupport('p2_optional', 'Optional B');
    second.enrichment!.abilities![0].timing = 'RESPONSE';
    state.players[1].tableau = [createCardInstance(second)];

    const res = defeatMinion();

    // Optional abilities of two players merge into one ordering prompt (#287), owned by the first player.
    const queue = res.state.pendingDecisionQueue!;
    expect(queue).toHaveLength(1);
    expect(queue[0].kind).toBe('ORDER_SIMULTANEOUS_ABILITIES');
    expect(queue[0].simultaneousPrompts!.map((p) => p.playerId)).toEqual(['p1', 'p2']);
    expect(queue[0].simultaneousPrompts!.every((p) => !p.forced)).toBe(true);
  });
});

describe('Forced ordering pauses and resumes the damage window (#361)', () => {
  /** A support whose Forced Interrupt prevents 1 of the damage about to be taken. */
  function forcedPrevent(id: string): NormalizedCard {
    const base = cardCatalog.getCard(INTERROGATION_ROOM) as NormalizedCard;
    return {
      ...base,
      name: id,
      enrichment: {
        ...base.enrichment,
        abilities: [
          {
            id,
            timing: 'FORCED_INTERRUPT',
            trigger: 'DAMAGE_WOULD_BE_TAKEN',
            steps: [{ effect: 'PREVENT_DAMAGE', effectParams: { amount: 1 } }],
          },
        ],
      },
    } as NormalizedCard;
  }

  it('the attack waits for the first player to order two Forced Interrupts, then deals the reduced damage', () => {
    const state = newRhinoGame({ players: [{ hero: '01010a', alterEgo: '01010b', form: 'hero' }] });
    state.phase = 'PLAYER_PHASE' as never;
    state.encounterDeck = [];
    const player = state.players[0];
    player.tableau = [
      createCardInstance(forcedPrevent('prevent_a')),
      createCardInstance(forcedPrevent('prevent_b')),
    ];
    const hitPoints = player.health;

    initiateEnemyAttack(state, { type: 'VILLAIN' }, 'p1');
    let current = dispatchAction(state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: 'p1',
      selectedOptionId: 'undefended',
    }).state;

    const ordering = peekDecisionPrompt(current)!;
    expect(ordering.kind).toBe('ORDER_SIMULTANEOUS_ABILITIES');
    expect(current.players[0].health).toBe(hitPoints);

    current = dispatchAction(current, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: 'p1',
      selectedOptionId: ordering.options[0].id,
    }).state;

    expect(peekDecisionPrompt(current)).toBeUndefined();
    // Rhino attacks for 2; each Forced Interrupt prevents 1.
    expect(current.players[0].health).toBe(hitPoints);
  });
});

describe('Forced ordering pauses and resumes the threat window (#361)', () => {
  function forcedThreatPrevent(id: string): NormalizedCard {
    const base = cardCatalog.getCard(INTERROGATION_ROOM) as NormalizedCard;
    return {
      ...base,
      name: id,
      enrichment: {
        ...base.enrichment,
        abilities: [
          {
            id,
            timing: 'FORCED_INTERRUPT',
            trigger: 'THREAT_WOULD_BE_PLACED',
            steps: [{ effect: 'PREVENT_THREAT', effectParams: { amount: 1 } }],
          },
        ],
      },
    } as NormalizedCard;
  }

  it('the scheme waits for the first player to order two Forced Interrupts, then places the reduced threat', () => {
    const state = newRhinoGame({ players: [{ hero: '01001a', alterEgo: '01001b', form: 'hero' }] });
    state.encounterDeck = [
      createCardInstance(cardCatalog.getCard('01099')!), // Charge: 2 boost icons, scheme 1 + 2 = 3
      ...state.encounterDeck,
    ];
    state.players[0].tableau = [
      createCardInstance(forcedThreatPrevent('prevent_a')),
      createCardInstance(forcedThreatPrevent('prevent_b')),
    ];
    const before = getActiveMainScheme(state).threat;

    executeVillainSchemeAgainstPlayer(state, state.players[0]);

    const ordering = peekDecisionPrompt(state)!;
    expect(ordering.kind).toBe('ORDER_SIMULTANEOUS_ABILITIES');
    expect(getActiveMainScheme(state).threat).toBe(before);

    const after = dispatchAction(state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: 'p1',
      selectedOptionId: ordering.options[0].id,
    }).state;

    expect(peekDecisionPrompt(after)).toBeUndefined();
    expect(getActiveMainScheme(after).threat).toBe(before + 1);
  });
});

describe('Forced ordering pauses and resumes the attack initiation (#361)', () => {
  function forcedOnInitiation(id: string): NormalizedCard {
    const base = cardCatalog.getCard(INTERROGATION_ROOM) as NormalizedCard;
    return {
      ...base,
      name: id,
      enrichment: {
        ...base.enrichment,
        abilities: [
          {
            id,
            timing: 'FORCED_RESPONSE',
            trigger: 'ENEMY_INITIATES_ATTACK',
            steps: [{ effect: 'DRAW', effectParams: { count: 1 } }],
          },
        ],
      },
    } as NormalizedCard;
  }

  it('the attack waits in INITIATION for the first player to order two Forced abilities, then asks for a defender', () => {
    const state = newRhinoGame({ players: [{ hero: '01010a', alterEgo: '01010b', form: 'hero' }] });
    state.phase = 'PLAYER_PHASE' as never;
    state.encounterDeck = [];
    state.players[0].tableau = [
      createCardInstance(forcedOnInitiation('draw_a')),
      createCardInstance(forcedOnInitiation('draw_b')),
    ];
    const handBefore = state.players[0].hand.length;

    initiateEnemyAttack(state, { type: 'VILLAIN' }, 'p1');

    const ordering = peekDecisionPrompt(state)!;
    expect(ordering.kind).toBe('ORDER_SIMULTANEOUS_ABILITIES');
    expect(state.activeAttackContext?.phase).toBe('INITIATION');
    expect(state.players[0].hand.length).toBe(handBefore);

    const after = dispatchAction(state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: 'p1',
      selectedOptionId: ordering.options[0].id,
    }).state;

    expect(after.players[0].hand.length).toBe(handBefore + 2);
    expect(after.activeAttackContext?.phase).toBe('DECLARE_DEFENDER');
    expect(peekDecisionPrompt(after)?.options.some((o) => o.id === 'undefended')).toBe(true);
  });
});
