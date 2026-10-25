import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useStableCallback } from '../../src/ui/hooks/useStableCallback';

describe('useStableCallback', () => {
  it('keeps one identity across renders', () => {
    const { result, rerender } = renderHook(({ fn }) => useStableCallback(fn), {
      initialProps: { fn: (n: number) => n + 1 },
    });
    const first = result.current;
    rerender({ fn: (n: number) => n + 2 });
    expect(result.current).toBe(first);
  });

  it('calls the latest callback with its arguments', () => {
    const { result, rerender } = renderHook(({ fn }) => useStableCallback(fn), {
      initialProps: { fn: (n: number) => n + 1 },
    });
    expect(result.current(1)).toBe(2);
    rerender({ fn: (n: number) => n * 10 });
    expect(result.current(3)).toBe(30);
  });
});
