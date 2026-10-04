import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { cardCatalog } from '../../src/data/importer/card-loader';

/**
 * Core encounter cards whose printed text cannot be modeled yet (docs/backlog/plan_hero_target_audit.md).
 * Their placeholder abilities were removed (card-integration-protocol circuit-breaker) so the engine
 * never executes behavior that contradicts the printed text. Each must point at its ambiguity report.
 */
const BLOCKED: Record<string, { keepsBoostOnly?: boolean }> = {
  '01159': {},
  '01164': { keepsBoostOnly: true },
  '01168': {},
  '01169': {},
  '01174': {},
  '01179': {},
};

describe('Blocked core encounter cards declare no placeholder abilities', () => {
  it.each(Object.keys(BLOCKED))('%s has no executable When Revealed ability', (code) => {
    const card = cardCatalog.getCard(code)!;
    const abilities = card.enrichment?.abilities ?? [];
    expect(abilities.some((a) => a.trigger === 'WHEN_REVEALED')).toBe(false);
    if (BLOCKED[code].keepsBoostOnly) {
      expect(abilities.length).toBeGreaterThan(0);
      expect(abilities.every((a) => a.trigger === 'BOOST')).toBe(true);
    } else {
      expect(abilities).toHaveLength(0);
    }
  });

  it.each(Object.keys(BLOCKED))('%s points at an existing ambiguity report', (code) => {
    const audit = cardCatalog.getCard(code)!.enrichment?.audit as { ambiguityFile?: string };
    expect(audit?.ambiguityFile).toBeDefined();
    expect(fs.existsSync(path.resolve(__dirname, '../..', audit.ambiguityFile!))).toBe(true);
  });
});
