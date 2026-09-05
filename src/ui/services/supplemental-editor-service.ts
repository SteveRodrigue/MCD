import {
  CardSummary,
  PackMetadataResponse,
  CardDetailsResponse,
} from '../../tools/editor/api-middleware';

export interface CardFilters {
  pack?: string;
  packFile?: string;
  set?: string;
  faction?: string;
  hero?: string;
  status?: string;
  search?: string;
}

export async function fetchPacksMetadata(): Promise<PackMetadataResponse> {
  const res = await fetch('/api/supplemental/packs');
  if (!res.ok) {
    throw new Error(`Failed to fetch packs metadata: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchCards(
  filters: CardFilters = {},
): Promise<{ total: number; cards: CardSummary[] }> {
  const params = new URLSearchParams();
  if (filters.pack) params.set('pack', filters.pack);
  if (filters.packFile) params.set('packFile', filters.packFile);
  if (filters.set) params.set('set', filters.set);
  if (filters.faction) params.set('faction', filters.faction);
  if (filters.hero) params.set('hero', filters.hero);
  if (filters.status) params.set('status', filters.status);
  if (filters.search) params.set('search', filters.search);

  const qs = params.toString();
  const url = `/api/supplemental/cards${qs ? `?${qs}` : ''}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch cards: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchCardDetails(code: string): Promise<CardDetailsResponse> {
  const res = await fetch(`/api/supplemental/card/${code}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch card details for ${code}: ${res.statusText}`);
  }
  return res.json();
}

export async function saveCardSupplemental(
  code: string,
  payload: {
    packFile?: string;
    packCode?: string;
    supplemental: any;
  },
): Promise<{
  success: boolean;
  code?: string;
  packFile?: string;
  updatedAt?: string;
  errors?: any[];
  error?: string;
}> {
  const res = await fetch(`/api/supplemental/card/${code}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  return res.json();
}
