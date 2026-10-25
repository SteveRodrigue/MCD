import { describe, it, expect } from 'vitest';
import { Z, Z_CLASS, type ZLayer } from '../../src/ui/styles/z-layers';
// @ts-expect-error plain JS config has no type declarations
import tailwindConfig from '../../tailwind.config.js';

describe('Global z-index scale (Issue #312)', () => {
  it('defines exactly the documented layer values', () => {
    expect(Z).toEqual({
      table: 0,
      content: 100,
      raised: 200,
      zoom: 400,
      drawer: 600,
      modal: 700,
      banner: 800,
      menu: 900,
      critical: 1000,
    });
  });

  it('spaces every layer by a multiple of 100 except table', () => {
    for (const [key, value] of Object.entries(Z)) {
      if (key === 'table') {
        expect(value).toBe(0);
      } else {
        expect(value % 100).toBe(0);
      }
    }
  });

  it('exposes a literal Tailwind class per layer', () => {
    for (const key of Object.keys(Z) as ZLayer[]) {
      expect(Z_CLASS[key]).toBe(`z-${key}`);
    }
  });

  it('feeds the Tailwind config zIndex theme from the same scale', () => {
    const expected = Object.fromEntries(Object.entries(Z).map(([k, v]) => [k, String(v)]));
    expect((tailwindConfig as any).theme.extend.zIndex).toEqual(expected);
  });
});
