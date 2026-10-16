import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CardAttributesSection } from '../../src/ui/components/editor/CardAttributesSection';
import { cardCatalog } from '../../src/data/importer/card-loader';

const upstream = (code: string) => {
  const card = cardCatalog.getCard(code);
  expect(card, `card ${code} is not in the catalog`).toBeDefined();
  return card!;
};

const badgeTexts = () =>
  Array.from(
    screen.getByTestId('upstream-badges').querySelectorAll('[data-testid^="upstream-badge-"]'),
  ).map((el) => el.textContent);

const renderBadges = (code: string) =>
  render(
    <CardAttributesSection supplemental={{}} onChange={vi.fn()} upstreamCard={upstream(code)} />,
  );

describe('CardAttributesSection read-only upstream badges', () => {
  it('shows no badge strip without an upstream card', () => {
    render(<CardAttributesSection supplemental={{}} onChange={vi.fn()} />);
    expect(screen.queryByTestId('upstream-badges')).toBeNull();
  });

  it('shows Max N per player from the upstream card (Energy Channel 01018)', () => {
    renderBadges('01018');
    expect(screen.getByTestId('upstream-badge-max-per-player').textContent).toBe(
      'Max 1 per player',
    );
  });

  it('shows the dash power and the consequential damage of Hulk (01050): THW is a dash', () => {
    renderBadges('01050');
    expect(screen.getByTestId('upstream-badge-dash-thwart').textContent).toBe('THW –');
    expect(screen.getByTestId('upstream-badge-attack-cost').textContent).toBe(
      'Consequential ATK 1',
    );
    expect(screen.queryByTestId('upstream-badge-dash-attack')).toBeNull();
  });

  it('shows traits and a consequential THW cost for an ally (Black Cat 01002)', () => {
    renderBadges('01002');
    const texts = badgeTexts();
    expect(texts).toContain('Consequential THW 1');
    const traitTexts = upstream('01002').traits;
    expect(traitTexts.length).toBeGreaterThan(0);
    for (const trait of traitTexts) expect(texts).toContain(trait);
  });

  it('shows no consequential cost badge for cards that are not allies', () => {
    renderBadges('01018');
    expect(screen.queryByTestId('upstream-badge-attack-cost')).toBeNull();
    expect(screen.queryByTestId('upstream-badge-thwart-cost')).toBeNull();
  });

  it('shows keywords including Victory X as the loader derives them', () => {
    const card = { ...upstream('01018'), keywords: ['Guard', 'Victory 0', 'Victory -1'] as any };
    render(<CardAttributesSection supplemental={{}} onChange={vi.fn()} upstreamCard={card} />);
    expect(badgeTexts()).toEqual(expect.arrayContaining(['Guard', 'Victory 0', 'Victory -1']));
  });

  it('shows restricted slots when the upstream card has them', () => {
    const card = { ...upstream('01018'), restrictedSlots: 2 };
    render(<CardAttributesSection supplemental={{}} onChange={vi.fn()} upstreamCard={card} />);
    expect(screen.getByTestId('upstream-badge-restricted-slots').textContent).toBe(
      'Restricted slots 2',
    );
  });

  it('badges are static text, not inputs', () => {
    renderBadges('01050');
    const strip = screen.getByTestId('upstream-badges');
    expect(strip.querySelectorAll('input, select, textarea, button')).toHaveLength(0);
  });
});

describe('CardAttributesSection chip bar is independent of the card type', () => {
  it('offers every chip for any upstream card, since the editor no longer hides sections by type', () => {
    const chips = [
      'playRequirements',
      'uses',
      'attachTo',
      'recipient',
      'playUnderAnyPlayerControl',
      'errata',
    ];
    for (const code of ['01002', '01018', '01094', '01107']) {
      const { unmount } = render(
        <CardAttributesSection
          supplemental={{}}
          onChange={vi.fn()}
          upstreamCard={upstream(code)}
        />,
      );
      for (const key of chips) expect(screen.getByTestId(`card-chip-add-${key}`)).toBeDefined();
      unmount();
    }
  });
});
