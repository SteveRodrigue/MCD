import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CardAttributesSection } from '../../src/ui/components/editor/CardAttributesSection';

describe('CardAttributesSection encounter attachment host (#209)', () => {
  const renderFor = (supplemental: any, onChange = vi.fn()) => {
    render(<CardAttributesSection supplemental={supplemental} onChange={onChange} />);
    return onChange;
  };

  it('shows the host select once the chip is added and emits a host without superlative', () => {
    const onChange = renderFor({ attachTo: { host: { type: 'VILLAIN' } } });
    const select = screen.getByTestId('attach-to-host-select') as HTMLSelectElement;
    expect(select.value).toBe('VILLAIN');
    fireEvent.change(select, { target: { value: 'MINION' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ attachTo: { host: { type: 'MINION' } } }),
    );
  });

  it('does not show the field without attachTo, offering the chip instead', () => {
    renderFor({});
    expect(screen.queryByTestId('attach-to-field')).toBeNull();
    expect(screen.getByTestId('card-chip-add-attachTo')).toBeDefined();
  });

  it('edits the superlative', () => {
    const onChange = renderFor({ attachTo: { host: { type: 'MINION' } } });
    fireEvent.change(screen.getByTestId('attach-to-stat-select'), {
      target: { value: 'PRINTED_HIT_POINTS' },
    });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        attachTo: {
          host: {
            type: 'MINION',
            superlative: { stat: 'PRINTED_HIT_POINTS', extreme: 'HIGHEST' },
          },
        },
      }),
    );
  });

  it('edits the lowest / highest choice of an existing superlative', () => {
    const onChange = renderFor({
      attachTo: {
        host: { type: 'ENEMY', superlative: { stat: 'PRINTED_ATTACK', extreme: 'HIGHEST' } },
      },
    });
    fireEvent.change(screen.getByTestId('attach-to-extreme-select'), {
      target: { value: 'LOWEST' },
    });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        attachTo: {
          host: { type: 'ENEMY', superlative: { stat: 'PRINTED_ATTACK', extreme: 'LOWEST' } },
        },
      }),
    );
  });

  it('edits the copy rule and the otherwise branch', () => {
    const onChange = renderFor({ attachTo: { host: { type: 'MINION' } } });
    fireEvent.click(screen.getByTestId('attach-to-without-copy'));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        attachTo: { host: { type: 'MINION', withoutCopyAttached: true } },
      }),
    );
    fireEvent.change(screen.getByTestId('attach-to-otherwise-select'), {
      target: { value: 'SURGE' },
    });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        attachTo: { host: { type: 'MINION' }, otherwise: { type: 'SURGE' } },
      }),
    );
  });

  it('choosing Default (villain) removes attachTo', () => {
    const onChange = renderFor({ attachTo: { host: { type: 'MINION' } } });
    fireEvent.change(screen.getByTestId('attach-to-host-select'), { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ attachTo: undefined }));
  });
});
