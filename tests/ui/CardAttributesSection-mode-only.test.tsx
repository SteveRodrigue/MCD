import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CardAttributesSection } from '../../src/ui/components/editor/CardAttributesSection';
import { TriggerFilterSection } from '../../src/ui/components/editor/TriggerFilterSection';

describe('Card Editor fields of the encounter set work', () => {
  it('sets and clears the mode-only side', () => {
    const onChange = vi.fn();
    render(<CardAttributesSection supplemental={{ modeOnly: 'STANDARD' }} onChange={onChange} />);
    const select = screen.getByTestId('mode-only-select') as HTMLSelectElement;
    expect(select.value).toBe('STANDARD');

    fireEvent.change(select, { target: { value: 'EXPERT' } });
    expect(onChange).toHaveBeenLastCalledWith({ modeOnly: 'EXPERT' });
    fireEvent.change(select, { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith({});
  });

  it('offers the counters-here trigger filter', () => {
    render(
      <TriggerFilterSection
        isExpanded
        filter={{ countersHere: { counterType: 'pursuit', atLeast: 3 } }}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getAllByText(/Counters Here/i).length).toBeGreaterThan(0);
  });
});
