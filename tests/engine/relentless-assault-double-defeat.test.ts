import { describe, it, expect } from 'vitest';
import {
  GamePhase,
  getActiveMainScheme,
  getActiveVillain,
  type CardInstance,
  type GameState,
} from '@engine/models';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { createCardInstance } from '@engine/state/game-setup';
import { dispatchAction } from '@engine/pipeline/action-dispatcher';
import { peekDecisionPrompt } from '@engine/pipeline/prompt-queue';
import { ScenarioRegistry } from '@engine/scenarios';
import { advanceVillainStage } from '@engine/scenarios/advance-villain-stage';
import { dispatchOk, newRhinoGame } from '../support/game-fixtures';

/**
 * #342: one Relentless Assault (01053) with Overkill is a single occurrence that can defeat a
 * minion and a villain stage. RR v1.8: a single interrupt window and a single response window
 * (Triggering Condition), forced before non-forced (Forced), "you" is the player whose identity
 * did it (You, Your), and defeating the last villain stage wins the game (Villain Defeat).
 */

const CHASE_THEM_DOWN = '01052';
const INTERROGATION_ROOM = '01063';
const SPIDER_TRACER = '01007';

function duo(): GameState {
  const state = newRhinoGame({
    players: [
      { hero: '01001a', form: 'hero' },
      { hero: '01029a', form: 'hero' },
    ],
  });
  state.phase = GamePhase.PLAYER_PHASE;
  state.activePlayerIndex = 0;
  getActiveMainScheme(state).threat = 5;
  return state;
}

function minionOf(hitPoints: number): CardInstance {
  const card = cardCatalog.getCard('01110')!;
  return createCardInstance({ ...card, health: hitPoints } as typeof card);
}

function inHand(code: string): CardInstance {
  return createCardInstance(cardCatalog.getCard(code)!);
}

function physicalPayment(): CardInstance {
  return createCardInstance({
    ...cardCatalog.getCard('01005')!,
    resources: { physical: 2, energy: 0, mental: 0, wild: 0, total: 2 },
  });
}

/** Plays Relentless Assault for the seat `seat`, paid with physical resources. */
function playAssault(state: GameState, seat: number, targetInstanceId: string) {
  const player = state.players[seat];
  const assault = inHand('01053');
  const payment = physicalPayment();
  player.hand.unshift(assault, payment);
  return dispatchAction(state, {
    type: 'PLAY_CARD',
    playerId: player.id,
    cardInstanceId: assault.instanceId,
    targetInstanceId,
    paymentCardInstanceIds: [payment.instanceId],
  });
}

function logKeys(state: GameState): string[] {
  return state.log.map((l) => l.key);
}

function promptsOf(state: GameState, cardCode: string) {
  return (state.pendingDecisionQueue ?? []).filter((p) => p.sourceCardCode === cardCode);
}

/** Answers every pending prompt, "Yes" to a trigger offer, and returns the codes in the order asked. */
function drainPrompts(state: GameState, answer: 'yes' | 'no' = 'yes') {
  const asked: string[] = [];
  let current = state;
  for (let guard = 0; guard < 12; guard++) {
    const prompt = peekDecisionPrompt(current);
    if (!prompt) break;
    asked.push(prompt.sourceCardCode ?? prompt.title);
    const trigger = prompt.options.find((o) => o.id.startsWith('trigger_'));
    const pick = trigger
      ? answer === 'yes'
        ? trigger
        : prompt.options.find((o) => o.id === 'pass')!
      : prompt.options[0];
    current = dispatchOk(current, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: prompt.playerId,
      selectedOptionId: pick.id,
    });
  }
  return { state: current, asked };
}

/** A support with a Forced Response to a minion's defeat that deals 1 damage to the villain. */
function forcedResponseProbe(): CardInstance {
  const base = cardCatalog.getCard(INTERROGATION_ROOM)!;
  return createCardInstance({
    ...base,
    code: 'probe_forced_response',
    name: 'Probe',
    enrichment: {
      abilities: [
        {
          id: 'probe_forced_response',
          timing: 'FORCED_RESPONSE',
          trigger: 'CHARACTER_DEFEATED',
          triggerFilter: { targetType: 'MINION' },
          steps: [{ effect: 'DEAL_DAMAGE', effectParams: { amount: 1 } }],
        },
      ],
    },
  } as unknown as typeof base);
}

function probeLogIndex(state: GameState): number {
  return state.log.findIndex(
    (l) =>
      l.key === 'damage.applied.villain' &&
      (l.params as { amount?: number } | undefined)?.amount === 1,
  );
}

function stageTwoHitPoints(): number {
  const control = duo();
  const plugin = ScenarioRegistry.get('rhino');
  plugin.onVillainDefeated(control, getActiveVillain(control).instanceId!);
  return getActiveVillain(control).health;
}

describe('D. cross-player: hero A attacks a minion engaged with hero B', () => {
  it('D1: the minion is defeated and the excess goes to Rhino', () => {
    const state = duo();
    const [a, b] = state.players;
    const minion = minionOf(2);
    b.engagedMinions.push(minion);
    const rhinoHp = getActiveVillain(state).health;
    const bHealth = b.health;

    const res = playAssault(state, 0, minion.instanceId);

    expect(res.result.success).toBe(true);
    expect(res.state.players[1].engagedMinions).toHaveLength(0);
    expect(res.state.players[0].engagedMinions).toHaveLength(0);
    expect(res.state.encounterDiscard.some((c) => c.instanceId === minion.instanceId)).toBe(true);
    expect(res.state.players[1].health).toBe(bHealth);
    expect(a.id).not.toBe(b.id);
    expect(getActiveVillain(res.state).health).toBe(rhinoHp - 3);
  });

  it('D2: with a minion on each board, the prompt lists both and A picks B’s', () => {
    const state = duo();
    const [a, b] = state.players;
    const own = minionOf(2);
    const theirs = minionOf(3);
    a.engagedMinions.push(own);
    b.engagedMinions.push(theirs);
    const rhinoHp = getActiveVillain(state).health;
    const assault = inHand('01053');
    const payment = physicalPayment();
    a.hand = [assault, payment];

    const played = dispatchOk(state, {
      type: 'PLAY_CARD',
      playerId: a.id,
      cardInstanceId: assault.instanceId,
      paymentCardInstanceIds: [payment.instanceId],
    });
    expect(peekDecisionPrompt(played)?.options.map((o) => o.id)).toEqual(
      expect.arrayContaining([own.instanceId, theirs.instanceId]),
    );
    const after = dispatchOk(played, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: a.id,
      selectedOptionId: theirs.instanceId,
    });

    expect(after.players[1].engagedMinions).toHaveLength(0);
    expect(after.players[0].engagedMinions.map((m) => m.instanceId)).toEqual([own.instanceId]);
    expect(getActiveVillain(after).health).toBe(rhinoHp - 2);
  });

  it('D3: only the attacking hero is offered Chase Them Down from hand', () => {
    const state = duo();
    const [a, b] = state.players;
    const minion = minionOf(2);
    b.engagedMinions.push(minion);
    a.hand.push(inHand(CHASE_THEM_DOWN));
    b.hand.push(inHand(CHASE_THEM_DOWN));

    const res = playAssault(state, 0, minion.instanceId);

    const offered = promptsOf(res.state, CHASE_THEM_DOWN);
    expect(offered.map((p) => p.playerId)).toEqual([a.id]);
  });

  it('D4: only the attacking hero is offered Interrogation Room in play ("after YOU defeat")', () => {
    const state = duo();
    const [a, b] = state.players;
    const minion = minionOf(2);
    b.engagedMinions.push(minion);
    a.tableau.push(inHand(INTERROGATION_ROOM));
    b.tableau.push(inHand(INTERROGATION_ROOM));

    const res = playAssault(state, 0, minion.instanceId);

    const offered = promptsOf(res.state, INTERROGATION_ROOM);
    expect(offered.map((p) => p.playerId)).toEqual([a.id]);
  });

  it('D5: a minion defeated by A’s ally does not offer A’s Interrogation Room', () => {
    const state = duo();
    const [a, b] = state.players;
    const minion = minionOf(1);
    b.engagedMinions.push(minion);
    a.tableau.push(inHand(INTERROGATION_ROOM));
    const ally = inHand('01084');
    a.allies.push(ally);

    const res = dispatchAction(state, {
      type: 'ALLY_ATTACK',
      playerId: a.id,
      allyInstanceId: ally.instanceId,
      targetType: 'minion',
      targetInstanceId: minion.instanceId,
    });

    expect(res.result.success, res.result.error).toBe(true);
    expect(res.state.players[1].engagedMinions).toHaveLength(0);
    expect(promptsOf(res.state, INTERROGATION_ROOM)).toHaveLength(0);
  });
});

describe('E. double defeat: the minion and the villain stage in one attack', () => {
  function stageOneAtTwoHitPoints(): GameState {
    const state = duo();
    getActiveVillain(state).health = 2;
    return state;
  }

  it('E1: Stage I is defeated and Stage II starts at full hit points', () => {
    const state = stageOneAtTwoHitPoints();
    const minion = minionOf(2);
    state.players[0].engagedMinions.push(minion);
    const stageOneCode = getActiveVillain(state).card.code;
    const expectedHp = stageTwoHitPoints();

    const res = playAssault(state, 0, minion.instanceId);

    expect(res.result.success).toBe(true);
    expect(res.state.winner).toBeFalsy();
    expect(res.state.players[0].engagedMinions).toHaveLength(0);
    expect(getActiveVillain(res.state).card.code).not.toBe(stageOneCode);
    expect(getActiveVillain(res.state).health).toBe(expectedHp);
    const keys = logKeys(res.state);
    expect(keys.indexOf('damage.applied.minion')).toBeGreaterThanOrEqual(0);
    expect(keys.indexOf('overkill.villain.hit')).toBeGreaterThan(
      keys.indexOf('damage.applied.minion'),
    );
    expect(keys.indexOf('villain.stageAdvance')).toBeGreaterThan(
      keys.indexOf('damage.applied.villain'),
    );
  });

  it('E2: defeating the last stage declares victory and stops everything', () => {
    const state = stageOneAtTwoHitPoints();
    advanceVillainStage(state, getActiveVillain(state).instanceId!, '01095');
    getActiveVillain(state).health = 2;
    const [a] = state.players;
    const minion = minionOf(2);
    // Spider-Tracer queues an interrupt prompt, Chase Them Down a response, the probe a forced one.
    const tracer = inHand(SPIDER_TRACER);
    tracer.ownerId = a.id;
    minion.attachments = [tracer];
    a.engagedMinions.push(minion);
    a.hand.push(inHand(CHASE_THEM_DOWN));
    a.tableau.push(forcedResponseProbe(), inHand(INTERROGATION_ROOM));
    const sideScheme = createCardInstance(cardCatalog.getCard('01109')!);
    (sideScheme as unknown as { threat: number }).threat = 3;
    state.sideSchemes.push(sideScheme as never);

    const res = playAssault(state, 0, minion.instanceId);

    expect(res.result.success).toBe(true);
    expect(res.state.winner).toBe('HEROES');
    expect(res.state.encounterDiscard.some((c) => c.instanceId === minion.instanceId)).toBe(true);
    expect(res.state.pendingDecisionQueue ?? []).toHaveLength(0);
    expect(probeLogIndex(res.state)).toBe(-1);
  });

  it('E3: one response window offers both responses, on the final board', () => {
    const state = stageOneAtTwoHitPoints();
    const [a] = state.players;
    const minion = minionOf(2);
    a.engagedMinions.push(minion);
    a.hand.push(inHand(CHASE_THEM_DOWN));
    a.tableau.push(inHand(INTERROGATION_ROOM));
    const threatBefore = getActiveMainScheme(state).threat;

    const res = playAssault(state, 0, minion.instanceId);

    expect(promptsOf(res.state, CHASE_THEM_DOWN).length).toBeGreaterThan(0);
    expect(promptsOf(res.state, INTERROGATION_ROOM)).toHaveLength(1);
    // Already final when offered: the minion is gone and Rhino is on his next stage.
    expect(res.state.players[0].engagedMinions).toHaveLength(0);
    expect(getActiveVillain(res.state).health).toBe(stageTwoHitPoints());

    const drained = drainPrompts(res.state, 'yes');
    expect(getActiveMainScheme(drained.state).threat).toBeLessThan(threatBefore);
    expect(drained.state.pendingDecisionQueue ?? []).toHaveLength(0);
  });

  it('E4: every copy of Chase Them Down in hand may respond', () => {
    const state = duo();
    const [a] = state.players;
    const minion = minionOf(2);
    a.engagedMinions.push(minion);
    a.hand.push(inHand(CHASE_THEM_DOWN), inHand(CHASE_THEM_DOWN));
    const threatBefore = getActiveMainScheme(state).threat;

    const res = playAssault(state, 0, minion.instanceId);
    expect(promptsOf(res.state, CHASE_THEM_DOWN)).toHaveLength(2);

    const drained = drainPrompts(res.state, 'yes');
    expect(getActiveMainScheme(drained.state).threat).toBe(threatBefore - 4);
    expect(
      drained.state.players[0].hand.filter((c) => c.card.code === CHASE_THEM_DOWN),
    ).toHaveLength(0);
  });

  it('E4b: two copies, two defeated enemies: at most one play per copy, no prompt left behind', () => {
    const state = stageOneAtTwoHitPoints();
    const [a] = state.players;
    const minion = minionOf(2);
    a.engagedMinions.push(minion);
    a.hand.push(inHand(CHASE_THEM_DOWN), inHand(CHASE_THEM_DOWN));
    const threatBefore = getActiveMainScheme(state).threat;

    const res = playAssault(state, 0, minion.instanceId);
    const drained = drainPrompts(res.state, 'yes');

    expect(getActiveMainScheme(drained.state).threat).toBe(threatBefore - 4);
    expect(drained.state.pendingDecisionQueue ?? []).toHaveLength(0);
    expect(
      drained.state.players[0].hand.filter((c) => c.card.code === CHASE_THEM_DOWN),
    ).toHaveLength(0);
  });

  it('E5: a Forced Response to the minion’s defeat resolves after the Overkill lands', () => {
    const state = duo();
    const [a] = state.players;
    const minion = minionOf(2);
    a.engagedMinions.push(minion);
    a.tableau.push(forcedResponseProbe());

    const res = playAssault(state, 0, minion.instanceId);

    const keys = logKeys(res.state);
    const overkill = keys.indexOf('overkill.villain.hit');
    expect(overkill).toBeGreaterThanOrEqual(0);
    expect(probeLogIndex(res.state)).toBeGreaterThan(overkill);
  });

  it('E6: the Forced Response resolves before the optional Response is offered', () => {
    const state = duo();
    const [a] = state.players;
    const minion = minionOf(2);
    a.engagedMinions.push(minion);
    a.tableau.push(forcedResponseProbe(), inHand(INTERROGATION_ROOM));

    const res = playAssault(state, 0, minion.instanceId);

    expect(probeLogIndex(res.state)).toBeGreaterThanOrEqual(0);
    expect(promptsOf(res.state, INTERROGATION_ROOM)).toHaveLength(1);
  });

  it('E7: Spider-Tracer’s interrupt still resolves when the same attack defeats Stage I', () => {
    const state = stageOneAtTwoHitPoints();
    const [a] = state.players;
    const minion = minionOf(2);
    const tracer = inHand(SPIDER_TRACER);
    tracer.ownerId = a.id;
    minion.attachments = [tracer];
    a.engagedMinions.push(minion);
    const side = createCardInstance(cardCatalog.getCard('01109')!);
    (side as unknown as { threat: number }).threat = 3;
    state.sideSchemes.push(side as never);

    const res = playAssault(state, 0, minion.instanceId);

    expect(res.state.players[0].engagedMinions).toHaveLength(0);
    expect(getActiveVillain(res.state).health).toBe(stageTwoHitPoints());
    expect(promptsOf(res.state, SPIDER_TRACER).length).toBe(1);
  });
});
