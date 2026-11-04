import { z } from 'zod';
import { DIFFICULTY_MODES } from '../../engine/models/difficulty.ts';

const DifficultySchema = z.enum(DIFFICULTY_MODES);
const CardCodeList = z.array(z.string().min(1));

/**
 * A minion with no printed card of its own, which a scenario's script puts into play (an Ultron
 * Drone). Declared here so its stats are data and an art pack can target its code.
 */
const ScenarioTokenSchema = z
  .object({
    code: z.string().regex(/^[a-z][a-z0-9_]*$/, 'must be snake_case'),
    name: z.string().min(1),
    type: z.literal('minion'),
    /** The pack that owns the scenario. */
    packCode: z.string().min(1),
    traits: z.array(z.string().min(1)),
    scheme: z.number().int().nonnegative(),
    attack: z.number().int().nonnegative(),
    health: z.number().int().positive(),
  })
  .strict();

/**
 * A scenario's exception to a set choice: `fixed` is the one set it always uses, or null when it
 * uses no such set (The Wrecking Crew, Civil War competitive).
 */
const EncounterSetRuleSchema = z.object({ fixed: z.string().min(1).nullable() }).strict();

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
    /** Comic sound effect shown with the setup log entry. */
    setupOnomatopoeia: z.string().min(1).optional(),
    supportedDifficulties: z.array(DifficultySchema).min(1),
    villainSetup: z
      .object({
        villainName: z.string().min(1),
        stages: z.partialRecord(DifficultySchema, CardCodeList),
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
        slotCount: z.number().int().nonnegative().optional(),
        recommendedModularSets: z.array(z.string()).optional(),
      })
      .strict(),
    /** Only for a scenario that breaks the usual Standard or Expert set rule. */
    encounterSetRules: z
      .object({ standard: EncounterSetRuleSchema, expert: EncounterSetRuleSchema })
      .partial()
      .strict()
      .optional(),
    tokens: z.array(ScenarioTokenSchema).optional(),
  })
  .strict()
  .superRefine((definition, context) => {
    for (const difficulty of definition.supportedDifficulties) {
      if (definition.villainSetup.stages[difficulty]?.length) continue;
      context.addIssue({
        code: 'custom',
        path: ['villainSetup', 'stages', difficulty],
        message: `a supported difficulty needs villain stages (${difficulty})`,
      });
    }
  });

export type ScenarioDefinition = z.infer<typeof ScenarioDefinitionSchema>;
export type ScenarioToken = z.infer<typeof ScenarioTokenSchema>;

export const ENCOUNTER_SET_CODE_PATTERN = /^[a-z][a-z0-9_]*$/;

/**
 * The kind of an encounter set a player can choose at setup. RR v1.8 Standard Set and Expert Set:
 * neither is a modular set, and neither can fill a modular slot.
 */
export const ENCOUNTER_SET_KINDS = ['modular', 'standard', 'expert'] as const;
export type EncounterSetKind = (typeof ENCOUNTER_SET_KINDS)[number];

/** encounter-sets.json: the encounter sets a pack offers at setup. */
export const EncounterSetsSchema = z.array(
  z
    .object({
      code: z.string().regex(ENCOUNTER_SET_CODE_PATTERN, 'must be snake_case'),
      kind: z.enum(ENCOUNTER_SET_KINDS),
      name: z.string().min(1),
      description: z.string(),
    })
    .strict(),
);

export type EncounterSets = z.infer<typeof EncounterSetsSchema>;
