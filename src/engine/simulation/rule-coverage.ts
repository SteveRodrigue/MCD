import type { AbilitySweepResult, TriggerWindowResult } from './ability-stage-setter';
import type { CoverageLedger } from './ability-coverage';
import type { GauntletMatch } from './gauntlet';
import type { Observable, RuleObservation } from './rule-observations';
import type { RuleScenarioResult } from './rule-scenarios';
import type { RuleEntry } from './rules-graph';

export type EvidenceSource = 'stage' | 'gauntlet';

/** What one source of simulation runs showed. */
export interface EvidenceSet {
  logKeys: Set<string>;
  timings: Set<string>;
  effects: Set<string>;
  triggers: Set<string>;
  /** Rule scenarios that passed. */
  scenarios: Set<string>;
}

export type RuleEvidence = Record<EvidenceSource, EvidenceSet>;

const emptySet = (): EvidenceSet => ({
  logKeys: new Set(),
  timings: new Set(),
  effects: new Set(),
  triggers: new Set(),
  scenarios: new Set(),
});

export const emptyEvidence = (): RuleEvidence => ({ stage: emptySet(), gauntlet: emptySet() });

export interface EvidenceInput {
  ledger: CoverageLedger;
  sweep: readonly AbilitySweepResult[];
  windows: readonly TriggerWindowResult[];
  gauntlet: readonly GauntletMatch[];
  scenarios: readonly RuleScenarioResult[];
}

/**
 * Gathers what the Stage-Setter (covered abilities, passing runs, clean trigger windows, passing
 * rule scenarios) and the Gauntlet (log of every match that finished) showed. Only runs that passed count: a failed run
 * proves nothing about the rule.
 */
export function collectEvidence({
  ledger,
  sweep,
  windows,
  gauntlet,
  scenarios,
}: EvidenceInput): RuleEvidence {
  const evidence = emptyEvidence();
  for (const { target, outcomes } of sweep) {
    for (const outcome of outcomes) {
      for (const key of outcome.ok ? (outcome.logKeys ?? []) : []) evidence.stage.logKeys.add(key);
    }
    if (!ledger.isCovered(target.cardCode, target.abilityId)) continue;
    evidence.stage.timings.add(target.ability.timing);
    for (const step of target.ability.steps) evidence.stage.effects.add(step.effect);
    if (target.ability.trigger) evidence.stage.triggers.add(target.ability.trigger);
  }
  for (const window of windows) {
    if (!window.ok) continue;
    evidence.stage.triggers.add(window.trigger);
    for (const key of window.logKeys ?? []) evidence.stage.logKeys.add(key);
  }
  for (const scenario of scenarios) {
    if (!scenario.ok) continue;
    evidence.stage.scenarios.add(scenario.id);
    for (const key of scenario.logKeys) evidence.stage.logKeys.add(key);
  }
  for (const match of gauntlet) {
    for (const key of match.result?.logSummary ?? []) evidence.gauntlet.logKeys.add(key);
  }
  return evidence;
}

const matchesLog = (pattern: string, keys: ReadonlySet<string>): boolean =>
  pattern.endsWith('.*')
    ? [...keys].some((key) => key.startsWith(pattern.slice(0, -1)))
    : keys.has(pattern);

function seenIn(observable: Observable, set: EvidenceSet): boolean {
  if ('log' in observable) return matchesLog(observable.log, set.logKeys);
  if ('timing' in observable) return set.timings.has(observable.timing);
  if ('effect' in observable) return set.effects.has(observable.effect);
  if ('trigger' in observable) return set.triggers.has(observable.trigger);
  return set.scenarios.has(observable.scenario);
}

export interface ObservedRule {
  slug: string;
  title: string;
  by: EvidenceSource[];
}

export interface UntestedRule {
  slug: string;
  title: string;
  kind: 'definition' | 'no-observable' | 'no-scenario';
  reason: string;
}

export interface RuleCoverageReport {
  total: number;
  observed: ObservedRule[];
  /** Mapped to an observable, but no run showed it. */
  unobserved: { slug: string; title: string }[];
  /** Declared untested in the table, with the reason. */
  untested: UntestedRule[];
  /** The table and the glossary (or the engine's vocabulary) disagree: this fails the run. */
  drift: string[];
}

/** What the table may name besides log keys, which the compiler checks against the log catalog. */
export interface KnownVocabulary {
  timings: readonly string[];
  effects: readonly string[];
  triggers: readonly string[];
  scenarios: readonly string[];
}

const SOURCES: readonly EvidenceSource[] = ['stage', 'gauntlet'];

function driftOf(
  graph: Readonly<Record<string, RuleEntry>>,
  table: Readonly<Record<string, RuleObservation>>,
  known: KnownVocabulary,
): string[] {
  const drift: string[] = [];
  for (const slug of Object.keys(graph)) {
    if (!(slug in table)) drift.push(`glossary entry '${slug}' has no rule observation`);
  }
  for (const [slug, observation] of Object.entries(table)) {
    if (!(slug in graph)) {
      drift.push(`rule observation '${slug}' is not a glossary entry`);
      continue;
    }
    if ('untested' in observation) continue;
    for (const observable of observation.observe) {
      if ('timing' in observable && !known.timings.includes(observable.timing)) {
        drift.push(`'${slug}' names unknown timing '${observable.timing}'`);
      } else if ('effect' in observable && !known.effects.includes(observable.effect)) {
        drift.push(`'${slug}' names unknown effect '${observable.effect}'`);
      } else if ('trigger' in observable && !known.triggers.includes(observable.trigger)) {
        drift.push(`'${slug}' names a trigger no scenario stages: '${observable.trigger}'`);
      } else if ('scenario' in observable && !known.scenarios.includes(observable.scenario)) {
        drift.push(`'${slug}' names unknown rule scenario '${observable.scenario}'`);
      }
    }
  }
  return drift.sort();
}

/** Sorted and pure: the same graph, table and evidence give the same report. */
export function reportRuleCoverage(
  graph: Readonly<Record<string, RuleEntry>>,
  table: Readonly<Record<string, RuleObservation>>,
  evidence: RuleEvidence,
  known: KnownVocabulary,
): RuleCoverageReport {
  const report: RuleCoverageReport = {
    total: Object.keys(graph).length,
    observed: [],
    unobserved: [],
    untested: [],
    drift: driftOf(graph, table, known),
  };
  for (const slug of Object.keys(graph).sort()) {
    const observation = table[slug];
    if (!observation) continue;
    const { title } = graph[slug];
    if ('untested' in observation) {
      report.untested.push({ slug, title, kind: observation.untested, reason: observation.reason });
      continue;
    }
    const by = SOURCES.filter((source) =>
      observation.observe.some((observable) => seenIn(observable, evidence[source])),
    );
    if (by.length > 0) report.observed.push({ slug, title, by });
    else report.unobserved.push({ slug, title });
  }
  return report;
}
