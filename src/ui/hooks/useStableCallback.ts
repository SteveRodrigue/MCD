import { useCallback, useEffect, useRef } from 'react';

/**
 * One function identity that always calls the latest `callback`, so memoised children keep their
 * props while the handler's own dependencies change.
 */
export function useStableCallback<Args extends unknown[], Result>(
  callback: (...args: Args) => Result,
): (...args: Args) => Result {
  const latest = useRef(callback);
  useEffect(() => {
    latest.current = callback;
  });
  return useCallback((...args: Args) => latest.current(...args), []);
}
