import { describe, it, expect } from 'vitest';
import { getFanZIndex } from '../../src/ui/components/cards/fan-z';

describe('getFanZIndex (Issue #312)', () => {
  it.each([1, 5, 6, 32, 50, 99])(
    'is positive, strictly decreasing and hover-topped for %i cards',
    (count) => {
      const resting = Array.from({ length: count }, (_, i) => getFanZIndex(count, i));
      for (const z of resting) expect(z).toBeGreaterThanOrEqual(1);
      for (let i = 1; i < count; i++) expect(resting[i]).toBeLessThan(resting[i - 1]);
      for (let i = 0; i < count; i++) {
        const hovered = getFanZIndex(count, i, true);
        expect(hovered).toBe(count + 1);
        expect(hovered).toBeGreaterThan(Math.max(...resting));
      }
    },
  );
});
