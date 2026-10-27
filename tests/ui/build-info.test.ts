import { describe, it, expect } from 'vitest';
import { formatBuildLabel } from '../../src/ui/build-info';

describe('formatBuildLabel', () => {
  it('joins the version and the short commit', () => {
    expect(formatBuildLabel({ version: '0.1.1', commit: 'f4b6a60', dirty: false })).toBe(
      'v0.1.1 · f4b6a60',
    );
  });

  it('marks a build with uncommitted changes', () => {
    expect(formatBuildLabel({ version: '0.1.1', commit: 'f4b6a60', dirty: true })).toBe(
      'v0.1.1 · f4b6a60-dirty',
    );
  });

  it('keeps an unknown commit readable', () => {
    expect(formatBuildLabel({ version: '0.1.1', commit: 'unknown', dirty: false })).toBe(
      'v0.1.1 · unknown',
    );
  });
});
