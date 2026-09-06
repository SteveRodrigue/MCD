import { describe, it, expect } from 'vitest';
import { EffectTypeSchema } from '../../src/data/supplemental/schema';
import {
  EFFECT_PARAMETER_REGISTRY,
  getEffectDescriptor,
} from '../../src/ui/components/editor/effect-parameter-registry';

describe('Effect Parameter Registry & 1:1 Engine Grounding', () => {
  it('registers 100% of EffectTypeSchema primitives without any omissions', () => {
    const allEffects = EffectTypeSchema.options;
    expect(allEffects.length).toBeGreaterThan(50);

    for (const effect of allEffects) {
      const descriptor = EFFECT_PARAMETER_REGISTRY[effect];
      expect(descriptor, `Missing registry entry for primitive: ${effect}`).toBeDefined();
      expect(descriptor.effect).toBe(effect);
      expect(typeof descriptor.description).toBe('string');
      expect(Array.isArray(descriptor.parameters)).toBe(true);
    }
  });

  it('DRAW_CARDS exposes count and target without legacy card-specific carolBonus', () => {
    const desc = getEffectDescriptor('DRAW_CARDS');
    expect(desc.effect).toBe('DRAW_CARDS');

    const paramKeys = desc.parameters.map((p) => p.key);
    expect(paramKeys).toContain('count');
    expect(paramKeys).toContain('target');
    expect(paramKeys).not.toContain('carolBonus');

    const countParam = desc.parameters.find((p) => p.key === 'count');
    expect(countParam?.type).toBe('number');
    expect(countParam?.defaultValue).toBe(1);
  });

  it('DEAL_DAMAGE exposes amount, target, amountFormula, max, and overkill', () => {
    const desc = getEffectDescriptor('DEAL_DAMAGE');
    const paramKeys = desc.parameters.map((p) => p.key);

    expect(paramKeys).toContain('amount');
    expect(paramKeys).toContain('target');
    expect(paramKeys).toContain('amountFormula');
    expect(paramKeys).toContain('max');
    expect(paramKeys).toContain('overkill');
  });

  it('ADD_STATUS exposes status card options and target', () => {
    const desc = getEffectDescriptor('ADD_STATUS');
    const statusParam = desc.parameters.find((p) => p.key === 'status');
    const targetParam = desc.parameters.find((p) => p.key === 'target');

    expect(statusParam).toBeDefined();
    expect(statusParam?.type).toBe('select');
    expect(statusParam?.options).toEqual(['STUNNED', 'CONFUSED', 'TOUGH']);
    expect(targetParam).toBeDefined();
  });

  it('GENERATE_RESOURCE exposes resource types and amount', () => {
    const desc = getEffectDescriptor('GENERATE_RESOURCE');
    const resParam = desc.parameters.find((p) => p.key === 'resource');
    const amountParam = desc.parameters.find((p) => p.key === 'amount');

    expect(resParam?.type).toBe('select');
    expect(resParam?.options).toEqual(['physical', 'energy', 'mental', 'wild']);
    expect(amountParam?.type).toBe('number');
  });

  it('SEARCH_AND_SELECT exposes destination routing, card picking, universal filter, and prompt controls', () => {
    const desc = getEffectDescriptor('SEARCH_AND_SELECT');
    const paramKeys = desc.parameters.map((p) => p.key);

    expect(paramKeys).toContain('source');
    expect(paramKeys).toContain('lookCount');
    expect(paramKeys).toContain('takeCount');
    expect(paramKeys).toContain('filter');
    expect(paramKeys).toContain('selectedDestination');
    expect(paramKeys).toContain('unselectedDestination');
    expect(paramKeys).toContain('shuffleAfter');
    expect(paramKeys).toContain('isVoluntary');
    expect(paramKeys).toContain('promptTitle');

    const filterParam = desc.parameters.find((p) => p.key === 'filter');
    expect(filterParam?.type).toBe('card-filter');
  });

  it('GRANT_KEYWORD exposes keyword, amount, duration, and target', () => {
    const desc = getEffectDescriptor('GRANT_KEYWORD');
    const paramKeys = desc.parameters.map((p) => p.key);

    expect(paramKeys).toContain('keyword');
    expect(paramKeys).toContain('amount');
    expect(paramKeys).toContain('duration');
    expect(paramKeys).toContain('target');
  });

  it('EXHAUST exposes target selector and optional filter', () => {
    const desc = getEffectDescriptor('EXHAUST');
    expect(desc.effect).toBe('EXHAUST');

    const targetParam = desc.parameters.find((p) => p.key === 'target');
    const filterParam = desc.parameters.find((p) => p.key === 'filter');

    expect(targetParam).toBeDefined();
    expect(targetParam?.type).toBe('select');
    expect(targetParam?.defaultValue).toBe('SELF_IDENTITY');

    expect(filterParam).toBeDefined();
    expect(filterParam?.type).toBe('card-filter');
  });

  it('READY exposes target selector and optional filter', () => {
    const desc = getEffectDescriptor('READY');
    expect(desc.effect).toBe('READY');

    const targetParam = desc.parameters.find((p) => p.key === 'target');
    const filterParam = desc.parameters.find((p) => p.key === 'filter');

    expect(targetParam).toBeDefined();
    expect(targetParam?.type).toBe('select');
    expect(targetParam?.defaultValue).toBe('SELF_IDENTITY');

    expect(filterParam).toBeDefined();
    expect(filterParam?.type).toBe('card-filter');
  });

  it('purges legacy fragmented ready and exhaust primitives from registry', () => {
    const legacyPrimitives = [
      'EXHAUST_HERO',
      'EXHAUST_IDENTITY',
      'READY_ALLY',
      'READY_CARD',
      'READY_CHARACTER',
      'READY_IDENTITY',
    ];

    for (const legacy of legacyPrimitives) {
      expect((EFFECT_PARAMETER_REGISTRY as any)[legacy]).toBeUndefined();
    }
  });

  it('falls back gracefully to an operational descriptor for unknown or custom primitives', () => {
    const unknown = getEffectDescriptor('CUSTOM_PRIMITIVE_UNKNOWN' as any);
    expect(unknown.effect).toBe('CUSTOM_PRIMITIVE_UNKNOWN');
    expect(unknown.parameters).toEqual([]);
    expect(unknown.description).toContain('CUSTOM_PRIMITIVE_UNKNOWN');
  });
});
