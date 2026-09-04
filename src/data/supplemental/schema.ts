import { z } from 'zod';

/**
 * ISO-8601 Timestamp regex matching YYYY-MM-DDTHH:MM(:SS)?
 */
export const IsoTimestampSchema = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{3})?)?(?:Z|[+-]\d{2}:\d{2})?$/,
    'Must be a valid ISO timestamp with date and time (e.g. 2026-08-30T15:00)',
  );

/**
 * Audit Metadata Schema (RR v1.8 / Card Integration Protocol Step 8)
 */
export const CardAuditRecordSchema = z.object({
  createdAt: IsoTimestampSchema.optional(),
  updatedAt: IsoTimestampSchema.optional(),
  reviewedAt: IsoTimestampSchema.optional(),
  reviewedBy: z.string().optional(),
  rulesVersion: z.string().optional(),
  confidence: z.number().min(0).max(100).optional(),
  originalText: z.string().optional(),
  reconstructedText: z.string().optional(),
});

/**
 * Ability Timing Types
 */
export const TimingTypeSchema = z.enum([
  'FORCED_INTERRUPT',
  'INTERRUPT',
  'HERO_INTERRUPT',
  'ALTER_EGO_INTERRUPT',
  'HERO_ACTION',
  'ALTER_EGO_ACTION',
  'ACTION',
  'RESOURCE',
  'HERO_RESOURCE',
  'ALTER_EGO_RESOURCE',
  'FORCED_RESPONSE',
  'RESPONSE',
  'HERO_RESPONSE',
  'ALTER_EGO_RESPONSE',
  'CONSTANT',
  'SPECIAL',
  'SETUP',
  'WHEN_REVEALED',
  'BOOST',
  'CARD_PLAYED',
  'WHEN_PLAYED',
]);

/**
 * Event Trigger Types
 */
export const TriggerTypeSchema = z.enum([
  'WHEN_REVEALED',
  'BOOST_STAR_RESOLVED',
  'VILLAIN_INITIATES_ATTACK',
  'TAKE_ATTACK_DAMAGE',
  'TAKE_DAMAGE',
  'CARD_PLAYED',
  'PLAYED',
  'MINION_DEFEATED',
  'MINION_DEFEATED_BY_ATTACK',
  'ENEMY_DEFEATED_BY_HERO_ATTACK',
  'MINION_ENTERS_PLAY',
  'TREACHERY_REVEALED',
  'ATTACHED_MINION_DEFEATED',
  'ATTACHED_ENEMY_ATTACKS',
  'THREAT_WOULD_BE_PLACED',
  'MAIN_SCHEME_ADVANCED',
  'FORM_CHANGED_TO_HERO',
  'FORM_CHANGED_TO_ALTER_EGO',
  'BASIC_ATTACK_PERFORMED',
  'HERO_DEFENDED_ATTACK',
  'ATTACK_RESOLVED',
  'THWART_RESOLVED',
  'RESOURCE_SPENT',
  'MINION_ATTACKED',
  'ATTACK',
  'ROUND_END',
  'ROUND_BEGAN',
  'ROUND_ENDED',
  'PLAYER_PHASE_BEGAN',
  'PLAYER_PHASE_ENDED',
  'VILLAIN_PHASE_BEGAN',
  'VILLAIN_PHASE_ENDED',
  'DEFEATED',
  'DAMAGE_TAKEN',
  'THREAT_PLACED',
  'HERO_FLIPPED',
  'PHASE_START',
  'BOOST',
]);

/**
 * Target Selector Types
 */
export const TargetSelectorSchema = z.enum([
  'SELF',
  'SELF_IDENTITY',
  'ACTIVE_PLAYER',
  'ALL_PLAYERS',
  'ALL_HEROES',
  'TRIGGERING_HERO',
  'CHOSEN_PLAYER',
  'VILLAIN',
  'MAIN_SCHEME',
  'SIDE_SCHEME',
  'CHOSEN_SCHEME',
  'CHOSEN_ENEMY',
  'ALL_ENEMIES',
  'ENGAGED_MINIONS',
  'CHOSEN_ALLY',
  'PREVIOUS_TARGET',
  'PREVIOUS_SELECTED_CARD',
]);

/**
 * Sequential Condition Gate Types (RR v1.8 p. 2, 24)
 */
export const ConditionGateSchema = z.enum([
  'ALWAYS',
  'THEN',
  'IF_PREVIOUS_SUCCESS',
  'IF_AMOUNT_ZERO',
  'IF_ZERO_HEALED',
  'IF_FAILED',
  'IF_ALREADY_HAS_STATUS',
  'IF_RESOURCE_MATCH',
]);

/**
 * Ability Effect Primitives (Codebase-Grounded to active handlers in src/engine/)
 */
export const EffectTypeSchema = z.enum([
  'ADD_COUNTER',
  'ADD_COUNTERS',
  'ADD_STATUS',
  'ADD_STATUS_WITH_SURGE',
  'ADD_THREAT',
  'ADD_THREAT_PER_PLAYER',
  'ADD_TRAIT',
  'ALLY_LIMIT_BONUS',
  'ATTACHMENT_DAMAGE_SHIELD',
  'ATTACH_FACEDOWN_CARDS_FROM_HAND',
  'ATTACH_TO_HOST',
  'BOOST_STAT_CHOICE',
  'BUFF_ALL_FRIENDLY_CHARACTERS',
  'CANCEL_TREACHERY_AND_VILLAIN_ATTACKS',
  'CANCEL_WHEN_REVEALED',
  'CANCEL_WHEN_REVEALED_AND_ATTACK',
  'CANCEL_WHEN_REVEALED_AND_REVEAL_ANOTHER',
  'CHANGE_FORM',
  'CHANGE_FORM_DRAW_TO_HAND_SIZE',
  'COST_REDUCER',
  'DEAL_ADDITIONAL_BOOST_CARD',
  'DEAL_DAMAGE',
  'DEAL_DAMAGE_ALL_ENEMIES',
  'DECLARE_DEFENDER',
  'DISCARD_ATTACHMENT',
  'DISCARD_CARDS_FROM_HAND_AT_RANDOM',
  'DISCARD_CARDS_UNDER_HOST',
  'DISCARD_ENCOUNTER_DECK',
  'DISCARD_RANDOM_HAND',
  'DISCARD_SELF',
  'DISCARD_TOP_DECK_FILTER',
  'DISCARD_UPGRADE_OR_SUPPORT',
  'DISCARD_UPGRADE_OR_SUPPORT_OR_SURGE',
  'DOUBLE_RESOURCE_FOR_ASPECT',
  'DRAW_CARDS',
  'DRAW_UP_TO_HAND_SIZE',
  'EXECUTE_SPECIAL',
  'EXECUTE_WAKANDA_FOREVER',
  'EXHAUST_HERO',
  'EXHAUST_IDENTITY',
  'EXPLOSION',
  'FLIP_FORM',
  'FORM_BRANCH_VILLAIN_ATTACK_OR_SURGE',
  'GENERATE_RESOURCE',
  'GENERATE_TOP_DISCARD_RESOURCES',
  'GIVE_ADDITIONAL_BOOST_CARD',
  'GRANT_KEYWORD',
  'HEAL_DAMAGE',
  'HEAL_DAMAGE_WITH_SURGE',
  'HERO_FORM_BRANCH',
  'HULK_DISCARD_RESOLUTION',
  'INTERCEPT_ATTACK',
  'MODIFY_ALLY_LIMIT',
  'MODIFY_COUNTER',
  'MODIFY_HAND_SIZE',
  'MODIFY_MAX_HEALTH',
  'MODIFY_STAT',
  'NICK_FURY_CHOICE',
  'PLACE_CARD_UNDER_HOST',
  'PLACE_THREAT_PER_SIDE_SCHEME',
  'PLAYER_CHOICE',
  'PLAY_ALLY_FROM_DISCARD',
  'PREVENT_DAMAGE',
  'PUT_INTO_PLAY',
  'PUT_INTO_PLAY_ENGAGED',
  'READY_ALLY',
  'READY_CARD',
  'READY_CHARACTER',
  'READY_IDENTITY',
  'REDUCE_NEXT_CARD_COST',
  'REMOVE_COUNTER',
  'REMOVE_COUNTERS',
  'REMOVE_COUNTERS_MATCHING_FILTER',
  'REMOVE_THREAT',
  'REPULSOR_BLAST',
  'REPULSOR_BLAST_DAMAGE',
  'RESOLVE_SCRY_SELECTION',
  'RESTRICTED_LIMIT_BONUS',
  'RETRIEVE_CARD_FROM_DISCARD',
  'RETRIEVE_TECH_UPGRADE_FROM_DISCARD',
  'RETURN_FACEDOWN_CARDS_TO_OWNERS',
  'RETURN_TO_HAND',
  'REVEAL_ENCOUNTER_CARD',
  'REVEAL_ENCOUNTER_CARD_WITH_SURGE',
  'SCRY_AND_SELECT_TRAIT',
  'SEARCH_AND_PLAY_UPGRADE',
  'SEARCH_AND_REVEAL_SIDE_SCHEME',
  'SEARCH_AND_SELECT',
  'SEARCH_DECK_FOR_CARD',
  'SHUFFLE_DISCARD_INTO_DECK',
  'SHUFFLE_INTO_DECK',
  'SPAWN_MINION_ENGAGED',
  'SPAWN_NEMESIS',
  'SPEND_COUNTERS',
  'SURGE',
  'TAKE_THREAT_AS_DAMAGE',
  'TRANSFER_DAMAGE',
  'TRIGGER_SURGE',
  'TRIGGER_WAKANDA_UPGRADES',
  'VILLAIN_AND_ENGAGED_MINIONS_ATTACK',
  'VILLAIN_ATTACKS',
  'VILLAIN_SCHEMES',
  'WHEN_ATTACHED_HOST_DEFEATED',
]);

export type EffectType = z.infer<typeof EffectTypeSchema>;

/**
 * Resource Types
 */
export const ResourceTypeSchema = z.enum(['physical', 'energy', 'mental', 'wild']);

/**
 * Filter Schema
 */
export const FilterSchema = z.object({
  type: z
    .enum([
      'hero',
      'alter_ego',
      'ally',
      'upgrade',
      'support',
      'event',
      'resource',
      'minion',
      'villain',
      'main_scheme',
      'side_scheme',
      'treachery',
      'attachment',
      'obligation',
      'environment',
    ])
    .optional(),
  type_code: z.string().optional(),
  types: z.array(z.string()).optional(),
  cardTypes: z.array(z.string()).optional(),
  trait: z.string().optional(),
  traits: z.array(z.string()).optional(),
  aspect: z.enum(['aggression', 'justice', 'leadership', 'protection', 'basic', 'encounter']).optional(),
  aspects: z.array(z.string()).optional(),
  zone: z.enum(['tableau', 'hand', 'deck', 'discard', 'setAside', 'engaged']).optional(),
  isUnique: z.boolean().optional(),
  targetCardCode: z.string().optional(),
  targetCardCodes: z.array(z.string()).optional(),
  targetCardName: z.string().optional(),
  isIdentitySpecific: z.boolean().optional(),
  costMin: z.number().optional(),
  costMax: z.number().optional(),
  hasKeyword: z
    .enum([
      'Guard',
      'Overkill',
      'Quickstrike',
      'Ranged',
      'Retaliate',
      'Toughness',
      'Crisis',
      'Hazard',
      'Acceleration',
    ])
    .optional(),
});

/**
 * Ability Cost Schema
 */
export const AbilityCostSchema = z.object({
  exhaustSelf: z.boolean().optional(),
  exhaustCard: TargetSelectorSchema.optional(),
  discardSelf: z.boolean().optional(),
  resources: z.array(ResourceTypeSchema).optional(),
  resourceCost: z.union([z.number(), z.record(z.string(), z.number())]).optional(),
  damageHero: z.number().optional(),
  damageSelf: z.number().optional(),
  removeCounter: z.number().optional(),
  spendCounter: z.number().optional(),
  spendCounters: z
    .object({
      counterType: z.string().optional(),
      amount: z.number(),
      target: z.enum(['SELF', 'IDENTITY']).optional(),
    })
    .optional(),
  discardCard: z
    .object({
      count: z.number().optional(),
      maxCount: z.number().optional(),
      from: z.enum(['HAND', 'DECK', 'PLAY']),
    })
    .optional(),
  spendTokens: z
    .object({
      type: z.string(),
      count: z.number(),
    })
    .optional(),
  costCheck: z.string().optional(),
});

export const AddCountersParamsSchema = z.object({
  target: z.string().optional(),
  counterType: z.string().optional(),
  amount: z.union([z.number(), z.string()]),
});

export const SpendCountersParamsSchema = z.object({
  target: z.string().optional(),
  counterType: z.string().optional(),
  amount: z.union([z.number(), z.string()]),
  discardWhenEmpty: z.boolean().optional(),
});

export const RemoveCountersMatchingFilterParamsSchema = z.object({
  targetZone: z.string().optional(),
  traitFilter: z.string().optional(),
  counterType: z.string().optional(),
  amount: z.union([z.number(), z.literal('ALL')]).optional(),
});

/**
 * Decision Prompt Option Schema
 */
export const DecisionPromptOptionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string().optional(),
  effect: z.string().optional(),
  params: z.record(z.string(), z.any()).optional(),
  disabled: z.boolean().optional(),
});

/**
 * Search & Select Destination Routing Params Schema (RR v1.8 p. 19, 26, ADR-0030, ADR-0032)
 */
export const SearchAndSelectParamsSchema = z.object({
  source: z
    .enum(['PLAYER_DECK', 'ENCOUNTER_DECK', 'PLAYER_DISCARD', 'ENCOUNTER_DISCARD', 'PLAYER_HAND'])
    .default('PLAYER_DECK'),
  lookCount: z.number().optional(),
  takeCount: z.number().default(1),
  filter: FilterSchema.extend({
    targetCardCode: z.string().optional(),
    targetCardName: z.string().optional(),
    traits: z.array(z.string()).optional(),
    cardTypes: z.array(z.string()).optional(),
    isIdentitySpecific: z.boolean().optional(),
  }).optional(),
  selectedDestination: z
    .enum(['HAND', 'TABLEAU', 'DECK_TOP', 'DISCARD', 'ATTACH_TO_TARGET'])
    .default('HAND'),
  unselectedDestination: z
    .enum(['DISCARD', 'DECK_BOTTOM', 'DECK_SHUFFLE', 'DECK_TOP', 'LEAVE_IN_PLACE'])
    .nullable()
    .optional(),
  shuffleAfter: z.boolean().optional(),
  isVoluntary: z.boolean().optional(),
  promptTitle: z.string().optional(),
});

export type AbilityCost = z.infer<typeof AbilityCostSchema>;
export type SearchAndSelectParams = z.infer<typeof SearchAndSelectParamsSchema>;

/**
 * Ability Execution Step Interface (Operational Primitive)
 */
export interface AbilityStep {
  id?: string;
  effect: EffectType;
  params?: Record<string, any>;
  gate?: z.infer<typeof ConditionGateSchema>;
  filter?: z.infer<typeof FilterSchema>;
}

/**
 * Ability Execution Step Schema
 */
export const AbilityStepSchema = z.object({
  id: z.string().optional(),
  effect: EffectTypeSchema,
  params: z.record(z.string(), z.any()).optional(),
  gate: ConditionGateSchema.optional(),
  filter: FilterSchema.optional(),
});

/**
 * Card Ability Interface (Trigger / Cost / Timing Header)
 */
export interface CardAbility {
  id: string;
  timing: z.infer<typeof TimingTypeSchema>;
  trigger?: z.infer<typeof TriggerTypeSchema>;
  cost?: AbilityCost;
  limit?: 'ONCE_PER_ROUND' | 'ONCE_PER_PHASE';
  maxPerRound?: number;
  errata?: string | null;
  steps: AbilityStep[];
}

/**
 * Card Ability Schema
 */
export const CardAbilitySchema: z.ZodType<CardAbility> = z.object({
  id: z.string().min(1),
  timing: TimingTypeSchema,
  trigger: TriggerTypeSchema.optional(),
  cost: AbilityCostSchema.optional(),
  limit: z.enum(['ONCE_PER_ROUND', 'ONCE_PER_PHASE']).optional(),
  maxPerRound: z.number().optional(),
  errata: z.string().nullable().optional(),
  steps: z.array(AbilityStepSchema).min(1),
});

/**
 * Card Uses Definition Schema (RR v1.8 p. 30 'Uses')
 */
export const CardUsesSchema = z.object({
  count: z.number().int().nonnegative(),
  type: z.string().optional(),
  counterType: z.string().optional(),
  max: z.number().int().positive().optional(),
  discardOnEmpty: z.boolean().optional(),
});



export type CardUses = z.infer<typeof CardUsesSchema>;

/**
 * Card Enrichment Schema
 */
export const CardEnrichmentSchema = z.object({
  comment: z.string().optional(),
  abilities: z.array(CardAbilitySchema).optional(),
  audit: CardAuditRecordSchema.optional(),
  mechanicSteps: z.array(z.string()).optional(),
  noSupplementalNeeded: z.boolean().optional(),
  maxPerPlayer: z.number().optional(),
  uses: CardUsesSchema.optional(),
  victoryPoints: z.number().optional(),
  errata: z.string().nullable().optional(),
});

/**
 * Supplemental Pack JSON File Schema
 */
export const SupplementalPackSchema = z.object({
  cards: z.record(z.string(), CardEnrichmentSchema),
});

export type SupplementalPack = z.infer<typeof SupplementalPackSchema>;
export type CardEnrichment = z.infer<typeof CardEnrichmentSchema>;
export type CardAuditRecord = z.infer<typeof CardAuditRecordSchema>;
export type FilterSchemaType = z.infer<typeof FilterSchema>;
