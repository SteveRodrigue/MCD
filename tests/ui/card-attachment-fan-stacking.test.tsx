import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { CardAttachmentFan } from '../../src/ui/components/cards/CardAttachmentFan';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { createCardInstance } from '../../src/engine/state/game-setup';

vi.mock('../../src/ui/hooks/useCardArt', () => ({
  useCardArt: vi.fn().mockReturnValue({
    artUrl: 'https://cdn.example.com/test.jpg',
    loading: false,
    error: null,
  }),
}));

const makeUnderneath = (i: number) => {
  const inst = createCardInstance({
    code: `secret-${i}`,
    name: `Secret ${i}`,
    type: 'event',
    faction: 'justice',
  } as any);
  inst.ownerId = 'p1';
  return inst;
};

const z = (el: Element) => Number((el as HTMLElement).style.zIndex);

describe('CardAttachmentFan local stacking (Issue #312)', () => {
  it.each([
    [1, 0],
    [5, 0],
    [0, 6],
    [5, 6],
    [20, 20],
  ])('orders underneath < attachments < host for n=%i attachments, m=%i underneath', (n, m) => {
    const attachments = Array.from({ length: n }, () =>
      createCardInstance(cardCatalog.getCard('01099')!),
    );
    const cardsUnderneath = Array.from({ length: m }, (_, i) => makeUnderneath(i));
    const { container } = render(
      <CardAttachmentFan attachments={attachments} cardsUnderneath={cardsUnderneath}>
        <div data-testid="host-child">host</div>
      </CardAttachmentFan>,
    );

    const outer = container.firstElementChild as HTMLElement;
    expect(outer.className).toContain('isolate');
    expect(outer.className).toContain('hover:z-zoom');
    expect(outer.className).toContain('focus-within:z-zoom');

    const host = outer.firstElementChild as HTMLElement;
    const hostZ = z(host);
    expect(hostZ).toBe(m + n + 1);

    const attItems = Array.from(outer.querySelectorAll('.pointer-events-auto'));
    expect(attItems).toHaveLength(n);
    const underItems = Array.from(
      outer.querySelectorAll('[data-testid="underneath-facedown-card"]'),
    ).map((e) => e.parentElement as HTMLElement);
    expect(underItems).toHaveLength(m);

    const attZ = attItems.map(z);
    const underZ = underItems.map(z);
    for (const a of attZ) expect(a).toBeLessThan(hostZ);
    for (const u of underZ) expect(u).toBeLessThan(hostZ);
    for (const u of underZ) for (const a of attZ) expect(u).toBeLessThan(a);
    for (const u of underZ) expect(u).toBeGreaterThanOrEqual(1);

    if (n > 0) {
      fireEvent.mouseEnter(attItems[0]);
      expect(z(attItems[0])).toBe(m + n + 2);
      fireEvent.mouseLeave(attItems[0]);
      expect(z(attItems[0])).toBeLessThan(hostZ);
    }
  });
});
