import { z } from 'zod';
import {
  GATE_REGISTRY,
  StepGateSchema,
  type StepGate,
  type ResultFact,
  canEffectProduceFact,
  IdentityFormSchema,
} from './gate-params';
import { EFFECT_PARAM_SCHEMAS } from './effect-params';
import {
  EffectTypeSchema,
  type EffectType,
  TimingTypeSchema,
  TriggerTypeSchema,
  type TriggerFilter,
  TriggerFilterSchema,
  type AbilityCost,
  AbilityCostSchema,
  UniversalCardFilterSchema,
  CardAuditRecordSchema,
} from './schema-primitives';

export * from './schema-primitives';

/**
 * Ability Execution Step Interface (Operational Primitive)
 */
export interface AbilityStep {
  id?: string;
  effect: EffectType;
  gateParams?: Record<string, any>;
  effectParams?: Record<string, any>;
  gate?: StepGate;
  cannotBeCanceled?: boolean;
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
    gate: StepGateSchema.optional(),
    cannotBeCanceled: z.boolean().optional(),
  })
  .strict()
  .superRefine((step, ctx) => {
    if (step.effectParams) {
      const parsed = EFFECT_PARAM_SCHEMAS[step.effect].safeParse(step.effectParams);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          ctx.addIssue({
            ...issue,
            path: ['effectParams', ...issue.path],
          });
        }
      }
    }
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
  /** The whole step list resolves once per player in player order ("each player ... that player"). */
  forEachPlayer?: boolean;
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

    if (ability.zone === 'HAND' && ability.cost?.discardSelf) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Abilities in zone 'HAND' cannot declare 'cost.discardSelf'; events discard intrinsically per RR v1.8 Event",
        path: ['cost', 'discardSelf'],
      });
    }
  });

/**
 * Card Uses Definition Schema (RR v1.8 p. 30 'Uses')
 */
export const CardUsesSchema = z
  .object({
    count: z.number().int().nonnegative().meta({ label: 'Count', primary: true }),
    counterType: z
      .string()
      .meta({ label: 'Counter Type', placeholder: 'e.g. charge, all-purpose', primary: true })
      .optional(),
    discardOnEmpty: z.boolean().meta({ label: 'Discard When Empty', primary: true }).optional(),
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
    identityForm: IdentityFormSchema.meta({
      label: 'Required Identity Form',
      primary: true,
    }).optional(),
    formTrait: z
      .string()
      .meta({ label: 'Form Trait Requirement', placeholder: 'e.g. Giant, Tiny', primary: true })
      .optional(),
    identityTraits: z
      .array(z.string())
      .meta({
        label: 'Required Identity Traits (comma separated)',
        placeholder: 'e.g. Avenger, Mystic, X-Men',
        widget: 'string-list',
        primary: true,
      })
      .optional(),
    controlFilter: UniversalCardFilterSchema.meta({
      label: 'Required Controlled Card Criteria',
      widget: 'card-filter',
    }).optional(),
    controlZones: z
      .array(z.enum(['tableau', 'allies', 'identity']))
      .meta({ label: 'Required Control Zones', primary: true })
      .optional(),
    identityNames: z
      .array(z.string())
      .meta({
        label: 'Required Identity Names (comma separated)',
        placeholder: 'e.g. Peter Parker, Tony Stark',
        widget: 'string-list',
        primary: true,
      })
      .optional(),
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
const AttachHostSchema = z.discriminatedUnion('type', [
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
const AttachToSchema = z
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
    recipient: PlayerRecipientSchema.optional(),
    attachTo: AttachToSchema.optional(),
    playUnderAnyPlayerControl: z.boolean().optional(),
    uses: CardUsesSchema.optional(),
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

export type CardEnrichment = z.infer<typeof CardEnrichmentSchema>;
export type CardAuditRecord = z.infer<typeof CardAuditRecordSchema>;
