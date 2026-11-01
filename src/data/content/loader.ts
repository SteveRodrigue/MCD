import type { CardEnrichment, MarvelCDBDeck, RawUpstreamCard } from '@engine/models';
import { ContentConfigSchema } from '../packs/content-config';
import { ClaimRegistry } from '../packs/identity';
import { PackDeckSchema } from '../packs/pack-deck';
import { PACK_API_VERSION, PackManifestSchema, type PackManifest } from '../packs/pack-manifest';
import {
  ModularSetsSchema,
  ScenarioDefinitionSchema,
  type ModularSets,
  type ScenarioDefinition,
} from '../packs/scenario-definition';
import { SupplementalPackSchema } from '../supplemental/schema';
import type {
  ContentDriver,
  LoadContentOptions,
  LoadedContent,
  LoadedPack,
  PackDescription,
  PackLoadFailure,
} from './types';

const CONTENT_FAILURE_ID = '(content)';

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function jsonFiles(names: string[]): string[] {
  return names.filter((name) => name.endsWith('.json')).sort();
}

async function readEnabledPacks(
  driver: ContentDriver,
  failures: PackLoadFailure[],
): Promise<string[]> {
  try {
    if (!(await driver.exists('config.json'))) return [];
    const parsed = ContentConfigSchema.safeParse(await driver.readJson('config.json'));
    if (parsed.success) return parsed.data.enabledPacks;
    failures.push({ packId: CONTENT_FAILURE_ID, reason: `config.json: ${parsed.error.message}` });
  } catch (error) {
    failures.push({ packId: CONTENT_FAILURE_ID, reason: describeError(error) });
  }
  return [];
}

async function readManifest(driver: ContentDriver, id: string): Promise<PackManifest> {
  const path = `packs/${id}/pack.json`;
  if (!(await driver.exists(path))) throw new Error(`Pack "${id}" has no pack.json`);
  const parsed = PackManifestSchema.safeParse(await driver.readJson(path));
  if (!parsed.success) throw new Error(`${path}: ${parsed.error.message}`);
  const manifest = parsed.data;
  if (manifest.id !== id) throw new Error(`${path}: id "${manifest.id}" must equal the folder name`);
  if (manifest.apiVersion > PACK_API_VERSION) {
    throw new Error(
      `${path}: apiVersion ${manifest.apiVersion} is newer than the engine's ${PACK_API_VERSION}`,
    );
  }
  return manifest;
}

async function readCards(driver: ContentDriver, id: string): Promise<RawUpstreamCard[]> {
  const cards: RawUpstreamCard[] = [];
  for (const name of jsonFiles(await driver.listFiles(`packs/${id}/cards`))) {
    const list = await driver.readJson(`packs/${id}/cards/${name}`);
    if (!Array.isArray(list)) throw new Error(`cards/${name}: expected an array of cards`);
    for (const card of list as Partial<RawUpstreamCard>[]) {
      if (typeof card?.code !== 'string') {
        throw new Error(`cards/${name}: every card needs a string "code"`);
      }
      cards.push(card as RawUpstreamCard);
    }
  }
  return cards;
}

async function readSupplemental(
  driver: ContentDriver,
  id: string,
): Promise<Record<string, CardEnrichment>> {
  const merged: Record<string, CardEnrichment> = {};
  for (const name of jsonFiles(await driver.listFiles(`packs/${id}/supplemental`))) {
    const raw = await driver.readJson(`packs/${id}/supplemental/${name}`);
    const parsed = SupplementalPackSchema.safeParse(raw);
    if (!parsed.success) throw new Error(`supplemental/${name}: ${parsed.error.message}`);
    // Validate, but keep the data as written: parsing returns re-ordered copies.
    Object.assign(merged, (raw as { cards: Record<string, CardEnrichment> }).cards);
  }
  return merged;
}

async function readModularSets(driver: ContentDriver, id: string): Promise<ModularSets> {
  const path = `packs/${id}/modular-sets.json`;
  if (!(await driver.exists(path))) return [];
  const raw = await driver.readJson(path);
  const parsed = ModularSetsSchema.safeParse(raw);
  if (!parsed.success) throw new Error(`modular-sets.json: ${parsed.error.message}`);
  return raw as ModularSets;
}

async function readScenarios(driver: ContentDriver, id: string): Promise<ScenarioDefinition[]> {
  const scenarios: ScenarioDefinition[] = [];
  for (const dir of await driver.listDirs(`packs/${id}/scenarios`)) {
    const path = `packs/${id}/scenarios/${dir}/definition.json`;
    if (!(await driver.exists(path))) throw new Error(`scenarios/${dir}: missing definition.json`);
    const parsed = ScenarioDefinitionSchema.safeParse(await driver.readJson(path));
    if (!parsed.success) throw new Error(`scenarios/${dir}/definition.json: ${parsed.error.message}`);
    scenarios.push(parsed.data);
  }
  return scenarios;
}

async function readDecks(driver: ContentDriver, id: string): Promise<MarvelCDBDeck[]> {
  const decks: MarvelCDBDeck[] = [];
  for (const name of jsonFiles(await driver.listFiles(`packs/${id}/decks`))) {
    const raw = await driver.readJson(`packs/${id}/decks/${name}`);
    const parsed = PackDeckSchema.safeParse(raw);
    if (!parsed.success) throw new Error(`decks/${name}: ${parsed.error.message}`);
    decks.push(raw as MarvelCDBDeck);
  }
  // Decks are listed by deck id, so a pack controls the order they are offered in.
  return decks.sort((a, b) =>
    String(a.id).localeCompare(String(b.id), undefined, { numeric: true }),
  );
}

/**
 * Loads the enabled packs (plus their dependencies) from a content root without touching any
 * global state. A pack that fails is disabled with a reason, and so is every pack that depends on
 * it. Zero packs is a valid result.
 */
export async function loadContent(
  driver: ContentDriver,
  options: LoadContentOptions = {},
): Promise<LoadedContent> {
  const failures: PackLoadFailure[] = [];
  const requested = options.packs ?? (await readEnabledPacks(driver, failures));

  const outcome = new Map<string, LoadedPack | string>();
  const blockedBy = new Map<string, string>();
  const order: string[] = [];
  const inProgress = new Set<string>();
  const cardClaims = new ClaimRegistry();
  const setClaims = new ClaimRegistry();
  const scenarioClaims = new ClaimRegistry();

  async function resolve(id: string): Promise<LoadedPack | string> {
    const known = outcome.get(id);
    if (known !== undefined) return known;
    if (inProgress.has(id)) return `dependsOn forms a cycle through "${id}"`;
    inProgress.add(id);
    let result: LoadedPack | string;
    try {
      const manifest = await readManifest(driver, id);
      let blocked: string | undefined;
      for (const dependency of manifest.dependsOn) {
        const dep = await resolve(dependency);
        if (typeof dep === 'string' && blocked === undefined) {
          blocked = `needs "${dependency}", which is disabled (${dep})`;
          blockedBy.set(id, dependency);
        }
      }
      if (blocked) {
        result = blocked;
      } else {
        const cards = await readCards(driver, id);
        const supplemental = await readSupplemental(driver, id);
        const modularSets = await readModularSets(driver, id);
        const scenarios = await readScenarios(driver, id);
        const decks = await readDecks(driver, id);
        for (const card of cards) {
          const owner = cardClaims.ownerOf(card.code);
          if (owner) throw new Error(`card ${card.code} is also defined by "${owner}"`);
        }
        for (const set of modularSets) {
          const owner = setClaims.ownerOf(set.code);
          if (owner) throw new Error(`modular set "${set.code}" is also defined by "${owner}"`);
        }
        for (const scenario of scenarios) {
          const owner = scenarioClaims.ownerOf(scenario.id);
          if (owner) throw new Error(`scenario "${scenario.id}" is also defined by "${owner}"`);
        }
        for (const card of cards) cardClaims.claim(card.code, id);
        for (const set of modularSets) setClaims.claim(set.code, id);
        for (const scenario of scenarios) scenarioClaims.claim(scenario.id, id);
        result = {
          id,
          manifest,
          cards,
          supplemental,
          modularSets,
          scenarios,
          decks,
          cardCount: cards.length,
          supplementalCount: Object.keys(supplemental).length,
        };
      }
    } catch (error) {
      result = describeError(error);
    }
    inProgress.delete(id);
    outcome.set(id, result);
    if (typeof result !== 'string') order.push(id);
    return result;
  }

  for (const id of requested) await resolve(id);
  for (const [packId, result] of outcome) {
    if (typeof result === 'string') failures.push({ packId, reason: result, blockedBy: blockedBy.get(packId) });
  }

  const packs = order.map((id) => outcome.get(id) as LoadedPack);
  const descriptions = await describePacks(driver, packs, failures);
  return { packs, failures, descriptions };
}

async function readLockedScenarios(
  driver: ContentDriver,
  id: string,
): Promise<{ id: string; name: string }[]> {
  const found: { id: string; name: string }[] = [];
  try {
    for (const dir of await driver.listDirs(`packs/${id}/scenarios`)) {
      const path = `packs/${id}/scenarios/${dir}/definition.json`;
      if (!(await driver.exists(path))) continue;
      const raw = (await driver.readJson(path)) as { id?: unknown; name?: unknown };
      if (typeof raw.id === 'string' && typeof raw.name === 'string') {
        found.push({ id: raw.id, name: raw.name });
      }
    }
  } catch {
    // An unreadable scenario is simply not listed; the pack's own state carries the reason.
  }
  return found;
}

/**
 * One description per folder in `packs/`: loaded packs from the loader's result, failed ones with
 * the loader's reason, the rest by reading only their manifest (no card files). The single place
 * that decides what "Playable" and "Data only" mean (Q45).
 */
async function describePacks(
  driver: ContentDriver,
  loaded: LoadedPack[],
  failures: PackLoadFailure[],
): Promise<PackDescription[]> {
  const loadedById = new Map(loaded.map((pack) => [pack.id, pack]));
  const failureById = new Map(failures.map((failure) => [failure.packId, failure]));
  const descriptions: PackDescription[] = [];
  for (const id of (await driver.listDirs('packs')).sort()) {
    const pack = loadedById.get(id);
    if (pack) {
      descriptions.push({
        id,
        name: pack.manifest.name,
        origin: pack.manifest.origin,
        enabled: true,
        state: pack.supplementalCount > 0 ? 'playable' : 'data-only',
        cardCount: pack.cardCount,
        supplementalCount: pack.supplementalCount,
        lockedScenarios: [],
      });
      continue;
    }
    const failure = failureById.get(id);
    let name = id;
    let origin: PackDescription['origin'];
    let manifestError: string | undefined;
    try {
      const manifest = await readManifest(driver, id);
      name = manifest.name;
      origin = manifest.origin;
    } catch (error) {
      manifestError = describeError(error);
    }
    const reason = failure?.reason ?? manifestError;
    descriptions.push({
      id,
      name,
      origin,
      enabled: failure !== undefined,
      state: reason === undefined ? 'data-only' : failure?.blockedBy ? 'needs-pack' : 'failed',
      reason,
      cardCount: 0,
      supplementalCount: 0,
      lockedScenarios: await readLockedScenarios(driver, id),
    });
  }
  return descriptions;
}
