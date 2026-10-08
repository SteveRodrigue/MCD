import { z } from 'zod';

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
};

export function canEffectProduceFact(effect: string, fact: ResultFact): boolean {
  const producers = FACT_PRODUCERS[fact];
  if (producers === 'ALL') return true;
  return producers.includes(effect);
}

export const StepGateSchema = z.enum([
  'THEN',
  'IF_RESULT',
  'IF_FORM',
  'IF_PLAYER_HAS_TRAIT',
  'IF_ZONE_EMPTY',
  'IF_CARD_IN_PLAY',
  'IF_RESOURCE_MATCH',
  'IF_UNDEFENDED_ATTACK',
  'IF_ACTIVATION_DEALT_DAMAGE',
]);
export type StepGate = z.infer<typeof StepGateSchema>;

export type GateKind = 'RESULT' | 'STATE' | 'CONTEXT';

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

// Individual strict param schemas per gate
export const ThenGateParamsSchema = z
  .object({
    step: z.string().min(1).optional(),
    negate: z.boolean().optional(),
  })
  .strict();

export const IfResultGateParamsSchema = z
  .object({
    result: ResultFactSchema,
    step: z.string().min(1).optional(),
    negate: z.boolean().optional(),
  })
  .strict();

export const IfFormGateParamsSchema = z
  .object({
    form: IdentityFormSchema,
    negate: z.boolean().optional(),
  })
  .strict();

export const IfPlayerHasTraitGateParamsSchema = z
  .object({
    trait: z.string().min(1),
    form: IdentityFormSchema.optional(),
    negate: z.boolean().optional(),
  })
  .strict();

export const IfZoneEmptyGateParamsSchema = z
  .object({
    zone: ZoneEmptyTargetSchema,
    negate: z.boolean().optional(),
  })
  .strict();

export const IfCardInPlayGateParamsSchema = z
  .object({
    cardCode: z.string().min(1),
    negate: z.boolean().optional(),
  })
  .strict();

export const IfResourceMatchGateParamsSchema = z
  .object({
    resource: z.string().min(1),
    count: z.number().int().positive().optional(),
    printedResource: z.boolean().optional(),
    only: z.boolean().optional(),
    form: IdentityFormSchema.optional(),
    negate: z.boolean().optional(),
  })
  .strict();

export const IfUndefendedAttackGateParamsSchema = z
  .object({
    attackerKind: AttackerKindSchema.optional(),
    negate: z.boolean().optional(),
  })
  .strict();

export const IfActivationDealtDamageGateParamsSchema = z
  .object({
    negate: z.boolean().optional(),
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

export const GATE_REGISTRY: Record<StepGate, GateDefinition> = {
  THEN: {
    gate: 'THEN',
    kind: 'RESULT',
    schema: ThenGateParamsSchema,
    hasRequiredParams: false,
    fields: [
      { key: 'step', label: 'Step ID', type: 'step', required: false },
      { key: 'negate', label: 'Negate (NOT)', type: 'boolean', required: false },
    ],
  },
  IF_RESULT: {
    gate: 'IF_RESULT',
    kind: 'RESULT',
    schema: IfResultGateParamsSchema,
    hasRequiredParams: true,
    fields: [
      { key: 'result', label: 'Result Fact', type: 'enum', required: true, options: ResultFactSchema.options },
      { key: 'step', label: 'Step ID', type: 'step', required: false },
      { key: 'negate', label: 'Negate (NOT)', type: 'boolean', required: false },
    ],
  },
  IF_FORM: {
    gate: 'IF_FORM',
    kind: 'STATE',
    schema: IfFormGateParamsSchema,
    hasRequiredParams: true,
    fields: [
      { key: 'form', label: 'Identity Form', type: 'enum', required: true, options: IdentityFormSchema.options },
      { key: 'negate', label: 'Negate (NOT)', type: 'boolean', required: false },
    ],
  },
  IF_PLAYER_HAS_TRAIT: {
    gate: 'IF_PLAYER_HAS_TRAIT',
    kind: 'STATE',
    schema: IfPlayerHasTraitGateParamsSchema,
    hasRequiredParams: true,
    fields: [
      { key: 'trait', label: 'Trait', type: 'string', required: true },
      { key: 'form', label: 'Form Qualifier', type: 'enum', required: false, options: IdentityFormSchema.options },
      { key: 'negate', label: 'Negate (NOT)', type: 'boolean', required: false },
    ],
  },
  IF_ZONE_EMPTY: {
    gate: 'IF_ZONE_EMPTY',
    kind: 'STATE',
    schema: IfZoneEmptyGateParamsSchema,
    hasRequiredParams: true,
    fields: [
      { key: 'zone', label: 'Zone', type: 'enum', required: true, options: ZoneEmptyTargetSchema.options },
      { key: 'negate', label: 'Negate (NOT)', type: 'boolean', required: false },
    ],
  },
  IF_CARD_IN_PLAY: {
    gate: 'IF_CARD_IN_PLAY',
    kind: 'STATE',
    schema: IfCardInPlayGateParamsSchema,
    hasRequiredParams: true,
    fields: [
      { key: 'cardCode', label: 'Card Code', type: 'string', required: true },
      { key: 'negate', label: 'Negate (NOT)', type: 'boolean', required: false },
    ],
  },
  IF_RESOURCE_MATCH: {
    gate: 'IF_RESOURCE_MATCH',
    kind: 'CONTEXT',
    schema: IfResourceMatchGateParamsSchema,
    hasRequiredParams: true,
    fields: [
      { key: 'resource', label: 'Resource', type: 'string', required: true },
      { key: 'count', label: 'Count', type: 'number', required: false, defaultValue: 1 },
      { key: 'printedResource', label: 'Printed Only', type: 'boolean', required: false },
      { key: 'only', label: 'Only Matching Spent', type: 'boolean', required: false },
      { key: 'form', label: 'Form Qualifier', type: 'enum', required: false, options: IdentityFormSchema.options },
      { key: 'negate', label: 'Negate (NOT)', type: 'boolean', required: false },
    ],
  },
  IF_UNDEFENDED_ATTACK: {
    gate: 'IF_UNDEFENDED_ATTACK',
    kind: 'CONTEXT',
    schema: IfUndefendedAttackGateParamsSchema,
    hasRequiredParams: false,
    fields: [
      { key: 'attackerKind', label: 'Attacker Kind', type: 'enum', required: false, options: AttackerKindSchema.options },
      { key: 'negate', label: 'Negate (NOT)', type: 'boolean', required: false },
    ],
  },
  IF_ACTIVATION_DEALT_DAMAGE: {
    gate: 'IF_ACTIVATION_DEALT_DAMAGE',
    kind: 'CONTEXT',
    schema: IfActivationDealtDamageGateParamsSchema,
    hasRequiredParams: false,
    fields: [
      { key: 'negate', label: 'Negate (NOT)', type: 'boolean', required: false },
    ],
  },
};
