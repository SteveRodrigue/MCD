/**
 * Marvel Champions Digital (MCD) - JSON Schema Generator
 *
 * Exports the codebase-grounded Zod schemas to standard JSON Schema files for live VS Code
 * validation and IntelliSense: the supplemental pack schema and the content-pack schemas
 * (pack manifest, scenario definition, modular sets). One entry in SCHEMAS per output file.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { toJSONSchema, type ZodType } from 'zod';
import { SupplementalPackSchema } from '../src/data/supplemental/schema';
import { PackManifestSchema } from '../src/data/packs/pack-manifest';
import { ModularSetsSchema, ScenarioDefinitionSchema } from '../src/data/packs/scenario-definition';

export interface SchemaEntry {
  /** Output path relative to the repository root. */
  outputPath: string;
  title: string;
  description: string;
  schema: ZodType;
}

export const SCHEMAS: SchemaEntry[] = [
  {
    outputPath: 'src/data/supplemental/schema.json',
    title: 'Marvel Champions Digital - Supplemental Pack Schema',
    description:
      'Codebase-grounded schema for Marvel Champions Digital card supplementals. Enforces strict effect primitives, triggers, timings, costs, targets, and card structures.',
    schema: SupplementalPackSchema,
  },
  {
    outputPath: 'src/data/packs/pack.schema.json',
    title: 'Marvel Champions Digital - Content Pack Manifest',
    description:
      'Manifest (pack.json) of a content pack: identity, origin, API version and dependencies.',
    schema: PackManifestSchema,
  },
  {
    outputPath: 'src/data/packs/scenario.schema.json',
    title: 'Marvel Champions Digital - Scenario Definition',
    description:
      'Declarative scenario definition (definition.json) shared by official and user scenarios.',
    schema: ScenarioDefinitionSchema,
  },
  {
    outputPath: 'src/data/packs/modular-sets.schema.json',
    title: 'Marvel Champions Digital - Modular Encounter Sets',
    description: 'Catalog of modular encounter sets (modular-sets.json) provided by a pack.',
    schema: ModularSetsSchema,
  },
];

export function generateSchema(entry: SchemaEntry): Record<string, any> {
  const rawSchema = toJSONSchema(entry.schema) as Record<string, any>;

  // Ensure top-level metadata and compatibility
  return {
    $schema: 'http://json-schema.org/draft-07/schema#',
    title: entry.title,
    description: entry.description,
    ...rawSchema,
  };
}

export function generateSupplementalSchema(): Record<string, any> {
  return generateSchema(SCHEMAS[0]);
}

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function writeSchemas(): string[] {
  return SCHEMAS.map((entry) => {
    const outputPath = path.resolve(REPO_ROOT, entry.outputPath);
    fs.writeFileSync(outputPath, JSON.stringify(generateSchema(entry), null, 2) + '\n', 'utf-8');
    console.log(`✅ JSON Schema written to ${outputPath}`);
    return outputPath;
  });
}

// Direct execution
if (
  process.argv[1]?.includes('generate-supplemental-schema') ||
  import.meta.url === `file://${process.argv[1]}`
) {
  writeSchemas();
}
