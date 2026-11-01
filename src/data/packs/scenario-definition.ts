import { z } from 'zod';
import { DIFFICULTY_MODES } from '../../engine/models/state';

const DifficultySchema = z.enum(DIFFICULTY_MODES);
const CardCodeList = z.array(z.string().min(1));

/** Declarative scenario manifest (definition.json), shared by official and user scenarios. */
export const ScenarioDefinitionSchema = z
  .object({
    $schema: z.string().optional(),
    id: z.string().min(1),
    name: z.string().min(1),
    scenarioCardCode: z.string().min(1),
    author: z.string().optional(),
    version: z.string().optional(),
    description: z.string().optional(),
    supportedDifficulties: z.array(DifficultySchema).min(1),
    villainSetup: z
      .object({
        villainName: z.string().min(1),
        stages: z.record(DifficultySchema, CardCodeList),
      })
      .strict(),
    mainSchemeSetup: z
      .object({
        stages: CardCodeList,
        startingThreat: z.number().int().nonnegative(),
        targetThreatPerPlayer: z.number().int().nonnegative(),
        escalationThreatPerPlayer: z.number().int().nonnegative(),
      })
      .strict(),
    modularEncounterSets: z
      .object({
        mandatory: z.array(z.string()),
        defaults: z.record(DifficultySchema, z.array(z.string())),
        slotCount: z.number().int().nonnegative().optional(),
        recommendedModularSets: z.array(z.string()).optional(),
      })
      .strict(),
  })
  .strict();

export type ScenarioDefinition = z.infer<typeof ScenarioDefinitionSchema>;

export const MODULAR_SET_CODE_PATTERN = /^[a-z][a-z0-9_]*$/;

/** modular-sets.json: a top-level array of modular encounter set descriptions. */
export const ModularSetsSchema = z.array(
  z
    .object({
      code: z.string().regex(MODULAR_SET_CODE_PATTERN, 'must be snake_case'),
      name: z.string().min(1),
      description: z.string(),
    })
    .strict(),
);

export type ModularSets = z.infer<typeof ModularSetsSchema>;
