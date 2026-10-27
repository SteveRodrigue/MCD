import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { CardView } from '../../src/ui/components/cards/CardView';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { createCardInstance } from '../../src/engine/state/card-instance';

vi.mock('../../src/ui/hooks/useCardArt', () => ({
  useCardArt: vi.fn().mockReturnValue({
    artUrl: 'https://cdn.example.com/test.jpg',
    loading: false,
    error: null,
  }),
}));

describe('CardView exhaustion prop precedence', () => {
  it('does not render EXHAUSTED badge or rotate-30 when isExhausted={false} even if instance.exhausted is true', () => {
    const card = cardCatalog.getCard('01008')!; // Web-Shooter
    const instance = createCardInstance(card);
    instance.exhausted = true;

    const { container, queryByText } = render(
      <CardView card={card} instance={instance} isExhausted={false} />,
    );

    expect(queryByText('EXHAUSTED')).toBeNull();
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).not.toContain('rotate-30');
    expect(root.className).toContain('rotate-0');
  });

  it('tilts and tags the card from instance.exhausted when no isExhausted prop is given (#453)', () => {
    const card = cardCatalog.getCard('01008')!; // Web-Shooter
    const instance = createCardInstance(card);
    instance.exhausted = true;

    const { container, getByText } = render(<CardView card={card} instance={instance} />);

    expect(getByText('EXHAUSTED')).toBeDefined();
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain('rotate-30');
  });
});
