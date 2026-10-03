import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CardAttributesSection } from '../../src/ui/components/editor/CardAttributesSection';

describe('CardAttributesSection obligation recipient override (Issue #158)', () => {
  it('offers the recipient select for obligation cards and emits the chosen override', () => {
    const onChange = vi.fn();
    render(
      <CardAttributesSection
        supplemental={{}}
        onChange={onChange}
        typeCode="obligation"
        showAllFields={true}
      />,
    );
    const select = screen.getByTestId('obligation-recipient-select') as HTMLSelectElement;
    expect(select.value).toBe('');
    fireEvent.change(select, { target: { value: 'FIRST_PLAYER' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ recipient: { type: 'FIRST_PLAYER' } }),
    );
  });

  it('does not show the field for other card types without a recipient', () => {
    render(
      <CardAttributesSection
        supplemental={{}}
        onChange={vi.fn()}
        typeCode="upgrade"
        showAllFields={true}
      />,
    );
    expect(screen.queryByTestId('obligation-recipient-field')).toBeNull();
  });

  it('IDENTITY shows a codes input and emits parsed codes; selecting Default clears the override', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <CardAttributesSection
        supplemental={{ recipient: { type: 'IDENTITY', codes: ['01010a'] } }}
        onChange={onChange}
        typeCode="obligation"
        showAllFields={true}
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
        typeCode="obligation"
        showAllFields={true}
      />,
    );
    fireEvent.change(screen.getByTestId('obligation-recipient-select'), { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ recipient: undefined }));
  });
});
