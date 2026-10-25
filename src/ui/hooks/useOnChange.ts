import { useState } from 'react';

const UNSEEN = Symbol('unseen');

/**
 * Runs `onChange` while rendering, when `value` differs from the previous render's, so the state it
 * sets is part of the same render instead of a second one after an effect. With `runOnMount` it
 * also runs on the first render.
 */
export function useOnChange<T>(
  value: T,
  onChange: (value: T) => void,
  { runOnMount = false }: { runOnMount?: boolean } = {},
): void {
  const [seen, setSeen] = useState<T | typeof UNSEEN>(runOnMount ? UNSEEN : value);
  if (!Object.is(seen, value)) {
    setSeen(value);
    onChange(value);
  }
}
