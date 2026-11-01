/**
 * Marvel Champions Digital (MCD) - Content sync CLI.
 *
 * Usage: npm run content:sync [-- --from <dir>] [-- --check] [-- --prune]
 * Downloads the upstream dataset (zzorba/marvelsdb-json-data) into content/.cache/upstream/ and
 * materializes it into the content/ pack layout (ADR-0092): cards, catalog metadata, schemas and
 * translations. Each pack's pack.json, supplemental/, scenarios/, decks/ and modular-sets.json are
 * never touched. Files are copied byte for byte.
 *   --from <dir>  use an already-extracted upstream folder instead of downloading
 *   --check       write nothing, print what would change, exit 1 when anything differs
 *   --prune       also delete synced files that upstream no longer has (default: report them)
 */

import * as childProcess from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import {
  cardFile,
  codeOfStem,
  contentRoot,
  listPackCodes,
  metaFile,
  packDir,
  translationFile,
} from '../src/tools/content-paths';

const UPSTREAM_REPO = 'zzorba/marvelsdb-json-data';
const UPSTREAM_TARBALL = `https://codeload.github.com/${UPSTREAM_REPO}/tar.gz/refs/heads/master`;
const CATALOG_NAMES = ['packs', 'sets', 'factions', 'types', 'subtypes', 'packtypes', 'settypes'];
const CATALOG_TRANSLATION_NAMES = ['factions', 'packs', 'packtypes', 'sets', 'subtypes', 'types'];
const PACK_KIND_BY_TYPE: Record<string, string> = {
  core: 'core',
  hero: 'hero',
  scenario: 'scenario',
  encounter: 'scenario',
  story: 'mixed',
};

export interface SyncOptions {
  /** Write nothing; only report. */
  check?: boolean;
  /** Delete synced files that upstream no longer has. */
  prune?: boolean;
}

export interface SyncReport {
  /** Content-relative paths created or changed. */
  written: string[];
  unchanged: number;
  /** Content-relative paths deleted (prune). */
  removed: string[];
  /** Content-relative synced files upstream no longer has, left in place (no prune). */
  stale: string[];
  skipped: string[];
  createdPacks: string[];
}

interface PlannedFile {
  dest: string;
  content: () => Buffer;
}

interface UpstreamPack {
  code: string;
  name: string;
  pack_type_code: string;
}

function listJson(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort();
}

function stemOf(fileName: string): string {
  return fileName.slice(0, -'.json'.length);
}

function newPackManifest(pack: UpstreamPack): string {
  const manifest = {
    id: pack.code,
    name: pack.name,
    kind: PACK_KIND_BY_TYPE[pack.pack_type_code] ?? 'mixed',
    origin: 'official-bundled',
    apiVersion: 1,
    version: '1.0.0',
    dependsOn: pack.code === 'core' ? [] : ['core'],
    source: UPSTREAM_REPO,
  };
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

/** Every file a sync owns, and may therefore report as stale or prune. */
function syncedFilesOnDisk(base: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.json')) out.push(p);
    }
  };
  for (const code of listPackCodes(base)) {
    walk(path.join(packDir(code, base), 'cards'));
    walk(path.join(packDir(code, base), 'translations'));
  }
  walk(path.join(contentRoot(base), 'meta', 'schema'));
  walk(path.join(contentRoot(base), 'meta', 'translations'));
  for (const name of CATALOG_NAMES) out.push(metaFile(name, base));
  return out.filter((f) => fs.existsSync(f));
}

function copyOf(source: string): () => Buffer {
  return () => fs.readFileSync(source);
}

/** Plans what content/ should contain after the sync; unmapped files go to `report.skipped`. */
function planSync(extractedDir: string, base: string, report: SyncReport): PlannedFile[] {
  const files: PlannedFile[] = [];
  const packsJson = path.join(extractedDir, 'packs.json');
  if (!fs.existsSync(packsJson)) throw new Error(`No packs.json found in ${extractedDir}`);
  const packs = JSON.parse(fs.readFileSync(packsJson, 'utf-8')) as UpstreamPack[];
  const packByCode = new Map(packs.map((p) => [p.code, p]));
  const usedCodes = new Set<string>();

  const planStem = (
    stem: string,
    source: string,
    dest: (stem: string) => string,
    label: string,
  ): void => {
    const code = codeOfStem(stem);
    if (!packByCode.has(code)) {
      report.skipped.push(`${label}: pack code "${code}" is not in packs.json`);
      return;
    }
    usedCodes.add(code);
    files.push({ dest: dest(stem), content: copyOf(source) });
  };

  for (const name of listJson(path.join(extractedDir, 'pack'))) {
    planStem(
      stemOf(name),
      path.join(extractedDir, 'pack', name),
      (s) => cardFile(s, base),
      `pack/${name}`,
    );
  }

  for (const name of CATALOG_NAMES) {
    const source = path.join(extractedDir, `${name}.json`);
    if (fs.existsSync(source)) files.push({ dest: metaFile(name, base), content: copyOf(source) });
    else report.skipped.push(`${name}.json: missing upstream`);
  }

  const schemaDir = path.join(extractedDir, 'schema');
  for (const name of listJson(schemaDir)) {
    files.push({
      dest: path.join(contentRoot(base), 'meta', 'schema', name),
      content: copyOf(path.join(schemaDir, name)),
    });
  }

  const translationsDir = path.join(extractedDir, 'translations');
  if (fs.existsSync(translationsDir)) {
    for (const locale of fs.readdirSync(translationsDir).sort()) {
      const localeDir = path.join(translationsDir, locale);
      if (!fs.statSync(localeDir).isDirectory()) continue;
      for (const name of listJson(path.join(localeDir, 'pack'))) {
        planStem(
          stemOf(name),
          path.join(localeDir, 'pack', name),
          (s) => translationFile(locale, s, base),
          `translations/${locale}/pack/${name}`,
        );
      }
      for (const name of CATALOG_TRANSLATION_NAMES) {
        const source = path.join(localeDir, `${name}.json`);
        if (!fs.existsSync(source)) continue;
        files.push({
          dest: path.join(contentRoot(base), 'meta', 'translations', locale, `${name}.json`),
          content: copyOf(source),
        });
      }
    }
  }

  for (const code of [...usedCodes].sort()) {
    const manifest = path.join(packDir(code, base), 'pack.json');
    if (fs.existsSync(manifest)) continue;
    const text = newPackManifest(packByCode.get(code) as UpstreamPack);
    files.push({ dest: manifest, content: () => Buffer.from(text) });
    report.createdPacks.push(code);
  }
  return files;
}

/**
 * Materializes an extracted upstream dataset into `<base>/content`. Existing pack.json files and
 * every non-synced file stay untouched. With `check`, nothing is written or deleted.
 */
export function materializeUpstream(
  extractedDir: string,
  base: string,
  options: SyncOptions = {},
): SyncReport {
  const report: SyncReport = {
    written: [],
    unchanged: 0,
    removed: [],
    stale: [],
    skipped: [],
    createdPacks: [],
  };
  const rel = (p: string): string => path.relative(contentRoot(base), p).split(path.sep).join('/');
  const files = planSync(extractedDir, base, report);

  for (const file of files) {
    const next = file.content();
    const current = fs.existsSync(file.dest) ? fs.readFileSync(file.dest) : undefined;
    if (current && current.equals(next)) {
      report.unchanged += 1;
      continue;
    }
    report.written.push(rel(file.dest));
    if (!options.check) {
      fs.mkdirSync(path.dirname(file.dest), { recursive: true });
      fs.writeFileSync(file.dest, next);
    }
  }

  const planned = new Set(files.map((f) => path.resolve(f.dest)));
  for (const file of syncedFilesOnDisk(base)) {
    if (planned.has(path.resolve(file))) continue;
    if (options.prune) {
      report.removed.push(rel(file));
      if (!options.check) fs.rmSync(file);
    } else {
      report.stale.push(rel(file));
    }
  }
  return report;
}

/** True when the sync would change anything (or found stale files). */
export function hasDifferences(report: SyncReport): boolean {
  return report.written.length > 0 || report.removed.length > 0 || report.stale.length > 0;
}

interface CliArgs {
  from?: string;
  check: boolean;
  prune: boolean;
}

export function parseArgs(argv: readonly string[]): CliArgs {
  const args: CliArgs = { check: false, prune: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--check') args.check = true;
    else if (arg === '--prune') args.prune = true;
    else if (arg === '--from') {
      const value = argv[++i];
      if (!value) throw new Error('--from needs a directory');
      args.from = value;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

async function downloadUpstream(cacheDir: string): Promise<string> {
  fs.rmSync(cacheDir, { recursive: true, force: true });
  fs.mkdirSync(cacheDir, { recursive: true });
  const response = await fetch(UPSTREAM_TARBALL);
  if (!response.ok) throw new Error(`Download failed: HTTP ${response.status}`);
  const tarball = path.join(cacheDir, 'upstream.tar.gz');
  fs.writeFileSync(tarball, Buffer.from(await response.arrayBuffer()));
  const extractDir = path.join(cacheDir, 'extracted');
  fs.mkdirSync(extractDir);
  // Run inside the cache folder with relative names: GNU tar reads `C:\...` as a remote host.
  childProcess.execFileSync('tar', ['-xzf', path.basename(tarball), '-C', 'extracted'], {
    cwd: cacheDir,
    stdio: 'inherit',
  });
  fs.rmSync(tarball);
  const folders = fs
    .readdirSync(extractDir, { withFileTypes: true })
    .filter((d) => d.isDirectory());
  if (folders.length !== 1) throw new Error('Upstream archive has an unexpected layout');
  return path.join(extractDir, folders[0].name);
}

function printReport(report: SyncReport, check: boolean): void {
  for (const w of report.skipped) console.warn(`warning: skipped ${w}`);
  for (const p of report.createdPacks) console.log(`new pack: ${p}`);
  for (const f of report.written) console.log(`${check ? 'would write' : 'wrote'}: ${f}`);
  for (const f of report.removed) console.log(`${check ? 'would remove' : 'removed'}: ${f}`);
  for (const f of report.stale) console.log(`stale (not upstream, use --prune): ${f}`);
  console.log(
    `${check ? 'Would write' : 'Wrote'} ${report.written.length}, unchanged ${report.unchanged}, ` +
      `stale/removed ${report.stale.length + report.removed.length}, skipped ${report.skipped.length}.`,
  );
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const base = process.cwd();
  const cacheDir = path.join(contentRoot(base), '.cache', 'upstream');
  let downloaded = false;
  try {
    let source: string;
    if (args.from) {
      source = path.resolve(args.from);
    } else {
      source = await downloadUpstream(cacheDir);
      downloaded = true;
    }
    const report = materializeUpstream(source, base, { check: args.check, prune: args.prune });
    printReport(report, args.check);
    if (args.check && hasDifferences(report)) process.exitCode = 1;
  } finally {
    if (downloaded) fs.rmSync(cacheDir, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
