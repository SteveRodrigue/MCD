import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { getActiveMainScheme, getActiveVillain, type GameState } from '@engine/models';
import { executeEnemyAttackSynchronously } from '@engine/pipeline';
import { eliminatePlayer } from '@engine/pipeline/player-elimination';
import { handleMainSchemeCompletion, handleVillainDefeat } from '@engine/pipeline/scenario-helpers';
import { advanceVillainStage } from '@engine/scenarios/advance-villain-stage';
import { endGame } from '@engine/state/victory';
import { newRhinoGame } from '../support/game-fixtures';

// #362: a finished game keeps no pending resolution state, and `endGame` is the only writer of
// `state.winner`.

/** Leaves every kind of in-flight resolution state on the game, as in the middle of an attack. */
function midResolution(): GameState {
  const state = newRhinoGame();
  const s = state as unknown as Record<string, unknown>;
  s.pendingDecisionQueue = [{ id: 'prompt-1' }];
  s.pendingDamagePlacements = [{ id: 'damage-1' }];
  s.pendingThreatPlacements = [{ id: 'threat-1' }];
  s.pendingCleanUpPlayerIds = [state.players[0].id];
  s.pendingActivations = [{ type: 'VILLAIN', playerId: state.players[0].id }];
  s.activeBoostCard = { instanceId: 'boost-1' };
  s.activeBoostResolution = { id: 'boost-resolution-1' };
  s.activeAttackContext = { phase: 'DAMAGE' };
  s.activeEncounterContext = { id: 'encounter-1' };
  return state;
}

function expectNothingPending(state: GameState) {
  expect(state.pendingDecisionQueue ?? []).toEqual([]);
  expect(state.pendingDamagePlacements).toBeUndefined();
  expect(state.pendingThreatPlacements).toBeUndefined();
  expect(state.pendingCleanUpPlayerIds).toBeUndefined();
  expect(state.pendingActivations).toBeUndefined();
  expect(state.activeBoostCard).toBeUndefined();
  expect(state.activeBoostResolution).toBeUndefined();
  expect(state.activeAttackContext).toBeUndefined();
  expect(state.activeEncounterContext).toBeUndefined();
}

describe('endGame (#362)', () => {
  it.each(['HEROES', 'VILLAIN'] as const)(
    'a %s win clears all pending resolution state',
    (winner) => {
      const state = midResolution();
      endGame(state, winner);
      expect(state.winner).toBe(winner);
      expectNothingPending(state);
    },
  );

  it('keeps the results of the last combat (they are not pending work)', () => {
    const state = midResolution();
    state.lastCombatOutcome = { attackerName: 'Rhino', finalDamage: 3 } as never;
    endGame(state, 'HEROES');
    expect(state.lastCombatOutcome).toBeDefined();
  });

  it('the last villain stage defeated mid-attack leaves a clean state', () => {
    const state = midResolution();
    advanceVillainStage(state, getActiveVillain(state).instanceId!, '01095');
    const villain = getActiveVillain(state);
    villain.health = 0;
    handleVillainDefeat(state, villain.instanceId);
    expect(state.winner).toBe('HEROES');
    expectNothingPending(state);
  });

  it('a main scheme completed mid-encounter leaves a clean state', () => {
    const state = midResolution();
    const scheme = getActiveMainScheme(state);
    scheme.threat = scheme.targetThreat;
    handleMainSchemeCompletion(state, scheme.instanceId);
    expect(state.winner).toBe('VILLAIN');
    expectNothingPending(state);
  });

  it('the last hero eliminated clears the pending state', () => {
    const state = midResolution();
    eliminatePlayer(state, state.players[0].id);
    expect(state.winner).toBe('VILLAIN');
    expectNothingPending(state);
  });

  it('the hero killed by the villain attack ends the game without post-attack steps', () => {
    const state = newRhinoGame();
    state.players[0].health = 1;
    const logLength = state.log.length;
    executeEnemyAttackSynchronously(
      state,
      { type: 'VILLAIN' },
      state.players[0].id,
      'TAKE_UNDEFENDED',
    );
    expect(state.winner).toBe('VILLAIN');
    expectNothingPending(state);
    expect(state.log.slice(logLength).some((l) => l.key.startsWith('combat.retaliate'))).toBe(
      false,
    );
  });

  it('is the only place that sets state.winner', () => {
    const offenders: string[] = [];
    const scan = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) scan(path);
        else if (/\.tsx?$/.test(name) && /\.winner\s*=[^=]/.test(readFileSync(path, 'utf8'))) {
          offenders.push(path.replaceAll('\\', '/'));
        }
      }
    };
    scan('src');
    expect(offenders).toEqual(['src/engine/state/victory.ts']);
  });
});
