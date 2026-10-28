import { describe, it, expect } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { RULE_SCENARIOS, sweepRuleScenarios } from '@engine/simulation/rule-scenarios';

describe('rule scenarios', () => {
  const options = { catalog: cardCatalog, allCards: cardCatalog.getAllCards() };
  const results = sweepRuleScenarios(options);

  it('runs every scenario, in a fixed order', () => {
    expect(results.map((r) => r.id)).toEqual(Object.keys(RULE_SCENARIOS));
  });

  it.each(results.map((r) => [r.id, r] as const))('%s reaches its situation', (_id, result) => {
    expect(result.reason).toBeUndefined();
    expect(result.ok).toBe(true);
    expect(result.logKeys.length).toBeGreaterThan(0);
  });

  it('writes the same log keys on a second run', () => {
    expect(sweepRuleScenarios(options)).toEqual(results);
  });

  it('fails a scenario that does not write the keys it expects', () => {
    const broken = { ...RULE_SCENARIOS['recover-action'], expects: ['scenario.victory' as never] };
    const original = RULE_SCENARIOS['recover-action'];
    (RULE_SCENARIOS as Record<string, unknown>)['recover-action'] = broken;
    try {
      const result = sweepRuleScenarios(options).find((r) => r.id === 'recover-action');
      expect(result?.ok).toBe(false);
      expect(result?.reason).toContain('scenario.victory');
    } finally {
      (RULE_SCENARIOS as Record<string, unknown>)['recover-action'] = original;
    }
  });
});
