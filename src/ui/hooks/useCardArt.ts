import { useState, useEffect } from 'react';
import { getCardArtUrl, CardArtIdentifier } from '../services/card-cache-service';

export interface UseCardArtResult {
  artUrl: string | null;
  loading: boolean;
  error: Error | null;
}

export function useCardArt(cardOrCode: CardArtIdentifier | string | undefined): UseCardArtResult {
  const [artUrl, setArtUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const code = typeof cardOrCode === 'string' ? cardOrCode : cardOrCode?.code;
  const type = typeof cardOrCode === 'object' ? cardOrCode?.type : undefined;
  const stage = typeof cardOrCode === 'object' ? cardOrCode?.stage : undefined;

  useEffect(() => {
    if (!code) {
      setArtUrl(null);
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    getCardArtUrl(typeof cardOrCode === 'object' && cardOrCode !== null ? cardOrCode : code)
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
  }, [code, type, stage]);

  return { artUrl, loading, error };
}
