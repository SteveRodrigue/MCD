import path from 'node:path';
import type { RawUpstreamCard } from '../../src/engine/models';
import { bootContent } from '../../src/data/content/apply';
import { NodeFsDriver } from '../../src/data/content/drivers/node-fs';
import { loadContent } from '../../src/data/content/loader';
import { getLoadedContent } from '../../src/data/content/store';

/** The repository's content folder, read through the same driver the setup file uses. */
export const contentDriver = new NodeFsDriver(path.resolve(__dirname, '../../content'));

/** Raw cards of packs the setup file already loaded (the packs enabled in content/config.json). */
export function loadedRawCards(...packIds: string[]): RawUpstreamCard[] {
  const loaded = getLoadedContent().packs;
  return packIds.flatMap((id) => {
    const pack = loaded.find((p) => p.id === id);
    if (!pack) throw new Error(`Pack "${id}" is not loaded; use bootPacks or rawCardsOf`);
    return pack.cards;
  });
}

/** Raw cards of any packs, loaded through the content loader without touching the singletons. */
export async function rawCardsOf(...packIds: string[]): Promise<RawUpstreamCard[]> {
  const content = await loadContent(contentDriver, { packs: packIds });
  const failed = content.failures.find((f) => packIds.includes(f.packId));
  if (failed) throw new Error(`Pack "${failed.packId}" failed to load: ${failed.reason}`);
  return content.packs.filter((p) => packIds.includes(p.id)).flatMap((p) => p.cards);
}

/**
 * Re-fills the engine singletons (catalog, supplemental registry, modular sets, starter decks)
 * with another pack set for the rest of the test file, for tests that need a pack outside
 * content/config.json.
 */
export async function bootPacks(...packIds: string[]): Promise<void> {
  const content = await bootContent(contentDriver, { packs: packIds });
  const failed = content.failures[0];
  if (failed) throw new Error(`Pack "${failed.packId}" failed to load: ${failed.reason}`);
}
