import { useEffect, useRef, useState } from 'react';

export interface AsyncData<T> {
  /** The latest settled value; the previous one while a new key loads, null after a failure or without a key. */
  data: T | null;
  loading: boolean;
  /** The failure of the latest request for the current key. */
  error: Error | null;
  /** Fetches the current key again. */
  reload: () => void;
}

interface Settled<T> {
  request: string | null;
  data: T | null;
  error: Error | null;
}

/**
 * Fetches `fetcher()` whenever `key` changes (null means nothing to fetch). `loading` is derived
 * from which request has settled, so nothing sets state synchronously inside the effect.
 */
export function useAsyncData<T>(key: string | null, fetcher: () => Promise<T>): AsyncData<T> {
  const [settled, setSettled] = useState<Settled<T>>({ request: null, data: null, error: null });
  const [reloads, setReloads] = useState(0);
  const fetcherRef = useRef(fetcher);

  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  const request = key === null ? null : `${key}#${reloads}`;

  useEffect(() => {
    if (request === null) return;
    let isCurrent = true;
    fetcherRef
      .current()
      .then((data) => isCurrent && setSettled({ request, data, error: null }))
      .catch((err) => {
        if (!isCurrent) return;
        const error = err instanceof Error ? err : new Error(String(err));
        setSettled({ request, data: null, error });
      });
    return () => {
      isCurrent = false;
    };
  }, [request]);

  const isSettled = settled.request === request;
  return {
    data: request === null ? null : settled.data,
    loading: request !== null && !isSettled,
    error: isSettled ? settled.error : null,
    reload: () => setReloads((n) => n + 1),
  };
}
