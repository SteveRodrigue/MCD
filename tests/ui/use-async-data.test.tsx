import { describe, it, expect, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useAsyncData } from '../../src/ui/hooks/useAsyncData';

/** A fetcher whose promises the test settles by hand, one per call. */
function manualFetcher() {
  const pending: Array<{
    key: string;
    resolve: (v: string) => void;
    reject: (e: unknown) => void;
  }> = [];
  const fetcherFor = (key: string) => () =>
    new Promise<string>((resolve, reject) => pending.push({ key, resolve, reject }));
  return { pending, fetcherFor };
}

describe('useAsyncData', () => {
  it('has nothing to load without a key', () => {
    const { result } = renderHook(() => useAsyncData<string>(null, () => Promise.resolve('x')));
    expect(result.current).toMatchObject({ data: null, loading: false, error: null });
  });

  it('is loading from the first render, then settles with the data', async () => {
    const { pending, fetcherFor } = manualFetcher();
    const { result } = renderHook(() => useAsyncData('a', fetcherFor('a')));
    expect(result.current).toMatchObject({ data: null, loading: true });

    await act(async () => pending[0].resolve('A'));
    expect(result.current).toMatchObject({ data: 'A', loading: false, error: null });
  });

  it('keeps the previous data while a new key loads, and drops it for a null key', async () => {
    const { pending, fetcherFor } = manualFetcher();
    const { result, rerender } = renderHook(
      ({ key }: { key: string | null }) => useAsyncData(key, fetcherFor(key ?? '')),
      { initialProps: { key: 'a' as string | null } },
    );
    await act(async () => pending[0].resolve('A'));

    rerender({ key: 'b' });
    expect(result.current).toMatchObject({ data: 'A', loading: true });
    await act(async () => pending[1].resolve('B'));
    expect(result.current).toMatchObject({ data: 'B', loading: false });

    rerender({ key: null });
    expect(result.current).toMatchObject({ data: null, loading: false });
  });

  it('ignores an answer for a key that is no longer current', async () => {
    const { pending, fetcherFor } = manualFetcher();
    const { result, rerender } = renderHook(({ key }) => useAsyncData(key, fetcherFor(key)), {
      initialProps: { key: 'a' },
    });
    rerender({ key: 'b' });
    await act(async () => pending[0].resolve('A (late)'));
    expect(result.current).toMatchObject({ data: null, loading: true });

    await act(async () => pending[1].resolve('B'));
    expect(result.current.data).toBe('B');
  });

  it('reports a failure and clears the data', async () => {
    const { pending, fetcherFor } = manualFetcher();
    const { result } = renderHook(() => useAsyncData('a', fetcherFor('a')));
    await act(async () => pending[0].reject(new Error('boom')));

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeNull();
    expect(result.current.error?.message).toBe('boom');
  });

  it('reload fetches the current key again, keeping the data meanwhile', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce('first').mockResolvedValueOnce('second');
    const { result } = renderHook(() => useAsyncData('a', fetcher));
    await waitFor(() => expect(result.current.data).toBe('first'));

    act(() => result.current.reload());
    expect(result.current).toMatchObject({ data: 'first', loading: true });
    await waitFor(() => expect(result.current.data).toBe('second'));
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
