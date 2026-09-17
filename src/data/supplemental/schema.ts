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
export const CardAuditRecordSchema = z
  .object({
    createdAt: IsoTimestampSchema.optional(),
    updatedAt: IsoTimestampSchema.optional(),
    reviewedAt: IsoTimestampSchema.optional(),
    reviewedBy: z.string().optional(),
    rulesVersion: z.string().optional(),
    confidence: z.number().min(0).max(100).optional(),
    ambiguityFile: z.string().optional(),
    originalText: z.string().optional(),
  })
  .strict();


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
]);

/**
 * Event Trigger Types
 */
export const TriggerTypeSchema = z.enum([
  'WHEN_REVEALED',
  'BOOST_STAR_RESOLVED',
  'ENEMY_INITIATES_ATTACK',
  'DAMAGE_WOULD_BE_TAKEN',
  'CARD_PLAYED',
  'ENTERS_PLAY',
  'MINION_ENTERS_PLAY',
  'TREACHERY_REVEALED',
  'CHARACTER_DEFEATED',
  'SCHEME_DEFEATED',
  'ATTACHED_ENEMY_ATTACKS',
  'THREAT_WOULD_BE_PLACED',
  'MAIN_SCHEME_ADVANCED',
  'BASIC_ATTACK_PERFORMED',
  'ATTACK_DEFENDED',
  'ATTACK_RESOLVED',
  'THWART_RESOLVED',
  'RESOURCE_SPENT',
  'MINION_ATTACKED',
  'ATTACK',
  'ROUND_BEGAN',
  'ROUND_ENDED',
  'PLAYER_PHASE_BEGAN',
  'PLAYER_PHASE_ENDED',
  'VILLAIN_PHASE_BEGAN',
  'VILLAIN_PHASE_ENDED',
  'DEFEATED',
  'DAMAGE_TAKEN',
  'THREAT_PLACED',
  'FORM_CHANGED',
  'STATUS_REMOVED',
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
  'CHOSEN_SCHEME',
  'CHOSEN_ENEMY',
  'ALL_ENEMIES',
  'ENGAGED_ENEMIES',
  'ENGAGED_MINIONS',
  'CHOSEN_MINION',
  'CHOSEN_ENGAGED_MINION',
  'ALL_MINIONS',
  'CHOSEN_ALLY',
  'CHOSEN_CONTROLLED_ALLY',
  'ALL_CONTROLLED_ALLIES',
  'ALL_ALLIES',
  'CHOSEN_CHARACTER',
  'CHOSEN_CONTROLLED_CHARACTER',
  'ALL_CONTROLLED_CHARACTERS',
  'CHOSEN_FRIENDLY_CHARACTER',
  'ALL_FRIENDLY_CHARACTERS',
  'ALL_CHARACTERS',
  'CHOSEN_SIDE_SCHEME',
  'ALL_SIDE_SCHEMES',
  'ALL_SCHEMES',
  'TRIGGERING_SCHEME',
  'PREVIOUS_TARGET',
  'PREVIOUS_SELECTED_CARD',
  'TRIGGERING_MINION',
  'TRIGGERING_ENEMY',
]);

/**
 * Declarative Step Condition Schema across all categories (ADR-0049, RR v1.8 p. 2, 23, 24)
 */
export const StepConditionSchema = z.enum([
  // Core Step Milestones
  'SCHEME_EMPTY',
  'TARGET_DEFEATED',
  'FULLY_HEALED',
  'STATUS_APPLIED',
  'EXCESS_DAMAGE_DEALT',

  // Entity & Board States
  'ALREADY_HAS_STATUS',
  'TARGET_ALREADY_EXHAUSTED',
  'TARGET_TRAIT_MATCH',
  'TARGET_FORM_MATCH',

  // Payment & Resource Invariants
  'RESOURCE_KICKER_MET',

  // Thresholds & Counters
  'COUNTER_THRESHOLD_MET',
  'ZONE_EMPTY',
]);

export type StepCondition = z.infer<typeof StepConditionSchema>;

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
  'IF_CONDITION_MET',
  'IF_CARD_IN_PLAY',
  'IF_CARD_NOT_IN_PLAY',
]);

/**
 * Ability Effect Primitives (Codebase-Grounded to active handlers in src/engine/)
 */
export const EffectTypeSchema = z.enum([
  'DRAW',
  'ADD_COUNTERS',
  'ADD_STATUS',
  'ADD_STATUS_WITH_SURGE',
  'ADD_THREAT',
  'ADD_TRAIT',
  'ALLY_LIMIT_BONUS',
  'ATTACHMENT_DAMAGE_SHIELD',
  'ATTACH_FACEDOWN_CARDS_FROM_HAND',
  'ATTACH_TO_HOST',
  'CANCEL_TREACHERY_AND_VILLAIN_ATTACKS',
  'CANCEL_WHEN_REVEALED',
  'CANCEL_WHEN_REVEALED_AND_ATTACK',
  'CANCEL_WHEN_REVEALED_AND_REVEAL_ANOTHER',
  'CHANGE_FORM',
  'COST_REDUCER',
  'DEAL_ADDITIONAL_BOOST_CARD',
  'DEAL_DAMAGE',
  'DECLARE_DEFENDER',
  'DISCARD',
  'DOUBLE_RESOURCE_FOR_ASPECT',
  'EXECUTE_SPECIAL',
  'EXECUTE_WAKANDA_FOREVER',
  'EXHAUST',
  'FLIP_FORM',
  'FORM_BRANCH',
  'GENERATE_RESOURCE',
  'GENERATE_TOP_DISCARD_RESOURCES',
  'GIVE_ADDITIONAL_BOOST_CARD',
  'GRANT_KEYWORD',
  'HEAL_DAMAGE',
  'HEAL_DAMAGE_WITH_SURGE',
  'HERO_FORM_BRANCH',
  'INTERCEPT_ATTACK',
  'MODIFY_ALLY_LIMIT',
  'MODIFY_RESTRICTED_LIMIT',
  'MODIFY_COUNTER',
  'MODIFY_HAND_SIZE',
  'MODIFY_MAX_HEALTH',
  'MODIFY_STAT',
  'PLACE_CARD_UNDER_HOST',
  'PLAYER_CHOICE',
  'PLAY_FROM_ZONE',
  'PREVENT_DAMAGE',
  'PUT_INTO_PLAY',
  'PUT_INTO_PLAY_ENGAGED',
  'READY',
  'REDUCE_NEXT_CARD_COST',
  'REMOVE_COUNTERS',
  'REMOVE_COUNTERS_MATCHING_FILTER',
  'REMOVE_THREAT',
  'RESTRICTED_LIMIT_BONUS',
  'RETURN_TO_HAND',
  'REVEAL_ENCOUNTER_CARD',
  'REVEAL_ENCOUNTER_CARD_WITH_SURGE',
  'SEARCH_AND_PLAY_UPGRADE',
  'SEARCH',
  'SHUFFLE_INTO_DECK',
  'SPAWN_MINION_ENGAGED',
  'SPAWN_NEMESIS',
  'SPEND_COUNTERS',
  'SURGE',
  'TRANSFER_DAMAGE',
  'TRIGGER_WAKANDA_UPGRADES',
  'VILLAIN_AND_ENGAGED_MINIONS_ATTACK',
  'VILLAIN_ATTACKS',
  'VILLAIN_SCHEMES',
  'REMOVE_STATUS',
]);

export type EffectType = z.infer<typeof EffectTypeSchema>;

/**
 * Resource Types
 */
export const ResourceTypeSchema = z.enum(['physical', 'energy', 'mental', 'wild']);
export type ResourceType = z.infer<typeof ResourceTypeSchema>;

export const CardTypeSchema = z.enum([
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
]);
export type CardType = z.infer<typeof CardTypeSchema>;

export const AspectSchema = z.enum([
  'aggression',
  'justice',
  'leadership',
  'protection',
  'basic',
  'encounter',
]);
export type Aspect = z.infer<typeof AspectSchema>;

export const KeywordSchema = z.enum([
  'Guard',
  'Overkill',
  'Quickstrike',
  'Ranged',
  'Retaliate',
  'Toughness',
  'Crisis',
  'Hazard',
  'Acceleration',
]);
export type Keyword = z.infer<typeof KeywordSchema>;

/**
 * Structured parameterized keyword declaration (ADR-0054).
 */
export const StructuredKeywordSchema = z
  .object({
    keyword: z.string().min(1),
    amount: z.number().int().positive().optional(),
  })
  .strict();

export const KeywordEntrySchema = z.union([z.string(), StructuredKeywordSchema]);

export const CharacterStatusSchema = z.enum(['STUNNED', 'CONFUSED', 'TOUGH']);
export type CharacterStatus = z.infer<typeof CharacterStatusSchema>;

/**
 * Comparison criteria for numeric properties (cost, atk, hp, etc.)
 */
export const NumberComparisonSchema = z
  .object({
    min: z.number().int().optional(),
    max: z.number().int().optional(),
    equals: z.number().int().optional(),
  })
  .strict();

export type NumberComparison = z.infer<typeof NumberComparisonSchema>;

/**
 * Universal Card Criteria Schema (ADR-0046)
 * Atomic predicate criteria evaluated with logical AND.
 */
export const CardCriteriaSchema = z
  .object({
    codes: z.array(z.string()).optional(),
    names: z.array(z.string()).optional(),
    types: z.array(CardTypeSchema).optional(),
    traits: z.array(z.string()).optional(),
    aspects: z.array(AspectSchema).optional(),
    sets: z.array(z.string()).optional(),
    isUnique: z.boolean().optional(),
    isIdentitySpecific: z.boolean().optional(),
    cost: NumberComparisonSchema.optional(),
    resourceIcons: z.array(ResourceTypeSchema).optional(),
    hasKeyword: KeywordSchema.optional(),
    isExhausted: z.boolean().optional(),
    hasStatus: z.array(CharacterStatusSchema).optional(),
  })
  .strict();

export type CardCriteria = z.infer<typeof CardCriteriaSchema>;

/**
 * Universal Card Filter Interface (Composable Predicate Tree per ADR-0046)
 */
export type UniversalCardFilter = CardCriteria & {
  all?: UniversalCardFilter[];
  any?: UniversalCardFilter[];
  none?: UniversalCardFilter[];
};

/**
 * Universal Card Filter Schema (Recursive Zod Schema)
 */
export const UniversalCardFilterSchema: z.ZodType<UniversalCardFilter> = CardCriteriaSchema.extend({
  all: z.lazy(() => z.array(UniversalCardFilterSchema)).optional(),
  any: z.lazy(() => z.array(UniversalCardFilterSchema)).optional(),
  none: z.lazy(() => z.array(UniversalCardFilterSchema)).optional(),
}).strict();

export const TriggerFilterSchema = z
  .object({
    attackerKind: z.enum(['VILLAIN', 'MINION', 'ANY_ENEMY']).optional(),
    attackerCardFilter: UniversalCardFilterSchema.optional(),
    sourceCardCode: z.string().optional(),
    sourceInstanceId: z.string().optional(),
    targetPlayerScope: z.enum(['SELF','OTHER','ANY']).optional(),
    targetForm: z.enum(['HERO', 'ALTER_EGO']).optional(),
    targetType: z.enum(['VILLAIN', 'MINION', 'SCHEME', 'CHARACTER']).optional(),
    isEngaged: z.boolean().optional(),
    damageSourceType: z.enum(['ATTACK', 'SCHEME', 'EFFECT']).optional(),
    damageTargetType: z.enum(['HERO', 'ALLY', 'SCHEME']).optional(),
    defeatEntityType: z.enum(['CHARACTER', 'SCHEME', 'ATTACHMENT']).optional(),
    defeatByAttack: z.boolean().optional(),
    formChangeDirection: z.enum(['HERO_TO_ALTER_EGO', 'ALTER_EGO_TO_HERO']).optional(),
  })
  .strict();

export type TriggerFilter = z.infer<typeof TriggerFilterSchema>;

/**
 * FilterSchema is now strictly canonical UniversalCardFilterSchema (ADR-0046).
 */
export const FilterSchema = UniversalCardFilterSchema;

/**
 * Discard Inspection Attribute Schema (Issue #117)
 * Attributes to inspect when calculating dynamic values from discarded cards.
 */
export const DiscardInspectionAttributeSchema = z.enum([
  'COUNT',
  'RESOURCE_ICONS',
  'DIFFERENT_RESOURCES',
  'BOOST_ICONS',
  'DIFFERENT_CARD_TYPES',
  'PRINTED_COST',
]);

export type DiscardInspectionAttribute = z.infer<typeof DiscardInspectionAttributeSchema>;

/**
 * Dynamic Value Source Schema (ADR-0049, ADR-0052, Issue #117)
 * Declarative value resolution for composable effect amounts, counters, and scalers.
 */
export const DynamicValueSourceSchema = z
  .object({
    from: z.enum([
      'INTERCEPTED_VALUE',
      'PREVIOUS_RESULT',
      'DISCARDED_CARDS',
      'ENTITY_COUNT',
      'STAT_VALUE',
      'COUNTERS',
      'CARD_ATTRIBUTE',
      'HAS_TRAIT',
      'HAS_IDENTITY',
    ]),
    discardAttribute: DiscardInspectionAttributeSchema.optional(),
    resourceType: ResourceTypeSchema.optional(),
    targetCardCode: z.string().optional(),
    stat: z
      .enum([
        'SUFFERED_DAMAGE',
        'ATTACK',
        'HERO_ATK',
        'THWART',
        'DEFENSE',
        'RECOVERY',
        'THREAT',
        'DAMAGE',
      ])
      .optional(),
    counterType: z.string().optional(),
    target: TargetSelectorSchema.optional(),
    filter: UniversalCardFilterSchema.optional(),
    attribute: z.enum(['BOOST_ICONS', 'PRINTED_RESOURCES', 'PRINTED_COST']).optional(),
    multiplier: z.number().optional(),
    offset: z.number().optional(),
    clamp: z
      .object({
        min: z.number().optional(),
        max: z.number().optional(),
      })
      .optional(),
  })
  .strict();

export type DynamicValueSource = z.infer<typeof DynamicValueSourceSchema>;

/**
 * Ability Cost Schema
 */
export const AbilityCostSchema = z
  .object({
    exhaustSelf: z.boolean().optional(),
    exhaustCard: TargetSelectorSchema.optional(),
    discardSelf: z.boolean().optional(),
    resources: z.array(ResourceTypeSchema).optional(),
    resourceCost: z.union([z.number(), z.record(z.string(), z.number())]).optional(),
    damageHero: z.number().optional(),
    damageSelf: z.number().optional(),
    spendCounters: z
      .object({
        counterType: z.string().optional(),
        amount: z.number(),
        target: z.enum(['SELF', 'IDENTITY']).optional(),
      })
      .strict()
      .optional(),
    discardCard: z
      .object({
        count: z.number().optional(),
        maxCount: z.number().optional(),
        from: z.enum(['HAND', 'DECK', 'PLAY']),
      })
      .strict()
      .optional(),
    costCheck: z.string().optional(),
  })
  .strict();

export const AddCountersParamsSchema = z.object({
  target: z.string().optional(),
  counterType: z.string().optional(),
  amount: z.union([z.number(), z.string(), DynamicValueSourceSchema]),
});

export const SpendCountersParamsSchema = z.object({
  target: z.string().optional(),
  counterType: z.string().optional(),
  amount: z.union([z.number(), z.string(), DynamicValueSourceSchema]),
  discardWhenEmpty: z.boolean().optional(),
});

export const RemoveCountersMatchingFilterParamsSchema = z.object({
  targetZone: z.string().optional(),
  traitFilter: z.string().optional(),
  counterType: z.string().optional(),
  amount: z.union([z.number(), z.literal('ALL'), DynamicValueSourceSchema]).optional(),
});

export const DiscardParamsSchema = z
  .object({
    source: z
      .enum([
        'HAND',
        'DECK',
        'ENCOUNTER_DECK',
        'TABLEAU',
        'HOST',
        'SELF',
        'CARDS_UNDER_HOST',
      ])
      .optional()
      .default('HAND'),
    count: z.union([z.number(), z.literal('ALL'), DynamicValueSourceSchema]).optional().default(1),
    mode: z.enum(['CHOSEN', 'RANDOM', 'TOP', 'ALL', 'UNTIL_MATCH']).optional(),
    target: TargetSelectorSchema.optional(),
    filter: FilterSchema.optional(),
    untilFilter: FilterSchema.optional(),
    fallback: z.enum(['SURGE', 'NONE']).optional(),
    matchingDestination: z.enum(['HAND', 'PLAY', 'DISCARD']).optional(),
  })
  .strict();

export type DiscardParams = z.infer<typeof DiscardParamsSchema>;

export const DrawCardsLimitSchema = z.enum(['HAND_SIZE', 'PRINTED_HAND_SIZE']);
export type DrawCardsLimit = z.infer<typeof DrawCardsLimitSchema>;

export const DrawCardsParamsSchema = z
  .object({
    count: z.union([z.number(), DynamicValueSourceSchema]).optional(),
    limit: DrawCardsLimitSchema.optional(),
    target: TargetSelectorSchema.optional(),
    targetPlayerId: z.string().optional(),
  })
  .strict();

export type DrawCardsParams = z.infer<typeof DrawCardsParamsSchema>;

export const ExhaustReadyParamsSchema = z
  .object({
    target: TargetSelectorSchema.optional().default('SELF_IDENTITY'),
    filter: UniversalCardFilterSchema.optional(),
  })
  .strict();

export type ExhaustReadyParams = z.infer<typeof ExhaustReadyParamsSchema>;

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
 * Search Zone Schema
 */
export const SearchZoneSchema = z.enum([
  'PLAYER_DECK',
  'ENCOUNTER_DECK',
  'PLAYER_DISCARD',
  'ENCOUNTER_DISCARD',
  'PLAYER_HAND',
]);

export type SearchZone = z.infer<typeof SearchZoneSchema>;

/**
 * Search & Select Destination Routing Params Schema (RR v1.8 p. 19, 26, ADR-0030, ADR-0032, ADR-0046)
 */
export const SearchAndSelectParamsSchema = z
  .object({
    source: z.union([SearchZoneSchema, z.array(SearchZoneSchema).min(1)]).default('PLAYER_DECK'),
    lookCount: z
      .union([z.number().int().nonnegative(), z.literal('ALL'), DynamicValueSourceSchema])
      .optional(),
    takeCount: z
      .union([z.number().int().nonnegative(), z.literal('ALL'), DynamicValueSourceSchema])
      .default(1),
    filter: UniversalCardFilterSchema.optional(),
    selectedDestination: z
      .enum(['HAND', 'TABLEAU', 'DECK_TOP', 'DISCARD', 'ATTACH_TO_TARGET', 'REVEAL'])
      .default('HAND'),
    unselectedDestination: z
      .enum(['DISCARD', 'DECK_BOTTOM', 'DECK_SHUFFLE', 'DECK_TOP', 'LEAVE_IN_PLACE'])
      .nullable()
      .optional(),
    shuffleAfter: z.boolean().optional(),
    isVoluntary: z.boolean().optional(),
    autoSelectIfUnambiguous: z.boolean().optional(),
    promptTitle: z.string().optional(),
  })
  .strict();

/**
 * Play Card From Zone Params Schema (RR v1.8 p. 19, ADR-0047)
 */
export const PlayCardFromZoneParamsSchema = z
  .object({
    source: z
      .enum([
        'PLAYER_DISCARD',
        'ANY_PLAYER_DISCARD',
        'PLAYER_DECK',
        'SET_ASIDE',
        'ATTACHED',
        'TUCKED',
      ])
      .default('PLAYER_DISCARD'),
    filter: UniversalCardFilterSchema.optional(),
    costMode: z.enum(['PRINTED_COST', 'FREE', 'REDUCED']).default('PRINTED_COST'),
    costReduction: z.number().int().nonnegative().optional(),
    destination: z.enum(['TABLEAU', 'ENGAGED_WITH_PLAYER']).default('TABLEAU'),
    control: z.enum(['SELF', 'OWNER']).default('SELF'),
    promptTitle: z.string().optional(),
  })
  .strict();

export type AbilityCost = z.infer<typeof AbilityCostSchema>;
export type SearchAndSelectParams = z.infer<typeof SearchAndSelectParamsSchema>;
export type PlayCardFromZoneParams = z.infer<typeof PlayCardFromZoneParamsSchema>;

/**
 * Reduce Next Card Cost Params Schema (RR v1.8 p. 7, 17, Issue #46)
 */
export const ReduceNextCardCostParamsSchema = z
  .object({
    amount: z.number().int().positive().default(1),
    target: TargetSelectorSchema.optional().default('CHOSEN_PLAYER'),
    duration: z.enum(['PHASE', 'ROUND', 'TURN']).optional().default('PHASE'),
    cardFilter: UniversalCardFilterSchema.optional(),
  })
  .strict();

export type ReduceNextCardCostParams = z.infer<typeof ReduceNextCardCostParamsSchema>;

/**
 * Ability Execution Step Interface (Operational Primitive)
 */
export interface AbilityStep {
  id?: string;
  effect: EffectType;
  gateParams?: Record<string, any>;
  effectParams?: Record<string, any>;
  gate?: z.infer<typeof ConditionGateSchema>;
  filter?: z.infer<typeof FilterSchema>;
  condition?: StepCondition;
}

export function getStepEffectParams(step: { effectParams?: Record<string, any> }): Record<string, any> {
  return step.effectParams ?? {};
}

export function getStepGateParams(step: { gateParams?: Record<string, any> }): Record<string, any> {
  return step.gateParams ?? {};
}

/**
 * Ability Execution Step Schema
 */
export const AbilityStepSchema = z
  .object({
    id: z.string().optional(),
    effect: EffectTypeSchema,
    gateParams: z.record(z.string(), z.any()).optional(),
    effectParams: z.record(z.string(), z.any()).optional(),
    gate: ConditionGateSchema.optional(),
    filter: FilterSchema.optional(),
    condition: StepConditionSchema.optional(),
  })
  .strict();

/**
 * Card Ability Interface (Trigger / Cost / Timing Header)
 */
export interface CardAbility {
  id: string;
  timing: z.infer<typeof TimingTypeSchema>;
  trigger?: z.infer<typeof TriggerTypeSchema>;
  triggerFilter?: TriggerFilter;
  zone?: 'HAND' | 'PLAY' | 'DISCARD';
  cost?: AbilityCost;
  limit?: 'ONCE_PER_ROUND' | 'ONCE_PER_PHASE';
  errata?: string | null;
  steps: AbilityStep[];
}

/**
 * Card Ability Schema
 */
export const CardAbilitySchema: z.ZodType<CardAbility> = z
  .object({
    id: z.string().min(1),
    timing: TimingTypeSchema,
    trigger: TriggerTypeSchema.optional(),
    triggerFilter: TriggerFilterSchema.optional(),
    zone: z.enum(['HAND', 'PLAY', 'DISCARD']).optional(),
    cost: AbilityCostSchema.optional(),
    limit: z.enum(['ONCE_PER_ROUND', 'ONCE_PER_PHASE']).optional(),
    errata: z.string().nullable().optional(),
    steps: z.array(AbilityStepSchema).min(1),
  })
  .strict();

/**
 * Card Uses Definition Schema (RR v1.8 p. 30 'Uses')
 */
export const CardUsesSchema = z
  .object({
    count: z.number().int().nonnegative(),
    type: z.string().optional(),
    counterType: z.string().optional(),
    max: z.number().int().positive().optional(),
    discardOnEmpty: z.boolean().optional(),
  })
  .strict();

export type CardUses = z.infer<typeof CardUsesSchema>;

/**
 * Universal Card Play Requirements Schema (RR v1.8 p. 16 'Play Restrictions, Permissions')
 * Declaratively standardizes play restrictions across identity form, form traits,
 * identity traits, controlled card requirements, and identity names.
 */
export const PlayRequirementsSchema = z
  .object({
    identityForm: z.enum(['HERO', 'ALTER_EGO']).optional(),
    formTrait: z.string().optional(),
    identityTraits: z.array(z.string()).optional(),
    controlFilter: UniversalCardFilterSchema.optional(),
    controlZones: z.array(z.enum(['tableau', 'allies', 'identity'])).optional(),
    identityNames: z.array(z.string()).optional(),
  })
  .strict();

export type PlayRequirements = z.infer<typeof PlayRequirementsSchema>;

/**
 * Card Enrichment Schema
 */
export const CardEnrichmentSchema = z
  .object({
    comment: z.string().optional(),
    abilities: z.array(CardAbilitySchema).optional(),
    playRequirements: PlayRequirementsSchema.optional(),
    audit: CardAuditRecordSchema.optional(),
    noSupplementalNeeded: z.boolean().optional(),
    isLandscape: z.boolean().optional(),
    attackCost: z.number().int().nonnegative().optional(),
    thwartCost: z.number().int().nonnegative().optional(),
    maxPerPlayer: z.number().optional(),
    uses: CardUsesSchema.optional(),
    victoryPoints: z.number().optional(),
    keywords: z.array(KeywordEntrySchema).optional(),
    traits: z.array(z.string()).optional(),
    restrictedSlots: z.number().int().positive().optional(),
    additionalBoostCards: z.number().int().positive().optional(),
    errata: z.string().nullable().optional(),
  })
  .strict();

/**
 * Supplemental Pack JSON File Schema
 */
export const SupplementalPackSchema = z
  .object({
    $schema: z.string().optional(),
    cards: z.record(z.string(), CardEnrichmentSchema),
  })
  .strict();

export type SupplementalPack = z.infer<typeof SupplementalPackSchema>;
export type CardEnrichment = z.infer<typeof CardEnrichmentSchema>;
export type CardAuditRecord = z.infer<typeof CardAuditRecordSchema>;
export type FilterSchemaType = z.infer<typeof FilterSchema>;
