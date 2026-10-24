import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ModalLayer } from '../../src/ui/components/layout/ModalLayer';
import { ModalStyleProvider } from '../../src/ui/theme/ModalStyleContext';
import { MODAL_STYLES, themeFontVars } from '../../src/ui/theme/modal-styles';

/**
 * Every modal, drawer and newspaper renders through `ModalLayer`, a portal outside the game root, so the
 * layer itself carries the theme's font roles and text sizes (the combat log and the Daily Bugle depend on it).
 */
const style = MODAL_STYLES.find((s) => s.id === 'splash')!;

const renderLayer = (props: { themed?: boolean; style?: React.CSSProperties }) =>
  render(
    <ModalStyleProvider style={style}>
      <ModalLayer data-testid="layer" {...props}>
        text
      </ModalLayer>
    </ModalStyleProvider>,
  );

describe('ModalLayer follows the theme', () => {
  it('sets the font roles and size changes of the active theme, and makes Body the base text', () => {
    renderLayer({});
    const layer = screen.getByTestId('layer');
    expect(layer.className).toContain('font-body');
    for (const [name, value] of Object.entries(themeFontVars(style))) {
      expect(layer.style.getPropertyValue(name), name).toBe(String(value));
    }
    expect(layer.style.getPropertyValue('--text-adjust')).toBe('3px');
  });

  it('keeps the style the caller passes, on top of the theme variables', () => {
    renderLayer({ style: { top: 12 } });
    const layer = screen.getByTestId('layer');
    expect(layer.style.top).toBe('12px');
    expect(layer.style.getPropertyValue('--font-body')).not.toBe('');
  });

  it('adds nothing for the lab chrome (themed false)', () => {
    renderLayer({ themed: false });
    const layer = screen.getByTestId('layer');
    expect(layer.className).not.toContain('font-body');
    expect(layer.style.getPropertyValue('--font-body')).toBe('');
  });
});
