import type { CardEnrichment } from '@engine/models';
import { FetchDriver } from '../../data/content/drivers/fetch';
import { getLoadedContent } from '../../data/content/store';
import type { ContentDriver, ContentWriter } from '../../data/content/types';
import {
  cardDetails,
  listCards,
  packMetadata,
  prepareSave,
  type CardDetailsResponse,
  type CardFilters,
  type CardSummary,
  type EditorMeta,
  type PackMetadataResponse,
} from '../../data/content/editor-model';

export type { CardDetailsResponse, CardFilters, CardSummary, PackMetadataResponse };

/** Where the editor reads the meta files and writes supplemental data (the dev server's content endpoint). */
export type EditorStorage = ContentDriver & ContentWriter;

const defaultStorage: EditorStorage = new FetchDriver('/__content');
const SCHEMA_REF = '../../../../src/data/supplemental/schema.json';

async function readMeta(storage: EditorStorage): Promise<EditorMeta> {
  const read = async <T>(name: string): Promise<T[]> => {
    try {
      return (await storage.readJson(`meta/${name}.json`)) as T[];
    } catch {
      return [];
    }
  };
  const [packs, sets, factions] = await Promise.all([
    read<EditorMeta['packs'][number]>('packs'),
    read<EditorMeta['sets'][number]>('sets'),
    read<EditorMeta['factions'][number]>('factions'),
  ]);
  return { packs, sets, factions };
}

export async function fetchPacksMetadata(
  storage: EditorStorage = defaultStorage,
): Promise<PackMetadataResponse> {
  return packMetadata(getLoadedContent(), await readMeta(storage));
}

export async function fetchCards(
  filters: CardFilters = {},
): Promise<{ total: number; cards: CardSummary[]; page?: number; limit?: number }> {
  return listCards(getLoadedContent(), filters);
}

export async function fetchCardDetails(code: string): Promise<CardDetailsResponse> {
  const details = cardDetails(getLoadedContent(), code);
  if (!details)
    throw new Error(`Failed to fetch card details for ${code}: not in the loaded content`);
  return details;
}

export async function saveCardSupplemental(
  code: string,
  payload: { packFile?: string; packCode?: string; supplemental: any },
  storage: EditorStorage = defaultStorage,
): Promise<{
  success: boolean;
  code?: string;
  packFile?: string;
  updatedAt?: string;
  errors?: any[];
  error?: string;
}> {
  const content = getLoadedContent();
  const prepared = prepareSave(content, code, payload);
  if (!prepared.ok) return { success: false, error: prepared.error, errors: prepared.errors };

  // Re-read the file so a save never overwrites another card's data written since the page loaded.
  let file: { $schema?: string; cards: Record<string, unknown> } = {
    $schema: SCHEMA_REF,
    cards: {},
  };
  try {
    const existing = (await storage.readJson(prepared.path)) as typeof file;
    file = { ...existing, cards: existing.cards ?? {} };
  } catch {
    // No such file yet: it is created by the write below.
  }
  file.cards[code] = prepared.data;

  try {
    await storage.writeJson(prepared.path, file);
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }

  // Keep the list and the inspector in step; the game itself picks the data up on reload.
  const pack = content.packs.find((p) => p.id === prepared.packId);
  if (pack) {
    // The schema's output and the engine's CardEnrichment describe the same JSON.
    pack.supplemental[code] = prepared.data as unknown as CardEnrichment;
    pack.supplementalCount = Object.keys(pack.supplemental).length;
  }
  return {
    success: true,
    code,
    packFile: prepared.path.split('/').pop(),
    updatedAt: prepared.updatedAt,
  };
}
