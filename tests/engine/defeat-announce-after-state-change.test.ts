import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  GamePhase,
  getActiveVillain,
  type AllyCard,
  type CardInstance,
  type GameState,
  type PlayerState,
} from '@engine/models';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { createCardInstance } from '@engine/state/game-setup';
import { kernel } from '@engine/kernel';
import { dispatchAction, executeEnemyAttackSynchronously } from '@engine/pipeline';
import {
  applyDamageToTarget,
  defeatMinionsBeyondHitPoints,
} from '@engine/pipeline/damage-pipeline';
import { ScenarioRegistry } from '@engine/scenarios';
import { advanceVillainStage } from '@engine/scenarios/advance-villain-stage';
import type { TriggerContext } from '@engine/triggers/trigger-dispatcher';
import { newRhinoGame } from '../support/game-fixtures';

/**
 * #359: a defeat is announced once its state change has happened (RR v1.8: a Response is used
 * after the triggering condition has occurred; Villain Defeat; Player Elimination). The stage
 * advance, the elimination and the discard come first, then DEFEATED / CHARACTER_DEFEATED.
 * Interrupts to a defeat are covered by relentless-assault-double-defeat.test.ts (E7).
 */

const CHARGE = '01099';
const BLACK_CAT = '01002';
const DAREDEVIL = '01058';
const NICK_FURY = '01084';
const INTERROGATION_ROOM = '01063';
const MINION = '01110';

/** What the board looked like at the moment a DEFEATED trigger was dispatched. */
interface AtAnnouncement {
  targetInstanceId?: string;
  targetType?: string;
  villainCode: string;
  playerIds: string[];
  eliminatedIds: string[];
  discardIds: string[];
  encounterDiscardIds: string[];
}

let announcements: AtAnnouncement[] = [];
let dispatchSpy: ReturnType<typeof vi.spyOn> | undefined;

beforeEach(() => {
  announcements = [];
  const original = kernel.dispatchTrigger;
  dispatchSpy = vi
    .spyOn(kernel, 'dispatchTrigger')
    .mockImplementation((state: GameState, trigger, context: TriggerContext, chain) => {
      if (trigger === 'DEFEATED') {
        announcements.push({
          targetInstanceId: context.targetInstanceId,
          targetType: context.targetType,
          villainCode: getActiveVillain(state).card.code,
          playerIds: state.players.map((p) => p.id),
          eliminatedIds: (state.eliminatedPlayers ?? []).map((p) => p.id),
          discardIds: state.players.flatMap((p) => p.discard.map((c) => c.instanceId)),
          encounterDiscardIds: state.encounterDiscard.map((c) => c.instanceId),
        });
      }
      return original(state, trigger, context, chain);
    });
});

afterEach(() => {
  dispatchSpy?.mockRestore();
});

function duo(): GameState {
  const state = newRhinoGame({
    players: [
      { hero: '01001a', form: 'hero' },
      { hero: '01029a', form: 'hero' },
    ],
  });
  state.phase = GamePhase.PLAYER_PHASE;
  state.activePlayerIndex = 0;
  return state;
}

function solo(): GameState {
  const state = newRhinoGame({ players: [{ hero: '01001a', form: 'hero' }] });
  state.phase = GamePhase.PLAYER_PHASE;
  return state;
}

function inPlay(code: string): CardInstance {
  return createCardInstance(cardCatalog.getCard(code)!);
}

function hit(state: GameState, player: PlayerState, amount: number) {
  return applyDamageToTarget(state, {
    target: {
      type: 'player',
      entity: player,
      name: player.name,
      targetPlayerId: player.id,
      attachments: player.attachments,
      statusCards: player.statusCards,
    },
    amount,
    sourceType: 'VILLAIN',
  });
}

/** A Forced Response to any character's defeat that deals `target` 1 damage. */
function forcedResponseProbe(
  target: 'villain' | 'ALL_HEROES',
  triggerFilter?: Record<string, string>,
): CardInstance {
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
          ...(triggerFilter ? { triggerFilter } : {}),
          steps: [
            {
              effect: 'DEAL_DAMAGE',
              effectParams: target === 'villain' ? { amount: 1 } : { target, amount: 1 },
            },
          ],
        },
      ],
    },
  } as unknown as typeof base);
}

function stageTwoHitPoints(): number {
  const control = duo();
  ScenarioRegistry.get('rhino').onVillainDefeated(control, getActiveVillain(control).instanceId!);
  return getActiveVillain(control).health;
}

function playerHitNames(state: GameState): string[] {
  return state.log
    .filter((l) => l.key === 'damage.applied.player')
    .map((l) => (l.params as { target: string }).target);
}

describe('villain defeat', () => {
  function hitVillainForGood(state: GameState) {
    const villain = getActiveVillain(state);
    return applyDamageToTarget(state, {
      target: {
        type: 'villain',
        entity: villain,
        name: villain.card.name,
        attachments: villain.attachments,
        statusCards: villain.statusCards,
      },
      amount: 999,
      sourceType: 'HERO',
      sourcePlayerId: state.players[0].id,
    });
  }

  it('V1: the defeat is announced with the next stage already in play', () => {
    const state = duo();
    const stageOne = getActiveVillain(state).card.code;

    hitVillainForGood(state);

    expect(announcements).toHaveLength(1);
    expect(announcements[0].targetType).toBe('VILLAIN');
    expect(announcements[0].villainCode).not.toBe(stageOne);
  });

  it('V1b: a Forced Response to the defeat resolves on the next stage, at its full hit points', () => {
    const state = duo();
    state.players[0].tableau.push(forcedResponseProbe('villain', { targetType: 'VILLAIN' }));

    hitVillainForGood(state);

    const keys = state.log.map((l) => l.key);
    const probeHit = keys.lastIndexOf('damage.applied.villain');
    expect(probeHit).toBeGreaterThan(keys.indexOf('villain.stageAdvance'));
    expect(getActiveVillain(state).health).toBe(stageTwoHitPoints() - 1);
  });

  it('V2: defeating the last stage declares victory and announces nothing that resolves', () => {
    const state = duo();
    advanceVillainStage(state, getActiveVillain(state).instanceId!, '01095');
    state.players[0].tableau.push(forcedResponseProbe('villain', { targetType: 'VILLAIN' }));
    const keysBefore = state.log.length;

    hitVillainForGood(state);

    expect(state.winner).toBe('HEROES');
    expect(
      state.log.slice(keysBefore).filter((l) => l.key === 'damage.applied.villain'),
    ).toHaveLength(1);
  });
});

describe('hero defeat', () => {
  it('H1: the damage pipeline announces a hero defeat after the elimination', () => {
    const state = duo();
    const [a, b] = state.players;
    a.tableau.push(forcedResponseProbe('ALL_HEROES'));
    const aHealth = a.health;

    hit(state, b, 999);

    expect(announcements).toHaveLength(1);
    expect(announcements[0].targetType).toBe('HERO');
    expect(announcements[0].playerIds).toEqual([a.id]);
    expect(announcements[0].eliminatedIds).toEqual([b.id]);
    // The response sees only the surviving hero: the eliminated hero is not hit again.
    expect(playerHitNames(state)).toEqual([b.name, a.name]);
    expect(state.players[0].health).toBe(aHealth - 1);
  });

  it('H2: an undefended enemy attack announces the hero defeat after the elimination', () => {
    const state = duo();
    const [a, b] = state.players;
    b.health = 1;
    state.encounterDeck = [];

    executeEnemyAttackSynchronously(state, { type: 'VILLAIN' }, b.id, 'TAKE_UNDEFENDED');

    expect(announcements).toHaveLength(1);
    expect(announcements[0].targetType).toBe('HERO');
    expect(announcements[0].playerIds).toEqual([a.id]);
    expect(announcements[0].eliminatedIds).toEqual([b.id]);
  });

  it('H3: the last hero defeated loses the game', () => {
    const state = solo();

    hit(state, state.players[0], 999);

    expect(state.winner).toBe('VILLAIN');
    expect(state.pendingDecisionQueue ?? []).toHaveLength(0);
  });
});

describe('ally, minion and scheme-free defeats', () => {
  it('A1: one enemy attack that defeats an ally and, by Overkill, the hero announces both after both state changes', () => {
    const state = duo();
    const [a, b] = state.players;
    const ally = inPlay(BLACK_CAT);
    b.allies.push(ally);
    b.health = 1;
    getActiveVillain(state).attachments.push(inPlay(CHARGE));
    state.encounterDeck = [];

    executeEnemyAttackSynchronously(state, { type: 'VILLAIN' }, b.id, 'ALLY_CHUMP_BLOCK');

    expect(announcements.map((x) => x.targetType)).toEqual(['ALLY', 'HERO']);
    for (const announced of announcements) {
      expect(announced.playerIds).toEqual([a.id]);
      expect(announced.eliminatedIds).toEqual([b.id]);
    }
  });

  it('A2: an ally defeated by the consequential damage of its attack is already in the discard pile', () => {
    const state = duo();
    const [a] = state.players;
    const ally = inPlay(NICK_FURY);
    ally.tokens = { damage: (ally.card as AllyCard).health - 1 };
    a.allies.push(ally);
    const minion = createCardInstance({
      ...cardCatalog.getCard(MINION)!,
      health: 20,
    } as ReturnType<typeof cardCatalog.getCard> & object);
    a.engagedMinions.push(minion);

    const res = dispatchAction(state, {
      type: 'ALLY_ATTACK',
      playerId: a.id,
      allyInstanceId: ally.instanceId,
      targetType: 'minion',
      targetInstanceId: minion.instanceId,
    });

    expect(res.result.success, res.result.error).toBe(true);
    const announced = announcements.filter((x) => x.targetInstanceId === ally.instanceId);
    expect(announced).toHaveLength(1);
    expect(announced[0].discardIds).toContain(ally.instanceId);
  });

  it('A3: an ally defeated by the consequential damage of its thwart is already in the discard pile', () => {
    const state = duo();
    const [a] = state.players;
    const ally = inPlay(DAREDEVIL);
    ally.tokens = { damage: (ally.card as AllyCard).health - 1 };
    a.allies.push(ally);
    const scheme = state.mainSchemes![state.activeMainSchemeIndex ?? 0];
    scheme.threat = 5;

    const res = dispatchAction(state, {
      type: 'ALLY_THWART',
      playerId: a.id,
      allyInstanceId: ally.instanceId,
      targetType: 'main_scheme',
      targetInstanceId: scheme.instanceId,
    });

    expect(res.result.success, res.result.error).toBe(true);
    const announced = announcements.filter((x) => x.targetInstanceId === ally.instanceId);
    expect(announced).toHaveLength(1);
    expect(announced[0].discardIds).toContain(ally.instanceId);
  });

  it('M1: a minion that lost its hit point bonus is already in the encounter discard pile when announced', () => {
    const state = duo();
    const minion = inPlay(MINION);
    minion.tokens = { damage: 99 };
    state.players[0].engagedMinions.push(minion);

    defeatMinionsBeyondHitPoints(state);

    expect(announcements).toHaveLength(1);
    expect(announcements[0].encounterDiscardIds).toContain(minion.instanceId);
  });
});
