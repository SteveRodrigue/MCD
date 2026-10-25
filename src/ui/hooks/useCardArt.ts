import { getCardArtUrl, CardArtIdentifier } from '../services/card-cache-service';
import { useAsyncData } from './useAsyncData';

export interface UseCardArtResult {
  artUrl: string | null;
  loading: boolean;
  error: Error | null;
}

export function useCardArt(cardOrCode: CardArtIdentifier | string | undefined): UseCardArtResult {
  const code = typeof cardOrCode === 'string' ? cardOrCode : cardOrCode?.code;
  const type = typeof cardOrCode === 'object' ? cardOrCode?.type : undefined;
  const stage = typeof cardOrCode === 'object' ? cardOrCode?.stage : undefined;

  const {
    data: artUrl,
    loading,
    error,
  } = useAsyncData(code ? JSON.stringify([code, type, stage]) : null, () =>
    getCardArtUrl({ code: code as string, type, stage }),
  );

  return { artUrl, loading, error };
}
