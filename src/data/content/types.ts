import type { CardEnrichment, MarvelCDBDeck, RawUpstreamCard } from '@engine/models';
import type { ModularSets, ScenarioDefinition } from '../packs/scenario-definition';
import type { PackManifest } from '../packs/pack-manifest';

/**
 * Read-only access to a content root (ADR-0092). Paths are relative to the content root and use
 * forward slashes, for example `packs/core/pack.json`. Implementations: Node file system (tests,
 * scripts), fetch against the dev server (browser), and later the Tauri folder driver.
 */
export interface ContentDriver {
  /** Names of the entries (files) directly inside `dir`; empty when the directory is missing. */
  listFiles(dir: string): Promise<string[]>;
  /** Names of the sub-directories directly inside `dir`; empty when the directory is missing. */
  listDirs(dir: string): Promise<string[]>;
  exists(path: string): Promise<boolean>;
  readJson(path: string): Promise<unknown>;
}

export interface LoadedPack {
  id: string;
  manifest: PackManifest;
  cards: RawUpstreamCard[];
  supplemental: Record<string, CardEnrichment>;
  modularSets: ModularSets;
  scenarios: ScenarioDefinition[];
  decks: MarvelCDBDeck[];
  cardCount: number;
  supplementalCount: number;
}

export interface PackLoadFailure {
  packId: string;
  reason: string;
  /** The dependency that disabled this pack, when that is the reason. */
  blockedBy?: string;
}

/** What a player sees for a pack on disk (Q45). `data-only`: cards but no supplemental data, or not enabled. */
export type PackState = 'playable' | 'data-only' | 'needs-pack' | 'failed';

export interface PackDescription {
  id: string;
  name: string;
  origin?: PackManifest['origin'];
  /** Listed in `config.json` (or requested), whether or not it loaded. */
  enabled: boolean;
  state: PackState;
  reason?: string;
  cardCount: number;
  supplementalCount: number;
  /** Scenarios of a pack that is not loaded, so the setup screen can list them as locked. */
  lockedScenarios: { id: string; name: string }[];
}

export interface LoadedContent {
  /** Packs in dependency order (dependencies first). */
  packs: LoadedPack[];
  failures: PackLoadFailure[];
  /** Every pack folder on disk, loaded or not. */
  descriptions: PackDescription[];
}

export interface LoadContentOptions {
  /** Packs to load instead of the ones listed in `config.json`. */
  packs?: string[];
}
