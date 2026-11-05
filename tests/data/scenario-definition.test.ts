import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { packDir, scenarioDefinitionFile } from '../../src/tools/content-paths';
import {
  EncounterSetsSchema,
  ScenarioDefinitionSchema,
} from '../../src/data/packs/scenario-definition';

const definitions: [string, any][] = ['rhino', 'klaw', 'ultron', 'risky_business'].map((id) => [
  id,
  JSON.parse(fs.readFileSync(scenarioDefinitionFile(id), 'utf8')),
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

describe('EncounterSetsSchema', () => {
  const sets = JSON.parse(
    fs.readFileSync(path.join(packDir('core'), 'encounter-sets.json'), 'utf8'),
  );

  it('accepts the real encounter-sets.json', () => {
    expect(EncounterSetsSchema.safeParse(sets).success).toBe(true);
  });

  it('rejects non-snake_case codes and missing names', () => {
    expect(
      EncounterSetsSchema.safeParse([{ code: 'Bomb-Scare', kind: 'modular', name: 'x', description: '' }]).success,
    ).toBe(false);
    expect(EncounterSetsSchema.safeParse([{ code: 'bomb_scare', kind: 'modular', description: '' }]).success).toBe(
      false,
    );
  });
});
