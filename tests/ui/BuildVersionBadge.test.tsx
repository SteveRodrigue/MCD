import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BuildVersionBadge } from '../../src/ui/components/BuildVersionBadge';
import { BUILD_LABEL } from '../../src/ui/build-info';

describe('BuildVersionBadge', () => {
  it('shows the build label without intercepting clicks', () => {
    render(<BuildVersionBadge />);
    const badge = screen.getByLabelText('Build version');
    expect(badge.textContent).toBe(BUILD_LABEL);
    expect(badge.className).toContain('pointer-events-none');
    expect(badge.className).toContain('fixed');
  });
});
