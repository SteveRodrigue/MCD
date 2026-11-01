import type { CardEnrichment, MarvelCDBDeck, RawUpstreamCard } from '@engine/models';
import type { ModularSets, ScenarioDefinition } from '../packs/scenario-definition';
import type { PackManifest } from '../packs/pack-manifest';

/**
 * Read-only access to a content root (ADR-0092). Paths are relative to the content root and use
 * forward slashes, for example `packs/core/pack.json`. Implementations: Node file system (tests,
 * scripts) and fetch against the dev server (browser).
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
}

export interface LoadedContent {
  /** Packs in dependency order (dependencies first). */
  packs: LoadedPack[];
  failures: PackLoadFailure[];
}

export interface LoadContentOptions {
  /** Packs to load instead of the ones listed in `config.json`. */
  packs?: string[];
}
