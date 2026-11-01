/**
 * Marvel Champions Digital (MCD) - Pack status report.
 *
 * Usage: npm run pack:status
 * Prints one row per pack under content/packs: cards, cards with supplemental data and whether the
 * pack has any supplemental data at all (ADR-0092, Q45). Status is derived from the files, never
 * written down by hand.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { listPackCodes, packDir } from '../src/tools/content-paths';

export interface PackStatus {
  code: string;
  cards: number;
  supplemental: number;
  state: 'with supplemental' | 'data only';
}

function readJsonFiles(dir: string): unknown[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')));
}

export function packStatuses(base?: string): PackStatus[] {
  return listPackCodes(base).map((code) => {
    const root = packDir(code, base);
    const cards = readJsonFiles(path.join(root, 'cards')).reduce<number>(
      (n, file) => n + (Array.isArray(file) ? file.length : 0),
      0,
    );
    const supplemental = readJsonFiles(path.join(root, 'supplemental')).reduce<number>(
      (n, file) => n + Object.keys((file as { cards?: object }).cards ?? {}).length,
      0,
    );
    return {
      code,
      cards,
      supplemental,
      state: supplemental > 0 ? 'with supplemental' : 'data only',
    };
  });
}

function main(): void {
  const rows = packStatuses();
  const width = Math.max(4, ...rows.map((r) => r.code.length));
  console.log(`${'pack'.padEnd(width)}  cards  supplemental  state`);
  for (const r of rows) {
    console.log(
      `${r.code.padEnd(width)}  ${String(r.cards).padStart(5)}  ${String(r.supplemental).padStart(12)}  ${r.state}`,
    );
  }
  const withSupp = rows.filter((r) => r.supplemental > 0).length;
  console.log(`\n${rows.length} packs, ${withSupp} with supplemental data.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
