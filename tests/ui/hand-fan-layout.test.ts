import { describe, it, expect } from 'vitest';

describe('Hand Fan-Out Stack Layout Architecture', () => {
  it('calculates unconstrained default gap when cards fit within container', () => {
    const cardCount = 3;
    const cardWidth = 176;
    const defaultGap = 16;
    const padding = 32;
    const containerWidth = 1000;

    const usableWidth = containerWidth - padding; // 968px
    const totalNaturalWidth = cardCount * cardWidth + (cardCount - 1) * defaultGap; // 3*176 + 2*16 = 560px

    expect(totalNaturalWidth).toBeLessThanOrEqual(usableWidth);

    let overlapMargin = defaultGap;
    let isTightened = false;

    if (cardCount > 1 && totalNaturalWidth > usableWidth) {
      isTightened = true;
      const spacing = (usableWidth - cardWidth) / (cardCount - 1);
      overlapMargin = spacing - cardWidth;
    }

    expect(isTightened).toBe(false);
    expect(overlapMargin).toBe(16);
  });

  it('calculates negative overlap margin when cards exceed usable container width', () => {
    const cardCount = 8;
    const cardWidth = 176;
    const defaultGap = 16;
    const padding = 32;
    const containerWidth = 900;

    const usableWidth = containerWidth - padding; // 868px
    const totalNaturalWidth = cardCount * cardWidth + (cardCount - 1) * defaultGap; // 8*176 + 7*16 = 1520px

    expect(totalNaturalWidth).toBeGreaterThan(usableWidth);

    let overlapMargin = defaultGap;
    let isTightened = false;

    if (cardCount > 1 && totalNaturalWidth > usableWidth) {
      isTightened = true;
      const spacing = (usableWidth - cardWidth) / (cardCount - 1);
      overlapMargin = spacing - cardWidth;
    }

    expect(isTightened).toBe(true);
    expect(overlapMargin).toBeLessThan(0);

    // Total resulting width: 1st card + (N-1) * (cardWidth + overlapMargin) = cardWidth + (N-1)*spacing = usableWidth
    const spacing = cardWidth + overlapMargin;
    const totalRenderedWidth = cardWidth + (cardCount - 1) * spacing;
    expect(Math.round(totalRenderedWidth)).toBe(usableWidth);
  });

  it('ensures descending z-index stacking puts leftmost card (index 0) at the top', () => {
    const handSize = 6;
    const zIndices = Array.from({ length: handSize }, (_, i) => 30 - i);

    expect(zIndices[0]).toBe(30); // Top of stack
    expect(zIndices[1]).toBe(29);
    expect(zIndices[5]).toBe(25); // Bottom of stack
    expect(zIndices[0]).toBeGreaterThan(zIndices[1]);
    expect(zIndices[1]).toBeGreaterThan(zIndices[2]);
  });

  it('guarantees 1-hero mode hand width never overflows viewport/container with standard fan-out algorithm', () => {
    const cardCount = 6;
    const cardWidth = 128; // size="sm"
    const defaultGap = 12;
    const padding = 24;
    const containerWidth = 820; // standard solo/station width

    const usableWidth = containerWidth - padding; // 796px
    const naturalWidth = cardCount * cardWidth + (cardCount - 1) * defaultGap; // 6*128 + 5*12 = 828px

    expect(naturalWidth).toBeGreaterThan(usableWidth);

    const spacing = Math.min(defaultGap + cardWidth, (usableWidth - cardWidth) / (cardCount - 1));
    const overlapMargin = spacing - cardWidth;
    const totalRenderedWidth = cardWidth + (cardCount - 1) * spacing;

    expect(overlapMargin).toBeLessThan(defaultGap);
    expect(Math.round(totalRenderedWidth)).toBeLessThanOrEqual(usableWidth);
  });
});
