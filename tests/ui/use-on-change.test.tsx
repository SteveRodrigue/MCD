import { describe, it, expect } from 'vitest';
import { useState } from 'react';
import { act, renderHook } from '@testing-library/react';
import { useOnChange } from '../../src/ui/hooks/useOnChange';

/** A value that follows `prop` through useOnChange, plus how many times it was told to. */
function useFollower(prop: string, options?: { runOnMount?: boolean }) {
  const [followed, setFollowed] = useState('initial');
  const [calls, setCalls] = useState(0);
  useOnChange(
    prop,
    (value) => {
      setFollowed(value);
      setCalls((n) => n + 1);
    },
    options,
  );
  return { followed, calls, setFollowed };
}

describe('useOnChange', () => {
  it('does not run on the first render by default', () => {
    const { result } = renderHook(() => useFollower('a'));
    expect(result.current).toMatchObject({ followed: 'initial', calls: 0 });
  });

  it('runs on the first render with runOnMount', () => {
    const { result } = renderHook(() => useFollower('a', { runOnMount: true }));
    expect(result.current).toMatchObject({ followed: 'a', calls: 1 });
  });

  it('runs once when the value changes, in the same render', () => {
    const { result, rerender } = renderHook(({ prop }) => useFollower(prop), {
      initialProps: { prop: 'a' },
    });
    rerender({ prop: 'b' });
    expect(result.current).toMatchObject({ followed: 'b', calls: 1 });

    rerender({ prop: 'b' });
    expect(result.current.calls).toBe(1);
  });

  it('leaves later local changes alone until the value changes again', () => {
    const { result, rerender } = renderHook(({ prop }) => useFollower(prop), {
      initialProps: { prop: 'a' },
    });
    rerender({ prop: 'b' });
    act(() => result.current.setFollowed('local'));
    rerender({ prop: 'b' });
    expect(result.current.followed).toBe('local');

    rerender({ prop: 'c' });
    expect(result.current.followed).toBe('c');
  });
});
