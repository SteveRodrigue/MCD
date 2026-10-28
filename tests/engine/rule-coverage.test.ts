import { describe, it, expect } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { EFFECT_TYPES } from '../../src/data/supplemental/runtime';
import {
  COVERAGE_RULE_BY_TIMING,
  CoverageLedger,
  buildAbilityInventory,
} from '@engine/simulation/ability-coverage';
import {
  STAGED_TRIGGERS,
  sweepAbilities,
  sweepTriggerWindows,
} from '@engine/simulation/ability-stage-setter';
import {
  collectEvidence,
  emptyEvidence,
  reportRuleCoverage,
  type KnownVocabulary,
} from '@engine/simulation/rule-coverage';
import { RULE_OBSERVATIONS, type RuleObservation } from '@engine/simulation/rule-observations';
import { rulesGraph, type RuleEntry } from '@engine/simulation/rules-graph';

const known: KnownVocabulary = {
  timings: Object.keys(COVERAGE_RULE_BY_TIMING),
  effects: [...EFFECT_TYPES],
  triggers: STAGED_TRIGGERS,
};

const entry = (title: string): RuleEntry => ({ title, file: 'glossary/X.md', anchor: title });
const graph = { alpha: entry('ALPHA'), beta: entry('BETA'), gamma: entry('GAMMA') };

describe('rule observation table', () => {
  it('maps every glossary entry and nothing else', () => {
    const report = reportRuleCoverage(rulesGraph, RULE_OBSERVATIONS, emptyEvidence(), known);
    expect(report.drift).toEqual([]);
    expect(report.total).toBe(Object.keys(rulesGraph).length);
  });

  it('gives every declared-untested rule a reason', () => {
    const missing = Object.entries(RULE_OBSERVATIONS)
      .filter(([, o]) => 'untested' in o && o.reason.trim() === '')
      .map(([slug]) => slug);
    expect(missing).toEqual([]);
  });
});

describe('reportRuleCoverage', () => {
  const evidence = emptyEvidence();
  evidence.stage.logKeys.add('overkill.hit');
  evidence.gauntlet.logKeys.add('damage.applied.minion');
  evidence.stage.timings.add('INTERRUPT');

  const table: Record<string, RuleObservation> = {
    alpha: { observe: [{ log: 'overkill.hit' }, { log: 'retaliate.hit' }] },
    beta: { observe: [{ log: 'damage.applied.*' }, { timing: 'INTERRUPT' }] },
    gamma: { untested: 'definition', reason: 'wording' },
  };

  it('splits rules into observed (with their source), unobserved and untested', () => {
    const report = reportRuleCoverage(graph, table, evidence, known);
    expect(report.observed).toEqual([
      { slug: 'alpha', title: 'ALPHA', by: ['stage'] },
      { slug: 'beta', title: 'BETA', by: ['stage', 'gauntlet'] },
    ]);
    expect(report.unobserved).toEqual([]);
    expect(report.untested).toEqual([
      { slug: 'gamma', title: 'GAMMA', kind: 'definition', reason: 'wording' },
    ]);
    expect(report.drift).toEqual([]);
  });

  it('lists a mapped rule that no run showed as unobserved', () => {
    const report = reportRuleCoverage(graph, table, emptyEvidence(), known);
    expect(report.observed).toEqual([]);
    expect(report.unobserved.map((r) => r.slug)).toEqual(['alpha', 'beta']);
  });

  it('matches a prefix pattern only against keys that start with it', () => {
    const only = emptyEvidence();
    only.stage.logKeys.add('damage.applied');
    const report = reportRuleCoverage(graph, table, only, known);
    expect(report.unobserved.map((r) => r.slug)).toContain('beta');
  });

  it('reports drift for a glossary entry without a mapping, an unknown slug and a stale vocabulary', () => {
    const stale: Record<string, RuleObservation> = {
      alpha: { observe: [{ timing: 'NOT_A_TIMING' as never }] },
      beta: { observe: [{ effect: 'NOT_AN_EFFECT' as never }, { trigger: 'NOT_A_TRIGGER' }] },
      delta: { untested: 'definition', reason: 'not in the glossary' },
    };
    const { drift } = reportRuleCoverage(graph, stale, emptyEvidence(), known);
    expect(drift).toEqual([
      "'alpha' names unknown timing 'NOT_A_TIMING'",
      "'beta' names a trigger no scenario stages: 'NOT_A_TRIGGER'",
      "'beta' names unknown effect 'NOT_AN_EFFECT'",
      "glossary entry 'gamma' has no rule observation",
      "rule observation 'delta' is not a glossary entry",
    ]);
  });

  it('is deterministic and sorted for the same inputs', () => {
    const a = reportRuleCoverage(graph, table, evidence, known);
    const b = reportRuleCoverage({ ...graph }, { ...table }, evidence, known);
    expect(b).toEqual(a);
  });
});

describe('Stage-Setter rule evidence', () => {
  const allCards = cardCatalog.getAllCards();
  const inventory = buildAbilityInventory(allCards);
  const ledger = new CoverageLedger(inventory);
  const options = { catalog: cardCatalog, allCards };
  const sweep = sweepAbilities(ledger, options);
  const windows = sweepTriggerWindows(inventory, options);
  const evidence = collectEvidence({ ledger, sweep, windows, gauntlet: [] });
  const report = reportRuleCoverage(rulesGraph, RULE_OBSERVATIONS, evidence, known);

  it('records the log keys of every passing run', () => {
    const used = sweep.flatMap(({ outcomes }) =>
      outcomes.filter((o) => o.ok && o.evidence === 'used-counter'),
    );
    expect(used.length).toBeGreaterThan(0);
    expect(used.every((o) => (o.logKeys ?? []).length > 0)).toBe(true);
    expect(used.every((o) => [...o.logKeys!].sort().join() === o.logKeys!.join())).toBe(true);
  });

  it('reads timings, effects and triggers from the covered abilities', () => {
    expect(evidence.stage.timings.has('WHEN_REVEALED')).toBe(true);
    expect(evidence.stage.effects.has('DRAW')).toBe(true);
    expect(evidence.stage.triggers.size).toBeGreaterThan(0);
  });

  it('observes rules the Core Set exercises and never reports drift', () => {
    const observed = new Set(report.observed.map((r) => r.slug));
    for (const slug of ['when-revealed-abilities', 'draw-drawing-cards', 'constant-ability']) {
      expect(observed.has(slug), slug).toBe(true);
    }
    expect(report.drift).toEqual([]);
  });

  it('accounts for every glossary entry exactly once', () => {
    const slugs = [
      ...report.observed.map((r) => r.slug),
      ...report.unobserved.map((r) => r.slug),
      ...report.untested.map((r) => r.slug),
    ];
    expect(new Set(slugs).size).toBe(report.total);
    expect(slugs.length).toBe(report.total);
  });
});
