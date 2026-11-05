import { useSyncExternalStore } from 'react';
import { getCardArtUrl } from '../services/card-cache-service';
import { artPackArt, CardArtIdentifier, CardArtStats } from '../../data/content/card-art';
import { getArtPackVersion, subscribeArtPacks } from '../../data/content/store';
import { useAsyncData } from './useAsyncData';

export interface UseCardArtResult {
  artUrl: string | null;
  loading: boolean;
  error: Error | null;
}

export interface UseCardArtOptions {
  artStats?: CardArtStats;
  officialArt?: boolean;
}

export function useCardArt(
  cardOrCode: CardArtIdentifier | string | undefined,
  { artStats, officialArt }: UseCardArtOptions = {},
): UseCardArtResult {
  // Switching an art pack on or off re-renders every card that shows art.
  useSyncExternalStore(subscribeArtPacks, getArtPackVersion);
  const code = typeof cardOrCode === 'string' ? cardOrCode : cardOrCode?.code;
  const type = typeof cardOrCode === 'object' ? cardOrCode?.type : undefined;
  const stage = typeof cardOrCode === 'object' ? cardOrCode?.stage : undefined;
  // Keyed by the image, not the stats: a stat change that keeps the same image fetches nothing.
  const artPackUrl = code && !officialArt ? artPackArt(code, artStats)?.url : undefined;

  const {
    data: artUrl,
    loading,
    error,
  } = useAsyncData(code ? JSON.stringify([code, type, stage, artPackUrl]) : null, () =>
    getCardArtUrl({ code: code as string, type, stage, artStats, officialArt }),
  );

  return { artUrl, loading, error };
}
