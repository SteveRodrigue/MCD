/**
 * Marvel Champions Digital (MCD) - Pack status report.
 *
 * Usage: npm run pack:status
 * Prints one row per pack under content/packs: cards, cards with supplemental data and the state
 * the game shows for it (Playable, Data only, Needs pack, Failed). The states come from the content
 * loader's `descriptions` (ADR-0092, Q45), the same ones the Content screen uses.
 */

import * as path from 'path';
import { fileURLToPath } from 'url';
import { NodeFsDriver } from '../src/data/content/drivers/node-fs';
import { loadContent } from '../src/data/content/loader';
import type { PackDescription } from '../src/data/content/types';
import { contentRoot } from '../src/tools/content-paths';

export async function packStatuses(base?: string): Promise<PackDescription[]> {
  const driver = new NodeFsDriver(contentRoot(base));
  // Load every pack so the counts are real; the report is about the files, not config.json.
  const everything = await driver.listDirs('packs');
  return (await loadContent(driver, { packs: everything })).descriptions;
}

async function main(): Promise<void> {
  const rows = await packStatuses();
  const width = Math.max(4, ...rows.map((r) => r.id.length));
  console.log(`${'pack'.padEnd(width)}  cards  supplemental  state`);
  for (const r of rows) {
    const reason = r.reason ? `: ${r.reason}` : '';
    console.log(
      `${r.id.padEnd(width)}  ${String(r.cardCount).padStart(5)}  ${String(r.supplementalCount).padStart(12)}  ${r.state}${reason}`,
    );
  }
  const playable = rows.filter((r) => r.state === 'playable').length;
  console.log(`\n${rows.length} packs, ${playable} playable.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  void main();
