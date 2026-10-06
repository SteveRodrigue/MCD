import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { executeEffect } from '@engine/effects';
import { dispatchAction, peekDecisionPrompt } from '@engine/pipeline';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import type {
  AlterEgoCard,
  CardInstance,
  GameState,
  HeroCard,
  SideSchemeState,
} from '@engine/models';

/**
 * Spider-Tracer (01007) "remove 3 threat from a scheme" must remove exactly 3, exactly once per
 * Tracer, whichever way the host is defeated (Issue #249). The older tests only use schemes with
 * 3 threat or fewer, so they never see the remainder.
 */
describe('Spider-Tracer removes exactly 3 threat per defeated host (Issue #249)', () => {
  let state: GameState;

  const withTracer = (minion: CardInstance): CardInstance => {
    const tracer = createCardInstance(cardCatalog.getCard('01007')!);
    (tracer as any).ownerId = 'p1';
    minion.attachments = [tracer];
    return minion;
  };

  const crowdControl = (threat: number): SideSchemeState => ({
    instanceId: 'side_crowd_control',
    card: cardCatalog.getCard('01108') as any,
    threat,
  });

  const bombScare = (threat: number): SideSchemeState => ({
    instanceId: 'side_bomb_scare',
    card: cardCatalog.getCard('01109') as any,
    threat,
  });

  const breakin = (threat: number): SideSchemeState => ({
    instanceId: 'side_breakin',
    card: cardCatalog.getCard('01107') as any,
    threat,
  });

  const secondCrowdControl = (threat: number): SideSchemeState => ({
    instanceId: 'side_crowd_control_2',
    card: cardCatalog.getCard('01108') as any,
    threat,
  });

  const defeatTracerHost = (s: GameState) => {
    const minion = withTracer(createCardInstance(cardCatalog.getCard('01101')!));
    minion.tokens = { damage: 2 };
    s.players[0].engagedMinions = [minion];
    return dispatchAction(s, {
      type: 'BASIC_ATTACK',
      playerId: 'p1',
      targetType: 'minion',
      targetInstanceId: minion.instanceId,
    });
  };

  const choose = (s: GameState, id: string) =>
    dispatchAction(s, { type: 'RESOLVE_DECISION_PROMPT', playerId: 'p1', selectedOptionId: id });

  const removeThreatLogs = (s: GameState) =>
    s.log.filter((l) => l.key === 'card.effect.removeThreat').length;

  const threatOf = (s: GameState, id: string) =>
    s.sideSchemes.find((x) => x.instanceId === id)?.threat;

  const damageAbility = (target: string) => ({
    id: 'event_damage',
    timing: 'HERO_ACTION' as const,
    steps: [{ effect: 'DEAL_DAMAGE', effectParams: { amount: 3, target } }],
  });

  beforeEach(() => {
    const spiderMan = cardCatalog.getCard('01001a') as HeroCard;
    const peter = cardCatalog.getCard('01001b') as AlterEgoCard;
    const captainMarvel = cardCatalog.getCard('01010a') as HeroCard;
    const carol = cardCatalog.getCard('01010b') as AlterEgoCard;
    state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: spiderMan,
          alterEgo: peter,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
        {
          id: 'p2',
          name: 'Captain Marvel',
          hero: captainMarvel,
          alterEgo: carol,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      skipMulligan: true,
      skipScenarioPlugin: true,
    } as any);
    state.players[0].currentForm = 'hero';
    state.players[0].activeFormCard = spiderMan;
    state.players[1].currentForm = 'hero';
    state.players[1].activeFormCard = captainMarvel;
    state.mainScheme.threat = 5;
  });

  it('basic attack: Crowd Control (Crisis) 4 threat keeps 1, no prompt, one removal', () => {
    const minion = withTracer(createCardInstance(cardCatalog.getCard('01101')!));
    minion.tokens = { damage: 2 };
    state.players[0].engagedMinions = [minion];
    state.sideSchemes = [crowdControl(4)];

    const res = dispatchAction(state, {
      type: 'BASIC_ATTACK',
      playerId: 'p1',
      targetType: 'minion',
      targetInstanceId: minion.instanceId,
    });

    expect(res.result.success).toBe(true);
    expect(peekDecisionPrompt(res.state)).toBeUndefined();
    expect(threatOf(res.state, 'side_crowd_control')).toBe(1);
    expect(res.state.mainScheme.threat).toBe(5);
    expect(removeThreatLogs(res.state)).toBe(1);
  });

  it('basic attack: main scheme 5 threat and Bomb Scare (01109) 4 threat, chosen Bomb Scare keeps 1', () => {
    const minion = withTracer(createCardInstance(cardCatalog.getCard('01101')!));
    minion.tokens = { damage: 2 };
    state.players[0].engagedMinions = [minion];
    state.sideSchemes = [bombScare(4)];

    const res = dispatchAction(state, {
      type: 'BASIC_ATTACK',
      playerId: 'p1',
      targetType: 'minion',
      targetInstanceId: minion.instanceId,
    });
    expect(peekDecisionPrompt(res.state)).toBeDefined();

    const resolved = dispatchAction(res.state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: 'p1',
      selectedOptionId: 'side_bomb_scare',
    });

    expect(resolved.result.success).toBe(true);
    expect(peekDecisionPrompt(resolved.state)).toBeUndefined();
    expect(threatOf(resolved.state, 'side_bomb_scare')).toBe(1);
    expect(resolved.state.mainScheme.threat).toBe(5);
    expect(removeThreatLogs(resolved.state)).toBe(1);
  });

  it('basic attack: chosen main scheme 5 threat keeps 2 and Bomb Scare is untouched', () => {
    const minion = withTracer(createCardInstance(cardCatalog.getCard('01101')!));
    minion.tokens = { damage: 2 };
    state.players[0].engagedMinions = [minion];
    state.sideSchemes = [bombScare(4)];

    const res = dispatchAction(state, {
      type: 'BASIC_ATTACK',
      playerId: 'p1',
      targetType: 'minion',
      targetInstanceId: minion.instanceId,
    });
    const mainId = peekDecisionPrompt(res.state)!.options.find((o) => o.cardCode === '01097b')!.id;

    const resolved = dispatchAction(res.state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: 'p1',
      selectedOptionId: mainId,
    });

    expect(resolved.state.mainScheme.threat).toBe(2);
    expect(threatOf(resolved.state, 'side_bomb_scare')).toBe(4);
    expect(removeThreatLogs(resolved.state)).toBe(1);
  });

  it('two players: Tracer played by p1 on a minion engaged with p2, defeated by p2', () => {
    const minion = createCardInstance(cardCatalog.getCard('01101')!);
    state.players[1].engagedMinions = [minion];
    const tracer = createCardInstance(cardCatalog.getCard('01007')!);
    const payment = createCardInstance(cardCatalog.getCard('01005')!);
    state.players[0].hand = [tracer, payment];

    const played = dispatchAction(state, {
      type: 'PLAY_CARD',
      playerId: 'p1',
      cardInstanceId: tracer.instanceId,
      paymentCardInstanceIds: [payment.instanceId],
    });
    expect(played.result.success).toBe(true);

    const st = played.state;
    st.sideSchemes = [crowdControl(4)];
    st.players[1].engagedMinions[0].tokens = { damage: 2 };
    st.activePlayerIndex = 1;

    const res = dispatchAction(st, {
      type: 'BASIC_ATTACK',
      playerId: 'p2',
      targetType: 'minion',
      targetInstanceId: minion.instanceId,
    });

    expect(res.result.success).toBe(true);
    expect(peekDecisionPrompt(res.state)).toBeUndefined();
    expect(threatOf(res.state, 'side_crowd_control')).toBe(1);
    expect(removeThreatLogs(res.state)).toBe(1);
    expect(res.state.players[0].discard.some((c) => c.card.code === '01007')).toBe(true);
  });

  it('ally attack: Crowd Control 4 threat keeps 1', () => {
    const minion = withTracer(createCardInstance(cardCatalog.getCard('01101')!));
    minion.tokens = { damage: 2 };
    state.players[0].engagedMinions = [minion];
    const daredevil = createCardInstance(cardCatalog.getCard('01058')!);
    state.players[0].allies = [daredevil];
    state.sideSchemes = [crowdControl(4)];

    const res = dispatchAction(state, {
      type: 'ALLY_ATTACK',
      playerId: 'p1',
      allyInstanceId: daredevil.instanceId,
      targetType: 'minion',
      targetInstanceId: minion.instanceId,
    });

    expect(res.result.success).toBe(true);
    expect(res.state.players[0].engagedMinions).toHaveLength(0);
    expect(threatOf(res.state, 'side_crowd_control')).toBe(1);
    expect(removeThreatLogs(res.state)).toBe(1);
  });

  it('event damage to one chosen minion: Crowd Control 4 threat keeps 1', () => {
    const minion = withTracer(createCardInstance(cardCatalog.getCard('01101')!));
    state.players[0].engagedMinions = [minion];
    state.sideSchemes = [crowdControl(4)];

    const res = executeEffect(state, damageAbility('CHOSEN_MINION'), {
      playerId: 'p1',
      chosenTargetType: 'minion',
      chosenTargetInstanceId: minion.instanceId,
    });

    expect(res.success).toBe(true);
    expect(res.state.players[0].engagedMinions).toHaveLength(0);
    expect(threatOf(res.state, 'side_crowd_control')).toBe(1);
    expect(removeThreatLogs(res.state)).toBe(1);
  });

  it('area damage defeats two Tracer minions: each removes 3 (8 threat leaves 2)', () => {
    const a = withTracer(createCardInstance(cardCatalog.getCard('01101')!));
    const b = withTracer(createCardInstance(cardCatalog.getCard('01101')!));
    state.players[0].engagedMinions = [a, b];
    state.sideSchemes = [crowdControl(8)];

    const res = executeEffect(state, damageAbility('ALL_ENEMIES'), { playerId: 'p1' });

    expect(res.success).toBe(true);
    expect(res.state.players[0].engagedMinions).toHaveLength(0);
    expect(threatOf(res.state, 'side_crowd_control')).toBe(2);
    expect(removeThreatLogs(res.state)).toBe(2);
  });

  it('one Tracer minion defeated beside a plain minion: removes 3 once', () => {
    const a = withTracer(createCardInstance(cardCatalog.getCard('01101')!));
    const b = createCardInstance(cardCatalog.getCard('01101')!);
    state.players[0].engagedMinions = [a, b];
    state.sideSchemes = [crowdControl(4)];

    const res = executeEffect(state, damageAbility('ALL_ENEMIES'), { playerId: 'p1' });

    expect(threatOf(res.state, 'side_crowd_control')).toBe(1);
    expect(removeThreatLogs(res.state)).toBe(1);
  });

  it('a scheme left at 0 threat is discarded; a scheme left at 1 is not', () => {
    const minion = withTracer(createCardInstance(cardCatalog.getCard('01101')!));
    minion.tokens = { damage: 2 };
    state.players[0].engagedMinions = [minion];
    state.sideSchemes = [crowdControl(3)];

    const res = dispatchAction(state, {
      type: 'BASIC_ATTACK',
      playerId: 'p1',
      targetType: 'minion',
      targetInstanceId: minion.instanceId,
    });

    expect(res.state.sideSchemes).toHaveLength(0);
    expect(res.state.encounterDiscard.some((c) => c.card.code === '01108')).toBe(true);
  });

  describe('multi-scheme prompt', () => {
    it('main scheme plus two side schemes: three options, each choice removes 3 from that scheme only', () => {
      const setup = () => {
        const fresh = structuredClone(state);
        fresh.sideSchemes = [bombScare(4), breakin(3)];
        return fresh;
      };
      const ids = ['side_bomb_scare', 'side_breakin', state.mainScheme.instanceId!];
      const expected = [
        { main: 5, bomb: 1, breakin: 3 },
        { main: 5, bomb: 4, breakin: undefined },
        { main: 2, bomb: 4, breakin: 3 },
      ];

      ids.forEach((id, i) => {
        const res = defeatTracerHost(setup());
        const prompt = peekDecisionPrompt(res.state)!;
        expect(prompt.options.map((o) => o.id).sort()).toEqual([...ids].sort());

        const resolved = choose(res.state, id);
        expect(resolved.result.success).toBe(true);
        expect(peekDecisionPrompt(resolved.state)).toBeUndefined();
        expect(resolved.state.mainScheme.threat).toBe(expected[i].main);
        expect(threatOf(resolved.state, 'side_bomb_scare')).toBe(expected[i].bomb);
        expect(threatOf(resolved.state, 'side_breakin')).toBe(expected[i].breakin);
        expect(removeThreatLogs(resolved.state)).toBe(1);
      });
    });

    it('two Crisis schemes block the main scheme: prompt offers only the two, chosen one keeps its remainder', () => {
      state.sideSchemes = [crowdControl(4), secondCrowdControl(5)];

      const res = defeatTracerHost(state);
      const prompt = peekDecisionPrompt(res.state)!;
      expect(prompt.options.map((o) => o.id).sort()).toEqual([
        'side_crowd_control',
        'side_crowd_control_2',
      ]);

      const resolved = choose(res.state, 'side_crowd_control_2');
      expect(threatOf(resolved.state, 'side_crowd_control_2')).toBe(2);
      expect(threatOf(resolved.state, 'side_crowd_control')).toBe(4);
      expect(resolved.state.mainScheme.threat).toBe(5);
      expect(removeThreatLogs(resolved.state)).toBe(1);
    });

    it('a scheme with 0 threat is not offered', () => {
      state.sideSchemes = [bombScare(0), breakin(3)];

      const res = defeatTracerHost(state);
      const prompt = peekDecisionPrompt(res.state)!;
      expect(prompt.options.map((o) => o.id)).not.toContain('side_bomb_scare');
      expect(prompt.options.map((o) => o.id).sort()).toEqual(
        ['side_breakin', state.mainScheme.instanceId!].sort(),
      );
    });

    it('the only scheme with threat is auto-targeted without a prompt', () => {
      state.mainScheme.threat = 0;
      state.sideSchemes = [bombScare(0), breakin(4)];

      const res = defeatTracerHost(state);

      expect(peekDecisionPrompt(res.state)).toBeUndefined();
      expect(threatOf(res.state, 'side_breakin')).toBe(1);
      expect(removeThreatLogs(res.state)).toBe(1);
    });
  });
});
