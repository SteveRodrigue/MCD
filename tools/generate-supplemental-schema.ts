/**
 * Marvel Champions Digital (MCD) - Supplemental JSON Schema Generator
 *
 * Exports the codebase-grounded Zod schema (SupplementalPackSchema) to a standard
 * JSON Schema file at `src/data/supplemental/schema.json` for live VS Code validation,
 * red squigglies on invalid enums/properties, and IntelliSense autocomplete.
 */

import * as fs from 'fs';
import * as path from 'path';
import { toJSONSchema } from 'zod';
import { SupplementalPackSchema } from '../src/data/supplemental/schema';

export function generateSupplementalSchema(): Record<string, any> {
  const rawSchema = toJSONSchema(SupplementalPackSchema) as Record<string, any>;

  // Ensure top-level metadata and compatibility
  const fullSchema = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    title: 'Marvel Champions Digital - Supplemental Pack Schema',
    description:
      'Codebase-grounded schema for Marvel Champions Digital card supplementals. Enforces strict effect primitives, triggers, timings, costs, targets, and card structures.',
    ...rawSchema,
  };

  return fullSchema;
}

export function writeSupplementalSchema(): string {
  const schema = generateSupplementalSchema();
  const outputPath = path.resolve('src/data/supplemental/schema.json');
  const formattedJson = JSON.stringify(schema, null, 2) + '\n';
  fs.writeFileSync(outputPath, formattedJson, 'utf-8');
  console.log(`✅ Supplemental JSON Schema written to ${outputPath}`);
  return outputPath;
}

// Direct execution
if (
  process.argv[1]?.includes('generate-supplemental-schema') ||
  import.meta.url === `file://${process.argv[1]}`
) {
  writeSupplementalSchema();
}
