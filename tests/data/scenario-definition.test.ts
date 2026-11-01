import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  ModularSetsSchema,
  ScenarioDefinitionSchema,
} from '../../src/data/packs/scenario-definition';

const builtInDir = path.resolve('src/engine/scenarios/built-in');
const definitions: [string, any][] = fs
  .readdirSync(builtInDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => [
    d.name,
    JSON.parse(fs.readFileSync(path.join(builtInDir, d.name, 'definition.json'), 'utf8')),
  ]);

describe('ScenarioDefinitionSchema', () => {
  it.each(definitions)('accepts the real %s definition.json', (_name, json) => {
    expect(ScenarioDefinitionSchema.safeParse(json).success).toBe(true);
  });

  const rhino = definitions.find(([name]) => name === 'rhino')?.[1];

  it('rejects a missing difficulty in villain stages', () => {
    const broken = structuredClone(rhino);
    delete broken.villainSetup.stages.EXPERT;
    const result = ScenarioDefinitionSchema.safeParse(broken);
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain('EXPERT');
  });

  it('rejects an unknown property and a non-numeric threat', () => {
    expect(ScenarioDefinitionSchema.safeParse({ ...rhino, typo: 1 }).success).toBe(false);
    const broken = structuredClone(rhino);
    broken.mainSchemeSetup.startingThreat = 'zero';
    expect(ScenarioDefinitionSchema.safeParse(broken).success).toBe(false);
  });
});

describe('ModularSetsSchema', () => {
  const sets = JSON.parse(
    fs.readFileSync(path.resolve('src/engine/scenarios/modular-sets.json'), 'utf8'),
  );

  it('accepts the real modular-sets.json', () => {
    expect(ModularSetsSchema.safeParse(sets).success).toBe(true);
  });

  it('rejects non-snake_case codes and missing names', () => {
    expect(
      ModularSetsSchema.safeParse([{ code: 'Bomb-Scare', name: 'x', description: '' }]).success,
    ).toBe(false);
    expect(ModularSetsSchema.safeParse([{ code: 'bomb_scare', description: '' }]).success).toBe(
      false,
    );
  });
});
