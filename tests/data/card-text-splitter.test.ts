import { describe, it, expect } from 'vitest';
import { splitCardText } from '../../src/data/importer/card-loader';

describe('Card Text Splitter - Ability vs Boost (Issue #528)', () => {
  it('splits standard cards with <hr /> divider (e.g. Tiger Shark 01131)', () => {
    const rawText =
      '<b>Forced Response</b>: After Tiger Shark attacks, give him a tough status card.\n<hr />\n[star] <b>Boost</b>: Give the villain a tough status card.';
    const result = splitCardText(rawText);

    expect(result.abilityText).toBe(
      '<b>Forced Response</b>: After Tiger Shark attacks, give him a tough status card.',
    );
    expect(result.boostText).toBe('Give the villain a tough status card.');
  });

  it('splits cards with Overkill and Boost with 0 boost icons (e.g. Whirlwind 01130)', () => {
    const rawText =
      '[star] <b>Forced Interrupt</b>: When Whirlwind attacks you, also resolve his attack against each other hero.\n<hr />\n[star] <b>Boost</b>: Deal 1 damage to each hero.';
    const result = splitCardText(rawText);

    expect(result.abilityText).toBe(
      '[star] <b>Forced Interrupt</b>: When Whirlwind attacks you, also resolve his attack against each other hero.',
    );
    expect(result.boostText).toBe('Deal 1 damage to each hero.');
  });

  it('splits cards with Treachery When Revealed and Boost (e.g. Concussive Blast 01154)', () => {
    const rawText =
      '<b>When Revealed</b>: Deal 1 damage to each friendly character.\n<hr />\n[star] <b>Boost</b>: Deal 1 damage to each character you control.';
    const result = splitCardText(rawText);

    expect(result.abilityText).toBe(
      '<b>When Revealed</b>: Deal 1 damage to each friendly character.',
    );
    expect(result.boostText).toBe('Deal 1 damage to each character you control.');
  });

  it('handles cards where the only text is a boost ability (e.g. Cut the Power 16111)', () => {
    const rawText =
      '[star] <b>Boost</b>: Choose to either exhaust the Milano or place 2 threat on the main scheme.';
    const result = splitCardText(rawText);

    expect(result.abilityText).toBe('');
    expect(result.boostText).toBe(
      'Choose to either exhaust the Milano or place 2 threat on the main scheme.',
    );
  });

  it('handles cards with newline [star] Boost without <hr /> (e.g. Hired Gun 02007)', () => {
    const rawText =
      '<b>When Revealed</b>: Choose to either give the villain 1 facedown boost card or place 2 infamy counters on Criminal Enterprise.\n[star] <b>Boost</b>: Place 1 infamy counter on Criminal Enterprise. If you cannot, remove 1 madness counter from State of Madness.';
    const result = splitCardText(rawText);

    expect(result.abilityText).toBe(
      '<b>When Revealed</b>: Choose to either give the villain 1 facedown boost card or place 2 infamy counters on Criminal Enterprise.',
    );
    expect(result.boostText).toBe(
      'Place 1 infamy counter on Criminal Enterprise. If you cannot, remove 1 madness counter from State of Madness.',
    );
  });

  it('ignores non-boost divider lines like Preparation (e.g. A.I.M. Commando 50072)', () => {
    const rawText =
      'Quickstrike.\n<hr />\n<b>Preparation</b>: After this attack, put this minion into play engaged with you.';
    const result = splitCardText(rawText);

    expect(result.abilityText).toBe('Quickstrike.');
    expect(result.boostText).toBeUndefined();
  });

  it('returns full text as abilityText and undefined boostText for cards without boost', () => {
    const rawText = '<b>Interrupt</b> <i>(defense)</i>: When you would take any amount of damage, prevent all of that damage.';
    const result = splitCardText(rawText);

    expect(result.abilityText).toBe(rawText);
    expect(result.boostText).toBeUndefined();
  });

  it('handles undefined or empty string text gracefully', () => {
    expect(splitCardText(undefined)).toEqual({ abilityText: '', boostText: undefined });
    expect(splitCardText('')).toEqual({ abilityText: '', boostText: undefined });
  });
});
