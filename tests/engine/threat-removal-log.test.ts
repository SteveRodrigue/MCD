import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { executeEffect } from '@engine/effects';
import { dispatchAction, peekDecisionPrompt } from '@engine/pipeline';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { getActiveMainScheme } from '@engine/models';
import type {
  AlterEgoCard,
  CardAbility,
  GameState,
  HeroCard,
  SideSchemeState,
} from '@engine/models';

/**
 * Every threat removal writes one `card.effect.removeThreat` entry per scheme with the actor, the
 * source card, the target, the amount actually removed and the threat left (#343), whichever path
 * removed it: basic thwart, ally thwart, card effect or distributed assignment.
 */
describe('Threat removal is always logged with its source (#343)', () => {
  let state: GameState;

  const sideScheme = (id: string, threat: number): SideSchemeState => ({
    instanceId: id,
    card: cardCatalog.getCard('01107') as any,
    threat,
  });
  const removals = (s: GameState) => s.log.filter((l) => l.key === 'card.effect.removeThreat');
  const mainName = () => getActiveMainScheme(state).card.name;

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

  beforeEach(() => {
    const spiderMan = cardCatalog.getCard('01001a') as HeroCard;
    state = setupGame({
      catalog: cardCatalog,
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Peter',
          hero: spiderMan,
          alterEgo: cardCatalog.getCard('01001b') as AlterEgoCard,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      skipMulligan: true,
    });
    state.players[0].currentForm = 'hero';
    state.players[0].activeFormCard = spiderMan;
    getActiveMainScheme(state).threat = 5;
    state.sideSchemes = [];
  });

  it('basic thwart: the hero is the source', () => {
    const res = dispatchAction(state, {
      type: 'BASIC_THWART',
      playerId: 'p1',
      targetType: 'main_scheme',
    });

    expect(res.result.success).toBe(true);
    const left = getActiveMainScheme(res.state).threat;
    expect(removals(res.state).map((l) => l.params)).toEqual([
      {
        actor: 'Peter',
        source: 'Spider-Man',
        target: mainName(),
        amount: 5 - left,
        remainingThreat: left,
      },
    ]);
  });

  it('ally thwart: the ally is the source, a side scheme is the target', () => {
    const daredevil = createCardInstance(cardCatalog.getCard('01058')!);
    state.players[0].allies = [daredevil];
    state.sideSchemes = [sideScheme('side_a', 4)];

    const res = dispatchAction(state, {
      type: 'ALLY_THWART',
      playerId: 'p1',
      allyInstanceId: daredevil.instanceId,
      targetType: 'side_scheme',
      targetInstanceId: 'side_a',
    });

    expect(res.result.success).toBe(true);
    const left = res.state.sideSchemes.find((s) => s.instanceId === 'side_a')!.threat;
    expect(removals(res.state).map((l) => l.params)).toEqual([
      {
        actor: 'Peter',
        source: daredevil.card.name,
        target: cardCatalog.getCard('01107')!.name,
        amount: 4 - left,
        remainingThreat: left,
      },
    ]);
  });

  it('a card effect removing 0 threat still writes an entry with amount 0', () => {
    getActiveMainScheme(state).threat = 0;
    const source = createCardInstance(cardCatalog.getCard('01037')!);
    const ability: CardAbility = {
      id: 'test_remove_nothing',
      timing: 'ACTION' as const,
      steps: [{ effect: 'REMOVE_THREAT', effectParams: { amount: 2, target: 'MAIN_SCHEME' } }],
    };

    const res = executeEffect(state, ability, { playerId: 'p1', sourceCardInstance: source });

    expect(res.success).toBe(true);
    expect(removals(res.state).map((l) => l.params)).toEqual([
      {
        actor: 'Peter',
        source: 'Mark V Helmet',
        target: mainName(),
        amount: 0,
        remainingThreat: 0,
      },
    ]);
  });

  describe('distributed removal', () => {
    const helmet = () => createCardInstance(cardCatalog.getCard('01037')!);

    it('prompt assignment: one entry per scheme that received threat removal, with the card as source', () => {
      state.sideSchemes = [sideScheme('side_a', 3), sideScheme('side_b', 4)];
      const queued = executeEffect(state, distribute(3), {
        playerId: 'p1',
        sourceCardInstance: helmet(),
      });
      expect(peekDecisionPrompt(queued.state)?.kind).toBe('DISTRIBUTE_POINTS');

      const resolved = dispatchAction(queued.state, {
        type: 'RESOLVE_DECISION_PROMPT',
        playerId: 'p1',
        selectedOptionId: 'confirm_distribution',
        assignments: { side_a: 2, side_b: 1 },
      });

      expect(resolved.result.success).toBe(true);
      const sideName = cardCatalog.getCard('01107')!.name;
      expect(removals(resolved.state).map((l) => l.params)).toEqual([
        {
          actor: 'Peter',
          source: 'Mark V Helmet',
          target: sideName,
          amount: 2,
          remainingThreat: 1,
        },
        {
          actor: 'Peter',
          source: 'Mark V Helmet',
          target: sideName,
          amount: 1,
          remainingThreat: 3,
        },
      ]);
    });

    it('prompt assignment that empties a side scheme logs the removal, then the defeat', () => {
      state.sideSchemes = [sideScheme('side_a', 2), sideScheme('side_b', 4)];
      const queued = executeEffect(state, distribute(2), {
        playerId: 'p1',
        sourceCardInstance: helmet(),
      });

      const resolved = dispatchAction(queued.state, {
        type: 'RESOLVE_DECISION_PROMPT',
        playerId: 'p1',
        selectedOptionId: 'confirm_distribution',
        assignments: { side_a: 2 },
      });

      const keys = resolved.state.log
        .map((l) => l.key)
        .filter((k) => k === 'card.effect.removeThreat' || k === 'side_scheme.defeated');
      expect(keys).toEqual(['card.effect.removeThreat', 'side_scheme.defeated']);
      expect(resolved.state.sideSchemes.map((s) => s.instanceId)).toEqual(['side_b']);
    });

    it('assignments passed straight to the step are logged the same way', () => {
      state.sideSchemes = [sideScheme('side_a', 3)];

      const res = executeEffect(state, distribute(2), {
        playerId: 'p1',
        sourceCardInstance: helmet(),
        assignments: { side_a: 2 },
      });

      expect(removals(res.state).map((l) => l.params)).toEqual([
        {
          actor: 'Peter',
          source: 'Mark V Helmet',
          target: cardCatalog.getCard('01107')!.name,
          amount: 2,
          remainingThreat: 1,
        },
      ]);
    });
  });
});
