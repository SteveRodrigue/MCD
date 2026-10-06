import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '@data/importer/card-loader';
import {
  GameState,
  HeroCard,
  AlterEgoCard,
  CardAbility,
  setupGame,
  resetInstanceCounter,
  createCardInstance,
  executeEffect,
} from '@engine/index';

/**
 * #225: a step that fails with an `error` (malformed data, unsupported target) stops the sequence
 * and is reported; a step that fails without one is an outcome that later gates may read.
 */
describe('executeSequence step failures (Issue #225)', () => {
  let state: GameState;
  const player = () => state.players[0];

  beforeEach(() => {
    resetInstanceCounter();
    state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Iron Man',
          hero: cardCatalog.getCard('01029a') as HeroCard,
          alterEgo: cardCatalog.getCard('01029b') as AlterEgoCard,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });
    player().currentForm = 'hero';
    player().activeFormCard = player().hero;
  });

  const run = (steps: unknown[]) => {
    const source = createCardInstance(cardCatalog.getCard('01039')!);
    player().tableau.push(source);
    const ability = { id: 'test_sequence', timing: 'HERO_ACTION', steps } as unknown as CardAbility;
    return executeEffect(state, ability, { playerId: 'p1', sourceCardInstance: source });
  };

  const stepErrors = () => state.log.filter((e) => e.key === 'engine.stepError');

  it('stops at a step that fails with an error, reports it and logs it', () => {
    const res = run([
      { effect: 'ADD_TRAIT', effectParams: { trait: 'Aerial', target: 'ALL_ENEMIES' } },
      { effect: 'ADD_TRAIT', effectParams: { trait: 'Tech' } },
    ]);

    expect(res.success).toBe(false);
    expect(res.error).toContain('ALL_ENEMIES');
    expect(player().activeTraitModifiers ?? []).toHaveLength(0);
    expect(stepErrors()).toHaveLength(1);
    expect(stepErrors()[0].text).toContain('ADD_TRAIT');
    expect(stepErrors()[0].text).toContain('ALL_ENEMIES');
  });

  it('keeps the steps applied before the failing one', () => {
    const res = run([
      { effect: 'ADD_TRAIT', effectParams: { trait: 'Tech' } },
      { effect: 'ADD_TRAIT', effectParams: { trait: ' ' } },
      { effect: 'ADD_TRAIT', effectParams: { trait: 'Aerial' } },
    ]);

    expect(res.success).toBe(false);
    expect(player().activeTraitModifiers?.map((m) => m.trait)).toEqual(['Tech']);
  });

  it('treats a failure without an error as an outcome: IF_FAILED still runs, no error is logged', () => {
    const res = run([
      { effect: 'ENEMY_ATTACKS', effectParams: { enemy: '99999' } },
      { effect: 'ADD_TRAIT', gate: 'IF_FAILED', effectParams: { trait: 'Tech' } },
    ]);

    expect(res.success).toBe(true);
    expect(player().activeTraitModifiers?.map((m) => m.trait)).toEqual(['Tech']);
    expect(stepErrors()).toHaveLength(0);
  });

  it('propagates an error out of an ability that resolves once per player', () => {
    const source = createCardInstance(cardCatalog.getCard('01039')!);
    player().tableau.push(source);
    const ability = {
      id: 'test_each_player',
      timing: 'HERO_ACTION',
      forEachPlayer: true,
      steps: [{ effect: 'ADD_TRAIT', effectParams: { trait: ' ' } }],
    } as unknown as CardAbility;
    const res = executeEffect(state, ability, { playerId: 'p1', sourceCardInstance: source });

    expect(res.success).toBe(false);
    expect(stepErrors()).toHaveLength(1);
  });
});
