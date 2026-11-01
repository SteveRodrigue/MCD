/**
 * Marvel Champions Digital (MCD) - Content path helper (Node only).
 *
 * The single place that knows the on-disk layout of the content folder (ADR-0092):
 *
 *   content/meta/                         shared catalog metadata, schemas, catalog translations
 *   content/packs/<code>/cards/<stem>.json
 *   content/packs/<code>/supplemental/<stem>.json
 *   content/packs/<code>/translations/<locale>/<stem>.json
 *   content/packs/<code>/{scenarios,decks,modular-sets.json,pack.json}
 *
 * A "stem" is an upstream file name without extension: `core`, `core_encounter`, `aoa_encounter`.
 * Scripts, tools, tests and the editor middleware use this module instead of spelling paths.
 */

import * as fs from 'fs';
import * as path from 'path';

const ENCOUNTER_SUFFIX = '_encounter';

export function codeOfStem(stem: string): string {
  return stem.endsWith(ENCOUNTER_SUFFIX) ? stem.slice(0, -ENCOUNTER_SUFFIX.length) : stem;
}

export function contentRoot(base: string = process.cwd()): string {
  return path.resolve(base, 'content');
}

export function packsRoot(base?: string): string {
  return path.join(contentRoot(base), 'packs');
}

export function packDir(code: string, base?: string): string {
  return path.join(packsRoot(base), code);
}

export function metaFile(name: string, base?: string): string {
  return path.join(contentRoot(base), 'meta', `${name}.json`);
}

export function metaSchemaFile(name: string, base?: string): string {
  return path.join(contentRoot(base), 'meta', 'schema', `${name}.json`);
}

export function cardFile(stem: string, base?: string): string {
  return path.join(packDir(codeOfStem(stem), base), 'cards', `${stem}.json`);
}

export function supplementalFile(stem: string, base?: string): string {
  return path.join(packDir(codeOfStem(stem), base), 'supplemental', `${stem}.json`);
}

export function translationFile(locale: string, stem: string, base?: string): string {
  return path.join(packDir(codeOfStem(stem), base), 'translations', locale, `${stem}.json`);
}

export function scenarioDefinitionFile(scenarioId: string, base?: string): string {
  return path.join(packDir('core', base), 'scenarios', scenarioId, 'definition.json');
}

export interface StemFile {
  stem: string;
  code: string;
  file: string;
}

function listStemFiles(dirOf: (code: string) => string, base?: string): StemFile[] {
  const out: StemFile[] = [];
  for (const code of listPackCodes(base)) {
    const dir = dirOf(code);
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir).sort()) {
      if (!name.endsWith('.json')) continue;
      out.push({ stem: name.slice(0, -'.json'.length), code, file: path.join(dir, name) });
    }
  }
  return out.sort((a, b) => a.stem.localeCompare(b.stem));
}

export function listPackCodes(base?: string): string[] {
  const root = packsRoot(base);
  if (!fs.existsSync(root)) return [];
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

/** Every card file of every pack, sorted by stem. */
export function listCardFiles(base?: string): StemFile[] {
  return listStemFiles((code) => path.join(packDir(code, base), 'cards'), base);
}

/** Every supplemental file of every pack, sorted by stem. */
export function listSupplementalFiles(base?: string): StemFile[] {
  return listStemFiles((code) => path.join(packDir(code, base), 'supplemental'), base);
}

const JSON_EXT = '.json';

/** File names (`<stem>.json`) of every pack's card files. */
export function cardFileNames(base?: string): string[] {
  return listCardFiles(base).map((f) => `${f.stem}${JSON_EXT}`);
}

/** File names (`<stem>.json`) of every pack's supplemental files. */
export function supplementalFileNames(base?: string): string[] {
  return listSupplementalFiles(base).map((f) => `${f.stem}${JSON_EXT}`);
}

function stemOfFileName(fileName: string): string {
  return fileName.endsWith(JSON_EXT) ? fileName.slice(0, -JSON_EXT.length) : fileName;
}

/** Path of the card file named `<stem>.json`. */
export function cardPath(fileName: string, base?: string): string {
  return cardFile(stemOfFileName(fileName), base);
}

/** Path of the supplemental file named `<stem>.json`. */
export function supplementalPath(fileName: string, base?: string): string {
  return supplementalFile(stemOfFileName(fileName), base);
}
