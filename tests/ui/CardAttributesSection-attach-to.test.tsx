import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CardAttributesSection } from '../../src/ui/components/editor/CardAttributesSection';

describe('CardAttributesSection encounter attachment host (#209)', () => {
  const renderFor = (supplemental: any, typeCode = 'attachment', onChange = vi.fn()) => {
    render(
      <CardAttributesSection
        supplemental={supplemental}
        onChange={onChange}
        typeCode={typeCode}
        showAllFields={true}
      />,
    );
    return onChange;
  };

  it('offers the host select for attachments and emits a host without superlative', () => {
    const onChange = renderFor({});
    const select = screen.getByTestId('attach-to-host-select') as HTMLSelectElement;
    expect(select.value).toBe('');
    fireEvent.change(select, { target: { value: 'MINION' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ attachTo: { host: { type: 'MINION' } } }),
    );
  });

  it('does not show the field for other card types without attachTo', () => {
    renderFor({}, 'upgrade');
    expect(screen.queryByTestId('attach-to-field')).toBeNull();
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
