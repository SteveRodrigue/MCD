import { describe, it, expect } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';

/**
 * RR v1.8 Appendix II step 16 resolves "Setup" abilities on the player cards in play at the start
 * of the game: identities. No other card is ever resolved at that point, so a SETUP ability on an
 * ally, minion or villain is dead data (Luke Cage 01076, Sandman 01102 and Rhino stage III 01096
 * print only the Toughness keyword; the engine gives the tough status card, #283).
 */
const IDENTITY_TYPES = new Set(['hero', 'alter_ego']);

describe('SETUP abilities belong to identity cards', () => {
  it('no other card declares a SETUP ability', () => {
    const offenders = cardCatalog
      .getAllCards()
      .filter((c) => !IDENTITY_TYPES.has(c.type as string))
      .filter((c) => (c.enrichment?.abilities ?? []).some((a) => a.timing === 'SETUP'))
      .map((c) => `${c.code} ${c.name}`);
    expect(offenders).toEqual([]);
  });
});
