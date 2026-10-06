import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { cardCatalog } from '../../src/data/importer/card-loader';

/**
 * Core encounter cards whose printed text cannot be modeled yet.
 * Their placeholder abilities were removed (card-integration-protocol circuit-breaker) so the engine
 * never executes behavior that contradicts the printed text. Each must point at its ambiguity report.
 */
const BLOCKED: Record<string, { keeps?: 'BOOST' | 'WHEN_REVEALED' }> = {
  '01163': {},
  '01164': { keeps: 'BOOST' },
};

describe('Blocked core encounter cards declare no placeholder abilities', () => {
  it.each(Object.keys(BLOCKED))('%s declares only the abilities that are modeled', (code) => {
    const card = cardCatalog.getCard(code)!;
    const abilities = card.enrichment?.abilities ?? [];
    const keeps = BLOCKED[code].keeps;
    if (keeps) {
      expect(abilities.length).toBeGreaterThan(0);
      expect(abilities.every((a) => a.trigger === keeps)).toBe(true);
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
