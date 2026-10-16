import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  introspectObjectSchema,
  hasRequiredFields,
  defOf,
} from '../../src/data/supplemental/schema-introspector';

const byKey = (schema: z.ZodType, key: string) =>
  introspectObjectSchema(schema).find((field) => field.key === key)!;

describe('schema-introspector: node kinds', () => {
  it('describes string, number and boolean fields', () => {
    const schema = z.object({ s: z.string(), n: z.number().int(), b: z.boolean() }).strict();
    expect(introspectObjectSchema(schema).map((f) => [f.key, f.kind, f.widget])).toEqual([
      ['s', 'string', 'string'],
      ['n', 'number', 'number'],
      ['b', 'boolean', 'boolean'],
    ]);
  });

  it('describes an enum with its options', () => {
    const field = byKey(z.object({ e: z.enum(['A', 'B']) }), 'e');
    expect(field.kind).toBe('enum');
    expect(field.options).toEqual(['A', 'B']);
  });

  it('describes a literal as a single-option enum widget', () => {
    const field = byKey(z.object({ l: z.literal('ALL') }), 'l');
    expect(field.kind).toBe('literal');
    expect(field.widget).toBe('enum');
    expect(field.options).toEqual(['ALL']);
  });

  it('describes an array of enums as multi-enum and other arrays as array', () => {
    const multi = byKey(z.object({ a: z.array(z.enum(['X', 'Y'])) }), 'a');
    expect(multi.kind).toBe('multi-enum');
    expect(multi.options).toEqual(['X', 'Y']);
    expect(byKey(z.object({ a: z.array(z.string()) }), 'a').kind).toBe('array');
  });

  it('describes object, record and any fields as json widgets', () => {
    const schema = z.object({
      o: z.object({ x: z.string() }),
      r: z.record(z.string(), z.number()),
      a: z.any(),
    });
    expect(introspectObjectSchema(schema).map((f) => [f.kind, f.widget])).toEqual([
      ['object', 'json'],
      ['record', 'json'],
      ['any', 'json'],
    ]);
  });

  it('flags a union with a number, a literal ALL and an object as dynamic and all-capable', () => {
    const schema = z.object({
      v: z.union([z.number(), z.literal('ALL'), z.object({ from: z.string() })]).optional(),
    });
    const field = byKey(schema, 'v');
    expect(field.kind).toBe('number');
    expect(field.allowDynamic).toBe(true);
    expect(field.allowAll).toBe(true);
    expect(field.required).toBe(false);
  });

  it('describes a union of an enum and an array of the enum as multi-capable with options', () => {
    const zone = z.enum(['DECK', 'DISCARD']);
    const field = byKey(z.object({ s: z.union([zone, z.array(zone)]) }), 's');
    expect(field.kind).toBe('enum');
    expect(field.options).toEqual(['DECK', 'DISCARD']);
  });

  it('unwraps optional, nullable, default and lazy', () => {
    const schema = z.object({
      opt: z.string().optional(),
      nul: z.string().nullable(),
      def: z.number().default(3),
      lazy: z.lazy(() => z.boolean()),
    });
    const fields = Object.fromEntries(introspectObjectSchema(schema).map((f) => [f.key, f]));
    expect(fields.opt).toMatchObject({ kind: 'string', required: false, nullable: false });
    expect(fields.nul).toMatchObject({ kind: 'string', required: true, nullable: true });
    expect(fields.def).toMatchObject({ kind: 'number', required: false, defaultValue: 3 });
    expect(fields.lazy).toMatchObject({ kind: 'boolean', required: true });
  });

  it('throws on a node kind it cannot describe', () => {
    expect(() => introspectObjectSchema(z.object({ d: z.date() }))).toThrow(
      /unsupported Zod node kind 'date'/,
    );
  });

  it('throws when the root is not an object schema', () => {
    expect(() => introspectObjectSchema(z.string())).toThrow(/expected an object schema/);
  });
});

describe('schema-introspector: .meta()', () => {
  it('reads label, description, placeholder, primary, widget and defaultValue', () => {
    const schema = z.object({
      step: z.string().meta({
        label: 'Step ID',
        description: 'Which step',
        placeholder: 'e.g. s1',
        primary: true,
        widget: 'step',
        defaultValue: 'x',
      }),
    });
    expect(introspectObjectSchema(schema)[0]).toEqual({
      key: 'step',
      label: 'Step ID',
      kind: 'string',
      widget: 'step',
      required: true,
      nullable: false,
      description: 'Which step',
      placeholder: 'e.g. s1',
      primary: true,
      defaultValue: 'x',
    });
  });

  it('falls back to the key as label when no meta is given', () => {
    expect(byKey(z.object({ plain: z.string() }), 'plain').label).toBe('plain');
  });

  it('reads meta set on the inner schema and on the optional wrapper, outer winning', () => {
    const inner = z.object({ a: z.string().meta({ label: 'Inner' }).optional() });
    expect(byKey(inner, 'a').label).toBe('Inner');
    const outer = z.object({ a: z.string().meta({ label: 'Inner' }).optional().meta({ label: 'Outer' }) });
    expect(byKey(outer, 'a').label).toBe('Outer');
  });

  it('lets meta supply suggested options for a free-text field', () => {
    const field = byKey(z.object({ k: z.string().meta({ options: ['Guard', 'Ranged'] }) }), 'k');
    expect(field.kind).toBe('string');
    expect(field.options).toEqual(['Guard', 'Ranged']);
  });

  it('lets meta override the derived allowDynamic and allowAll', () => {
    const field = byKey(z.object({ n: z.number().meta({ allowDynamic: true, allowAll: true }) }), 'n');
    expect(field.allowDynamic).toBe(true);
    expect(field.allowAll).toBe(true);
  });
});

describe('schema-introspector: hasRequiredFields', () => {
  it('is true when any key is required', () => {
    expect(hasRequiredFields(z.object({ a: z.string(), b: z.string().optional() }))).toBe(true);
  });

  it('is false when every key is optional or defaulted', () => {
    expect(hasRequiredFields(z.object({ a: z.string().optional(), b: z.number().default(1) }))).toBe(
      false,
    );
  });

  it('is false for an empty object', () => {
    expect(hasRequiredFields(z.object({}).strict())).toBe(false);
  });
});

describe('schema-introspector: shared walker', () => {
  it('exposes the _zod.def of a schema', () => {
    expect(defOf(z.string())?.type).toBe('string');
  });
});
