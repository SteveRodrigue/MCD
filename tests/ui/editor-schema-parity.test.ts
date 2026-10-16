import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ZodType } from 'zod';
import { EFFECT_PARAM_SCHEMAS } from '../../src/data/supplemental/effect-params';
import { GATE_REGISTRY, StepGateSchema } from '../../src/data/supplemental/gate-params';
import * as primitives from '../../src/data/supplemental/schema-primitives';
import * as schemaModule from '../../src/data/supplemental/schema';
import {
  defOf,
  introspectObjectSchema,
  type FieldDescriptor,
} from '../../src/data/supplemental/schema-introspector';

const KNOWN_KINDS = new Set<FieldDescriptor['kind']>([
  'string',
  'number',
  'boolean',
  'enum',
  'multi-enum',
  'literal',
  'object',
  'array',
  'record',
  'any',
]);

/** Introspection throws on an unsupported node kind; every descriptor must also carry a known kind. */
function expectCleanIntrospection(schema: ZodType): void {
  const fields = introspectObjectSchema(schema);
  for (const field of fields) {
    expect(
      KNOWN_KINDS.has(field.kind),
      `field '${field.key}' has unknown kind '${field.kind}'`,
    ).toBe(true);
    expect(field.widget, `field '${field.key}' has no widget`).toBeTruthy();
  }
}

describe('editor schema parity (CI contract guard)', () => {
  it('every EffectTypeSchema option has an EFFECT_PARAM_SCHEMAS entry that introspects cleanly', () => {
    for (const effect of primitives.EffectTypeSchema.options) {
      const schema = EFFECT_PARAM_SCHEMAS[effect];
      expect(schema, `missing EFFECT_PARAM_SCHEMAS entry for ${effect}`).toBeDefined();
      expectCleanIntrospection(schema);
    }
    expect(Object.keys(EFFECT_PARAM_SCHEMAS).sort()).toEqual(
      [...primitives.EffectTypeSchema.options].sort(),
    );
  });

  it('every StepGateSchema option has a GATE_REGISTRY schema that introspects cleanly', () => {
    for (const gate of StepGateSchema.options) {
      const definition = GATE_REGISTRY[gate];
      expect(definition, `missing GATE_REGISTRY entry for ${gate}`).toBeDefined();
      expectCleanIntrospection(definition.schema);
    }
  });

  it.each([
    ['TriggerFilterSchema', primitives.TriggerFilterSchema],
    ['AbilityCostSchema', primitives.AbilityCostSchema],
    ['PlayRequirementsSchema', schemaModule.PlayRequirementsSchema],
    ['CardUsesSchema', schemaModule.CardUsesSchema],
    ['CardEnrichmentSchema', schemaModule.CardEnrichmentSchema],
  ])('%s introspects with zero unknown field kinds', (_name, schema) => {
    expectCleanIntrospection(schema);
  });

  describe('no hardcoded enum option arrays in the editor', () => {
    const enumSchemas = new Map<string, readonly string[]>();
    for (const source of [schemaModule, primitives] as Record<string, unknown>[]) {
      for (const [name, value] of Object.entries(source)) {
        if (defOf(value as ZodType)?.type !== 'enum') continue;
        const options = (value as { options: readonly string[] }).options;
        if (options.length >= 3) enumSchemas.set(name, options);
      }
    }

    const editorRoot = path.resolve(__dirname, '../../src/ui/components/editor');
    const collect = (dir: string): string[] =>
      fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return collect(full);
        return /\.tsx?$/.test(entry.name) ? [full] : [];
      });

    const STRING = String.raw`(?:'[^'\n]*'|"[^"\n]*")`;
    const arrayLiteral = new RegExp(String.raw`\[\s*${STRING}(?:\s*,\s*${STRING})+\s*,?\s*\]`, 'g');

    it('finds enum schemas to compare against', () => {
      expect(enumSchemas.size).toBeGreaterThan(10);
    });

    it('does not duplicate any schema enum as a string array literal', () => {
      const offenders: string[] = [];
      for (const file of collect(editorRoot)) {
        const source = fs.readFileSync(file, 'utf8');
        for (const match of source.matchAll(arrayLiteral)) {
          const members = [...match[0].matchAll(/'([^']*)'|"([^"]*)"/g)].map((m) => m[1] ?? m[2]);
          const memberSet = new Set(members);
          if (memberSet.size < 3) continue;
          for (const [name, options] of enumSchemas) {
            if (options.length === memberSet.size && options.every((o) => memberSet.has(o))) {
              const line = source.slice(0, match.index).split('\n').length;
              offenders.push(
                `${path.relative(editorRoot, file)}:${line} duplicates ${name}; use ${name}.options`,
              );
            }
          }
        }
      }
      expect(offenders).toEqual([]);
    });
  });
});
