import { describe, it, expect, beforeEach } from 'vitest';
import { createCardInstance } from '@engine/state/game-setup';
import { newRhinoGame } from '../support/game-fixtures';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { executeEffect } from '@engine/effects';
import { dispatchAction, peekDecisionPrompt } from '@engine/pipeline';
import { getActiveMainScheme } from '@engine/models';
import type { CardInstance, GameLogEntry, GameState } from '@engine/models';

const ENERGY_DAGGERS = '01046';
const PANTHER_CLAWS = '01047';
const VIBRANIUM_SUIT = '01049';
const TACTICAL_GENIUS = '01048';

/**
 * The log of a Wakanda Forever! turn (#398): every line is spoken by the player who acts (Black
 * Panther is the second seat, never the first), every hit names the upgrade that dealt it, and the
 * damage the Vibranium Suit moves off the hero has a line of its own.
 */
describe('Wakanda Forever! combat log (#398)', () => {
  let state: GameState;
  let upgrades: CardInstance[];
  let logStart: number;

  /** Resolves Wakanda Forever! for Black Panther (p2) and answers every prompt it raises. */
  const playSequence = (chosenPlayerId: string, order: CardInstance[] = upgrades): GameState => {
    const wakanda = createCardInstance(cardCatalog.getCard('01043a')!);
    let next = executeEffect(
      state,
      {
        id: 'wf',
        timing: 'HERO_ACTION',
        steps: [
          {
            effect: 'EXECUTE_SPECIAL',
            effectParams: {
              specialId: 'WAKANDA_FOREVER',
              sequenceOrder: order.map((u) => u.instanceId),
            },
          },
        ],
      },
      { playerId: 'p2', sourceCardInstance: wakanda },
    ).state;
    for (let prompt = peekDecisionPrompt(next); prompt; prompt = peekDecisionPrompt(next)) {
      const pick =
        prompt.options.find((o) => o.id === `engaged_enemies_${chosenPlayerId}`) ??
        prompt.options[0];
      next = dispatchAction(next, {
        type: 'RESOLVE_DECISION_PROMPT',
        playerId: prompt.playerId,
        selectedOptionId: pick.id,
      }).state;
    }
    return next;
  };

  const logOf = (s: GameState, keyPrefix: string): GameLogEntry[] =>
    s.log.slice(logStart).filter((e) => e.key.startsWith(keyPrefix));

  beforeEach(() => {
    state = newRhinoGame({
      players: [
        { id: 'p1', name: 'She-Hulk', hero: '01019a', alterEgo: '01019b', form: 'hero' },
        { id: 'p2', name: 'Black Panther', hero: '01040a', alterEgo: '01040b', form: 'hero' },
      ],
    });
    state.activePlayerIndex = 1;
    const blackPanther = state.players[1];
    blackPanther.health -= 3;
    upgrades = [ENERGY_DAGGERS, VIBRANIUM_SUIT, PANTHER_CLAWS].map((code) =>
      createCardInstance(cardCatalog.getCard(code)!),
    );
    blackPanther.tableau = upgrades;
    state.players[0].engagedMinions = [createCardInstance(cardCatalog.getCard('01096')!)];
    logStart = state.log.length;
  });

  it('attributes every damage line to Black Panther, the player who acts', () => {
    const hits = logOf(playSequence('p1'), 'damage.applied');
    expect(hits.length).toBeGreaterThanOrEqual(4);
    expect(hits.map((h) => h.actor?.name)).toEqual(hits.map(() => 'Black Panther'));
  });

  it('names the upgrade that dealt each hit, Energy Daggers included', () => {
    const sources = logOf(playSequence('p1'), 'damage.applied').map((h) => h.params?.source);
    expect(sources).toEqual([
      'Energy Daggers',
      'Energy Daggers',
      'Vibranium Suit',
      'Panther Claws',
    ]);
  });

  it('logs the damage the Vibranium Suit moves from the hero to the enemy', () => {
    const moved = logOf(playSequence('p1'), 'damage.transferred');
    expect(moved).toHaveLength(1);
    expect(moved[0].actor?.name).toBe('Black Panther');
    expect(moved[0].params).toMatchObject({
      actor: 'Black Panther',
      source: 'Vibranium Suit',
      amount: 1,
      target: 'Rhino',
    });
  });

  it('logs no transfer when the hero carries no damage', () => {
    state.players[1].health = state.players[1].maxHealth;
    expect(logOf(playSequence('p1'), 'damage.transferred')).toHaveLength(0);
  });

  describe.each([
    { finisher: ENERGY_DAGGERS, name: 'Energy Daggers', amount: 2 },
    { finisher: VIBRANIUM_SUIT, name: 'Vibranium Suit', amount: 2 },
    { finisher: PANTHER_CLAWS, name: 'Panther Claws', amount: 4 },
  ])('$name as the final step', ({ finisher, name, amount }) => {
    beforeEach(() => {
      state.players[1].tableau = [ENERGY_DAGGERS, VIBRANIUM_SUIT, PANTHER_CLAWS, TACTICAL_GENIUS]
        .filter((code) => code !== finisher)
        .concat(finisher)
        .map((code) => createCardInstance(cardCatalog.getCard(code)!));
      upgrades = state.players[1].tableau;
    });

    it('logs its boosted amount, every line spoken by Black Panther', () => {
      const next = playSequence('p1');
      const mine = logOf(next, 'damage').filter((e) => e.params?.source === name);
      expect(mine.length).toBeGreaterThan(0);
      expect(mine.map((e) => e.actor?.name)).toEqual(mine.map(() => 'Black Panther'));
      const amounts = mine.map((e) => e.params?.amount);
      expect(amounts).toEqual(amounts.map(() => amount));
    });
  });

  it('Tactical Genius as the final step removes 2 threat, logged by Black Panther', () => {
    getActiveMainScheme(state).threat = 5;
    const genius = createCardInstance(cardCatalog.getCard(TACTICAL_GENIUS)!);
    upgrades = [...upgrades.filter((u) => u.card.code !== PANTHER_CLAWS), genius];
    state.players[1].tableau = upgrades;
    const removed = logOf(playSequence('p1'), 'card.effect.removeThreat');
    expect(removed).toHaveLength(1);
    expect(removed[0].params).toMatchObject({
      actor: 'Black Panther',
      source: 'Tactical Genius',
      amount: 2,
    });
  });
});
