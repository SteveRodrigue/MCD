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
    comment: z.string().optional(),
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
  'ENEMY_INITIATES_ATTACK',
  'DAMAGE_WOULD_BE_TAKEN',
  'CARD_PLAYED',
  'ENTERS_PLAY',
  'MINION_ENTERS_PLAY',
  'ENCOUNTER_CARD_REVEALED',
  'TREACHERY_REVEALED',
  'CHARACTER_DEFEATED',
  'SCHEME_DEFEATED',
  'HOST_WOULD_ATTACK',
  'HOST_ATTACK_ENDED',
  'THREAT_WOULD_BE_PLACED',
  'BASIC_ATTACK_PERFORMED',
  'ATTACK_DEFENDED',
  'ATTACK_RESOLVED',
  'THWART_RESOLVED',
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
  'BOOST',
]);

/**
 * Target Selector Types
 */
export const TargetSelectorSchema = z.enum([
  'SELF',
  'SELF_IDENTITY',
  'SELF_HERO',
  'ACTIVE_PLAYER',
  'ALL_PLAYERS',
  'DEFENDING_PLAYER',
  'ALL_HEROES',
  'ALL_HEROES_AND_ALLIES',
  'TRIGGERING_HERO',
  'DAMAGED_CHARACTER',
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
  'ALL_CONTROLLED_TABLEAU',
  'ALL_ALLIES',
  'CHOSEN_CHARACTER',
  'CHOSEN_CONTROLLED_CHARACTER',
  'ALL_CONTROLLED_CHARACTERS',
  'CHOSEN_FRIENDLY_CHARACTER',
  'ALL_FRIENDLY_CHARACTERS',
  'ALL_CHARACTERS',
  'CHOSEN_SIDE_SCHEME',
  'THIS_SIDE_SCHEME',
  'ALL_SIDE_SCHEMES',
  'ALL_SCHEMES',
  'TRIGGERING_SCHEME',
  'PREVIOUS_TARGET',
  'PREVIOUS_SELECTED_CARD',
  'TRIGGERING_MINION',
  'TRIGGERING_ENEMY',
  'HOST',
  'HOST_ENEMY',
]);

export type TargetSelector = z.infer<typeof TargetSelectorSchema>;

export {
  IdentityFormSchema,
  type IdentityForm,
  ResultFactSchema,
  type ResultFact,
  type StepFacts,
  FACT_PRODUCERS,
  canEffectProduceFact,
  StepGateSchema,
  type StepGate,
  type GateKind,
  type GateFieldType,
  type GateFieldMeta,
  type GateDefinition,
  GATE_REGISTRY,
  ZoneEmptyTargetSchema,
  type ZoneEmptyTarget,
  AttackerKindSchema,
  type AttackerKind,
  ThenGateParamsSchema,
  IfResultGateParamsSchema,
  IfFormGateParamsSchema,
  IfPlayerHasTraitGateParamsSchema,
  IfZoneEmptyGateParamsSchema,
  IfCardInPlayGateParamsSchema,
  IfResourceMatchGateParamsSchema,
  IfUndefendedAttackGateParamsSchema,
  IfActivationDealtDamageGateParamsSchema,
} from './gate-params';
import {
  GATE_REGISTRY,
  StepGateSchema,
  type StepGate,
  type ResultFact,
  canEffectProduceFact,
  IdentityFormSchema,
} from './gate-params';


/**
 * Ability Effect Primitives (Codebase-Grounded to active handlers in src/engine/)
 */
export const EffectTypeSchema = z.enum([
  'DRAW',
  'ADD_ACCELERATION',
  'ADD_COUNTERS',
  'ADD_STATUS',
  'ADD_THREAT',
  'ADD_TRAIT',
  'ATTACHMENT_DAMAGE_SHIELD',
  'ATTACH_FACEDOWN_CARDS_FROM_HAND',
  'ATTACH_TO_HOST',
  'CANCEL_ATTACK',
  'CANCEL_WHEN_REVEALED',
  'CANCEL_WHEN_REVEALED_AND_REVEAL_ANOTHER',
  'CANNOT_TAKE_DAMAGE',
  'CHANGE_FORM',
  'DEAL_DAMAGE',
  'DECLARE_DEFENDER',
  'DISCARD',
  'DISTRIBUTE_AMOUNT',
  'DOUBLE_RESOURCE_FOR_ASPECT',
  'EXECUTE_SPECIAL',
  'EXHAUST',
  'FLIP_FORM',
  'GENERATE_RESOURCE',
  'GIVE_ADDITIONAL_BOOST_CARD',
  'GRANT_KEYWORD',
  'GRANT_ATTACK_KEYWORD',
  'HEAL_DAMAGE',
  'MODIFY_ALLY_LIMIT',
  'MODIFY_HAND_SIZE',
  'MODIFY_MAX_HEALTH',
  'MODIFY_RESTRICTED_LIMIT',
  'MODIFY_STAT',
  'PLACE_CARD_UNDER_HOST',
  'PLAYER_CHOICE',
  'PLAY_FROM_ZONE',
  'PREVENT_DAMAGE',
  'PREVENT_THREAT',
  'PUT_INTO_PLAY',
  'READY',
  'REDUCE_NEXT_CARD_COST',
  'REMOVE_COUNTERS',
  'REMOVE_COUNTERS_MATCHING_FILTER',
  'REMOVE_FROM_GAME',
  'REMOVE_THREAT',
  'RETURN_TO_HAND',
  'REVEAL_ENCOUNTER_CARD',
  'SEARCH',
  'SHUFFLE_INTO_DECK',
  'SPEND_COUNTERS',
  'SURGE',
  'TRANSFER_DAMAGE',
  'ENEMY_ATTACKS',
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
    targetPlayerScope: z.enum(['SELF', 'OTHER', 'ANY']).optional(),
    targetScope: z.enum(['HOST', 'SELF', 'OTHER', 'ANY']).optional(),
    targetForm: IdentityFormSchema.optional(),
    targetType: z.enum(['VILLAIN', 'MINION', 'ENEMY', 'SCHEME', 'CHARACTER', 'ALLY']).optional(),
    attackedBy: z.enum(['YOUR_HERO', 'THIS_CARD']).optional(),
    defeatedByAttackOf: z.enum(['YOUR_HERO', 'THIS_CARD']).optional(),
    isEngaged: z.boolean().optional(),
    defenderType: z.enum(['HERO', 'ALLY']).optional(),
    threatSource: z
      .enum([
        'VILLAIN_PHASE_STEP_1',
        'VILLAIN_SCHEME',
        'MINION_SCHEME',
        'CARD_EFFECT',
        'INCITE',
        'HAZARD',
      ])
      .optional(),
    damageSource: z.enum(['ATTACK']).optional(),
  })
  .strict();

export type TriggerFilter = z.infer<typeof TriggerFilterSchema>;

/**
 * FilterSchema is now strictly canonical UniversalCardFilterSchema (ADR-0046).
 */
export const FilterSchema = UniversalCardFilterSchema;

/**
 * Card Location Selector Schema (ADR-0046, Issue #13, RR v1.8)
 * Declarative selector for locating cards across zones and in-play areas.
 */
export const CardLocationZoneSchema = z.enum([
  'PLAYER_DISCARD',
  'PLAYER_DECK',
  'ENCOUNTER_DECK',
  'ENCOUNTER_DISCARD',
  'SIDE_SCHEMES',
  'IN_PLAY',
  'TABLEAU',
  'TUCKED',
  'ATTACHED',
]);
export type CardLocationZone = z.infer<typeof CardLocationZoneSchema>;

export const CardLocationPositionSchema = z.enum(['TOP', 'BOTTOM', 'TOPMOST_MATCHING']);
export type CardLocationPosition = z.infer<typeof CardLocationPositionSchema>;

export const CardLocationTargetSchema = z.enum([
  'SELF',
  'TARGET_CARD',
  'ATTACHED_CARD',
  'HOST_CARD',
]);
export type CardLocationTarget = z.infer<typeof CardLocationTargetSchema>;

export const CardLocationSelectorSchema = z
  .object({
    zone: CardLocationZoneSchema.optional(),
    position: CardLocationPositionSchema.optional(),
    cardCode: z.string().optional(),
    target: CardLocationTargetSchema.optional(),
    filter: UniversalCardFilterSchema.optional(),
  })
  .strict();

export type CardLocationSelector = z.infer<typeof CardLocationSelectorSchema>;

/**
 * Card Inspection Attribute Schema (Issue #13)
 * Attributes to inspect when querying a card in a zone or in play.
 */
export const CardInspectionAttributeSchema = z.enum([
  'PRINTED_COST',
  'BOOST_ICONS',
  'THREAT',
  'DAMAGE',
  'REMAINING_HIT_POINTS',
  'COUNTERS',
  'PRINTED_RESOURCES',
  'TOTAL_RESOURCES',
  'PHYSICAL_RESOURCES',
  'ENERGY_RESOURCES',
  'MENTAL_RESOURCES',
  'WILD_RESOURCES',
]);

export type CardInspectionAttribute = z.infer<typeof CardInspectionAttributeSchema>;

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
 * Dynamic Value Source Schema (ADR-0049, ADR-0052, Issue #117, Issue #13)
 * Declarative value resolution for composable effect amounts, counters, and scalers.
 */
export const DynamicValueSourceSchema = z
  .object({
    from: z.enum([
      'INTERCEPTED_VALUE',
      'PREVIOUS_RESULT',
      'PREVIOUS_EXCESS_DAMAGE',
      'DISCARDED_CARDS',
      'ENTITY_COUNT',
      'STAT_VALUE',
      'COUNTERS',
      'CARD_ATTRIBUTE',
      'HAS_TRAIT',
      'HAS_IDENTITY',
      'PAID_WITH_RESOURCE',
      'RESOURCES_SPENT',
    ]),
    discardAttribute: DiscardInspectionAttributeSchema.optional(),
    resourceType: ResourceTypeSchema.optional(),
    resource: ResourceTypeSchema.optional(),
    amount: z.number().optional(),
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
    attribute: CardInspectionAttributeSchema.optional(),
    fromCard: CardLocationSelectorSchema.optional(),
    targetCard: CardLocationSelectorSchema.optional(),
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
 * Generate Resource Params Schema (Issue #13)
 */
export const GenerateResourceParamsSchema = z
  .object({
    resource: ResourceTypeSchema.optional(),
    amount: z.union([z.number(), DynamicValueSourceSchema]).optional(),
    count: z.number().optional(),
    fromCard: CardLocationSelectorSchema.optional(),
  })
  .strict();

export type GenerateResourceParams = z.infer<typeof GenerateResourceParamsSchema>;

/**
 * Ability Cost Schema
 */
export const AbilityCostSchema = z
  .object({
    exhaustSelf: z.boolean().optional(),
    exhaustCard: z.literal('SELF_IDENTITY').optional(),
    discardSelf: z.boolean().optional(),
    resources: z.array(ResourceTypeSchema).optional(),
    resourceCost: z.union([z.number(), z.record(z.string(), z.number())]).optional(),
    requirePrinted: z.boolean().optional(),
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
        from: z.literal('HAND'),
        filter: UniversalCardFilterSchema.optional(),
        mode: z.enum(['CHOSEN', 'RANDOM']).optional(),
      })
      .strict()
      .optional(),
    heal: z
      .object({
        amount: z.number().min(1),
        target: z.enum(['SELF', 'TARGET']).optional(),
      })
      .strict()
      .optional(),
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
    matchingDestination: z.enum(['HAND', 'PLAY', 'DISCARD', 'REVEAL']).optional(),
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
  cardCode: z.string().optional(),
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
    target: TargetSelectorSchema.optional().default('SELF'),
    fromTop: z.boolean().optional().default(false),
    lookCount: z
      .union([z.number().int().nonnegative(), z.literal('ALL'), DynamicValueSourceSchema])
      .optional(),
    takeCount: z
      .union([z.number().int().nonnegative(), z.literal('ALL'), DynamicValueSourceSchema])
      .default(1),
    filter: UniversalCardFilterSchema.optional(),
    selectedDestination: z
      .enum([
        'HAND',
        'TABLEAU',
        'DECK_TOP',
        'DECK_BOTTOM',
        'DECK_SHUFFLE',
        'DISCARD',
        'ATTACH_TO_TARGET',
        'REVEAL',
      ])
      .default('HAND'),
    unselectedDestination: z
      .enum(['DISCARD', 'DECK_BOTTOM', 'DECK_SHUFFLE', 'DECK_TOP', 'LEAVE_IN_PLACE'])
      .nullable()
      .optional(),
    shuffleAfter: z.boolean().optional(),
    minimumTake: z.number().int().nonnegative().optional().default(1),
    distinctBy: z.literal('NAME').optional(),
    autoSelectIfUnambiguous: z.boolean().optional().default(true),
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
 * Canonical Duration Schema (RR v1.8 - PHASE, ROUND, TURN)
 */
export const DurationSchema = z.enum(['PHASE', 'ROUND', 'TURN']);
export type Duration = z.infer<typeof DurationSchema>;

/**
 * Reduce Next Card Cost Params Schema (RR v1.8 p. 7, 17, Issue #46)
 */
export const ReduceNextCardCostParamsSchema = z
  .object({
    amount: z.number().int().positive().default(1),
    target: TargetSelectorSchema.optional().default('CHOSEN_PLAYER'),
    duration: DurationSchema.optional().default('PHASE'),
    cardFilter: UniversalCardFilterSchema.optional(),
  })
  .strict();

export type ReduceNextCardCostParams = z.infer<typeof ReduceNextCardCostParamsSchema>;

export const DistinctFromSchema = z.enum(['PREVIOUS_TARGET']).or(z.string());
export type DistinctFrom = z.infer<typeof DistinctFromSchema>;

/**
 * Ability Execution Step Interface (Operational Primitive)
 */
export interface AbilityStep {
  id?: string;
  effect: EffectType;
  target?: TargetSelector;
  distinctFrom?: DistinctFrom;
  gateParams?: Record<string, any>;
  effectParams?: Record<string, any>;
  gate?: StepGate;
  filter?: z.infer<typeof FilterSchema>;
  cannotBeCanceled?: boolean;
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
    target: TargetSelectorSchema.optional(),
    distinctFrom: DistinctFromSchema.optional(),
    gateParams: z.record(z.string(), z.any()).optional(),
    effectParams: z.record(z.string(), z.any()).optional(),
    gate: StepGateSchema.optional(),
    filter: FilterSchema.optional(),
    cannotBeCanceled: z.boolean().optional(),
  })
  .strict()
  .superRefine((step, ctx) => {
    if (!step.gate && step.gateParams && Object.keys(step.gateParams).length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'gateParams cannot be specified without a gate',
        path: ['gateParams'],
      });
      return;
    }
    if (step.gate) {
      const entry = GATE_REGISTRY[step.gate];
      if (entry) {
        if (entry.hasRequiredParams && !step.gateParams) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `gate ${step.gate} requires gateParams`,
            path: ['gateParams'],
          });
        } else if (step.gateParams) {
          const parsed = entry.schema.safeParse(step.gateParams);
          if (!parsed.success) {
            for (const issue of parsed.error.issues) {
              ctx.addIssue({
                ...issue,
                path: ['gateParams', ...issue.path],
              });
            }
          }
        }
      }
    }
  });

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
  labels?: AbilityLabel[];
  /** The whole step list resolves once per player in player order ("each player ... that player"). */
  forEachPlayer?: boolean;
  errata?: string | null;
  steps: AbilityStep[];
}

/**
 * Printed ability labels: "(attack)", "(thwart)", "(defense)" (RR v1.8 glossary L). Only `ATTACK`
 * is read by the engine (#247, ADR-0078); `THWART` and `DEFENSE` are declared, not yet read.
 */
export const AbilityLabelSchema = z.enum(['ATTACK', 'THWART', 'DEFENSE']);
export type AbilityLabel = z.infer<typeof AbilityLabelSchema>;

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
    labels: z.array(AbilityLabelSchema).min(1).optional(),
    forEachPlayer: z.boolean().optional(),
    errata: z.string().nullable().optional(),
    steps: z.array(AbilityStepSchema).min(1),
  })
  .strict()
  .superRefine((ability, ctx) => {
    const steps = ability.steps;
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      if (step.gate) {
        const entry = GATE_REGISTRY[step.gate];
        if (ability.timing === 'CONSTANT') {
          if (entry && (entry.kind === 'RESULT' || entry.kind === 'CONTEXT')) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `RESULT or CONTEXT gate '${step.gate}' cannot be used in a CONSTANT ability`,
              path: ['steps', i, 'gate'],
            });
          }
        }

        if (entry && entry.kind === 'RESULT') {
          if (i === 0) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `RESULT gate '${step.gate}' cannot be used on the first step (step 0)`,
              path: ['steps', i, 'gate'],
            });
          } else {
            let referencedStep: AbilityStep | undefined;
            const targetStepId = step.gateParams?.step as string | undefined;
            if (targetStepId) {
              const earlierIndex = steps.slice(0, i).findIndex((s) => s.id === targetStepId);
              if (earlierIndex === -1) {
                ctx.addIssue({
                  code: z.ZodIssueCode.custom,
                  message: `gateParams.step '${targetStepId}' must name an earlier step with an id in the same ability`,
                  path: ['steps', i, 'gateParams', 'step'],
                });
              } else {
                referencedStep = steps[earlierIndex];
              }
            } else {
              referencedStep = steps[i - 1];
            }

            if (step.gate === 'IF_RESULT' && referencedStep) {
              const resultFact = step.gateParams?.result as ResultFact | undefined;
              if (resultFact && !canEffectProduceFact(referencedStep.effect, resultFact)) {
                ctx.addIssue({
                  code: z.ZodIssueCode.custom,
                  message: `result fact '${resultFact}' cannot be produced by referenced step effect '${referencedStep.effect}'`,
                  path: ['steps', i, 'gateParams', 'result'],
                });
              }
            }
          }
        }
      }
    }
  });

/**
 * Card Uses Definition Schema (RR v1.8 p. 30 'Uses')
 */
export const CardUsesSchema = z
  .object({
    count: z.number().int().nonnegative(),
    counterType: z.string().optional(),
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
    identityForm: IdentityFormSchema.optional(),
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
/**
 * Obligation recipient override (Issue #158). Separate from TargetSelectorSchema so it cannot be
 * confused with effect targets. Absent on a card = engine default (hero-set owner, else revealing player).
 */
export const PlayerRecipientSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('FIRST_PLAYER') }).strict(),
  z.object({ type: z.literal('REVEALING_PLAYER') }).strict(),
  z.object({ type: z.literal('CARD_SET_OWNER') }).strict(),
  z.object({ type: z.literal('IDENTITY'), codes: z.array(z.string()).min(1) }).strict(),
]);

/**
 * Encounter attachment host (#209): "Attach to X. Otherwise, ...". `VILLAIN` is the active
 * villain. `MINION` / `ENEMY` (minions, or the villains too) pick among the candidates that match
 * `filter`; `superlative` keeps the highest / lowest printed value (ties: the first player
 * chooses); `withoutCopyAttached` skips candidates already carrying a copy of the attachment.
 */
export const AttachHostSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('VILLAIN') }).strict(),
  z
    .object({
      type: z.enum(['MINION', 'ENEMY']),
      filter: UniversalCardFilterSchema.optional(),
      superlative: z
        .object({
          stat: z.enum(['PRINTED_HIT_POINTS', 'PRINTED_ATTACK']),
          extreme: z.enum(['HIGHEST', 'LOWEST']),
        })
        .strict()
        .optional(),
      withoutCopyAttached: z.boolean().optional(),
    })
    .strict(),
]);

export type AttachHost = z.infer<typeof AttachHostSchema>;

/**
 * Where an encounter attachment goes when it is revealed. Absent on a card = the active villain
 * (as today). `otherwise` applies when `host` has no candidate: `SURGE` discards the card and
 * deals the surge card; a host attaches there instead.
 */
export const AttachToSchema = z
  .object({
    host: AttachHostSchema,
    otherwise: z.union([AttachHostSchema, z.object({ type: z.literal('SURGE') }).strict()]).optional(),
  })
  .strict();

export type AttachTo = z.infer<typeof AttachToSchema>;

export const CardEnrichmentSchema = z
  .object({
    abilities: z.array(CardAbilitySchema).optional(),
    playRequirements: PlayRequirementsSchema.optional(),
    audit: CardAuditRecordSchema.optional(),
    noSupplementalNeeded: z.boolean().optional(),
    isLandscape: z.boolean().optional(),
    attackCost: z.number().int().nonnegative().optional(),
    thwartCost: z.number().int().nonnegative().optional(),
    maxPerPlayer: z.number().optional(),
    recipient: PlayerRecipientSchema.optional(),
    attachTo: AttachToSchema.optional(),
    playUnderAnyPlayerControl: z.boolean().optional(),
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
