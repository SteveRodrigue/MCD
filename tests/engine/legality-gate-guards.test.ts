import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { EFFECT_TYPES } from '../../src/data/supplemental/runtime';
import {
  EFFECTS_WITH_AFFECT_RULE,
  EFFECTS_WITHOUT_AFFECT_RULE,
} from '../../src/engine/effects/target-choice';

/**
 * Guards of the one generic legality gate (ADR-0090, #340). A target-validity rule lives in
 * `target-choice.ts` (`AFFECT_RULES`, `checkAbilityTargets`); callers ask the gate and never
 * repeat the rule by effect name or selector. Guidelines drift; these tests do not.
 */
describe('legality gate: every effect has a target-state rule or a stated reason', () => {
  const without = Object.values(EFFECTS_WITHOUT_AFFECT_RULE).flat();

  it('lists every effect exactly once', () => {
    const listed = [...EFFECTS_WITH_AFFECT_RULE, ...without];
    const missing = EFFECT_TYPES.filter((e) => !listed.includes(e));
    const duplicated = listed.filter((e, i) => listed.indexOf(e) !== i);
    expect({ missing, duplicated }).toEqual({ missing: [], duplicated: [] });
  });

  it('names no unknown effect', () => {
    const known: readonly string[] = EFFECT_TYPES;
    expect([...EFFECTS_WITH_AFFECT_RULE, ...without].filter((e) => !known.includes(e))).toEqual([]);
  });

  it('keeps the tracked gap visible: effects that act on a target without a state rule', () => {
    const gap = Object.entries(EFFECTS_WITHOUT_AFFECT_RULE).find(([reason]) =>
      reason.includes('tracked gap'),
    );
    expect(gap?.[1].length).toBeGreaterThan(0);
  });
});

describe('legality gate: no target-validity check outside the gate', () => {
  const ROOT = path.resolve(__dirname, '../..');

  /** Effect-name comparisons that decide target validity or legality, by effect named in a rule. */
  const EFFECT_NAME_CHECK =
    /\.effect\s*===\s*'(READY|HEAL_DAMAGE|EXHAUST|ADD_STATUS|REMOVE_THREAT|DEAL_DAMAGE|TRANSFER_DAMAGE)'/;
  /** A target enumeration: callers use the gate's `getValidStepTargets`, not the raw resolver. */
  const STATE_FILTERED_TARGETS = /getEligibleTargets\(/;

  /** The gate itself and the resolver it builds on. */
  const GATE_FILES = [
    'src/engine/effects/target-choice.ts',
    'src/engine/effects/target-resolver.ts',
  ];

  /**
   * Effect-name checks that remain, each with the reason. This list only shrinks: a stale entry
   * fails the test, and a new file needs the owner's approval in review (ADR-0090).
   */
  const ALLOWED_EFFECT_NAME_CHECKS: Record<string, string> = {
    'src/engine/pipeline/legality-checker.ts':
      'debt (#366): threat-removal and attack-damage legality (REMOVE_THREAT crisis/Patrol, DEAL_DAMAGE Guard) still check by effect name',
    'src/engine/pipeline/actions/play.ts':
      'display: picks the play onomatopoeia by effect, no legality',
    'src/engine/triggers/trigger-dispatcher.ts':
      'display: prompt summaries and the threat-placement prompt wiring, no legality',
    'src/engine/simulation/player-bot.ts':
      'heuristic: the bot ranks heal cards; legality comes from the gate',
    'src/ui/components/board/CardPaymentModal.tsx':
      'debt (#366): the payment modal picks its target picker by effect name; targets come from the engine',
  };

  const sourceFiles = (dir: string): string[] =>
    fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) return sourceFiles(rel);
      return /\.tsx?$/.test(entry.name) ? [rel] : [];
    });
  const files = [...sourceFiles('src/engine'), ...sourceFiles('src/ui')];
  const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

  it('decides target validity by effect name only inside the gate', () => {
    const offenders = files.filter(
      (f) =>
        !GATE_FILES.includes(f) &&
        !(f in ALLOWED_EFFECT_NAME_CHECKS) &&
        EFFECT_NAME_CHECK.test(read(f)),
    );
    expect(offenders).toEqual([]);
  });

  it('keeps the allow-list honest: every entry still has such a check', () => {
    const stale = Object.keys(ALLOWED_EFFECT_NAME_CHECKS).filter(
      (f) => !EFFECT_NAME_CHECK.test(read(f)),
    );
    expect(stale).toEqual([]);
  });

  it('enumerates targets only through the resolver and the gate', () => {
    const offenders = files.filter(
      (f) => !GATE_FILES.includes(f) && STATE_FILTERED_TARGETS.test(read(f)),
    );
    expect(offenders).toEqual([]);
  });
});
