import { describe, it, expect } from 'vitest';
import { checkAbilityTargets } from '@engine/effects/target-choice';
import {
  getActiveVillain,
  type AbilityStep,
  type CardAbility,
  type GameState,
} from '@engine/models';
import { newRhinoGame } from '../support/game-fixtures';

/**
 * Every selector is judged by what it names (#367, ADR-0090): a chosen selector by the player's
 * candidates, a fixed one by the entity it names, a group ("each ...") valid while at least one
 * member can be affected (RR v1.8 "Target"). Selectors filled in at run time are never judged.
 */
const heroGame = (): GameState =>
  newRhinoGame({
    players: [
      { hero: '01019a', form: 'hero' },
      { hero: '01029a', form: 'hero' },
    ],
  });
const gate = (state: GameState, effect: AbilityStep['effect'], params: Record<string, unknown>) => {
  const ability: CardAbility = {
    id: 'test_selector',
    timing: 'ACTION',
    steps: [{ effect, effectParams: params } as AbilityStep],
  };
  return checkAbilityTargets(state, state.players[0], ability).allowed;
};

describe('group selectors need one member that can be affected', () => {
  it('HEAL_DAMAGE on each hero needs a damaged hero', () => {
    const state = heroGame();
    expect(gate(state, 'HEAL_DAMAGE', { target: 'ALL_HEROES', amount: 1 })).toBe(false);

    state.players[1].health -= 1;
    expect(gate(state, 'HEAL_DAMAGE', { target: 'ALL_HEROES', amount: 1 })).toBe(true);
  });

  it('DEAL_DAMAGE on each minion needs a minion in play', () => {
    const state = heroGame();
    expect(gate(state, 'DEAL_DAMAGE', { target: 'ALL_MINIONS', amount: 1 })).toBe(false);
  });

  it('ADD_THREAT on each side scheme needs a side scheme in play', () => {
    const state = heroGame();
    state.sideSchemes = [];
    expect(gate(state, 'ADD_THREAT', { target: 'ALL_SIDE_SCHEMES', amount: 1 })).toBe(false);
  });
});

describe('fixed selectors are judged by the entity they name', () => {
  it('HEAL_DAMAGE on the villain needs a damaged villain', () => {
    const state = heroGame();
    expect(gate(state, 'HEAL_DAMAGE', { target: 'VILLAIN', amount: 1 })).toBe(false);

    getActiveVillain(state).health -= 1;
    expect(gate(state, 'HEAL_DAMAGE', { target: 'VILLAIN', amount: 1 })).toBe(true);
  });

  it('THIS_SIDE_SCHEME is the source card, so it cannot be judged without one', () => {
    const state = heroGame();
    state.sideSchemes = [];
    expect(gate(state, 'ADD_THREAT', { target: 'THIS_SIDE_SCHEME', amount: 1 })).toBe(true);
  });
});

describe('CHOSEN_PLAYER is judged against the players in the game', () => {
  it('READY needs an exhausted player', () => {
    const state = heroGame();
    expect(gate(state, 'READY', { target: 'CHOSEN_PLAYER' })).toBe(false);

    state.players[1].exhausted = true;
    expect(gate(state, 'READY', { target: 'CHOSEN_PLAYER' })).toBe(true);
  });
});

describe('selectors filled in at run time are not judged', () => {
  it.each(['PREVIOUS_TARGET', 'DAMAGED_CHARACTER', 'HOST', 'HOST_ENEMY', 'TRIGGERING_HERO'])(
    'HEAL_DAMAGE on %s never blocks',
    (target) => {
      expect(gate(heroGame(), 'HEAL_DAMAGE', { target, amount: 1 })).toBe(true);
    },
  );
});
