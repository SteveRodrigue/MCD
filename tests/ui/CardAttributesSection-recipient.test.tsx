import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CardAttributesSection } from '../../src/ui/components/editor/CardAttributesSection';

describe('CardAttributesSection obligation recipient override (Issue #158)', () => {
  it('shows the recipient select once the chip is added and emits the chosen override', () => {
    const onChange = vi.fn();
    render(
      <CardAttributesSection
        supplemental={{ recipient: { type: 'REVEALING_PLAYER' } }}
        onChange={onChange}
      />,
    );
    const select = screen.getByTestId('obligation-recipient-select') as HTMLSelectElement;
    expect(select.value).toBe('REVEALING_PLAYER');
    fireEvent.change(select, { target: { value: 'FIRST_PLAYER' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ recipient: { type: 'FIRST_PLAYER' } }),
    );
  });

  it('does not show the field without a recipient, offering the chip instead', () => {
    render(<CardAttributesSection supplemental={{}} onChange={vi.fn()} />);
    expect(screen.queryByTestId('obligation-recipient-field')).toBeNull();
    expect(screen.getByTestId('card-chip-add-recipient')).toBeDefined();
  });

  it('IDENTITY shows a codes input and emits parsed codes; selecting Default clears the override', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <CardAttributesSection
        supplemental={{ recipient: { type: 'IDENTITY', codes: ['01010a'] } }}
        onChange={onChange}
      />,
    );
    const codes = screen.getByTestId('obligation-recipient-codes') as HTMLInputElement;
    expect(codes.value).toBe('01010a');
    fireEvent.change(codes, { target: { value: '01010a, 01010b' } });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ recipient: { type: 'IDENTITY', codes: ['01010a', '01010b'] } }),
    );

    rerender(
      <CardAttributesSection
        supplemental={{ recipient: { type: 'FIRST_PLAYER' } }}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByTestId('obligation-recipient-select'), { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ recipient: undefined }));
  });
});
