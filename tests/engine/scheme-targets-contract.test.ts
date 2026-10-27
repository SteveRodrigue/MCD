import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { getEligibleTargets, resolveTargets } from '@engine/effects/target-resolver';
import { getValidStepTargets } from '@engine/effects/target-choice';
import { getActiveMainScheme } from '@engine/models';
import type { AbilityStep, GameState, SideSchemeCard } from '@engine/models';
import { newRhinoGame } from '../support/game-fixtures';

/**
 * Who may target a scheme (#371). `resolveTargets` and `getEligibleTargets` list the same schemes
 * under the same ids; `getEligibleTargets` is structural only, and Crisis/Patrol belong to
 * `getValidStepTargets`, which every caller outside the resolver uses.
 */
describe('scheme targets: one enumeration, one contract (#371)', () => {
  let state: GameState;

  const withCrisisSideScheme = () => {
    state.sideSchemes = [
      {
        instanceId: 'crisis_side',
        card: cardCatalog.getCard('01108') as SideSchemeCard,
        threat: 2,
      },
    ];
  };
  const removeThreat = (target: string): AbilityStep => ({
    effect: 'REMOVE_THREAT',
    effectParams: { target, amount: 1 },
  });
  const ids = (targets: { id: string }[]) => targets.map((t) => t.id);

  beforeEach(() => {
    state = newRhinoGame();
    getActiveMainScheme(state).threat = 5;
    withCrisisSideScheme();
  });

  it.each(['MAIN_SCHEME', 'ALL_SCHEMES', 'SIDE_SCHEME'])(
    '%s lists the same ids in the resolver and in the eligible targets',
    (selector) => {
      const player = state.players[0];
      expect(ids(getEligibleTargets(state, player, selector))).toEqual(
        ids(resolveTargets(state, selector, { playerId: player.id })),
      );
    },
  );

  it('names a main scheme without an instance id the same way in both', () => {
    delete getActiveMainScheme(state).instanceId;
    const player = state.players[0];
    expect(ids(getEligibleTargets(state, player, 'MAIN_SCHEME'))).toEqual(
      ids(resolveTargets(state, 'MAIN_SCHEME', { playerId: player.id })),
    );
  });

  it('lists the shielded main scheme as a candidate and leaves Crisis to the step targets', () => {
    const player = state.players[0];
    const mainId = getActiveMainScheme(state).instanceId!;

    expect(ids(getEligibleTargets(state, player, 'CHOSEN_SCHEME'))).toContain(mainId);

    const valid = getValidStepTargets(state, player, removeThreat('CHOSEN_SCHEME'), {});
    expect(ids(valid)).toEqual(['crisis_side']);
  });
});
