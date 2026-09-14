import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CardAttributesSection } from '../../src/ui/components/editor/CardAttributesSection';

const StatefulCardAttributesSection: React.FC<{
  initial: any;
  onChange?: (val: any) => void;
  hasErrors?: boolean;
  errors?: string[];
}> = ({ initial, onChange, hasErrors, errors }) => {
  const [data, setData] = React.useState(initial);
  return (
    <CardAttributesSection
      supplemental={data}
      hasErrors={hasErrors}
      errors={errors}
      onChange={(updated) => {
        setData(updated);
        onChange?.(updated);
      }}
    />
  );
};

describe('CardAttributesSection', () => {
  it('renders all card metadata and attribute inputs', () => {
    render(<CardAttributesSection supplemental={{ comment: 'Test card' }} onChange={vi.fn()} />);

    expect(screen.getByText(/CARD-LEVEL ATTRIBUTES & AUDIT/i)).toBeDefined();
    expect(screen.getByPlaceholderText(/e\.g\. Hero attack/i)).toBeDefined();
    expect(screen.getByPlaceholderText(/Leave empty if unrestricted/i)).toBeDefined();
    expect(screen.getByTestId('card-traits-input')).toBeDefined();
    expect(screen.getByTestId('card-restricted-slots-input')).toBeDefined();
    expect(screen.getByTestId('card-additional-boost-cards-input')).toBeDefined();
    expect(screen.getByTestId('card-victory-points-input')).toBeDefined();
    expect(screen.getByTestId('card-is-landscape-checkbox')).toBeDefined();
    expect(screen.getByTestId('toggle-uses-btn')).toBeDefined();
    expect(screen.getByTestId('no-supplemental-needed-checkbox')).toBeDefined();
    expect(screen.getByTestId('play-req-identity-form-select')).toBeDefined();
  });

  it('updates basic card metadata (comment, limits, confidence, attribution)', () => {
    const handleChange = vi.fn();
    render(
      <StatefulCardAttributesSection initial={{ comment: 'Initial' }} onChange={handleChange} />,
    );

    const commentInput = screen.getByPlaceholderText(/e\.g\. Hero attack/i);
    fireEvent.change(commentInput, { target: { value: 'Updated comment' } });
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({ comment: 'Updated comment' }),
    );

    const maxInput = screen.getByPlaceholderText(/Leave empty if unrestricted/i);
    fireEvent.change(maxInput, { target: { value: '2' } });
    expect(handleChange).toHaveBeenCalledWith(expect.objectContaining({ maxPerPlayer: 2 }));
  });

  it('updates numeric properties and orientation (restrictedSlots, boost, victory, isLandscape)', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <StatefulCardAttributesSection initial={{ traits: ['Avenger'] }} onChange={handleChange} />,
    );

    const traitsInput = screen.getByTestId('card-traits-input');
    fireEvent.change(traitsInput, { target: { value: 'Avenger, Spy' } });
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({ traits: ['Avenger', 'Spy'] }),
    );

    const slotsInput = screen.getByTestId('card-restricted-slots-input');
    fireEvent.change(slotsInput, { target: { value: '2' } });
    expect(handleChange).toHaveBeenCalledWith(expect.objectContaining({ restrictedSlots: 2 }));

    const boostInput = screen.getByTestId('card-additional-boost-cards-input');
    fireEvent.change(boostInput, { target: { value: '1' } });
    expect(handleChange).toHaveBeenCalledWith(expect.objectContaining({ additionalBoostCards: 1 }));

    const vpInput = screen.getByTestId('card-victory-points-input');
    fireEvent.change(vpInput, { target: { value: '3' } });
    expect(handleChange).toHaveBeenCalledWith(expect.objectContaining({ victoryPoints: 3 }));

    const landscapeCheckbox = screen.getByTestId('card-is-landscape-checkbox');
    await user.click(landscapeCheckbox);
    expect(handleChange).toHaveBeenCalledWith(expect.objectContaining({ isLandscape: true }));
  });

  it('manages uses counters lifecycle (configure, update, remove)', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <StatefulCardAttributesSection
        initial={{ comment: 'Counters card' }}
        onChange={handleChange}
      />,
    );

    // Toggle Configure Uses
    const toggleBtn = screen.getByTestId('toggle-uses-btn');
    await user.click(toggleBtn);
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        uses: { count: 3, type: 'charge', discardOnEmpty: true },
      }),
    );

    // Update count, counterType, max, discardOnEmpty
    fireEvent.change(screen.getByTestId('uses-count-input'), { target: { value: '5' } });
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        uses: expect.objectContaining({ count: 5 }),
      }),
    );

    fireEvent.change(screen.getByTestId('uses-type-input'), {
      target: { value: 'web' },
    });
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        uses: expect.objectContaining({ type: 'web' }),
      }),
    );

    fireEvent.change(screen.getByTestId('uses-max-input'), { target: { value: '6' } });
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        uses: expect.objectContaining({ max: 6 }),
      }),
    );

    await user.click(screen.getByTestId('uses-discard-on-empty-checkbox'));
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        uses: expect.objectContaining({ discardOnEmpty: undefined }),
      }),
    );

    // Remove Uses
    await user.click(screen.getByTestId('toggle-uses-btn'));
    expect(handleChange).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ uses: expect.anything() }),
    );
  });

  it('toggles keywords and modifies Retaliate amount', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(<StatefulCardAttributesSection initial={{ keywords: [] }} onChange={handleChange} />);

    // Toggle Guard
    await user.click(screen.getByText('Guard'));
    expect(handleChange).toHaveBeenCalledWith(expect.objectContaining({ keywords: ['Guard'] }));

    // Toggle Retaliate and set amount
    await user.click(screen.getByText('Retaliate'));
    const retaliateInput = screen.getByTestId('keyword-retaliate-amount');
    fireEvent.change(retaliateInput, { target: { value: '3' } });
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        keywords: expect.arrayContaining([{ keyword: 'Retaliate', amount: 3 }]),
      }),
    );
  });

  it('configures play requirements (identity form, form trait, traits, control filter)', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(<StatefulCardAttributesSection initial={{}} onChange={handleChange} />);

    // Select identity form
    const formSelect = screen.getByTestId('play-req-identity-form-select');
    await user.selectOptions(formSelect, 'HERO');
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        playRequirements: expect.objectContaining({ identityForm: 'HERO' }),
      }),
    );

    // Form trait
    const formTraitInput = screen.getByTestId('play-req-form-trait-input');
    fireEvent.change(formTraitInput, { target: { value: 'Giant' } });
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        playRequirements: expect.objectContaining({ formTrait: 'Giant' }),
      }),
    );

    // Identity traits
    const identityTraitsInput = screen.getByTestId('play-req-identity-traits-input');
    fireEvent.change(identityTraitsInput, { target: { value: 'Avenger, Mystic' } });
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        playRequirements: expect.objectContaining({
          identityTraits: ['Avenger', 'Mystic'],
        }),
      }),
    );

    // Open control filter accordion
    const toggleControlFilter = screen.getByTestId('toggle-play-req-control-filter-btn');
    await user.click(toggleControlFilter);
    expect(screen.getByText(/Required Controlled Card Criteria/i)).toBeDefined();
  });

  it('renders validation error callout when errors are provided', () => {
    render(
      <CardAttributesSection
        supplemental={{}}
        onChange={vi.fn()}
        hasErrors={true}
        errors={['restrictedSlots must be a positive integer', 'traits is required']}
      />,
    );

    expect(screen.getByText(/Attributes Issue/i)).toBeDefined();
    expect(screen.getByTestId('card-attributes-errors')).toBeDefined();
    expect(screen.getByText(/restrictedSlots must be a positive integer/i)).toBeDefined();
    expect(screen.getByText(/traits is required/i)).toBeDefined();
  });
});
