/**
 * Marvel Champions Digital (MCD) - Content pack validator.
 *
 * Usage: npm run pack:validate -- <packs-root | pack-dir>
 * Validates every pack under a packs root (or one pack, in the context of its siblings):
 * manifest, API version, reserved IDs, per-file schemas, cross-pack identity and dependencies.
 * Exit code 1 when any finding is reported.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import Ajv from 'ajv';
import type { ZodType } from 'zod';
import {
  OFFICIAL_CARD_CODE_PATTERN,
  PACK_API_VERSION,
  PackManifestSchema,
  isReservedPackId,
  userCardCodePattern,
  type PackManifest,
} from '../src/data/packs/pack-manifest';
import { ClaimRegistry } from '../src/data/packs/identity';
import { PackDeckSchema } from '../src/data/packs/pack-deck';
import { ModularSetsSchema, ScenarioDefinitionSchema } from '../src/data/packs/scenario-definition';
import { SupplementalPackSchema } from '../src/data/supplemental/schema';
import { metaFile, metaSchemaFile } from '../src/tools/content-paths';
import { packHooks } from '../src/data/content/pack-hooks.generated';

const PLACEHOLDER_CODE = '00000';

export interface PackFinding {
  pack: string;
  file: string;
  check: string;
  message: string;
}

export interface ValidatePackOptions {
  /** Official pack codes; user pack IDs may not collide with them. */
  officialPackCodes: readonly string[];
  /** Upstream (zzorba/MarvelCDB) card JSON schema every pack card must satisfy. */
  cardSchema: object;
  /** Ids of the packs in the generated hook map; when given, an official pack with scripts must be listed. */
  hookPackIds?: readonly string[];
  /** Report findings for this pack only (set-level checks still see every pack). */
  onlyPack?: string;
}

interface LoadedPack {
  dir: string;
  name: string;
  manifest?: PackManifest;
  cardCodes: Set<string>;
}

function readJson(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

function listJson(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => path.join(dir, f));
}

export function validatePackSet(packsRoot: string, options: ValidatePackOptions): PackFinding[] {
  const findings: PackFinding[] = [];
  const validateCard = new Ajv().compile(options.cardSchema);
  const add = (pack: string, file: string, check: string, message: string) =>
    findings.push({ pack, file: path.relative(packsRoot, file), check, message });
  const parse = (pack: string, file: string, schema: ZodType): unknown => {
    let data: unknown;
    try {
      data = readJson(file);
    } catch (e) {
      add(pack, file, 'json', `Invalid JSON: ${(e as Error).message}`);
      return undefined;
    }
    const result = schema.safeParse(data);
    if (!result.success) {
      for (const issue of result.error.issues) {
        add(pack, file, 'schema', `${issue.path.join('.') || '(root)'}: ${issue.message}`);
      }
      return undefined;
    }
    return result.data;
  };

  const packs: LoadedPack[] = fs
    .readdirSync(packsRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => ({
      dir: path.join(packsRoot, d.name),
      name: d.name,
      cardCodes: new Set<string>(),
    }));

  // Pass 1: manifests and card codes.
  for (const pack of packs) {
    const manifestPath = path.join(pack.dir, 'pack.json');
    if (!fs.existsSync(manifestPath)) {
      add(pack.name, manifestPath, 'manifest', 'Missing pack.json');
      continue;
    }
    pack.manifest = parse(pack.name, manifestPath, PackManifestSchema) as PackManifest | undefined;
    const manifest = pack.manifest;
    if (!manifest) continue;
    if (manifest.id !== pack.name) {
      add(pack.name, manifestPath, 'manifest', `id "${manifest.id}" must equal the folder name`);
    }
    if (manifest.apiVersion > PACK_API_VERSION) {
      add(
        pack.name,
        manifestPath,
        'api-version',
        `apiVersion ${manifest.apiVersion} is newer than the engine's ${PACK_API_VERSION}`,
      );
    }
    if (manifest.origin === 'user') {
      if (isReservedPackId(manifest.id, options.officialPackCodes)) {
        add(
          pack.name,
          manifestPath,
          'reserved-id',
          `"${manifest.id}" is reserved for official packs`,
        );
      }
      if (fs.existsSync(path.join(pack.dir, 'scripts'))) {
        add(
          pack.name,
          path.join(pack.dir, 'scripts'),
          'user-code',
          'User packs are JSON-only; scripts/ is not allowed',
        );
      }
    } else if (fs.existsSync(path.join(pack.dir, 'scripts'))) {
      const scriptsDir = path.join(pack.dir, 'scripts');
      if (!fs.existsSync(path.join(scriptsDir, 'index.ts'))) {
        add(
          pack.name,
          scriptsDir,
          'hooks-index',
          'scripts/ needs an index.ts that exports the hooks',
        );
      } else if (options.hookPackIds && !options.hookPackIds.includes(manifest.id)) {
        add(
          pack.name,
          scriptsDir,
          'hooks-map',
          `"${manifest.id}" is missing from the generated hook map (run npm run schema:generate)`,
        );
      }
    }
    const codePattern =
      manifest.origin === 'user' ? userCardCodePattern(manifest.id) : OFFICIAL_CARD_CODE_PATTERN;
    for (const file of listJson(path.join(pack.dir, 'cards'))) {
      let cards: unknown;
      try {
        cards = readJson(file);
      } catch (e) {
        add(pack.name, file, 'json', `Invalid JSON: ${(e as Error).message}`);
        continue;
      }
      if (!Array.isArray(cards)) {
        add(pack.name, file, 'cards', 'Expected an array of cards');
        continue;
      }
      for (const card of cards as Record<string, unknown>[]) {
        const code = card?.code;
        if (typeof code !== 'string' || !codePattern.test(code)) {
          add(pack.name, file, 'card-code', `"${String(code)}" does not match ${codePattern}`);
          continue;
        }
        // The upstream schema only knows numeric codes, so user cards are checked with a stand-in.
        const toValidate = manifest.origin === 'user' ? { ...card, code: PLACEHOLDER_CODE } : card;
        if (!validateCard(toValidate)) {
          const err = validateCard.errors?.[0];
          add(
            pack.name,
            file,
            'cards',
            `${code}: ${err?.dataPath ?? ''} ${err?.message ?? 'invalid card'}`.trim(),
          );
        } else pack.cardCodes.add(code);
      }
    }
  }

  // Pass 2: per-file schemas, dependencies and cross-pack identity.
  const byId = new Map<string, LoadedPack>();
  const cardClaims = new ClaimRegistry();
  const scenarioClaims = new ClaimRegistry();
  const setClaims = new ClaimRegistry();
  for (const pack of packs) {
    const manifest = pack.manifest;
    if (!manifest) continue;
    if (byId.has(manifest.id))
      add(pack.name, pack.dir, 'duplicate-pack', `Pack id "${manifest.id}" is used twice`);
    byId.set(manifest.id, pack);
    for (const code of pack.cardCodes) {
      const owner = cardClaims.claim(code, manifest.id);
      if (owner)
        add(pack.name, pack.dir, 'duplicate-card', `Card ${code} is also defined by "${owner}"`);
    }
  }
  for (const pack of packs) {
    const manifest = pack.manifest;
    if (!manifest) continue;
    const manifestPath = path.join(pack.dir, 'pack.json');
    for (const dep of manifest.dependsOn) {
      if (!byId.has(dep))
        add(pack.name, manifestPath, 'dependency', `dependsOn "${dep}" is not present`);
    }
    const visible = new Set(pack.cardCodes);
    for (const dep of manifest.dependsOn) byId.get(dep)?.cardCodes.forEach((c) => visible.add(c));
    for (const file of listJson(path.join(pack.dir, 'supplemental'))) {
      const data = parse(pack.name, file, SupplementalPackSchema) as
        { cards: Record<string, unknown> } | undefined;
      for (const code of Object.keys(data?.cards ?? {})) {
        if (!visible.has(code)) {
          add(
            pack.name,
            file,
            'supplemental-key',
            `Card ${code} is not in this pack or its dependencies`,
          );
        }
      }
    }
    const scenariosDir = path.join(pack.dir, 'scenarios');
    if (fs.existsSync(scenariosDir)) {
      for (const d of fs
        .readdirSync(scenariosDir, { withFileTypes: true })
        .filter((e) => e.isDirectory())) {
        const file = path.join(scenariosDir, d.name, 'definition.json');
        if (!fs.existsSync(file)) {
          add(pack.name, file, 'scenario', 'Missing definition.json');
          continue;
        }
        const def = parse(pack.name, file, ScenarioDefinitionSchema) as { id: string } | undefined;
        if (!def) continue;
        const owner = scenarioClaims.claim(def.id, manifest.id);
        if (owner)
          add(
            pack.name,
            file,
            'duplicate-scenario',
            `Scenario id "${def.id}" is also defined by "${owner}"`,
          );
      }
    }
    const setsFile = path.join(pack.dir, 'modular-sets.json');
    if (fs.existsSync(setsFile)) {
      const sets = parse(pack.name, setsFile, ModularSetsSchema) as { code: string }[] | undefined;
      for (const set of sets ?? []) {
        const owner = setClaims.claim(set.code, manifest.id);
        if (owner)
          add(
            pack.name,
            setsFile,
            'duplicate-modular-set',
            `Modular set "${set.code}" is also defined by "${owner}"`,
          );
      }
    }
    for (const file of listJson(path.join(pack.dir, 'decks')))
      parse(pack.name, file, PackDeckSchema);
  }

  // Dependency cycles.
  for (const pack of packs) {
    const manifest = pack.manifest;
    if (!manifest) continue;
    const seen = new Set<string>();
    const stack = [...manifest.dependsOn];
    while (stack.length) {
      const id = stack.pop() as string;
      if (id === manifest.id) {
        add(pack.name, path.join(pack.dir, 'pack.json'), 'dependency', 'dependsOn forms a cycle');
        break;
      }
      if (seen.has(id)) continue;
      seen.add(id);
      stack.push(...(byId.get(id)?.manifest?.dependsOn ?? []));
    }
  }

  return options.onlyPack ? findings.filter((f) => f.pack === options.onlyPack) : findings;
}

export function readCardSchema(repoRoot: string): object {
  return readJson(metaSchemaFile('card_schema', repoRoot)) as object;
}

export function readOfficialPackCodes(repoRoot: string): string[] {
  return (readJson(metaFile('packs', repoRoot)) as { code: string }[]).map((p) => p.code);
}

function main(): void {
  const arg = process.argv[2];
  if (!arg) {
    console.error('Usage: npm run pack:validate -- <packs-root | pack-dir>');
    process.exit(1);
  }
  const target = path.resolve(arg);
  const isPackDir = fs.existsSync(path.join(target, 'pack.json'));
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const findings = validatePackSet(isPackDir ? path.dirname(target) : target, {
    officialPackCodes: readOfficialPackCodes(repoRoot),
    cardSchema: readCardSchema(repoRoot),
    hookPackIds: Object.keys(packHooks),
    onlyPack: isPackDir ? path.basename(target) : undefined,
  });
  for (const f of findings) console.error(`${f.file} [${f.check}] ${f.message}`);
  if (findings.length) process.exit(1);
  console.log('pack:validate passed.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
