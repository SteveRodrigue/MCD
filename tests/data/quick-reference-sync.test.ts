import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  EffectTypeSchema,
  TimingTypeSchema,
  TriggerTypeSchema,
  TargetSelectorSchema,
} from '../../src/data/supplemental/schema';
import { EFFECT_PARAM_KEYS } from '../../src/data/supplemental/effect-params';
import {
  StepGateSchema,
  ResultFactSchema,
  GATE_REGISTRY,
} from '../../src/data/supplemental/gate-params';

const QUICK_REFERENCE_PATH = path.resolve(
  __dirname,
  '../../docs/specifications/supplemental/QUICK_REFERENCE.md',
);

describe('Supplemental Specification Quick Reference Sync Guard', () => {
  const content = fs.readFileSync(QUICK_REFERENCE_PATH, 'utf8');

  it('file exists and has non-trivial content', () => {
    expect(content.length).toBeGreaterThan(1000);
  });

  describe('Effect Primitives & Allowed Parameter Keys', () => {
    // Parse the Effect Primitives markdown table in Section 4
    // Format: | `EFFECT_NAME` | `key1`, `key2` | description |
    const parseEffectTable = (): Record<string, string[]> => {
      const effectMap: Record<string, string[]> = {};
      const sectionMatch = content.match(
        /## 4\. Effect Primitives & Allowed Parameter Keys[\s\S]*?(?=\n## 5\.|$)/,
      );
      if (!sectionMatch) return effectMap;
      const lines = sectionMatch[0].split('\n');
      for (const line of lines) {
        if (!line.trim().startsWith('|')) continue;
        const columns = line.split(/(?<!\\)\|/).map((c) => c.trim());
        if (columns.length >= 3) {
          const match = columns[1].match(/^`([A-Z0-9_]+)`$/);
          if (match) {
            const effectName = match[1];
            const keysColumn = columns[2];
            if (keysColumn.includes('(none)') || keysColumn === '—') {
              effectMap[effectName] = [];
            } else {
              const keyMatches = [...keysColumn.matchAll(/`([a-zA-Z0-9_]+)`/g)].map((m) => m[1]);
              effectMap[effectName] = keyMatches;
            }
          }
        }
      }
      return effectMap;
    };

    const documentedEffects = parseEffectTable();

    it('documents every EffectType from EffectTypeSchema', () => {
      for (const effect of EffectTypeSchema.options) {
        expect(
          documentedEffects,
          `Effect ${effect} is missing from QUICK_REFERENCE.md effect table`,
        ).toHaveProperty(effect);
      }
      expect(Object.keys(documentedEffects).sort()).toEqual([...EffectTypeSchema.options].sort());
    });

    it('documents exactly the allowed effectParams keys for each EffectType', () => {
      for (const effect of EffectTypeSchema.options) {
        const expectedKeys = [...EFFECT_PARAM_KEYS[effect]].sort();
        const actualKeys = (documentedEffects[effect] ?? []).sort();
        expect(
          actualKeys,
          `Mismatched effectParams keys for effect ${effect} in QUICK_REFERENCE.md`,
        ).toEqual(expectedKeys);
      }
    });
  });

  describe('Step Gates & Result Facts (ADR-0080)', () => {
    const parseGateTable = (): Record<string, string> => {
      const gateMap: Record<string, string> = {};
      const sectionMatch = content.match(
        /## 3\. Canonical Step Gates & Result Facts[\s\S]*?(?=\n### Result Facts|$)/,
      );
      if (!sectionMatch) return gateMap;
      const lines = sectionMatch[0].split('\n');
      for (const line of lines) {
        if (!line.trim().startsWith('|')) continue;
        const columns = line.split(/(?<!\\)\|/).map((c) => c.trim());
        // columns[0] is empty before first |, columns[1] is Gate, columns[2] is Kind, columns[3] is Fields
        if (columns.length >= 4) {
          const gateMatch = columns[1].match(/^`([A-Z0-9_]+)`$/);
          if (gateMatch) {
            gateMap[gateMatch[1]] = columns[3];
          }
        }
      }
      return gateMap;
    };

    const documentedGates = parseGateTable();

    it('documents every StepGate from StepGateSchema in the step gates table', () => {
      for (const gate of StepGateSchema.options) {
        expect(
          documentedGates,
          `StepGate ${gate} is not in the Step Gates table of QUICK_REFERENCE.md`,
        ).toHaveProperty(gate);
      }
      expect(Object.keys(documentedGates).sort()).toEqual([...StepGateSchema.options].sort());
    });

    it('documents every field for each StepGate under its row in GATE_REGISTRY', () => {
      for (const gate of StepGateSchema.options) {
        const def = GATE_REGISTRY[gate];
        const rowText = documentedGates[gate] ?? '';
        for (const field of def.fields) {
          expect(
            rowText.includes(`\`${field.key}\``),
            `Gate parameter field '${field.key}' for gate ${gate} is not documented in its table row in QUICK_REFERENCE.md`,
          ).toBe(true);
        }
      }
    });

    it('documents every ResultFact from ResultFactSchema', () => {
      for (const fact of ResultFactSchema.options) {
        expect(
          content.includes(`\`${fact}\``),
          `ResultFact ${fact} is not documented in QUICK_REFERENCE.md`,
        ).toBe(true);
      }
    });
  });

  describe('Timings & Triggers', () => {
    it('documents every TimingType from TimingTypeSchema', () => {
      for (const timing of TimingTypeSchema.options) {
        expect(
          content.includes(`\`${timing}\``),
          `TimingType ${timing} is not documented in QUICK_REFERENCE.md`,
        ).toBe(true);
      }
    });

    it('documents every TriggerType from TriggerTypeSchema', () => {
      for (const trigger of TriggerTypeSchema.options) {
        expect(
          content.includes(`\`${trigger}\``),
          `TriggerType ${trigger} is not documented in QUICK_REFERENCE.md`,
        ).toBe(true);
      }
    });
  });

  describe('Target Selectors', () => {
    it('documents every TargetSelector from TargetSelectorSchema', () => {
      for (const selector of TargetSelectorSchema.options) {
        expect(
          content.includes(`\`${selector}\``),
          `TargetSelector ${selector} is not documented in QUICK_REFERENCE.md`,
        ).toBe(true);
      }
    });
  });
});
