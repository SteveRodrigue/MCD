import { useCallback, useEffect, useRef } from 'react';

/**
 * Returns a `setTimeout` whose pending callbacks are cancelled when the component unmounts, so a
 * delayed state update never reaches an unmounted component.
 */
export function useTimeout(): (callback: () => void, delayMs: number) => void {
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach(clearTimeout);
      pending.clear();
    };
  }, []);

  return useCallback((callback: () => void, delayMs: number) => {
    const id = setTimeout(() => {
      timers.current.delete(id);
      callback();
    }, delayMs);
    timers.current.add(id);
  }, []);
}
