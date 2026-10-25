import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Beacon } from '../../src/ui/theme/kit/controls';
// @ts-expect-error plain JS config has no type declarations
import tailwindConfig from '../../tailwind.config.js';

describe('Beacon: the attention ring (Issue #378)', () => {
  it('shows a decorative ring only while active, and never hides its child', () => {
    const { rerender } = render(
      <Beacon active>
        <button>Go</button>
      </Beacon>,
    );
    const ring = screen.getByTestId('attention-beacon');
    expect(ring.getAttribute('aria-hidden')).toBe('true');
    expect(ring.className).toContain('pointer-events-none');
    expect(screen.getByRole('button', { name: 'Go' })).toBeDefined();

    rerender(
      <Beacon active={false}>
        <button>Go</button>
      </Beacon>,
    );
    expect(screen.queryByTestId('attention-beacon')).toBeNull();
    expect(screen.getByRole('button', { name: 'Go' })).toBeDefined();
  });

  it('stands still with reduced motion, but stays visible', () => {
    render(
      <Beacon active>
        <span>x</span>
      </Beacon>,
    );
    const ring = screen.getByTestId('attention-beacon');
    expect(ring.className).toContain('animate-beacon');
    expect(ring.className).toContain('motion-reduce:animate-none');
    expect(ring.className).toMatch(/(?:^|\s)opacity-60(?:\s|$)/);
  });

  it('has its keyframe and animation in the Tailwind config', () => {
    const extend = (tailwindConfig as any).theme.extend;
    expect(extend.keyframes.beacon).toBeDefined();
    expect(extend.animation.beacon).toMatch(/^beacon /);
  });
});
