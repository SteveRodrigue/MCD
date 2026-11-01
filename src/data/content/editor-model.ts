/**
 * What the Card Supplemental Editor shows, built from the content the game already loaded (M9).
 * Pure functions: no file access, no network. Saving is split in two: `prepareSave` validates and
 * stamps the audit block here, and the service writes the file through a `ContentWriter`.
 */
import {
  CardEnrichmentSchema,
  findEventDiscardSelfViolations,
  type CardEnrichment,
} from '../supplemental/schema';
import type { LoadedContent, LoadedPack } from './types';

export interface CardSummary {
  code: string;
  name: string;
  packCode: string;
  /** Folder id of the pack that defines the card. */
  packId: string;
  /** `<stem>.json`: the card file the card comes from. */
  packFile: string;
  setCode?: string;
  factionCode: string;
  typeCode: string;
  stage?: string;
  traits?: string;
  hasSupplemental: boolean;
  noSupplementalNeeded?: boolean;
  isValid: boolean;
  confidence?: number;
  errorCount?: number;
  /** False for packs the editor must not write (`official-sync`). */
  writable: boolean;
}

export interface EditorPack {
  id: string;
  name: string;
  origin: string;
  writable: boolean;
}

export interface PackMetadataResponse {
  /** MarvelCDB pack codes (content/meta/packs.json). */
  packs: Array<{ code: string; name: string; pack_type_code?: string; size?: number }>;
  sets: Array<{
    code: string;
    name: string;
    card_set_type_code?: string;
    pack_code?: string;
    pack_codes?: string[];
  }>;
  factions: Array<{ code: string; name: string; is_primary?: boolean }>;
  packFiles: string[];
  /** The enabled packs, which the pack selector lists. */
  editorPacks: EditorPack[];
}

export interface CardDetailsResponse {
  code: string;
  packCode: string;
  packId: string;
  packFile: string;
  upstream: any;
  supplemental?: any;
  writable: boolean;
  validation: { valid: boolean; errors: any[] };
}

export interface CardFilters {
  /** MarvelCDB pack code of the card. */
  pack?: string;
  /** Folder id of the pack. */
  packId?: string;
  packFile?: string;
  set?: string;
  faction?: string;
  hero?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface EditorMeta {
  packs: PackMetadataResponse['packs'];
  sets: PackMetadataResponse['sets'];
  factions: PackMetadataResponse['factions'];
}

/** Packs this checkout owns can be written; synced packs are re-downloaded, so edits would be lost. */
export const isWritableOrigin = (origin: string): boolean =>
  origin === 'user' || origin === 'official-bundled';

const issuesOf = (error: { issues?: unknown[] }): any[] => (error.issues as any[]) ?? [];

function* cardsOf(content: LoadedContent): Generator<{ card: any; pack: LoadedPack }> {
  for (const pack of content.packs) for (const card of pack.cards) yield { card, pack };
}

function findCard(content: LoadedContent, code: string) {
  for (const entry of cardsOf(content)) if (entry.card.code === code) return entry;
  return undefined;
}

const stemOf = (pack: LoadedPack, code: string): string => pack.cardStems[code] ?? pack.id;

export function packMetadata(content: LoadedContent, meta: EditorMeta): PackMetadataResponse {
  const setPacks = new Map<string, Set<string>>();
  const packFiles = new Set<string>();
  for (const { card, pack } of cardsOf(content)) {
    packFiles.add(`${stemOf(pack, card.code)}.json`);
    if (card.set_code && card.pack_code) {
      let packs = setPacks.get(card.set_code);
      if (!packs) setPacks.set(card.set_code, (packs = new Set()));
      packs.add(card.pack_code);
    }
  }
  const sets = meta.sets.map((s) => {
    const packCodes = Array.from(setPacks.get(s.code) ?? []);
    return { ...s, pack_code: packCodes[0], pack_codes: packCodes };
  });
  const editorPacks = content.packs.map((pack) => ({
    id: pack.id,
    name: pack.manifest.name,
    origin: pack.manifest.origin,
    writable: isWritableOrigin(pack.manifest.origin),
  }));
  return {
    packs: meta.packs,
    sets,
    factions: meta.factions,
    packFiles: Array.from(packFiles).sort(),
    editorPacks,
  };
}

export function listCards(
  content: LoadedContent,
  filters: CardFilters,
): { total: number; cards: CardSummary[]; page?: number; limit?: number } {
  const results: CardSummary[] = [];
  for (const { card, pack } of cardsOf(content)) {
    const code: string = card.code;
    const packFile = `${stemOf(pack, code)}.json`;
    if (filters.packId && pack.id !== filters.packId) continue;
    if (filters.packFile && packFile !== filters.packFile) continue;
    if (filters.pack && card.pack_code !== filters.pack) continue;
    if (filters.set && card.set_code !== filters.set) continue;
    if (filters.faction && card.faction_code !== filters.faction) continue;
    if (filters.hero) {
      const matchesHero =
        card.set_code === filters.hero ||
        (card.name && card.name.toLowerCase().includes(filters.hero.toLowerCase()));
      if (!matchesHero) continue;
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const hit =
        code.toLowerCase().includes(q) ||
        (card.name && card.name.toLowerCase().includes(q)) ||
        (card.traits && card.traits.toLowerCase().includes(q));
      if (!hit) continue;
    }

    const supplemental: any = pack.supplemental[code];
    const hasSupplemental = supplemental !== undefined;
    let isValid = true;
    let errorCount = 0;
    if (hasSupplemental) {
      const validation = CardEnrichmentSchema.safeParse(supplemental);
      if (!validation.success) {
        isValid = false;
        errorCount = issuesOf(validation.error).length;
      }
    }
    const noSupplementalNeeded = Boolean(supplemental?.noSupplementalNeeded);

    if (filters.status) {
      if (filters.status === 'has_supplemental' && !hasSupplemental) continue;
      if (filters.status === 'missing_supplemental' && hasSupplemental) continue;
      if (filters.status === 'invalid_supplemental' && (!hasSupplemental || isValid)) continue;
      if (filters.status === 'valid_supplemental' && (!hasSupplemental || !isValid)) continue;
      if (filters.status === 'vanilla_supplemental' && (!hasSupplemental || !noSupplementalNeeded))
        continue;
      if (filters.status === 'has_multistep') {
        const abilities: any[] = supplemental?.abilities || [];
        if (!abilities.some((a) => Array.isArray(a.steps) && a.steps.length >= 2)) continue;
      }
      if (filters.status === 'missing_audit' && supplemental?.audit?.originalText) continue;
    }

    results.push({
      code,
      name: card.name || 'Unknown',
      packCode: card.pack_code || '',
      packId: pack.id,
      packFile,
      setCode: card.set_code,
      factionCode: card.faction_code || 'basic',
      typeCode: card.type_code || '',
      stage: card.stage,
      traits: card.traits,
      hasSupplemental,
      noSupplementalNeeded,
      isValid,
      confidence: supplemental?.audit?.confidence,
      errorCount,
      writable: isWritableOrigin(pack.manifest.origin),
    });
  }

  results.sort((a, b) => {
    if (a.packFile !== b.packFile) return a.packFile.localeCompare(b.packFile);
    return a.code.localeCompare(b.code, undefined, { numeric: true });
  });

  const total = results.length;
  if (filters.limit !== undefined && filters.limit > 0) {
    const page = Math.max(1, filters.page ?? 1);
    const start = (page - 1) * filters.limit;
    return { total, cards: results.slice(start, start + filters.limit), page, limit: filters.limit };
  }
  return { total, cards: results };
}

export function cardDetails(content: LoadedContent, code: string): CardDetailsResponse | null {
  const entry = findCard(content, code);
  if (!entry) return null;
  const { card, pack } = entry;
  const supplemental: unknown = pack.supplemental[code];
  let valid = true;
  let errors: any[] = [];
  if (supplemental !== undefined) {
    const validation = CardEnrichmentSchema.safeParse(supplemental);
    if (!validation.success) {
      valid = false;
      errors = issuesOf(validation.error);
    }
  }
  return {
    code,
    packCode: card.pack_code || '',
    packId: pack.id,
    packFile: `${stemOf(pack, code)}.json`,
    upstream: card,
    supplemental,
    writable: isWritableOrigin(pack.manifest.origin),
    validation: { valid, errors },
  };
}

export type PreparedSave =
  | { ok: true; packId: string; path: string; code: string; data: CardEnrichment; updatedAt: string }
  | { ok: false; error: string; errors?: any[] };

/** A bare `<name>.json`: no path separators, no `..` (AUD-20261017-232534 F019). */
export function isPackFileName(name: string): boolean {
  return /^[a-z0-9_-]+\.json$/i.test(name);
}

/** Validates a card's supplemental data, stamps its audit block and names the file to write. */
export function prepareSave(
  content: LoadedContent,
  code: string,
  payload: { packFile?: string; supplemental: unknown },
  now: Date = new Date(),
): PreparedSave {
  const entry = findCard(content, code);
  if (!entry) return { ok: false, error: `Card ${code} is not in the loaded content` };
  const { card, pack } = entry;
  if (!isWritableOrigin(pack.manifest.origin)) {
    return { ok: false, error: `Pack "${pack.id}" is read-only (origin: ${pack.manifest.origin})` };
  }
  const targetFile = payload.packFile ?? `${stemOf(pack, code)}.json`;
  if (!isPackFileName(targetFile)) {
    return { ok: false, error: `Invalid pack file name '${targetFile}'` };
  }
  const supplemental = payload.supplemental || {};

  // Invariant check: Event cards cannot declare cost.discardSelf (Issue #271 / RR v1.8 Event)
  const eventViolation = findEventDiscardSelfViolations(card.type_code, supplemental);
  if (eventViolation) return { ok: false, error: eventViolation };

  const validation = CardEnrichmentSchema.safeParse(supplemental);
  if (!validation.success) {
    return {
      ok: false,
      error: 'Supplemental data does not conform to CardEnrichmentSchema',
      errors: issuesOf(validation.error),
    };
  }

  const data = validation.data;
  // ISO timestamp with seconds (YYYY-MM-DDTHH:MM:SSZ)
  const updatedAt = now.toISOString().replace(/\.\d{3}Z$/, 'Z');
  const audit = data.audit || {};
  audit.updatedAt = updatedAt;
  audit.reviewedAt = updatedAt;
  audit.reviewedBy = audit.reviewedBy || 'developer';
  audit.rulesVersion = audit.rulesVersion || 'v1.8';
  if (audit.confidence === undefined) audit.confidence = 100;
  data.audit = audit;

  return {
    ok: true,
    packId: pack.id,
    path: `packs/${pack.id}/supplemental/${targetFile}`,
    code,
    data,
    updatedAt,
  };
}
