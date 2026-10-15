import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ModalLayer } from '../../src/ui/components/layout/ModalLayer';

describe('ModalLayer (Issue #312)', () => {
  it('portals its child under document.body with fixed and z-modal by default', () => {
    const { container } = render(
      <ModalLayer data-testid="layer">
        <span>content</span>
      </ModalLayer>,
    );
    const layer = screen.getByTestId('layer');
    expect(container.contains(layer)).toBe(false);
    expect(layer.parentElement).toBe(document.body);
    expect(layer.className).toContain('fixed');
    expect(layer.className).toContain('z-modal');
  });

  it.each(['critical', 'drawer', 'banner'] as const)('uses z-%s when requested', (layer) => {
    render(
      <ModalLayer layer={layer} data-testid="layer">
        x
      </ModalLayer>,
    );
    expect(screen.getByTestId('layer').className).toContain(`z-${layer}`);
  });

  it('passes className and onClick through', () => {
    const onClick = vi.fn();
    render(
      <ModalLayer className="inset-0 extra" onClick={onClick} data-testid="layer">
        x
      </ModalLayer>,
    );
    const el = screen.getByTestId('layer');
    expect(el.className).toContain('inset-0');
    expect(el.className).toContain('extra');
    fireEvent.click(el);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
