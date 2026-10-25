import { GATE_KINDS, STEP_GATES, type GateKind } from './runtime.ts';

export type { GateKind };
import { z } from 'zod';
import { hasRequiredFields, introspectObjectSchema } from './schema-introspector.ts';

export const IdentityFormSchema = z.enum(['HERO', 'ALTER_EGO']);
export type IdentityForm = z.infer<typeof IdentityFormSchema>;

export const ResultFactSchema = z.enum([
  'TARGET_DEFEATED',
  'EXCESS_DAMAGE_DEALT',
  'FULLY_HEALED',
  'SCHEME_EMPTY',
  'STATUS_APPLIED',
  'ALREADY_HAD_STATUS',
  'STATUS_REMOVED',
  'AMOUNT_ZERO',
  'DAMAGE_DEALT',
]);
export type ResultFact = z.infer<typeof ResultFactSchema>;

export interface StepFacts {
  targetDefeated?: boolean;
  defeated?: boolean;
  excessDamage?: number;
  fullyHealed?: boolean;
  schemeEmpty?: boolean;
  threatZero?: boolean;
  statusApplied?: boolean;
  statusAdded?: boolean;
  alreadyHadStatus?: boolean;
  statusRemoved?: boolean;
  amountZero?: boolean;
  villainDefeated?: boolean;
  /** Damage an enemy attack dealt after step 6; the fact DAMAGE_DEALT is true when above 0. */
  damageDealt?: number;
  /** The friendly character that attack damaged, read by the DAMAGED_CHARACTER selector. */
  damagedCharacter?: { type: 'HERO' | 'ALLY'; playerId: string; allyInstanceId?: string };
}

export const FACT_PRODUCERS: Record<ResultFact, string[] | 'ALL'> = {
  TARGET_DEFEATED: ['DEAL_DAMAGE'],
  EXCESS_DAMAGE_DEALT: ['DEAL_DAMAGE'],
  FULLY_HEALED: ['HEAL_DAMAGE'],
  SCHEME_EMPTY: ['REMOVE_THREAT'],
  STATUS_APPLIED: ['ADD_STATUS'],
  ALREADY_HAD_STATUS: ['ADD_STATUS'],
  STATUS_REMOVED: ['REMOVE_STATUS'],
  AMOUNT_ZERO: 'ALL',
  DAMAGE_DEALT: ['VILLAIN_ATTACKS', 'ENEMY_ATTACKS'],
};

export function canEffectProduceFact(effect: string, fact: ResultFact): boolean {
  const producers = FACT_PRODUCERS[fact];
  if (producers === 'ALL') return true;
  return producers.includes(effect);
}

export const StepGateSchema = z.enum(STEP_GATES);
export type StepGate = z.infer<typeof StepGateSchema>;


export const ZoneEmptyTargetSchema = z.enum([
  'SIDE_SCHEMES',
  'ENCOUNTER_DECK',
  'ENCOUNTER_DISCARD',
  'HAND',
  'DECK',
  'DISCARD',
]);
export type ZoneEmptyTarget = z.infer<typeof ZoneEmptyTargetSchema>;

export const AttackerKindSchema = z.enum(['VILLAIN', 'MINION', 'ANY_ENEMY']);
export type AttackerKind = z.infer<typeof AttackerKindSchema>;

// Individual strict param schemas per gate. `.meta()` carries the editor labels; the field list and
// `hasRequiredParams` of GATE_REGISTRY are derived from these schemas by the introspector.
const stepIdParam = z.string().min(1).meta({ label: 'Step ID', widget: 'step' }).optional();
const negateParam = z.boolean().meta({ label: 'Negate (NOT)' }).optional();
const formQualifierParam = IdentityFormSchema.meta({ label: 'Form Qualifier' }).optional();

export const ThenGateParamsSchema = z
  .object({
    step: stepIdParam,
    negate: negateParam,
  })
  .strict();

export const IfResultGateParamsSchema = z
  .object({
    result: ResultFactSchema.meta({ label: 'Result Fact' }),
    step: stepIdParam,
    negate: negateParam,
  })
  .strict();

export const IfFormGateParamsSchema = z
  .object({
    form: IdentityFormSchema.meta({ label: 'Identity Form' }),
    negate: negateParam,
  })
  .strict();

export const IfPlayerHasTraitGateParamsSchema = z
  .object({
    trait: z.string().min(1).meta({ label: 'Trait' }),
    form: formQualifierParam,
    negate: negateParam,
  })
  .strict();

export const IfZoneEmptyGateParamsSchema = z
  .object({
    zone: ZoneEmptyTargetSchema.meta({ label: 'Zone' }),
    negate: negateParam,
  })
  .strict();

export const IfCardInPlayGateParamsSchema = z
  .object({
    cardCode: z.string().min(1).meta({ label: 'Card Code' }),
    negate: negateParam,
  })
  .strict();

export const IfResourceMatchGateParamsSchema = z
  .object({
    resource: z.string().min(1).meta({ label: 'Resource' }),
    count: z.number().int().positive().meta({ label: 'Count', defaultValue: 1 }).optional(),
    printedResource: z.boolean().meta({ label: 'Printed Only' }).optional(),
    only: z.boolean().meta({ label: 'Only Matching Spent' }).optional(),
    form: formQualifierParam,
    negate: negateParam,
  })
  .strict();

export const IfUndefendedAttackGateParamsSchema = z
  .object({
    attackerKind: AttackerKindSchema.meta({ label: 'Attacker Kind' }).optional(),
    negate: negateParam,
  })
  .strict();

export const IfActivationDealtDamageGateParamsSchema = z
  .object({
    negate: negateParam,
  })
  .strict();

export type GateFieldType = 'string' | 'number' | 'boolean' | 'enum' | 'step';

export interface GateFieldMeta {
  key: string;
  label: string;
  type: GateFieldType;
  required: boolean;
  options?: readonly string[];
  defaultValue?: any;
}

export interface GateDefinition {
  gate: StepGate;
  kind: GateKind;
  schema: z.ZodObject<any>;
  hasRequiredParams: boolean;
  fields: GateFieldMeta[];
}

function defineGate(gate: StepGate, schema: z.ZodObject<any>): GateDefinition {
  const kind = GATE_KINDS[gate];
  const fields = introspectObjectSchema(schema).map((descriptor): GateFieldMeta => {
    const field: GateFieldMeta = {
      key: descriptor.key,
      label: descriptor.label,
      type: descriptor.widget as GateFieldType,
      required: descriptor.required,
    };
    if (descriptor.options) field.options = descriptor.options;
    if (descriptor.defaultValue !== undefined) field.defaultValue = descriptor.defaultValue;
    return field;
  });
  return { gate, kind, schema, hasRequiredParams: hasRequiredFields(schema), fields };
}

export const GATE_REGISTRY: Record<StepGate, GateDefinition> = {
  THEN: defineGate('THEN', ThenGateParamsSchema),
  IF_RESULT: defineGate('IF_RESULT', IfResultGateParamsSchema),
  IF_FORM: defineGate('IF_FORM', IfFormGateParamsSchema),
  IF_PLAYER_HAS_TRAIT: defineGate('IF_PLAYER_HAS_TRAIT', IfPlayerHasTraitGateParamsSchema),
  IF_ZONE_EMPTY: defineGate('IF_ZONE_EMPTY', IfZoneEmptyGateParamsSchema),
  IF_CARD_IN_PLAY: defineGate('IF_CARD_IN_PLAY', IfCardInPlayGateParamsSchema),
  IF_RESOURCE_MATCH: defineGate('IF_RESOURCE_MATCH', IfResourceMatchGateParamsSchema),
  IF_UNDEFENDED_ATTACK: defineGate('IF_UNDEFENDED_ATTACK', IfUndefendedAttackGateParamsSchema,
  ),
  IF_ACTIVATION_DEALT_DAMAGE: defineGate('IF_ACTIVATION_DEALT_DAMAGE', IfActivationDealtDamageGateParamsSchema,
  ),
};
