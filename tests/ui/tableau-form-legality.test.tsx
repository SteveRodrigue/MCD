import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CardCatalog } from '../../src/data/importer/card-loader';
import { createCardInstance } from '../../src/engine/index';
import corePack from '../../data/upstream/pack/core.json';
import coreEncounterPack from '../../data/upstream/pack/core_encounter.json';
import { evaluateTableauCardLegality } from '../../src/ui/components/board/tableau-card-legality';
import { CardView } from '../../src/ui/components/cards/CardView';
import * as cardArtHook from '../../src/ui/hooks/useCardArt';

vi.mock('../../src/ui/hooks/useCardArt', () => ({
  useCardArt: vi.fn(),
}));

describe('Tableau Card Form Legality & Grayscale Invariants (Issue #159)', () => {
  const catalog = new CardCatalog([...corePack, ...coreEncounterPack]);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(cardArtHook.useCardArt).mockReturnValue({
      artUrl: 'https://cdn.example.com/test.jpg',
      loading: false,
      error: null,
    });
  });

  it('Web-Shooter (01008): Hero Resource is usable in Hero form and unusable in Alter-Ego form', () => {
    const card = catalog.getCard('01008')!; // Web-Shooter
    const instance = createCardInstance(card);

    // In Hero form: legal and usable
    const heroLegality = evaluateTableauCardLegality(instance, 'hero');
    expect(heroLegality.isUsable).toBe(true);
    expect(heroLegality.badge).toBeUndefined();

    // In Alter-Ego form: illegal, badge HERO ONLY
    const alterEgoLegality = evaluateTableauCardLegality(instance, 'alter_ego');
    expect(alterEgoLegality.isUsable).toBe(false);
    expect(alterEgoLegality.badge).toBe('HERO ONLY');
    expect(alterEgoLegality.reason).toBe('Requires Hero form');
  });

  it('Aunt May (01006): Alter-Ego Action is usable in Alter-Ego form and unusable in Hero form', () => {
    const card = catalog.getCard('01006')!; // Aunt May
    const instance = createCardInstance(card);

    // In Alter-Ego form: legal and usable
    const alterEgoLegality = evaluateTableauCardLegality(instance, 'alter_ego');
    expect(alterEgoLegality.isUsable).toBe(true);
    expect(alterEgoLegality.badge).toBeUndefined();

    // In Hero form: illegal, badge ALTER-EGO ONLY
    const heroLegality = evaluateTableauCardLegality(instance, 'hero');
    expect(heroLegality.isUsable).toBe(false);
    expect(heroLegality.badge).toBe('ALTER-EGO ONLY');
    expect(heroLegality.reason).toBe('Requires Alter-Ego form');
  });

  it('Helicarrier (01092) & Avengers Mansion (01091): Universal Actions are usable in both forms', () => {
    const helicarrier = createCardInstance(catalog.getCard('01092')!);
    const mansion = createCardInstance(catalog.getCard('01091')!);

    expect(evaluateTableauCardLegality(helicarrier, 'hero').isUsable).toBe(true);
    expect(evaluateTableauCardLegality(helicarrier, 'alter_ego').isUsable).toBe(true);

    expect(evaluateTableauCardLegality(mansion, 'hero').isUsable).toBe(true);
    expect(evaluateTableauCardLegality(mansion, 'alter_ego').isUsable).toBe(true);
  });

  it('Tenacity (01093) & Arc Reactor (01035): Hero Action upgrades are unusable in Alter-Ego form', () => {
    const tenacity = createCardInstance(catalog.getCard('01093')!);
    const arcReactor = createCardInstance(catalog.getCard('01035')!);

    expect(evaluateTableauCardLegality(tenacity, 'hero').isUsable).toBe(true);
    const tenacityAe = evaluateTableauCardLegality(tenacity, 'alter_ego');
    expect(tenacityAe.isUsable).toBe(false);
    expect(tenacityAe.badge).toBe('HERO ONLY');
    expect(tenacityAe.reason).toBe('Requires Hero form');

    expect(evaluateTableauCardLegality(arcReactor, 'hero').isUsable).toBe(true);
    const arcReactorAe = evaluateTableauCardLegality(arcReactor, 'alter_ego');
    expect(arcReactorAe.isUsable).toBe(false);
    expect(arcReactorAe.badge).toBe('HERO ONLY');
    expect(arcReactorAe.reason).toBe('Requires Hero form');
  });

  it('CardView renders grayscale filter and HERO ONLY badge when isUsable is false', () => {
    const card = catalog.getCard('01008')!;
    const instance = createCardInstance(card);

    const { container } = render(
      <CardView
        card={card}
        instance={instance}
        isUsable={false}
        unusableBadge="HERO ONLY"
        unusableReason="Requires Hero form"
      />,
    );

    // Verify grayscale styling is applied
    const cardContainer = container.querySelector('.filter.grayscale');
    expect(cardContainer).not.toBeNull();

    // Verify badge text
    expect(screen.getByText('HERO ONLY')).toBeDefined();
  });

  it('CardView renders full color without badge when isUsable is true', () => {
    const card = catalog.getCard('01008')!;
    const instance = createCardInstance(card);

    const { container } = render(<CardView card={card} instance={instance} isUsable={true} />);

    // Grayscale should NOT be applied
    const cardContainer = container.querySelector('.filter.grayscale');
    expect(cardContainer).toBeNull();

    // Unusable badge should NOT exist
    expect(screen.queryByText('HERO ONLY')).toBeNull();
    expect(screen.queryByText('CANNOT PLAY')).toBeNull();
  });
});
