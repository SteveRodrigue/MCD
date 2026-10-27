import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { executeEffect } from '@engine/effects';
import { dispatchAction, peekDecisionPrompt } from '@engine/pipeline';
import { createCardInstance } from '@engine/state/game-setup';
import { Keyword, getActiveMainScheme } from '@engine/models';
import type { CardAbility, GameState, MinionCard, SideSchemeCard } from '@engine/models';
import { newRhinoGame } from '../support/game-fixtures';

/**
 * Crisis and Patrol stop player cards removing threat from the main scheme (RR v1.8 "Crisis Icon",
 * "Patrol"; #370). The block lives where threat is removed, so a distributed removal obeys it like
 * a thwart does, whether the assignment comes with the step or from a prompt answer.
 */
describe('Crisis and Patrol block every threat removal path (#370)', () => {
  let state: GameState;

  const distribute = (budget: number): CardAbility => ({
    id: 'test_distribute_threat',
    timing: 'ACTION' as const,
    steps: [
      {
        effect: 'DISTRIBUTE_AMOUNT' as const,
        effectParams: {
          budget,
          allocationDomain: 'THREAT_REMOVAL' as const,
          targetScope: 'ALL_SCHEMES',
        },
      },
    ],
  });
  const helmet = () => createCardInstance(cardCatalog.getCard('01037')!);
  const blockLogs = (s: GameState) =>
    s.log.filter(
      (l) =>
        l.key === 'card.effect.threatBlockedByCrisis' ||
        l.key === 'card.effect.threatBlockedByPatrol',
    );

  /** Two side schemes with threat besides the shielded main scheme, so the prompt still asks. */
  const extraSide = (instanceId: string, code: string, threat: number) => ({
    instanceId,
    card: cardCatalog.getCard(code) as SideSchemeCard,
    threat,
  });
  const withCrisis = () => {
    state.sideSchemes = [extraSide('crisis_side', '01108', 2), extraSide('extra_side', '01107', 2)];
  };
  const withPatrol = () => {
    state.sideSchemes = [extraSide('plain_side', '01107', 2), extraSide('extra_side', '01107', 2)];
    const base = cardCatalog.getCard('01101') as MinionCard;
    state.players[0].engagedMinions = [
      createCardInstance({ ...base, keywords: [Keyword.PATROL] } as MinionCard),
    ];
  };

  beforeEach(() => {
    state = newRhinoGame({ players: [{ hero: '01001a', form: 'hero' }] });
    getActiveMainScheme(state).threat = 5;
  });

  describe.each([
    ['Crisis', 'card.effect.threatBlockedByCrisis', () => withCrisis()],
    ['Patrol', 'card.effect.threatBlockedByPatrol', () => withPatrol()],
  ] as const)('%s', (_name, logKey, arrange) => {
    it('a distribution assigned with the step leaves the main scheme alone and says why', () => {
      arrange();

      const res = executeEffect(state, distribute(2), {
        playerId: 'p1',
        sourceCardInstance: helmet(),
        assignments: { main_scheme: 2 },
      });

      expect(getActiveMainScheme(res.state).threat).toBe(5);
      expect(blockLogs(res.state).map((l) => l.key)).toEqual([logKey]);
    });

    it('a distribution answered from the prompt cannot assign threat removal to the main scheme', () => {
      arrange();
      const queued = executeEffect(state, distribute(2), {
        playerId: 'p1',
        sourceCardInstance: helmet(),
      });
      expect(peekDecisionPrompt(queued.state)?.kind).toBe('DISTRIBUTE_POINTS');

      const resolved = dispatchAction(queued.state, {
        type: 'RESOLVE_DECISION_PROMPT',
        playerId: 'p1',
        selectedOptionId: 'confirm_distribution',
        assignments: { main_scheme: 2 },
      });

      expect(resolved.result.success).toBe(false);
      expect(getActiveMainScheme(resolved.state).threat).toBe(5);
    });

    it('the distribution prompt does not offer the shielded main scheme', () => {
      arrange();
      const queued = executeEffect(state, distribute(2), {
        playerId: 'p1',
        sourceCardInstance: helmet(),
      });

      const main = peekDecisionPrompt(queued.state)?.distributionConfig?.targets.find(
        (t) => t.instanceId === 'main_scheme',
      );
      expect(main?.isEligible).toBe(false);
      expect(main?.ineligibilityReason).toContain(_name === 'Crisis' ? 'Crisis' : 'Patrol');
    });

    it('an encounter card is not limited', () => {
      arrange();

      const res = executeEffect(state, distribute(2), {
        playerId: 'p1',
        sourceCardInstance: createCardInstance(cardCatalog.getCard('01111')!),
        assignments: { main_scheme: 2 },
      });

      expect(getActiveMainScheme(res.state).threat).toBe(3);
      expect(blockLogs(res.state)).toEqual([]);
    });
  });

  it('a side scheme still receives its share while Crisis shields the main scheme', () => {
    withCrisis();

    const res = executeEffect(state, distribute(3), {
      playerId: 'p1',
      sourceCardInstance: helmet(),
      assignments: { main_scheme: 1, crisis_side: 1 },
    });

    expect(getActiveMainScheme(res.state).threat).toBe(5);
    expect(res.state.sideSchemes[0].threat).toBe(1);
  });
});
