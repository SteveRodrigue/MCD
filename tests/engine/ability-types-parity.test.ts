import { describe, it, expect, expectTypeOf } from 'vitest';
import fs from 'fs';
import path from 'path';
import type { z } from 'zod';
import type {
  AbilityCost as EngineAbilityCost,
  AbilityTiming as EngineAbilityTiming,
  CardUsesDefinition as EngineCardUsesDefinition,
  EffectType as EngineEffectType,
  TriggerType as EngineTriggerType,
} from '../../src/engine/models/abilities';
import {
  TimingTypeSchema,
  TriggerTypeSchema,
  type AbilityCost as SchemaAbilityCost,
  type CardUses as SchemaCardUses,
  type EffectType as SchemaEffectType,
} from '../../src/data/supplemental/schema';

const KNOWN_OFF_SCHEMA_DISPATCHES = new Set<string>();

const ENGINE_DIR = path.resolve(__dirname, '../../src/engine');

function listSourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listSourceFiles(full);
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

describe('engine ability types are the supplemental schema types', () => {
  it('are mutually assignable (compile-time)', () => {
    expectTypeOf<EngineAbilityTiming>().toEqualTypeOf<z.infer<typeof TimingTypeSchema>>();
    expectTypeOf<EngineTriggerType>().toEqualTypeOf<z.infer<typeof TriggerTypeSchema>>();
    expectTypeOf<EngineEffectType>().toEqualTypeOf<SchemaEffectType>();
    expectTypeOf<EngineAbilityCost>().toEqualTypeOf<SchemaAbilityCost>();
    expectTypeOf<EngineCardUsesDefinition>().toEqualTypeOf<SchemaCardUses>();
    expect(true).toBe(true);
  });

  it('never dispatches a trigger name absent from TriggerTypeSchema', () => {
    const known = new Set<string>(TriggerTypeSchema.options);
    const pattern = /dispatchTrigger\(\s*[\w.]+\s*,\s*'([A-Z_]+)'/g;
    const unknown: string[] = [];
    let dispatchSites = 0;
    for (const file of listSourceFiles(ENGINE_DIR)) {
      const source = fs.readFileSync(file, 'utf8');
      for (const match of source.matchAll(pattern)) {
        dispatchSites++;
        if (!known.has(match[1]) && !KNOWN_OFF_SCHEMA_DISPATCHES.has(match[1]))
          unknown.push(`${path.relative(ENGINE_DIR, file)}: ${match[1]}`);
      }
    }
    expect(dispatchSites).toBeGreaterThan(0);
    expect(unknown).toEqual([]);
  });
});
