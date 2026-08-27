import { useState, useEffect } from 'react';
import { getCardArtUrl } from '../services/card-cache-service';

export interface UseCardArtResult {
  artUrl: string | null;
  loading: boolean;
  error: Error | null;
}

export function useCardArt(code: string | undefined): UseCardArtResult {
  const [artUrl, setArtUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!code) {
      setArtUrl(null);
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    getCardArtUrl(code)
      .then((url) => {
        if (isMounted) {
          setArtUrl(url);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [code]);

  return { artUrl, loading, error };
}
