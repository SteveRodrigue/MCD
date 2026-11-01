import { describe, it, expect } from 'vitest';
import fs from 'fs';
import { supplementalFileNames, supplementalPath } from '../../src/tools/content-paths';

/**
 * ADD_TRAIT outside CONSTANT abilities lasts while its source card is in play unless the step
 * declares a `duration` (#131). Printed "until the end of the phase/round/turn" must therefore be
 * encoded explicitly, otherwise the trait would silently outlast the card text.
 */
const DURATIONS = ['PHASE', 'ROUND', 'TURN'];

interface Step {
  effect?: string;
  effectParams?: Record<string, unknown>;
  params?: Record<string, unknown>;
}

describe('ADD_TRAIT duration matches the printed text', () => {
  const offenders: string[] = [];
  const invalid: string[] = [];
  let checked = 0;

  for (const file of supplementalFileNames()) {
    const cards = JSON.parse(fs.readFileSync(supplementalPath(file), 'utf-8')).cards ?? {};
    for (const [code, card] of Object.entries<any>(cards)) {
      const printed: string = card.audit?.originalText ?? '';
      for (const ability of card.abilities ?? []) {
        if (ability.timing === 'CONSTANT') continue;
        for (const step of (ability.steps ?? []) as Step[]) {
          if (step.effect !== 'ADD_TRAIT') continue;
          checked++;
          const duration = (step.effectParams ?? step.params)?.duration as string | undefined;
          if (duration !== undefined && !DURATIONS.includes(duration)) invalid.push(`${code}`);
          if (/until the end of the (phase|round|turn)/i.test(printed) && !duration) {
            offenders.push(`${file} ${code}`);
          }
        }
      }
    }
  }

  it('finds the non-CONSTANT ADD_TRAIT steps (Rocket Boots at least)', () => {
    expect(checked).toBeGreaterThanOrEqual(1);
  });

  it('every printed "until the end of ..." grant declares a duration', () => {
    expect(offenders).toEqual([]);
  });

  it('declared durations are valid', () => {
    expect(invalid).toEqual([]);
  });
});
