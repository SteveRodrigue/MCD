import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AbilityFormBuilder } from '../../src/ui/components/editor/AbilityFormBuilder';
import { UniversalCardFilterBuilder } from '../../src/ui/components/editor/UniversalCardFilterBuilder';
import { DynamicValueBuilder } from '../../src/ui/components/editor/DynamicValueBuilder';
import { CardAttributesSection } from '../../src/ui/components/editor/CardAttributesSection';
import { SupplementalEditorScreen } from '../../src/ui/components/editor/SupplementalEditorScreen';
import { DualCardInspector } from '../../src/ui/components/editor/DualCardInspector';
import type { CardDetailsResponse } from '../../src/tools/editor/api-middleware';

// Mock API service for SupplementalEditorScreen
vi.mock('../../src/ui/services/supplemental-editor-service', () => ({
  fetchPacksMetadata: vi.fn().mockResolvedValue({
    packs: [{ code: 'core', name: 'Core Set' }],
    sets: [],
    factions: [],
    packFiles: ['core.json'],
  }),
  fetchCards: vi.fn().mockResolvedValue({
    total: 1,
    cards: [
      {
        code: '01001a',
        name: 'Spider-Man',
        packCode: 'core',
        packFile: 'core.json',
        factionCode: 'hero',
        typeCode: 'hero',
        hasSupplemental: true,
        isValid: true,
      },
    ],
  }),
  fetchCardDetails: vi.fn().mockResolvedValue(null),
  saveCardSupplemental: vi.fn().mockResolvedValue({ success: true }),
}));

describe('Editor UI Contrast & Layout Ergonomics (Issue #116)', () => {
  it('verifies + Add Ability button contrast and design system classes', () => {
    render(<AbilityFormBuilder supplemental={{}} onChange={vi.fn()} />);

    const addBtn = screen.getByTestId('add-ability-btn');
    expect(addBtn).toBeDefined();
    expect(addBtn.classList.contains('bg-comic-accent')).toBe(true);
    expect(addBtn.classList.contains('hover:bg-sky-700')).toBe(true);
    expect(addBtn.classList.contains('text-white')).toBe(true);
    expect(addBtn.classList.contains('font-bold')).toBe(true);
    expect(addBtn.classList.contains('border-2')).toBe(true);
    expect(addBtn.classList.contains('border-black')).toBe(true);
    expect(addBtn.classList.contains('shadow-comic-xs')).toBe(true);
  });

  it('verifies selected Card Types filter chips contrast and design system classes', () => {
    render(<UniversalCardFilterBuilder filter={{ types: ['ally'] }} onChange={vi.fn()} />);

    const allyChip = screen.getByTestId('filter-type-ally');
    expect(allyChip).toBeDefined();
    expect(allyChip.classList.contains('bg-comic-accent')).toBe(true);
    expect(allyChip.classList.contains('text-white')).toBe(true);
    expect(allyChip.classList.contains('shadow-comic-xs')).toBe(true);
    expect(allyChip.classList.contains('font-bold')).toBe(true);

    const eventChip = screen.getByTestId('filter-type-event');
    expect(eventChip).toBeDefined();
    expect(eventChip.classList.contains('bg-comic-accent')).toBe(false);
  });

  it('verifies active Fixed Number button contrast and classes in DynamicValueBuilder', () => {
    render(<DynamicValueBuilder label="Damage Amount" value={3} onChange={vi.fn()} />);

    const fixedBtn = screen.getByTestId('mode-fixed');
    expect(fixedBtn).toBeDefined();
    expect(fixedBtn.classList.contains('bg-comic-accent')).toBe(true);
    expect(fixedBtn.classList.contains('text-white')).toBe(true);
    expect(fixedBtn.classList.contains('shadow-comic-xs')).toBe(true);
    expect(fixedBtn.classList.contains('font-bold')).toBe(true);
  });

  it('verifies active Structured Keywords chips contrast and classes in CardAttributesSection', () => {
    render(<CardAttributesSection supplemental={{ keywords: ['guard'] }} onChange={vi.fn()} />);

    const guardChip = screen.getByTestId('keyword-guard');
    expect(guardChip).toBeDefined();
    expect(guardChip.classList.contains('bg-comic-accent')).toBe(true);
    expect(guardChip.classList.contains('text-white')).toBe(true);
    expect(guardChip.classList.contains('shadow-comic-xs')).toBe(true);
    expect(guardChip.classList.contains('font-bold')).toBe(true);

    const rangedChip = screen.getByTestId('keyword-ranged');
    expect(rangedChip).toBeDefined();
    expect(rangedChip.classList.contains('bg-comic-accent')).toBe(false);
  });

  it('verifies SupplementalEditorScreen sidebar toggle collapses and expands Column 1', async () => {
    const user = userEvent.setup();
    await act(async () => {
      render(<SupplementalEditorScreen />);
    });

    const sidebarPane = screen.getByTestId('card-gallery-pane');
    expect(sidebarPane.classList.contains('hidden')).toBe(false);

    const toggleBtn = screen.getByTestId('toggle-sidebar-btn');
    expect(toggleBtn).toBeDefined();

    // Click to collapse
    await user.click(toggleBtn);
    expect(sidebarPane.classList.contains('hidden')).toBe(true);

    // Click to expand
    await user.click(toggleBtn);
    expect(sidebarPane.classList.contains('hidden')).toBe(false);
  });

  it('verifies DualCardInspector layout proportions and 2-column Zzorba properties grid', async () => {
    const mockDetails: CardDetailsResponse = {
      code: '01001a',
      packCode: 'core',
      packFile: 'core.json',
      upstream: {
        code: '01001a',
        name: 'Spider-Man',
        type_code: 'hero',
        faction_code: 'hero',
        set_code: 'spiderman',
        health: 10,
        hand_size: 5,
        thwart: 2,
        attack: 2,
        defense: 3,
        text: 'Spider-Sense — When the villain attacks...',
        flavor: 'With great power...',
        traits: 'Avenger.',
      },
      supplemental: {},
      validation: {
        valid: true,
        errors: [],
      },
    };

    await act(async () => {
      render(
        <DualCardInspector
          cardDetails={mockDetails}
          loading={false}
          onSaveSupplemental={vi.fn()}
        />,
      );
    });

    // Verify Zzorba 2-column grid
    const zzorbaHeading = screen.getByText('UPSTREAM ZZORBA PROPERTIES');
    const zzorbaContainer = zzorbaHeading.closest('div');
    const zzorbaGrid = zzorbaContainer?.parentElement?.querySelector('.grid');
    expect(zzorbaGrid).toBeDefined();
    expect(zzorbaGrid?.classList.contains('grid-cols-2')).toBe(true);
    expect(zzorbaGrid?.classList.contains('sm:grid-cols-3')).toBe(false);

    // Verify Column 2 (card preview) natural width
    const printedHeading = screen.getByText('PRINTED CARD TEXT');
    const leftCol = printedHeading.closest('.border-r-4');
    expect(leftCol?.classList.contains('md:w-[320px]')).toBe(true);
    expect(leftCol?.classList.contains('lg:w-[340px]')).toBe(true);
    expect(leftCol?.classList.contains('shrink-0')).toBe(true);
    expect(leftCol?.classList.contains('md:w-1/2')).toBe(false);

    // Verify Column 3 (rules editor) expands to fill remaining space
    const rulesEditor = screen.getByText('DECLARATIVE ABILITIES (0)').closest('.flex-1');
    expect(rulesEditor).toBeDefined();
    expect(rulesEditor?.classList.contains('flex-1')).toBe(true);
    expect(rulesEditor?.classList.contains('w-full')).toBe(true);
    expect(rulesEditor?.classList.contains('md:w-1/2')).toBe(false);
  });
});
