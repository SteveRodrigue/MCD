import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CardFilterToolbar } from '../../src/ui/components/editor/CardFilterToolbar';
import type { PackMetadataResponse } from '../../src/tools/editor/api-middleware';

const mockMetadata: PackMetadataResponse = {
  packs: [
    { code: 'core', name: 'Core Set', size: 355 },
    { code: 'gob', name: 'The Green Goblin', size: 78 },
  ],
  sets: [
    {
      code: 'rhino',
      name: 'Rhino',
      card_set_type_code: 'villain',
      pack_code: 'core',
      pack_codes: ['core'],
    },
    {
      code: 'spider_man',
      name: 'Spider-Man',
      card_set_type_code: 'hero',
      pack_code: 'core',
      pack_codes: ['core'],
    },
    {
      code: 'mutagen_formula',
      name: 'Mutagen Formula',
      card_set_type_code: 'villain',
      pack_code: 'gob',
      pack_codes: ['gob'],
    },
    {
      code: 'risky_business',
      name: 'Risky Business',
      card_set_type_code: 'villain',
      pack_code: 'gob',
      pack_codes: ['gob'],
    },
  ],
  factions: [
    { code: 'aggression', name: 'Aggression' },
    { code: 'justice', name: 'Justice' },
  ],
  packFiles: ['core.json', 'gob.json'],
};

describe('CardFilterToolbar Encounter Set filtering by pack (Issue #478)', () => {
  it('renders all sets when no pack is selected', () => {
    const onFiltersChange = vi.fn();
    render(
      <CardFilterToolbar
        filters={{}}
        onFiltersChange={onFiltersChange}
        metadata={mockMetadata}
        totalCards={433}
        filteredCards={433}
        loading={false}
      />,
    );

    const setSelect = screen.getByLabelText(/encounter \/ set/i);
    expect(setSelect).toBeDefined();

    const options = Array.from(setSelect.querySelectorAll('option')).map((o) => o.textContent);
    expect(options[0]).toContain('All Sets (4)');
    expect(options).toContain('Rhino [villain]');
    expect(options).toContain('Spider-Man [hero]');
    expect(options).toContain('Mutagen Formula [villain]');
    expect(options).toContain('Risky Business [villain]');
  });

  it('renders only sets belonging to the selected pack', () => {
    const onFiltersChange = vi.fn();
    render(
      <CardFilterToolbar
        filters={{ pack: 'gob' }}
        onFiltersChange={onFiltersChange}
        metadata={mockMetadata}
        totalCards={433}
        filteredCards={78}
        loading={false}
      />,
    );

    const setSelect = screen.getByLabelText(/encounter \/ set/i);
    const options = Array.from(setSelect.querySelectorAll('option')).map((o) => o.textContent);

    expect(options[0]).toContain('All Sets in Pack (2)');
    expect(options).toContain('Mutagen Formula [villain]');
    expect(options).toContain('Risky Business [villain]');
    expect(options).not.toContain('Rhino [villain]');
    expect(options).not.toContain('Spider-Man [hero]');
  });

  it('resets selected set if switching to a pack that does not contain that set', async () => {
    const user = userEvent.setup();
    const onFiltersChange = vi.fn();
    render(
      <CardFilterToolbar
        filters={{ pack: 'core', set: 'rhino' }}
        onFiltersChange={onFiltersChange}
        metadata={mockMetadata}
        totalCards={433}
        filteredCards={15}
        loading={false}
      />,
    );

    const packSelect = screen.getByLabelText(/zzorba pack/i);
    await user.selectOptions(packSelect, 'gob');

    expect(onFiltersChange).toHaveBeenCalledWith(
      expect.objectContaining({
        pack: 'gob',
        set: undefined,
      }),
    );
  });

  it('preserves selected set if switching to a pack that also contains that set', async () => {
    const multiPackMetadata: PackMetadataResponse = {
      ...mockMetadata,
      sets: [
        ...mockMetadata.sets,
        {
          code: 'standard_pvp',
          name: 'Standard PvP',
          card_set_type_code: 'modular',
          pack_codes: ['core', 'gob'],
        },
      ],
    };

    const user = userEvent.setup();
    const onFiltersChange = vi.fn();
    render(
      <CardFilterToolbar
        filters={{ pack: 'core', set: 'standard_pvp' }}
        onFiltersChange={onFiltersChange}
        metadata={multiPackMetadata}
        totalCards={433}
        filteredCards={5}
        loading={false}
      />,
    );

    const packSelect = screen.getByLabelText(/zzorba pack/i);
    await user.selectOptions(packSelect, 'gob');

    expect(onFiltersChange).toHaveBeenCalledWith(
      expect.objectContaining({
        pack: 'gob',
        set: 'standard_pvp',
      }),
    );
  });
});
