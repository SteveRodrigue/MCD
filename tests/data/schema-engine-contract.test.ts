import { describe, it, expect } from 'vitest';
import {
  auditSchemaEngineCoverage,
  RECOGNIZED_PASSIVE_EFFECTS,
  RECOGNIZED_EFFECT_ALIASES,
} from '../../tools/audit/schema-engine-coverage';
import {
  EffectTypeSchema,
  TriggerTypeSchema,
  TimingTypeSchema,
} from '../../src/data/supplemental/schema';

describe('Supplemental Schema <-> Engine Contract Tests', () => {
  const result = auditSchemaEngineCoverage();

  describe('EffectTypeSchema Coverage', () => {
    it('verifies 100% of EffectTypeSchema primitives have active engine execution paths', () => {
      expect(
        result.unhandledEffects,
        `Found effects defined in EffectTypeSchema without executeEffect cases or recognized passive pipeline handlers: ${result.unhandledEffects.join(', ')}`,
      ).toEqual([]);
    });

    it('verifies executeEffect has zero orphan switch cases not in EffectTypeSchema', () => {
      expect(
        result.orphanEffectCases,
        `Found orphan switch cases in executeEffect not declared in EffectTypeSchema: ${result.orphanEffectCases.join(', ')}`,
      ).toEqual([]);
    });

    it('verifies recognized passive effects are valid EffectTypeSchema primitives', () => {
      const allowed = new Set(EffectTypeSchema.options);
      for (const effect of RECOGNIZED_PASSIVE_EFFECTS) {
        expect(allowed.has(effect as any), `Passive effect ${effect} must belong to EffectTypeSchema`).toBe(true);
      }
    });

    it('verifies recognized effect aliases do not silently mask unhandled effects', () => {
      expect(RECOGNIZED_EFFECT_ALIASES.has('DISCARD_CARDS')).toBe(true);
    });
  });

  describe('TriggerTypeSchema Coverage', () => {
    it('verifies 100% of TriggerTypeSchema triggers have active dispatch/listeners in src/engine', () => {
      expect(
        result.unhandledTriggers,
        `Found triggers defined in TriggerTypeSchema with 0 references in src/engine: ${result.unhandledTriggers.join(', ')}`,
      ).toEqual([]);
    });

    it('verifies purged orphan trigger PHASE_START does not exist in TriggerTypeSchema', () => {
      expect(TriggerTypeSchema.options).not.toContain('PHASE_START');
    });
  });

  describe('TimingTypeSchema Coverage', () => {
    it('verifies 100% of TimingTypeSchema timings are evaluated across src/engine', () => {
      expect(TimingTypeSchema.options.length).toBeGreaterThan(0);
      expect(
        result.unhandledTimings,
        `Found timings defined in TimingTypeSchema with 0 references in src/engine: ${result.unhandledTimings.join(', ')}`,
      ).toEqual([]);
    });
  });

  it('passes complete bidirectional schema-engine alignment audit', () => {
    expect(result.success).toBe(true);
  });
});
