import { describe, it, expect } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { createCardInstance } from '@engine/state/game-setup';
import { checkAbilityTargets } from '@engine/effects/target-choice';
import { canInitiateAbility } from '@engine/pipeline/legality-checker';
import { getActiveMainScheme, StatusCard, type CardAbility, type GameState } from '@engine/models';
import type { EffectType } from '../../src/data/supplemental/runtime';
import { abilityOf, newRhinoGame } from '../support/game-fixtures';

/**
 * The one generic legality gate (ADR-0090, #340): RR v1.8 "Target", an ability can only be
 * initiated when any part of it can affect a target.
 */
describe('checkAbilityTargets: self selectors are targets (#340)', () => {
  const ONE_TWO_PUNCH = abilityOf('01024', 'one_two_punch_response'); // READY SELF_HERO
  const TENACITY = abilityOf('01093', 'tenacity_ready'); // READY SELF_IDENTITY
  const AUNT_MAY = abilityOf('01006', 'aunt_may'); // HEAL_DAMAGE 4 SELF_IDENTITY

  const heroGame = (): GameState => newRhinoGame({ players: [{ hero: '01019a', form: 'hero' }] });
  const gate = (state: GameState, ability: CardAbility) =>
    checkAbilityTargets(state, state.players[0], ability);

  it('READY on SELF_HERO needs an exhausted hero', () => {
    const state = heroGame();
    state.players[0].exhausted = false;
    expect(gate(state, ONE_TWO_PUNCH)).toEqual({
      allowed: false,
      reason: 'Nothing is exhausted to ready.',
    });

    state.players[0].exhausted = true;
    expect(gate(state, ONE_TWO_PUNCH).allowed).toBe(true);
  });

  it('READY on SELF_IDENTITY judges the identity of the current form, alter-ego included', () => {
    const state = newRhinoGame();
    expect(state.players[0].currentForm).toBe('alter_ego');

    state.players[0].exhausted = false;
    expect(gate(state, TENACITY).allowed).toBe(false);

    state.players[0].exhausted = true;
    expect(gate(state, TENACITY).allowed).toBe(true);
  });

  it('HEAL_DAMAGE on SELF_IDENTITY needs damage to heal', () => {
    const state = newRhinoGame();
    expect(gate(state, AUNT_MAY)).toEqual({
      allowed: false,
      reason: 'No character has sustained damage to heal.',
    });

    state.players[0].health -= 1;
    expect(gate(state, AUNT_MAY).allowed).toBe(true);
  });

  it('an ability with any step that judges no target stays initiable (any part can affect)', () => {
    const state = heroGame();
    state.players[0].exhausted = false;
    const mixed: CardAbility = {
      ...ONE_TWO_PUNCH,
      steps: [...ONE_TWO_PUNCH.steps, { effect: 'DRAW', effectParams: { count: 1 } }],
    };
    expect(gate(state, mixed).allowed).toBe(true);
  });

  it('a Confused hero may still initiate a thwart-labelled ability: the Confused card is the target', () => {
    const state = heroGame();
    const thwart: CardAbility = {
      id: 'test_thwart',
      timing: 'ACTION',
      labels: ['THWART'],
      steps: [{ effect: 'REMOVE_THREAT', effectParams: { target: 'CHOSEN_SCHEME', amount: 1 } }],
    };
    for (const scheme of [getActiveMainScheme(state), ...state.sideSchemes]) scheme.threat = 0;
    expect(gate(state, thwart).allowed).toBe(false);

    state.players[0].statusCards = [StatusCard.CONFUSED];
    expect(gate(state, thwart).allowed).toBe(true);
  });
});

describe('Aunt May (01006): needs a change in the board state to be used (#340)', () => {
  const aunt = () => {
    const state = newRhinoGame();
    const instance = createCardInstance(cardCatalog.getCard('01006')!);
    state.players[0].allies.push(instance);
    return { state, instance, ability: abilityOf('01006', 'aunt_may') };
  };

  it('cannot be used while Peter Parker is at full health', () => {
    const { state, instance, ability } = aunt();
    const check = canInitiateAbility(state, 'p1', ability, instance);
    expect(check.allowed).toBe(false);
    expect(check.reason).toContain('No character has sustained damage to heal.');
  });

  it('can be used once Peter Parker is damaged', () => {
    const { state, instance, ability } = aunt();
    state.players[0].health -= 2;
    expect(canInitiateAbility(state, 'p1', ability, instance).allowed).toBe(true);
  });
});

/**
 * #368: a scheme an ability names ("the main scheme", "each side scheme") is not a target the
 * player chooses. The gate judges it only for REMOVE_THREAT, where Crisis and Patrol limit it
 * (#331); every other effect on a named scheme resolves, and a forced ability is not skipped.
 */
describe('checkAbilityTargets: named schemes are judged only for threat removal (#368)', () => {
  const namedSchemeAbility = (effect: EffectType, target: string): CardAbility => ({
    id: `named_${effect}_${target}`,
    timing: 'FORCED_RESPONSE',
    trigger: 'WHEN_REVEALED',
    steps: [{ effect, effectParams: { target } }],
  });
  const gate = (effect: EffectType, target: string, setup?: (state: GameState) => void) => {
    const state = newRhinoGame();
    state.sideSchemes = [];
    setup?.(state);
    return checkAbilityTargets(state, state.players[0], namedSchemeAbility(effect, target));
  };

  it.each<[EffectType, string]>([
    ['ADD_STATUS', 'MAIN_SCHEME'],
    ['ADD_THREAT', 'MAIN_SCHEME'],
    ['ADD_THREAT', 'SIDE_SCHEME'],
    ['ADD_THREAT', 'ALL_SCHEMES'],
  ])('%s on %s with no side scheme is initiated', (effect, target) => {
    expect(gate(effect, target).allowed).toBe(true);
  });

  it('REMOVE_THREAT on the main scheme still needs threat to remove', () => {
    const result = gate('REMOVE_THREAT', 'MAIN_SCHEME', (state) => {
      getActiveMainScheme(state)!.threat = 0;
    });
    expect(result).toEqual({ allowed: false, reason: 'No scheme has threat to remove.' });
  });
});
