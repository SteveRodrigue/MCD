import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UniversalCardFilterBuilder } from '../../src/ui/components/editor/UniversalCardFilterBuilder';
import { sanitizeCardFilter } from '../../src/ui/components/editor/universal-card-filter-utils';
import { UniversalCardFilterSchema } from '../../src/data/supplemental/schema';

describe('UniversalCardFilter Contract Tests', () => {
  it('validates card filters created by editor builder against Zod schema', () => {
    expect(
      UniversalCardFilterSchema.safeParse({
        types: ['upgrade', 'ally'],
        traits: ['Tech'],
        aspects: ['aggression'],
      }).success,
    ).toBe(true);

    expect(
      UniversalCardFilterSchema.safeParse({
        codes: ['01002'],
        cost: { equals: 2 },
      }).success,
    ).toBe(true);
  });

  it('validates cost range bounds (min, max, equals)', () => {
    expect(
      UniversalCardFilterSchema.safeParse({
        cost: { min: 1, max: 4 },
      }).success,
    ).toBe(true);
  });

  it('validates resource icons and unicity criteria', () => {
    expect(
      UniversalCardFilterSchema.safeParse({
        resourceIcons: ['mental', 'wild'],
        isUnique: true,
      }).success,
    ).toBe(true);
  });

  it('validates composable boolean combinators (all, any, none)', () => {
    expect(
      UniversalCardFilterSchema.safeParse({
        all: [{ types: ['ally'] }, { traits: ['Avenger'] }],
        none: [{ codes: ['01012'] }],
      }).success,
    ).toBe(true);
  });

  it('rejects invalid or unknown property keys due to strict schema enforcement', () => {
    expect(
      UniversalCardFilterSchema.safeParse({
        unknownProp: 'invalid',
      }).success,
    ).toBe(false);

    expect(
      UniversalCardFilterSchema.safeParse({
        cardTypes: ['upgrade'], // Deprecated legacy key
      }).success,
    ).toBe(false);
  });
});

describe('sanitizeCardFilter Eager Sanitization', () => {
  it('returns undefined for null, undefined, or empty object', () => {
    expect(sanitizeCardFilter(undefined)).toBeUndefined();
    expect(sanitizeCardFilter({})).toBeUndefined();
  });

  it('strips empty arrays and whitespace strings', () => {
    const dirty = {
      codes: ['  ', ''],
      traits: ['Avenger', ' '],
      types: [],
    };
    const cleaned = sanitizeCardFilter(dirty as any);
    expect(cleaned).toEqual({ traits: ['Avenger'] });
    expect(UniversalCardFilterSchema.safeParse(cleaned).success).toBe(true);
  });

  it('cleans cost comparison object when bounds are undefined', () => {
    const dirty = {
      cost: { min: undefined, max: undefined } as any,
    };
    expect(sanitizeCardFilter(dirty)).toBeUndefined();
  });

  it('recursively cleans boolean combinator branches', () => {
    const dirty = {
      all: [{ codes: ['01002'] }, { traits: ['   '] }],
    };
    const cleaned = sanitizeCardFilter(dirty as any);
    expect(cleaned).toEqual({
      all: [{ codes: ['01002'] }],
    });
    expect(UniversalCardFilterSchema.safeParse(cleaned).success).toBe(true);
  });
});

describe('UniversalCardFilterBuilder Interactive UI Component', () => {
  it('renders correctly with undefined initial filter', () => {
    render(<UniversalCardFilterBuilder filter={undefined} onChange={vi.fn()} />);

    expect(screen.getByText('Universal Card Filter')).toBeDefined();
    expect(screen.getByTestId('filter-codes-input')).toBeDefined();
    expect(screen.getByTestId('filter-traits-input')).toBeDefined();
    expect(screen.getByTestId('filter-type-ally')).toBeDefined();
    expect(screen.getByTestId('filter-aspect-aggression')).toBeDefined();
  });

  it('toggles card type chips and invokes onChange with updated list', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(<UniversalCardFilterBuilder filter={{ types: ['ally'] }} onChange={handleChange} />);

    const allyBtn = screen.getByTestId('filter-type-ally');
    const upgradeBtn = screen.getByTestId('filter-type-upgrade');

    // Add upgrade
    await user.click(upgradeBtn);
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        types: ['ally', 'upgrade'],
      }),
    );

    // Remove ally
    await user.click(allyBtn);
    expect(handleChange).toHaveBeenCalledWith(undefined); // Since ally removed and prop had only ally
  });

  it('toggles aspect chips and resource chips', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(<UniversalCardFilterBuilder filter={undefined} onChange={handleChange} />);

    await user.click(screen.getByTestId('filter-aspect-justice'));
    expect(handleChange).toHaveBeenCalledWith({
      aspects: ['justice'],
    });

    await user.click(screen.getByTestId('filter-resource-mental'));
    expect(handleChange).toHaveBeenCalledWith({
      resourceIcons: ['mental'],
    });
  });

  it('updates cost comparison min, max, equals fields', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(<UniversalCardFilterBuilder filter={{ cost: { min: 2 } }} onChange={handleChange} />);

    const maxInput = screen.getByTestId('filter-cost-max');
    await user.type(maxInput, '4');

    expect(handleChange).toHaveBeenCalledWith({
      cost: { min: 2, max: 4 },
    });
  });

  it('updates unicity and identity specific selects', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(<UniversalCardFilterBuilder filter={undefined} onChange={handleChange} />);

    const uniqueSelect = screen.getByTestId('filter-is-unique-select');
    await user.selectOptions(uniqueSelect, 'true');

    expect(handleChange).toHaveBeenCalledWith({
      isUnique: true,
    });
  });

  it('adds and removes boolean combinator branches', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <UniversalCardFilterBuilder
        filter={{ all: [{ codes: ['01002'] }] }}
        onChange={handleChange}
      />,
    );

    const removeBtn = screen.getByTestId('remove-all-subfilter-0');
    await user.click(removeBtn);

    expect(handleChange).toHaveBeenCalledWith(undefined);
  });

  it('clears filter when Clear Filter button is clicked', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(<UniversalCardFilterBuilder filter={{ codes: ['01002'] }} onChange={handleChange} />);

    const clearBtn = screen.getByText('Clear Filter');
    await user.click(clearBtn);

    expect(handleChange).toHaveBeenCalledWith(undefined);
  });
});
