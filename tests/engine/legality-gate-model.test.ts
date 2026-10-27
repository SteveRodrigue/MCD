import { describe, it, expect } from 'vitest';
import {
  SELECTOR_CLASS,
  checkAbilityTargets,
  type SelectorClass,
} from '@engine/effects/target-choice';
import { refreshPromptOptionAvailability } from '@engine/pipeline/prompt-queue';
import { getActiveMainScheme, type CardAbility, type GameState } from '@engine/models';
import { TargetSelectorSchema } from '../../src/data/supplemental/schema-primitives';
import { newRhinoGame } from '../support/game-fixtures';

/**
 * The gate model (#457, ADR-0090): a PLAYER_CHOICE is valid when any option is, a step with a
 * fallback never blocks, and a selector filled in at run time is not judged up front.
 */
const heroGame = (): GameState => newRhinoGame({ players: [{ hero: '01019a', form: 'hero' }] });
const gate = (state: GameState, ability: CardAbility) =>
  checkAbilityTargets(state, state.players[0], ability);
const noThreat = (state: GameState): void => {
  for (const scheme of [getActiveMainScheme(state), ...state.sideSchemes]) scheme.threat = 0;
};

const removeThreatOption = (id: string, selector: string) => ({
  id,
  label: id,
  effect: 'REMOVE_THREAT',
  params: { target: selector, amount: 1 },
});
const choiceOf = (...options: Array<Record<string, unknown>>): CardAbility => ({
  id: 'test_choice',
  timing: 'ACTION',
  steps: [{ effect: 'PLAYER_CHOICE', effectParams: { options } }],
});

describe('selector classes: every selector is classified once', () => {
  it('covers exactly the selectors of the schema', () => {
    expect(Object.keys(SELECTOR_CLASS).sort()).toEqual([...TargetSelectorSchema.options].sort());
  });

  it('uses only the known classes', () => {
    const known: SelectorClass[] = ['CHOSEN', 'FIXED', 'GROUP', 'EVENT', 'DEPENDENT'];
    expect(Object.values(SELECTOR_CLASS).filter((c) => !known.includes(c))).toEqual([]);
  });

  it('marks the selectors filled in at run time as DEPENDENT', () => {
    for (const selector of [
      'PREVIOUS_TARGET',
      'DAMAGED_CHARACTER',
      'HOST',
      'HOST_ENEMY',
    ] as const) {
      expect(SELECTOR_CLASS[selector]).toBe('DEPENDENT');
    }
  });
});

describe('PLAYER_CHOICE: valid when any option has a valid target', () => {
  it('is blocked when every option is judged and none has a target', () => {
    const state = heroGame();
    noThreat(state);
    const ability = choiceOf(
      removeThreatOption('a', 'CHOSEN_SCHEME'),
      removeThreatOption('b', 'CHOSEN_SIDE_SCHEME'),
    );
    expect(gate(state, ability).allowed).toBe(false);
  });

  it('is allowed when one judged option has a target', () => {
    const state = heroGame();
    getActiveMainScheme(state).threat = 2;
    const ability = choiceOf(
      removeThreatOption('a', 'CHOSEN_SCHEME'),
      removeThreatOption('b', 'CHOSEN_SIDE_SCHEME'),
    );
    expect(gate(state, ability).allowed).toBe(true);
  });

  it('is allowed when an option needs no target, whatever the others say', () => {
    const state = heroGame();
    noThreat(state);
    const ability = choiceOf(removeThreatOption('a', 'CHOSEN_SCHEME'), {
      id: 'stat',
      label: 'Stat',
      effect: 'MODIFY_STAT',
      params: {},
    });
    expect(gate(state, ability).allowed).toBe(true);
  });

  it('reads the steps of an option that runs several', () => {
    const state = heroGame();
    noThreat(state);
    const ability = choiceOf({
      id: 'multi',
      label: 'Multi',
      effect: 'REMOVE_THREAT',
      steps: [{ effect: 'REMOVE_THREAT', effectParams: { target: 'CHOSEN_SCHEME', amount: 1 } }],
    });
    expect(gate(state, ability).allowed).toBe(false);
  });
});

describe('fallback and run-time selectors never block', () => {
  it('a judged step with a fallback is allowed without a target', () => {
    const state = heroGame();
    noThreat(state);
    const ability: CardAbility = {
      id: 'test_fallback',
      timing: 'ACTION',
      steps: [
        {
          effect: 'REMOVE_THREAT',
          effectParams: { target: 'CHOSEN_SCHEME', amount: 1, fallback: 'SURGE' },
        },
      ],
    };
    expect(gate(state, ability).allowed).toBe(true);
  });

  it("a step on PREVIOUS_TARGET is not judged before the ability runs (Titania's Fury)", () => {
    const state = heroGame();
    const ability: CardAbility = {
      id: 'test_previous_target',
      timing: 'FORCED_RESPONSE',
      steps: [
        { effect: 'ENEMY_ATTACKS', effectParams: { target: 'SELF_HERO' } },
        { effect: 'HEAL_DAMAGE', effectParams: { target: 'PREVIOUS_TARGET', amount: 1 } },
      ],
    };
    expect(gate(state, ability).allowed).toBe(true);
  });
});

describe('PLAYER_CHOICE prompt: options without a valid target are disabled', () => {
  type TestOption = ReturnType<typeof removeThreatOption> & { disabled?: boolean };
  const promptFor = (state: GameState, options: TestOption[]) =>
    ({
      promptId: 'p1',
      playerId: state.players[0].id,
      title: 't',
      description: 'd',
      sourceCardName: 'Test',
      options,
      checkOptionTargets: true,
    }) as unknown as Parameters<typeof refreshPromptOptionAvailability>[1];
  const healOption = (): TestOption => ({
    id: 'heal',
    label: 'Heal',
    effect: 'HEAL_DAMAGE',
    params: { target: 'SELF_HERO', amount: 1 },
  });

  it('disables the option that cannot affect anything while another can', () => {
    const state = heroGame();
    noThreat(state);
    state.players[0].health -= 1;
    const options = [removeThreatOption('thwart', 'CHOSEN_SCHEME'), healOption()];
    refreshPromptOptionAvailability(state, promptFor(state, options));
    expect(options.map((o) => Boolean((o as TestOption).disabled))).toEqual([true, false]);
  });

  it('leaves every option open when none has a valid target', () => {
    const state = heroGame();
    noThreat(state);
    const options = [
      removeThreatOption('a', 'CHOSEN_SCHEME'),
      removeThreatOption('b', 'CHOSEN_SIDE_SCHEME'),
    ];
    refreshPromptOptionAvailability(state, promptFor(state, options));
    expect(options.map((o) => (o as TestOption).disabled)).toEqual([undefined, undefined]);
  });

  it('re-enables the option once a target appears', () => {
    const state = heroGame();
    noThreat(state);
    state.players[0].health -= 1;
    const options = [removeThreatOption('thwart', 'CHOSEN_SCHEME'), healOption()];
    const prompt = promptFor(state, options);
    refreshPromptOptionAvailability(state, prompt);
    getActiveMainScheme(state).threat = 2;
    refreshPromptOptionAvailability(state, prompt);
    expect((options[0] as TestOption).disabled).toBe(false);
  });
});
