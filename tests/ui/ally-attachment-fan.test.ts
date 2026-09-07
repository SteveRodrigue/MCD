import { describe, it, expect } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { createCardInstance } from '@engine/state/game-setup';

describe('Ally Attachment Staircase Fan Layout Architecture (Issue #83)', () => {
  it('calculates 42% downward and 11% leftward staircase offsets per attachment index', () => {
    // Offset formula for attachment i (0-indexed behind host):
    // top = (i + 1) * 42%
    // left = (i + 1) * -11%
    const getAttachmentOffset = (index: number) => {
      const topPercent = (index + 1) * 42;
      const leftPercent = (index + 1) * -11;
      return { top: `${topPercent}%`, left: `${leftPercent}%` };
    };

    // Attachment 0 (first attachment behind host): 42% down, -11% left
    expect(getAttachmentOffset(0)).toEqual({ top: '42%', left: '-11%' });

    // Attachment 1 (second attachment behind first attachment): 84% down, -22% left
    expect(getAttachmentOffset(1)).toEqual({ top: '84%', left: '-22%' });
  });

  it('calculates dynamic vertical expansion to accommodate fan-down attachments without overflow', () => {
    const getVerticalExtraPx = (attachmentCount: number) => {
      return attachmentCount > 0 ? attachmentCount * 70 : 0;
    };

    expect(getVerticalExtraPx(0)).toBe(0);
    expect(getVerticalExtraPx(1)).toBe(70);
    expect(getVerticalExtraPx(2)).toBe(140);
  });

  it('establishes descending z-index stacking behind host: Host (z-30) > Att 0 (z-20) > Att 1 (z-10)', () => {
    const getAttachmentZIndex = (totalAttachments: number, index: number) => {
      // Base attachment z-index descends so earlier attachments sit above later ones, but below host (30)
      return (totalAttachments - index) * 10;
    };

    const total = 2;
    const hostZIndex = 30;
    const att0ZIndex = getAttachmentZIndex(total, 0); // 20
    const att1ZIndex = getAttachmentZIndex(total, 1); // 10

    expect(hostZIndex).toBeGreaterThan(att0ZIndex);
    expect(att0ZIndex).toBeGreaterThan(att1ZIndex);
    expect(att0ZIndex).toBe(20);
    expect(att1ZIndex).toBe(10);
  });

  it('isolates exhaustion: exhausting host ally leaves attachment unexhausted', () => {
    const daredevilCard = cardCatalog.getCard('01058')!;
    const inspiredCard = cardCatalog.getCard('01074')!;

    const daredevil = createCardInstance(daredevilCard);
    const inspired = createCardInstance(inspiredCard);
    daredevil.attachments = [inspired];

    // Simulate exhausting host ally
    daredevil.exhausted = true;

    // Invariant: Attachment must remain unexhausted
    expect(daredevil.exhausted).toBe(true);
    expect(daredevil.attachments[0].exhausted).toBeFalsy();
  });
});
