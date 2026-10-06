import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { EffectTypeSchema } from '../../src/data/supplemental/schema';
import { EFFECT_PARAM_KEYS } from '../../src/data/supplemental/effect-params';

const PACK_DIR = path.resolve(__dirname, '../../src/data/supplemental/pack');
const PACK_FILES = ['core.json', 'core_encounter.json', 'cw_encounter.json'];

interface Violation {
  card: string;
  effect: string;
  key: string;
}

/**
 * Walks every object in a card (abilities, boost/reaction abilities, forEachPlayer,
 * nested PLAYER_CHOICE option steps, ...) and reports unknown effectParams keys.
 */
function findUnknownEffectParamKeys(card: unknown, cardCode: string): Violation[] {
  const violations: Violation[] = [];
  const effects = new Set<string>(EffectTypeSchema.options);
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (node === null || typeof node !== 'object') return;
    const obj = node as Record<string, unknown>;
    if (
      typeof obj.effect === 'string' &&
      effects.has(obj.effect) &&
      obj.effectParams &&
      typeof obj.effectParams === 'object'
    ) {
      const allowed = EFFECT_PARAM_KEYS[obj.effect as keyof typeof EFFECT_PARAM_KEYS];
      for (const key of Object.keys(obj.effectParams as object)) {
        if (!allowed.includes(key)) violations.push({ card: cardCode, effect: obj.effect, key });
      }
    }
    Object.values(obj).forEach(walk);
  };
  walk(card);
  return violations;
}

const format = (v: Violation[]) =>
  v.map((x) => `card ${x.card}: effect ${x.effect} has unknown effectParams key "${x.key}"`).join('\n');

function loadPack(file: string): Record<string, unknown>[] {
  const raw = JSON.parse(fs.readFileSync(path.join(PACK_DIR, file), 'utf8'));
  return Object.entries(raw.cards as Record<string, object>).map(([code, card]) => ({
    ...card,
    code,
  }));
}

describe('effectParams key guard (#230)', () => {
  for (const file of PACK_FILES) {
    it(`${file} uses only documented effectParams keys`, () => {
      const cards = loadPack(file);
      expect(cards.length).toBeGreaterThan(0);
      const violations = cards.flatMap((c) =>
        findUnknownEffectParamKeys(c, String((c as { code?: string }).code ?? '?')),
      );
      expect(violations, format(violations)).toEqual([]);
    });
  }

  it('table covers every EffectType', () => {
    for (const effect of EffectTypeSchema.options) {
      expect(Array.isArray(EFFECT_PARAM_KEYS[effect]), `Missing table entry: ${effect}`).toBe(true);
    }
    expect(Object.keys(EFFECT_PARAM_KEYS).sort()).toEqual([...EffectTypeSchema.options].sort());
  });

  it('rejects an unknown key and names card, effect and key', () => {
    const card = {
      code: '99999',
      abilities: [{ steps: [{ effect: 'DRAW', effectParams: { count: 1, bogusKey: 2 } }] }],
    };
    const v = findUnknownEffectParamKeys(card, '99999');
    expect(v).toEqual([{ card: '99999', effect: 'DRAW', key: 'bogusKey' }]);
    expect(format(v)).toContain('99999');
    expect(format(v)).toContain('DRAW');
    expect(format(v)).toContain('bogusKey');
  });

  it('checks nested PLAYER_CHOICE option steps', () => {
    const card = {
      code: '99998',
      abilities: [
        {
          steps: [
            {
              effect: 'PLAYER_CHOICE',
              effectParams: {
                options: [{ label: 'a', steps: [{ effect: 'DRAW', effectParams: { nope: 1 } }] }],
              },
            },
          ],
        },
      ],
    };
    const v = findUnknownEffectParamKeys(card, '99998');
    expect(v.map((x) => `${x.effect}.${x.key}`)).toEqual(['DRAW.nope']);
  });
});
