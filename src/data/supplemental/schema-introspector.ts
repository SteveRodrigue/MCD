/**
 * Headless Zod v4 introspector (Card Editor re-architecture, Phase 2).
 *
 * Walks the `_zod.def` AST of a schema and reads its `.meta()` annotations to produce
 * `FieldDescriptor[]`. It never imports React, the DOM, or any card data, so the engine,
 * the audit tools, and the editor UI all share one description of the supplemental schema.
 */
import type { ZodType } from 'zod';

/** The slice of a Zod v4 `_zod.def` that the walkers read. */
export interface ZodDef {
  type: string;
  innerType?: ZodType;
  element?: ZodType;
  getter?: () => ZodType;
  valueType?: ZodType;
  options?: ZodType[];
  left?: ZodType;
  right?: ZodType;
  in?: ZodType;
  entries?: Record<string, string>;
  values?: unknown[];
  defaultValue?: unknown;
  shape?: Record<string, ZodType> | (() => Record<string, ZodType>);
}

export const defOf = (schema: ZodType): ZodDef | undefined =>
  (schema as unknown as { _zod?: { def?: ZodDef } })._zod?.def;

/** Node kinds that wrap one inner schema without changing what the value is. */
const TRANSPARENT_WRAPPERS = new Set(['readonly', 'catch', 'prefault', 'nonoptional']);

/** Structural kind of a field (what the value is, not how the editor draws it). */
export type FieldKind =
  | 'string'
  | 'number'
  | 'boolean'
  | 'enum'
  | 'multi-enum'
  | 'literal'
  | 'object'
  | 'array'
  | 'record'
  | 'any';

/** Annotations read from `.meta()`. All optional. */
export interface FieldMeta {
  [key: string]: unknown;
  label?: string;
  description?: string;
  placeholder?: string;
  /** Shown by default in a form; other optional fields sit behind an "Add" chip. */
  primary?: boolean;
  /** Overrides the widget derived from the field kind (for example `step` or `card-filter`). */
  widget?: string;
  defaultValue?: unknown;
  /** Suggested values for a free-text field (a schema enum already supplies its own options). */
  options?: readonly string[];
  /** The value may be a dynamic value source object. Derived from the schema when omitted. */
  allowDynamic?: boolean;
  /** The value may be the literal `'ALL'`. Derived from the schema when omitted. */
  allowAll?: boolean;
}

export interface FieldDescriptor {
  key: string;
  label: string;
  kind: FieldKind;
  /** `meta.widget` when given, otherwise the default widget of `kind`. */
  widget: string;
  required: boolean;
  nullable: boolean;
  options?: readonly string[];
  defaultValue?: unknown;
  description?: string;
  placeholder?: string;
  primary?: boolean;
  allowDynamic?: boolean;
  allowAll?: boolean;
}

const DEFAULT_WIDGETS: Record<FieldKind, string> = {
  string: 'string',
  number: 'number',
  boolean: 'boolean',
  enum: 'enum',
  'multi-enum': 'multi-enum',
  literal: 'enum',
  object: 'json',
  array: 'json',
  record: 'json',
  any: 'json',
};

export function getShape(schema: ZodType): Record<string, ZodType> {
  const def = defOf(schema);
  if (!def || def.type !== 'object') {
    throw new Error(
      `schema-introspector: expected an object schema, got '${def?.type ?? 'unknown'}'`,
    );
  }
  return typeof def.shape === 'function' ? def.shape() : (def.shape ?? {});
}

const readMeta = (schema: ZodType): FieldMeta => {
  const meta = (schema as unknown as { meta?: () => unknown }).meta?.();
  return (meta && typeof meta === 'object' ? meta : {}) as FieldMeta;
};

interface Analysis {
  kind: FieldKind;
  options?: readonly string[];
  allowDynamic?: boolean;
  allowAll?: boolean;
}

/** Peels optional/default/nullable/lazy layers, merging meta (outer layers win). */
function unwrap(schema: ZodType): {
  core: ZodType;
  required: boolean;
  nullable: boolean;
  meta: FieldMeta;
  defaultValue?: unknown;
} {
  let current = schema;
  let required = true;
  let nullable = false;
  let meta: FieldMeta = {};
  let defaultValue: unknown;
  for (let depth = 0; depth < 20; depth++) {
    meta = { ...readMeta(current), ...meta };
    const def = defOf(current);
    if (!def) throw new Error('schema-introspector: value is not a Zod v4 schema');
    if (def.type === 'optional') {
      required = false;
      current = def.innerType as ZodType;
    } else if (def.type === 'nullable') {
      nullable = true;
      current = def.innerType as ZodType;
    } else if (def.type === 'default') {
      required = false;
      const raw = def.defaultValue;
      defaultValue = typeof raw === 'function' ? (raw as () => unknown)() : raw;
      current = def.innerType as ZodType;
    } else if (def.type === 'lazy') {
      current = (def.getter as () => ZodType)();
    } else if (TRANSPARENT_WRAPPERS.has(def.type)) {
      current = def.innerType as ZodType;
    } else {
      return { core: current, required, nullable, meta, defaultValue };
    }
  }
  throw new Error('schema-introspector: wrapper nesting is too deep');
}

function analyze(core: ZodType): Analysis {
  const def = defOf(core) as ZodDef;
  switch (def.type) {
    case 'string':
      return { kind: 'string' };
    case 'number':
      return { kind: 'number' };
    case 'boolean':
      return { kind: 'boolean' };
    case 'enum':
      return { kind: 'enum', options: Object.values(def.entries ?? {}) };
    case 'literal':
      return { kind: 'literal', options: (def.values ?? []).map(String) };
    case 'object':
      return { kind: 'object' };
    case 'record':
      return { kind: 'record' };
    case 'any':
    case 'unknown':
      return { kind: 'any' };
    case 'array': {
      const element = analyze(unwrap(def.element as ZodType).core);
      return element.kind === 'enum'
        ? { kind: 'multi-enum', options: element.options }
        : { kind: 'array' };
    }
    case 'union': {
      const variants = (def.options ?? []).map((option) => analyze(unwrap(option).core));
      // A union is described by its first scalar variant; extra variants only set capability flags.
      const primary =
        variants.find((v) => v.kind === 'number') ??
        variants.find((v) => v.kind === 'string' || v.kind === 'enum' || v.kind === 'boolean') ??
        variants.find((v) => v.kind === 'multi-enum') ??
        variants[0];
      const literalOptions = variants
        .filter((v) => v.kind === 'literal')
        .flatMap((v) => v.options ?? []);
      const enumOptions = variants.find(
        (v) => v.kind === 'enum' || v.kind === 'multi-enum',
      )?.options;
      return {
        kind: primary.kind === 'literal' ? 'enum' : primary.kind,
        options: primary.kind === 'number' ? undefined : (enumOptions ?? primary.options),
        allowDynamic: variants.some((v) => v.kind === 'object') || undefined,
        allowAll: literalOptions.includes('ALL') || undefined,
      };
    }
    default:
      throw new Error(`schema-introspector: unsupported Zod node kind '${def.type}'`);
  }
}

function describeField(key: string, schema: ZodType): FieldDescriptor {
  const { core, required, nullable, meta, defaultValue } = unwrap(schema);
  const analysis = analyze(core);
  const descriptor: FieldDescriptor = {
    key,
    label: meta.label ?? key,
    kind: analysis.kind,
    widget: meta.widget ?? DEFAULT_WIDGETS[analysis.kind],
    required,
    nullable,
  };
  const options = meta.options ?? analysis.options;
  if (options) descriptor.options = options;
  const resolvedDefault = meta.defaultValue !== undefined ? meta.defaultValue : defaultValue;
  if (resolvedDefault !== undefined) descriptor.defaultValue = resolvedDefault;
  if (meta.description !== undefined) descriptor.description = meta.description;
  if (meta.placeholder !== undefined) descriptor.placeholder = meta.placeholder;
  if (meta.primary !== undefined) descriptor.primary = meta.primary;
  const allowDynamic = meta.allowDynamic ?? analysis.allowDynamic;
  if (allowDynamic !== undefined) descriptor.allowDynamic = allowDynamic;
  const allowAll = meta.allowAll ?? analysis.allowAll;
  if (allowAll !== undefined) descriptor.allowAll = allowAll;
  return descriptor;
}

/** One descriptor per direct key of an object schema, in declaration order. */
export function introspectObjectSchema(schema: ZodType): FieldDescriptor[] {
  return Object.entries(getShape(schema)).map(([key, child]) => describeField(key, child));
}

/** True when the object schema has at least one key that must be present. */
export function hasRequiredFields(schema: ZodType): boolean {
  return introspectObjectSchema(schema).some((field) => field.required);
}
